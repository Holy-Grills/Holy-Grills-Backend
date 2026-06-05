import { adminUsersRoutes } from "./modules/admin/users.routes.js";
import type { FastifyInstance } from "fastify";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { cartRoutes } from "./modules/cart/cart.routes.js";
import { checkoutRoutes } from "./modules/checkout/checkout.routes.js";
import { deliveryWindowRoutes } from "./modules/delivery-windows/delivery-windows.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { menuRoutes } from "./modules/menu/menu.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { operatingHoursRoutes } from "./modules/operating-hours/operating-hours.routes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes, { prefix: "/api/v1/health" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(adminUsersRoutes, { prefix: "/api/v1/admin/users" });
  await app.register(menuRoutes, { prefix: "/api/v1" });
  await app.register(cartRoutes, { prefix: "/api/v1" });
  await app.register(checkoutRoutes, { prefix: "/api/v1/checkout" });
  await app.register(orderRoutes, { prefix: "/api/v1" });
  await app.register(deliveryWindowRoutes, { prefix: "/api/v1" });
  await app.register(operatingHoursRoutes, { prefix: "/api/v1" });
}
