import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../types/roles.js";

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  email: string;
};

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<AuthenticatedUser>();
    request.currentUser = {
      id: payload.id,
      role: payload.role,
      email: payload.email
    };
  } catch {
    return reply.unauthorized("Authentication required.");
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);

    if (reply.sent) {
      return;
    }

    if (!request.currentUser || !roles.includes(request.currentUser.role)) {
      return reply.forbidden("You do not have permission to access this resource.");
    }
  };
}

