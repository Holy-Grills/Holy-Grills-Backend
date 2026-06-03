import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../shared/http/auth.js";
import { authService } from "./auth.service.js";
import { googleOAuthService } from "./google-oauth.service.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  dob: z.string().optional(),
  faculty: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

const googleStartQuerySchema = z.object({
  redirectTo: z.string().url().optional()
});

const googleCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

const authResponseSchema = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string", example: "student" },
        createdAt: { type: "string", format: "date-time" }
      }
    },
    accessToken: { type: "string" },
    refreshToken: { type: "string" }
  }
} as const;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/google",
    {
      schema: {
        tags: ["Auth"],
        summary: "Start Google OAuth sign-in",
        querystring: {
          type: "object",
          properties: {
            redirectTo: {
              type: "string",
              format: "uri",
              description: "Frontend callback URL. Must match one of the configured frontend origins."
            }
          }
        },
        response: {
          302: {
            description: "Redirects to Google OAuth consent screen."
          }
        }
      }
    },
    async (request, reply) => {
      const query = googleStartQuerySchema.parse(request.query);
      const authorizationUrl = await googleOAuthService.createAuthorizationUrl(query.redirectTo);

      return reply.redirect(authorizationUrl);
    }
  );

  app.get(
    "/google/callback",
    {
      schema: {
        tags: ["Auth"],
        summary: "Complete Google OAuth sign-in",
        querystring: {
          type: "object",
          required: ["code", "state"],
          properties: {
            code: { type: "string" },
            state: { type: "string" }
          }
        },
        response: {
          302: {
            description: "Redirects to frontend callback URL with access and refresh tokens in the URL fragment."
          }
        }
      }
    },
    async (request, reply) => {
      const query = googleCallbackQuerySchema.parse(request.query);
      const result = await googleOAuthService.completeCallback(query.code, query.state);
      const accessToken = app.jwt.sign(result.user);
      const refreshResult = await authService.createSessionForUser(result.user.id);
      const redirectUrl = new URL(result.redirectTo);

      redirectUrl.hash = new URLSearchParams({
        accessToken,
        refreshToken: refreshResult.refreshToken
      }).toString();

      return reply.redirect(redirectUrl.toString());
    }
  );

  app.post(
    "/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Register a student account",
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            phone: { type: "string" },
            dob: { type: "string", format: "date" },
            faculty: { type: "string" }
          }
        },
        response: {
          201: authResponseSchema
        }
      }
    },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const result = await authService.register(input);
      const accessToken = app.jwt.sign(result.user);

      return reply.status(201).send({ ...result, accessToken });
    }
  );

  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" }
          }
        },
        response: {
          200: authResponseSchema
        }
      }
    },
    async (request) => {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);
      const accessToken = app.jwt.sign(result.user);

      return { ...result, accessToken };
    }
  );

  app.post(
    "/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Rotate a refresh token and issue a new access token",
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" }
          }
        },
        response: {
          200: authResponseSchema
        }
      }
    },
    async (request) => {
      const input = refreshTokenSchema.parse(request.body);
      const result = await authService.refreshSession(input.refreshToken);
      const accessToken = app.jwt.sign(result.user);

      return { ...result, accessToken };
    }
  );

  app.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" }
          }
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" }
            }
          }
        }
      }
    },
    async (request) => {
      const input = refreshTokenSchema.parse(request.body);

      return authService.logout(input.refreshToken);
    }
  );

  app.get(
    "/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["Auth"],
        summary: "Get the current authenticated user",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => ({
      user: request.currentUser
    })
  );
}
