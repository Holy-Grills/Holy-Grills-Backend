import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAdminAuditLog } from "../../shared/audit/admin-audit.js";
import { requireRole } from "../../shared/http/auth.js";
import { operatingHoursService } from "./operating-hours.service.js";

const operatingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isClosed: z.boolean().optional(),
  overrideMessage: z.string().max(240).nullable().optional()
});

const updateOperatingHoursSchema = z.object({
  hours: z.array(operatingHourSchema).min(1).max(7)
});

const operatingHourBodySchema = {
  type: "object",
  required: ["hours"],
  properties: {
    hours: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object",
        required: ["dayOfWeek", "opensAt", "closesAt"],
        properties: {
          dayOfWeek: {
            type: "integer",
            minimum: 0,
            maximum: 6,
            description: "0 is Sunday, 6 is Saturday"
          },
          opensAt: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$"
          },
          closesAt: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$"
          },
          isClosed: { type: "boolean", default: false },
          overrideMessage: {
            type: "string",
            nullable: true,
            maxLength: 240
          }
        }
      }
    }
  }
};

export async function operatingHoursRoutes(app: FastifyInstance): Promise<void> {
  app.get("/operating-hours/current", {
    schema: {
      tags: ["Operating Hours"],
      summary: "Get current operating status"
    }
  }, async () => {
    return operatingHoursService.getCurrentStatus();
  });

  app.get("/admin/operating-hours", {
    preHandler: requireRole("admin"),
    schema: {
      tags: ["Operating Hours"],
      summary: "List operating hours",
      security: [{ bearerAuth: [] }]
    }
  }, async () => {
    return operatingHoursService.listHours();
  });

  app.patch("/admin/operating-hours", {
    preHandler: requireRole("admin"),
    schema: {
      tags: ["Operating Hours"],
      summary: "Update operating hours",
      security: [{ bearerAuth: [] }],
      body: operatingHourBodySchema
    }
  }, async (request) => {
    const input = updateOperatingHoursSchema.parse(request.body);
    const result = await operatingHoursService.upsertHours(input.hours);

    await writeAdminAuditLog({
      adminId: request.currentUser!.id,
      action: "operating_hours.update",
      resourceType: "operating_hours",
      before: result.previous,
      after: result.hours,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });

    return result;
  });
}
