import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";

type CreateAuthenticatedOrderInput = {
  deliveryWindowId: string;
  deliveryAddress: string;
  notes?: string;
  idempotencyKey: string;
};

async function buildQuoteInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  deliveryWindowId: string
) {
  const now = new Date();
  const cart = await tx.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          menuItem: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!cart || cart.items.length === 0) {
    throw appErrors.badRequest("Cart is empty.", "CART_EMPTY");
  }

  const unavailableItem = cart.items.find(
    (item) => !item.menuItem.isAvailable || item.menuItem.archivedAt
  );

  if (unavailableItem) {
    throw appErrors.badRequest(
      `${unavailableItem.menuItem.name} is unavailable.`,
      "MENU_ITEM_UNAVAILABLE"
    );
  }

  const deliveryWindow = await tx.deliveryWindow.findFirst({
    where: {
      id: deliveryWindowId,
      status: { in: ["draft", "open"] },
      closesAt: { gt: now },
      OR: [
        { cutoffAt: null },
        { cutoffAt: { gt: now } }
      ]
    }
  });

  if (!deliveryWindow) {
    throw appErrors.badRequest(
      "Delivery window is unavailable or its cutoff has passed.",
      "DELIVERY_WINDOW_UNAVAILABLE"
    );
  }

  if (deliveryWindow.capacity !== null) {
    const reservedOrders = await tx.order.count({
      where: {
        deliveryWindowId,
        status: {
          notIn: ["cancelled", "refunded"]
        }
      }
    });

    if (reservedOrders >= deliveryWindow.capacity) {
      throw appErrors.conflict("Delivery window is full.", "DELIVERY_WINDOW_FULL");
    }
  }

  const items = cart.items.map((item) => ({
    cartItemId: item.id,
    menuItemId: item.menuItemId,
    name: item.menuItem.name,
    sku: item.menuItem.sku,
    quantity: item.quantity,
    unitPriceKobo: item.menuItem.priceKobo,
    subtotalKobo: item.menuItem.priceKobo * item.quantity,
    hpEarnValue: item.menuItem.hpEarnValue,
    hpEarnSubtotal: item.menuItem.hpEarnValue * item.quantity
  }));
  const subtotalKobo = items.reduce((sum, item) => sum + item.subtotalKobo, 0);
  const hpEarnPreview = items.reduce((sum, item) => sum + item.hpEarnSubtotal, 0);

  return {
    cartId: cart.id,
    deliveryWindow,
    items,
    subtotalKobo,
    totalKobo: subtotalKobo,
    hpEarnPreview,
    currency: "NGN"
  };
}

async function findExistingOrder(userId: string, idempotencyKey: string) {
  return prisma.order.findUnique({
    where: { idempotencyKey },
    include: {
      items: true,
      deliveryWindow: true,
      payments: {
        orderBy: { createdAt: "desc" }
      }
    }
  }).then((order) => {
    if (order && order.userId !== userId) {
      throw appErrors.conflict("Idempotency key is already in use.", "IDEMPOTENCY_KEY_IN_USE");
    }

    return order;
  });
}

export const checkoutService = {
  async quote(userId: string, deliveryWindowId: string) {
    const quote = await prisma.$transaction(
      (tx) => buildQuoteInTransaction(tx, userId, deliveryWindowId),
      {
        maxWait: 10_000,
        timeout: 20_000
      }
    );

    return { quote };
  },

  async createAuthenticatedOrder(userId: string, input: CreateAuthenticatedOrderInput) {
    const existingOrder = await findExistingOrder(userId, input.idempotencyKey);

    if (existingOrder) {
      return { order: existingOrder, idempotentReplay: true };
    }

    try {
      const order = await prisma.$transaction(
        async (tx) => {
          const quote = await buildQuoteInTransaction(tx, userId, input.deliveryWindowId);
          const orderNumber = `HG-${nanoid(8).toUpperCase()}`;
          const providerReference = `HG-PAY-${nanoid(18).toUpperCase()}`;

          const createdOrder = await tx.order.create({
            data: {
              orderNumber,
              userId,
              status: "payment_pending",
              paymentStatus: "initiated",
              paymentMethod: "card",
              paymentRef: providerReference,
              idempotencyKey: input.idempotencyKey,
              deliveryWindowId: quote.deliveryWindow.id,
              deliveryAddress: input.deliveryAddress,
              notes: input.notes,
              totalKobo: quote.totalKobo,
              items: {
                create: quote.items.map((item) => ({
                  menuItemId: item.menuItemId,
                  itemNameSnapshot: item.name,
                  quantity: item.quantity,
                  unitPriceKobo: item.unitPriceKobo,
                  subtotalKobo: item.subtotalKobo
                }))
              },
              statusHistory: {
                create: {
                  status: "payment_pending",
                  actorUserId: userId,
                  note: "Order created and awaiting Paystack payment initialization."
                }
              },
              payments: {
                create: {
                  provider: "paystack",
                  providerReference,
                  status: "initiated",
                  amountKobo: quote.totalKobo,
                  currency: quote.currency,
                  metadata: {
                    userId,
                    orderNumber,
                    integrationStatus: "awaiting_paystack_initialization"
                  }
                }
              }
            },
            include: {
              items: true,
              deliveryWindow: true,
              payments: true
            }
          });

          await tx.cartItem.deleteMany({
            where: { cartId: quote.cartId }
          });

          return createdOrder;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 30_000
        }
      );

      return { order, idempotentReplay: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const replayedOrder = await findExistingOrder(userId, input.idempotencyKey);

        if (replayedOrder) {
          return { order: replayedOrder, idempotentReplay: true };
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw appErrors.conflict(
          "Checkout changed while the order was being created. Retry with the same idempotency key.",
          "CHECKOUT_TRANSACTION_CONFLICT"
        );
      }

      throw error;
    }
  }
};
