import { buildApp } from "./app.js";
import { env } from "./shared/config/env.js";
import { logger } from "./shared/logger/logger.js";
import { closeRedisClient } from "./shared/redis/redis-client.js";

const app = await buildApp();

const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down api");
  await closeRedisClient();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info({ host: env.HOST, port: env.PORT }, "holy grills api listening");
} catch (error) {
  logger.error({ error }, "failed to start api");
  process.exit(1);
}
