import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../shared/http/auth.js";
import { orderService } from "./order.service.js";

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
  )
});

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", {
    preHandler: requireAuth,
    schema: {
      tags: ["Orders"],
      summary: "List current user's orders",
      security: [{ bearerAuth: [] }]
    }
  }, async (request) => {
    return orderService.listOrdersForUser(request.currentUser!.id);
  });

  app.post("/guest", {
    schema: {
      tags: ["Orders"],
      summary: "Create a guest food order",
      description: "Guest checkout is food-only and card-only. Guests cannot use wallet, HP, rewards, marketplace, or events.",
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

  app.patch("/:id/delivered", {
    preHandler: requireRole("rider", "admin"),
    schema: {
      tags: ["Orders"],
      summary: "Mark an order delivered",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    return orderService.markDelivered(params.id, request.currentUser!);
  });
}
