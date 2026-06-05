import { Prisma, type PaymentStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";
import { paystackClient } from "./paystack.client.js";

type PaystackWebhookEvent = {
  event: string;
  data?: {
    id?: number;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
  };
};

const paymentInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      paymentStatus: true,
      totalKobo: true
    }
  }
} as const;

function mapPaystackStatus(status: string): PaymentStatus {
  if (status === "success") return "successful";
  if (status === "failed") return "failed";
  if (status === "abandoned") return "abandoned";
  if (status === "reversed") return "refunded";

  return "pending";
}

async function getOwnedPayment(userId: string, orderId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      order: { userId }
    },
    include: paymentInclude,
    orderBy: { createdAt: "desc" }
  });

  if (!payment) {
    throw appErrors.notFound("Payment not found.", "PAYMENT_NOT_FOUND");
  }

  return payment;
}

export const paymentService = {
  async initializeOrderPayment(userId: string, orderId: string) {
    const payment = await getOwnedPayment(userId, orderId);

    if (payment.status === "successful") {
      throw appErrors.conflict("Order is already paid.", "ORDER_ALREADY_PAID");
    }

    if (payment.authorizationUrl && payment.accessCode) {
      return { payment, idempotentReplay: true };
    }

    if (payment.order.status !== "payment_pending") {
      throw appErrors.conflict(
        "Only payment-pending orders can initialize payment.",
        "ORDER_NOT_PAYMENT_PENDING"
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      throw appErrors.notFound("User not found.", "USER_NOT_FOUND");
    }

    const initialized = await paystackClient.initializeTransaction({
      email: user.email,
      amountKobo: payment.amountKobo,
      reference: payment.providerReference,
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber
    });

    if (
      !initialized.status
      || initialized.data.reference !== payment.providerReference
      || !initialized.data.authorization_url
      || !initialized.data.access_code
    ) {
      throw appErrors.badGateway(
        "Paystack returned an invalid initialization response.",
        "PAYSTACK_INVALID_RESPONSE"
      );
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "pending",
        authorizationUrl: initialized.data.authorization_url,
        accessCode: initialized.data.access_code,
        metadata: {
          initializationMessage: initialized.message
        }
      },
      include: paymentInclude
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: "pending" }
    });

    return { payment: updatedPayment, idempotentReplay: false };
  },

  async getOrderPayment(userId: string, orderId: string) {
    const payment = await getOwnedPayment(userId, orderId);

    return { payment };
  },

  async processPaystackWebhook(payload: PaystackWebhookEvent, signature: string | undefined) {
    const signatureVerified = paystackClient.verifyWebhookSignature(payload, signature);
    const reference = payload.data?.reference;
    const providerEventId = reference ? `${payload.event}:${reference}` : null;

    if (!signatureVerified) {
      await prisma.paymentEvent.create({
        data: {
          provider: "paystack",
          providerEventId,
          eventType: payload.event || "unknown",
          signatureVerified: false,
          payload: payload as Prisma.InputJsonValue
        }
      }).catch(() => undefined);

      throw appErrors.unauthorized(
        "Paystack webhook signature is invalid.",
        "INVALID_PAYSTACK_SIGNATURE"
      );
    }

    if (!reference) {
      throw appErrors.badRequest(
        "Paystack webhook reference is missing.",
        "PAYSTACK_REFERENCE_MISSING"
      );
    }

    const payment = await prisma.payment.findUnique({
      where: {
        provider_providerReference: {
          provider: "paystack",
          providerReference: reference
        }
      },
      include: paymentInclude
    });

    if (!payment) {
      throw appErrors.notFound("Payment reference not found.", "PAYMENT_NOT_FOUND");
    }

    const existingEvent = await prisma.paymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: "paystack",
          providerEventId: providerEventId!
        }
      }
    });

    if (existingEvent?.processedAt) {
      return { accepted: true, duplicate: true };
    }

    if (payload.event !== "charge.success") {
      await prisma.paymentEvent.upsert({
        where: {
          provider_providerEventId: {
            provider: "paystack",
            providerEventId: providerEventId!
          }
        },
        create: {
          paymentId: payment.id,
          provider: "paystack",
          providerEventId,
          eventType: payload.event,
          signatureVerified: true,
          processedAt: new Date(),
          payload: payload as Prisma.InputJsonValue
        },
        update: {
          paymentId: payment.id,
          signatureVerified: true,
          processedAt: new Date(),
          payload: payload as Prisma.InputJsonValue
        }
      });

      return { accepted: true, duplicate: false };
    }

    const verified = await paystackClient.verifyTransaction(reference);

    if (
      !verified.status
      || verified.data.reference !== payment.providerReference
      || verified.data.amount !== payment.amountKobo
      || verified.data.currency !== payment.currency
    ) {
      throw appErrors.badRequest(
        "Paystack verification did not match the expected payment.",
        "PAYSTACK_VERIFICATION_MISMATCH"
      );
    }

    const paymentStatus = mapPaystackStatus(verified.data.status);

    try {
      await prisma.$transaction(async (tx) => {
        const event = existingEvent
          ? await tx.paymentEvent.update({
              where: { id: existingEvent.id },
              data: {
                paymentId: payment.id,
                signatureVerified: true,
                payload: payload as Prisma.InputJsonValue
              }
            })
          : await tx.paymentEvent.create({
              data: {
                paymentId: payment.id,
                provider: "paystack",
                providerEventId,
                eventType: payload.event,
                signatureVerified: true,
                payload: payload as Prisma.InputJsonValue
              }
            });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: paymentStatus,
            metadata: verified.data as Prisma.InputJsonValue
          }
        });

        if (paymentStatus === "successful" && payment.order.status === "payment_pending") {
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: "received",
              paymentStatus: "successful",
              statusHistory: {
                create: {
                  status: "received",
                  note: "Paystack payment verified successfully."
                }
              }
            }
          });
        } else if (paymentStatus !== "successful") {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus }
          });
        }

        await tx.paymentEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() }
        });
      }, {
        maxWait: 10_000,
        timeout: 30_000
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { accepted: true, duplicate: true };
      }

      throw error;
    }

    return { accepted: true, duplicate: false };
  }
};
