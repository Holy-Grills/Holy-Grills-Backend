import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../shared/http/auth.js";
import { orderService } from "../orders/order.service.js";
import { checkoutService } from "./checkout.service.js";

const quoteSchema = z.object({
  deliveryWindowId: z.string().uuid()
});

const createOrderSchema = z.object({
  deliveryWindowId: z.string().uuid(),
  deliveryAddress: z.string().min(3),
  notes: z.string().max(500).optional(),
  paymentMethod: z.literal("card").default("card"),
  idempotencyKey: z.string().min(16).max(128)
});

const createGuestOrderSchema = z.object({
  guestName: z.string().min(2),
  guestPhone: z.string().min(7),
  guestEmail: z.string().email().optional(),
  deliveryAddress: z.string().min(3),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive()
    })
  ).min(1)
});

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post("/quote", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Checkout"],
      summary: "Quote the current student's cart",
      description: "Validates cart availability and the selected delivery window, then calculates current DB-backed totals and HP preview.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["deliveryWindowId"],
        properties: {
          deliveryWindowId: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request) => {
    const input = quoteSchema.parse(request.body);

    return checkoutService.quote(request.currentUser!.id, input.deliveryWindowId);
  });

  app.post("/order", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Checkout"],
      summary: "Create an authenticated student's order",
      description: "Creates a payment_pending card order and Paystack-ready payment record. External Paystack initialization is not yet implemented.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["deliveryWindowId", "deliveryAddress", "idempotencyKey"],
        properties: {
          deliveryWindowId: { type: "string", format: "uuid" },
          deliveryAddress: { type: "string", minLength: 3 },
          notes: { type: "string", maxLength: 500 },
          paymentMethod: { type: "string", enum: ["card"], default: "card" },
          idempotencyKey: {
            type: "string",
            minLength: 16,
            maxLength: 128,
            description: "Client-generated unique key reused when retrying the same order request."
          }
        }
      }
    }
  }, async (request, reply) => {
    const input = createOrderSchema.parse(request.body);
    const result = await checkoutService.createAuthenticatedOrder(request.currentUser!.id, input);

    return reply.status(result.idempotentReplay ? 200 : 201).send(result);
  });

  app.post("/guest-order", {
    schema: {
      tags: ["Checkout"],
      summary: "Create a pending guest food order",
      description: "Creates a card-only guest order in payment_pending state. Payment initiation is not yet implemented.",
      body: {
        type: "object",
        required: ["guestName", "guestPhone", "deliveryAddress", "items"],
        properties: {
          guestName: { type: "string", minLength: 2 },
          guestPhone: { type: "string", minLength: 7 },
          guestEmail: { type: "string", format: "email" },
          deliveryAddress: { type: "string", minLength: 3 },
          notes: { type: "string" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["menuItemId", "quantity"],
              properties: {
                menuItemId: { type: "string", format: "uuid" },
                quantity: { type: "integer", minimum: 1 }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const input = createGuestOrderSchema.parse(request.body);
    const order = await orderService.createGuestOrder(input);

    return reply.status(201).send(order);
  });
}
