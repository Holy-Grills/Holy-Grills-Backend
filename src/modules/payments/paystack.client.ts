import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../shared/config/env.js";
import { appErrors } from "../../shared/errors/app-error.js";

const paystackBaseUrl = "https://api.paystack.co";

type PaystackInitializeInput = {
  email: string;
  amountKobo: number;
  reference: string;
  orderId: string;
  orderNumber: string;
};

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string | null;
    gateway_response?: string;
  };
};

function requireSecretKey(): string {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw appErrors.serviceUnavailable(
      "Paystack is not configured.",
      "PAYSTACK_NOT_CONFIGURED"
    );
  }

  return env.PAYSTACK_SECRET_KEY;
}

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${paystackBaseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${requireSecretKey()}`,
        "Content-Type": "application/json",
        ...init?.headers
      }
    });
    const body = await response.json() as T & { message?: string };

    if (!response.ok) {
      throw appErrors.badGateway(
        body.message ?? "Paystack request failed.",
        "PAYSTACK_REQUEST_FAILED"
      );
    }

    return body;
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw appErrors.badGateway(
      "Paystack could not be reached.",
      "PAYSTACK_UNAVAILABLE"
    );
  }
}

export const paystackClient = {
  async initializeTransaction(input: PaystackInitializeInput) {
    return paystackRequest<PaystackInitializeResponse>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amountKobo),
        currency: "NGN",
        reference: input.reference,
        callback_url: env.PAYSTACK_CALLBACK_URL,
        metadata: {
          orderId: input.orderId,
          orderNumber: input.orderNumber
        }
      })
    });
  },

  async verifyTransaction(reference: string) {
    return paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
  },

  verifyWebhookSignature(payload: unknown, signature: string | undefined) {
    if (!signature || !env.PAYSTACK_SECRET_KEY) {
      return false;
    }

    const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    return expectedBuffer.length === signatureBuffer.length
      && timingSafeEqual(expectedBuffer, signatureBuffer);
  }
};
