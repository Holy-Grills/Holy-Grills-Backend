import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAdminAuditLog } from "../../shared/audit/admin-audit.js";
import { requireRole } from "../../shared/http/auth.js";
import { menuService } from "./menu.service.js";

const createCategorySchema = z.object({
  name: z.string().min(2),
  sortOrder: z.number().int().optional()
});

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
  app.get("/categories", {
    schema: {
      tags: ["Menu"],
      summary: "List menu categories"
    }
  }, async () => {
    return menuService.listCategories();
  });

  app.post("/categories", {
    preHandler: requireRole("admin"),
    schema: {
      tags: ["Menu"],
      summary: "Create a menu category",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 2 },
          sortOrder: { type: "integer" }
        }
      }
    }
  }, async (request, reply) => {
    const input = createCategorySchema.parse(request.body);
    const result = await menuService.createCategory(input);

    await writeAdminAuditLog({
      adminId: request.currentUser!.id,
      action: "menu_category.create",
      resourceType: "menu_category",
      resourceId: result.category.id,
      after: result.category,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    return reply.status(201).send(result);
  });

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

  app.get("/:id", {
    schema: {
      tags: ["Menu"],
      summary: "Get a menu item",
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

    return menuService.getMenuItem(params.id);
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
    const result = await menuService.createMenuItem(input);

    await writeAdminAuditLog({
      adminId: request.currentUser!.id,
      action: "menu_item.create",
      resourceType: "menu_item",
      resourceId: result.item.id,
      after: result.item,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    return reply.status(201).send(result);
  });
}
