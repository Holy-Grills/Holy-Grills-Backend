import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAdminAuditLog } from "../../shared/audit/admin-audit.js";
import { requireRole } from "../../shared/http/auth.js";
import { deliveryWindowService } from "./delivery-windows.service.js";

const deliveryWindowStatuses = [
  "draft",
  "open",
  "closed",
  "batching",
  "batched",
  "in_delivery",
  "completed",
  "cancelled",
] as const;

const createWindowSchema = z.object({
  label: z.string().min(2),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  cutoffAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

const updateWindowSchema = z.object({
  label: z.string().min(2).optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  cutoffAt: z.string().datetime().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

const listWindowQuerySchema = z.object({
  status: z.enum(deliveryWindowStatuses).optional(),
});

export async function deliveryWindowRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/delivery-windows/current",
    {
      schema: {
        tags: ["Delivery Windows"],
        summary: "Get the currently open delivery window",
      },
    },
    async () => {
      return deliveryWindowService.getCurrentWindow();
    },
  );

  app.get(
    "/delivery-windows/next",
    {
      schema: {
        tags: ["Delivery Windows"],
        summary: "Get the next delivery window",
      },
    },
    async () => {
      return deliveryWindowService.getNextWindow();
    },
  );

  app.get(
    "/admin/delivery-windows",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Delivery Windows"],
        summary: "List delivery windows",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: deliveryWindowStatuses },
          },
        },
      },
    },
    async (request) => {
      const query = listWindowQuerySchema.parse(request.query);
      return deliveryWindowService.listAdminWindows(query);
    },
  );

  app.post(
    "/admin/delivery-windows",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Delivery Windows"],
        summary: "Create a delivery window",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["label", "opensAt", "closesAt"],
          properties: {
            label: { type: "string", minLength: 2 },
            opensAt: { type: "string", format: "date-time" },
            closesAt: { type: "string", format: "date-time" },
            cutoffAt: { type: "string", format: "date-time", nullable: true },
            capacity: { type: "integer", minimum: 1, nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const input = createWindowSchema.parse(request.body);
      const result = await deliveryWindowService.createWindow(
        input,
        request.currentUser!.id,
      );

      await writeAdminAuditLog({
        adminId: request.currentUser!.id,
        action: "delivery_window.create",
        resourceType: "delivery_window",
        resourceId: result.window.id,
        after: result.window,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return reply.status(201).send(result);
    },
  );

  app.patch(
    "/admin/delivery-windows/:id",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Delivery Windows"],
        summary: "Update a delivery window",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            label: { type: "string", minLength: 2 },
            opensAt: { type: "string", format: "date-time" },
            closesAt: { type: "string", format: "date-time" },
            cutoffAt: { type: "string", format: "date-time", nullable: true },
            capacity: { type: "integer", minimum: 1, nullable: true },
          },
        },
      },
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const input = updateWindowSchema.parse(request.body);
      const result = await deliveryWindowService.updateWindow(params.id, input);

      await writeAdminAuditLog({
        adminId: request.currentUser!.id,
        action: "delivery_window.update",
        resourceType: "delivery_window",
        resourceId: result.window.id,
        before: result.previous,
        after: result.window,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return result;
    },
  );

  app.post(
    "/admin/delivery-windows/:id/open",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Delivery Windows"],
        summary: "Open a delivery window",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await deliveryWindowService.openWindow(params.id);

      await writeAdminAuditLog({
        adminId: request.currentUser!.id,
        action: "delivery_window.open",
        resourceType: "delivery_window",
        resourceId: result.window.id,
        before: result.previous,
        after: result.window,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return result;
    },
  );

  app.post(
    "/admin/delivery-windows/:id/close",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Delivery Windows"],
        summary: "Close a delivery window",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const result = await deliveryWindowService.closeWindow(params.id);

      await writeAdminAuditLog({
        adminId: request.currentUser!.id,
        action: "delivery_window.close",
        resourceType: "delivery_window",
        resourceId: result.window.id,
        before: result.previous,
        after: result.window,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return result;
    },
  );
}
