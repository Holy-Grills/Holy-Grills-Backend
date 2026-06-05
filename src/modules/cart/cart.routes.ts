import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../shared/http/auth.js";
import { cartService } from "./cart.service.js";

const addCartItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().max(99)
});

const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(99)
});

const itemParamsSchema = z.object({
  id: z.string().uuid()
});

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cart", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Cart"],
      summary: "Get the current student's cart",
      security: [{ bearerAuth: [] }]
    }
  }, async (request) => {
    return cartService.getCart(request.currentUser!.id);
  });

  app.post("/cart/items", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Cart"],
      summary: "Add a menu item to the current student's cart",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["menuItemId", "quantity"],
        properties: {
          menuItemId: { type: "string", format: "uuid" },
          quantity: { type: "integer", minimum: 1, maximum: 99 }
        }
      }
    }
  }, async (request, reply) => {
    const input = addCartItemSchema.parse(request.body);
    const result = await cartService.addItem(request.currentUser!.id, input.menuItemId, input.quantity);

    return reply.status(201).send(result);
  });

  app.patch("/cart/items/:id", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Cart"],
      summary: "Update a cart item quantity",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", format: "uuid" }
        }
      },
      body: {
        type: "object",
        required: ["quantity"],
        properties: {
          quantity: { type: "integer", minimum: 1, maximum: 99 }
        }
      }
    }
  }, async (request) => {
    const params = itemParamsSchema.parse(request.params);
    const input = updateCartItemSchema.parse(request.body);

    return cartService.updateItem(request.currentUser!.id, params.id, input.quantity);
  });

  app.delete("/cart/items/:id", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Cart"],
      summary: "Remove an item from the current student's cart",
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
    const params = itemParamsSchema.parse(request.params);

    return cartService.removeItem(request.currentUser!.id, params.id);
  });
}
