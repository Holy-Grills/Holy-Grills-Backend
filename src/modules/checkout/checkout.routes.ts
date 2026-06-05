import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { orderService } from "../orders/order.service.js";

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
