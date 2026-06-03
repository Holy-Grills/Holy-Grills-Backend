import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import { corsOrigins, env } from "./shared/config/env.js";
import { registerRoutes } from "./routes.js";
import { registerSwagger } from "./shared/docs/swagger.js";
import { errorHandler } from "./shared/http/error-handler.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "warn" : "info"
    }
  });

  await app.register(sensible);
  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET
  });
  await registerSwagger(app);

  app.setErrorHandler(errorHandler);

  await registerRoutes(app);

  return app;
}
