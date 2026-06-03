import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null
    });
  }

  return redisClient;
}

export function getRedisConnectionOptions(): RedisOptions {
  const url = new URL(env.REDIS_URL);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: decodeURIComponent(url.username || "default"),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null
  };
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
