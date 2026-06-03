import type { FastifyInstance } from "fastify";
import { getRedisClient } from "../../shared/redis/redis-client.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Check API health",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              service: { type: "string", example: "holy-grills-backend" },
              timestamp: { type: "string", format: "date-time" }
            }
          }
        }
      }
    },
    async () => ({
      status: "ok",
      service: "holy-grills-backend",
      timestamp: new Date().toISOString()
    })
  );

  app.get("/redis", {
    schema: {
      tags: ["Health"],
      summary: "Check Redis connectivity",
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            redis: { type: "string", example: "PONG" },
            latencyMs: { type: "number", example: 120 },
            timestamp: { type: "string", format: "date-time" }
          }
        },
        503: {
          type: "object",
          properties: {
            status: { type: "string", example: "unavailable" },
            service: { type: "string", example: "redis" },
            timestamp: { type: "string", format: "date-time" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const redis = getRedisClient();

    try {
      if (redis.status === "end" || redis.status === "close") {
        await redis.connect();
      }

      const startedAt = Date.now();
      const result = await redis.ping();

      return {
        status: result === "PONG" ? "ok" : "degraded",
        redis: result,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString()
      };
    } catch {
      return reply.status(503).send({
        status: "unavailable",
        service: "redis",
        timestamp: new Date().toISOString()
      });
    }
  });
}
