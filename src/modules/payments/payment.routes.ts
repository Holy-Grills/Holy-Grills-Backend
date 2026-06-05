import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../shared/http/auth.js";
import { paymentService } from "./payment.service.js";

const orderParamsSchema = z.object({
  orderId: z.string().uuid()
});

const webhookSchema = z.object({
  event: z.string().min(1),
  data: z.object({
    id: z.number().optional(),
    status: z.string().optional(),
    reference: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional()
  }).passthrough().optional()
}).passthrough();

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/payments/orders/:orderId/initialize", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Payments"],
      summary: "Initialize Paystack payment for an order",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["orderId"],
        properties: {
          orderId: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request) => {
    const params = orderParamsSchema.parse(request.params);

    return paymentService.initializeOrderPayment(request.currentUser!.id, params.orderId);
  });

  app.get("/payments/orders/:orderId", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Payments"],
      summary: "Get payment status for an order",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["orderId"],
        properties: {
          orderId: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request) => {
    const params = orderParamsSchema.parse(request.params);

    return paymentService.getOrderPayment(request.currentUser!.id, params.orderId);
  });

  app.post("/webhooks/paystack", {
    config: {
      rateLimit: false
    },
    schema: {
      tags: ["Payments"],
      summary: "Receive signed Paystack webhook events"
    }
  }, async (request) => {
    const payload = webhookSchema.parse(request.body);
    const signatureHeader = request.headers["x-paystack-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    return paymentService.processPaystackWebhook(payload, signature);
  });
}
