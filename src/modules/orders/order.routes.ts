import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../shared/http/auth.js";
import { orderService } from "./order.service.js";

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.get("/orders", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Orders"],
      summary: "List current user's orders",
      security: [{ bearerAuth: [] }]
    }
  }, async (request) => {
    return orderService.listOrdersForUser(request.currentUser!.id);
  });

  app.get("/orders/:id", {
    preHandler: requireRole("student"),
    schema: {
      tags: ["Orders"],
      summary: "Get one of the current student's orders",
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

    return orderService.getOrderForUser(request.currentUser!.id, params.id);
  });

  app.patch("/orders/:id/delivered", {
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
