import type { FastifyInstance } from "fastify";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { menuRoutes } from "./modules/menu/menu.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes, { prefix: "/api/v1/health" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(menuRoutes, { prefix: "/api/v1/menu" });
  await app.register(orderRoutes, { prefix: "/api/v1/orders" });
}

