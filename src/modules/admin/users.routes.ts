import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAdminAuditLog } from "../../shared/audit/admin-audit.js";
import { requireRole } from "../../shared/http/auth.js";
import { userRoles } from "../../shared/types/roles.js";
import { adminUsersService } from "./users.service.js";

const listUsersQuerySchema = z.object({
  role: z.enum(userRoles).optional(),
  search: z.string().optional()
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(userRoles),
  phone: z.string().optional(),
  faculty: z.string().optional()
});

export async function adminUsersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Admin Users"],
        summary: "List users",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            role: { type: "string", enum: userRoles },
            search: { type: "string" }
          }
        }
      }
    },
    async (request) => {
      const query = listUsersQuerySchema.parse(request.query);

      return adminUsersService.listUsers(query);
    }
  );

  app.post(
    "/",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["Admin Users"],
        summary: "Create a staff or student account",
        description: "Admin-created accounts are email-verified immediately and can be assigned student, kitchen, rider, or admin roles.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "email", "password", "role"],
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            role: { type: "string", enum: userRoles },
            phone: { type: "string" },
            faculty: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      const input = createUserSchema.parse(request.body);
      const result = await adminUsersService.createUser(input);

      await writeAdminAuditLog({
        adminId: request.currentUser!.id,
        action: "user.create",
        resourceType: "user",
        resourceId: result.user.id,
        after: result.user,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      });

      return reply.status(201).send(result);
    }
  );
}

