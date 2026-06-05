import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Holy Grills API",
        description:
          "Backend API for the Holy Grills student participation engine.",
        version: "0.1.0",
      },
      servers: [
        {
          url: env.API_BASE_URL,
          description:
            env.NODE_ENV === "production"
              ? "Production backend"
              : "Configured backend",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: [
        { name: "Health", description: "API and integration health checks" },
        {
          name: "Auth",
          description: "Registration, login, and current user identity",
        },
        {
          name: "Admin Users",
          description: "Admin-managed staff and student accounts",
        },
        {
          name: "Menu",
          description: "Menu browsing and admin menu management",
        },
        {
          name: "Cart",
          description: "Authenticated student cart management",
        },
        {
          name: "Checkout",
          description: "Order quotes and order placement workflows",
        },
        { name: "Orders", description: "Student and guest ordering workflows" },
        {
          name: "Delivery Windows",
          description: "Delivery window scheduling and admin controls",
        },
        {
          name: "Operating Hours",
          description: "Store operating status and admin-managed weekly schedule",
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
