import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../shared/http/auth.js";
import { menuService } from "./menu.service.js";

const createMenuItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(1),
  price: z.number().positive(),
  categoryId: z.string().uuid(),
  photoUrl: z.string().url().optional(),
  hpEarnValue: z.number().int().nonnegative(),
  sku: z.string().min(2),
  dietaryTags: z.array(z.string()).default([])
});

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", {
    schema: {
      tags: ["Menu"],
      summary: "List available menu items",
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "string", format: "uuid" },
          search: { type: "string" }
        }
      }
    }
  }, async (request) => {
    const query = z
      .object({
        categoryId: z.string().uuid().optional(),
        search: z.string().optional()
      })
      .parse(request.query);

    return menuService.listMenuItems(query);
  });

  app.post("/items", {
    preHandler: requireRole("admin"),
    schema: {
      tags: ["Menu"],
      summary: "Create a menu item",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name", "description", "price", "categoryId", "hpEarnValue", "sku"],
        properties: {
          name: { type: "string", minLength: 2 },
          description: { type: "string" },
          price: { type: "number", minimum: 1 },
          categoryId: { type: "string", format: "uuid" },
          photoUrl: { type: "string", format: "uri" },
          hpEarnValue: { type: "integer", minimum: 0 },
          sku: { type: "string" },
          dietaryTags: {
            type: "array",
            items: { type: "string" },
            default: []
          }
        }
      }
    }
  }, async (request, reply) => {
    const input = createMenuItemSchema.parse(request.body);
    const item = await menuService.createMenuItem(input);
    return reply.status(201).send(item);
  });
}
