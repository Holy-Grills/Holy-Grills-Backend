import { nanoid } from "nanoid";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";
import type { AuthenticatedUser } from "../../shared/http/auth.js";

type CreateGuestOrderInput = {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  deliveryAddress: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
  }>;
};

export const orderService = {
  async listOrdersForUser(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: true }
    });

    return { orders };
  },

  async getOrderForUser(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        items: true,
        deliveryWindow: true,
        statusHistory: {
          orderBy: { createdAt: "asc" }
        },
        payments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!order) {
      throw appErrors.notFound("Order not found.", "ORDER_NOT_FOUND");
    }

    return { order };
  },

  async createGuestOrder(input: CreateGuestOrderInput) {
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: input.items.map((item) => item.menuItemId) },
        isAvailable: true,
        archivedAt: null
      }
    });

    const menuById = new Map(menuItems.map((item) => [item.id, item]));
    const orderItems = input.items.map((item) => {
      const menuItem = menuById.get(item.menuItemId);

      if (!menuItem) {
        throw appErrors.badRequest(`Menu item ${item.menuItemId} is unavailable.`, "MENU_ITEM_UNAVAILABLE");
      }

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPriceKobo: menuItem.priceKobo,
        subtotalKobo: menuItem.priceKobo * item.quantity,
        itemNameSnapshot: menuItem.name
      };
    });

    const totalKobo = orderItems.reduce((sum, item) => sum + item.subtotalKobo, 0);

    const order = await prisma.order.create({
      data: {
        orderNumber: `HG-${nanoid(8).toUpperCase()}`,
        userId: null,
        status: "payment_pending",
        paymentStatus: "pending",
        paymentMethod: "card",
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes,
        totalKobo,
        secureTrackingToken: nanoid(32),
        items: {
          create: orderItems
        },
        statusHistory: {
          create: {
            status: "payment_pending",
            note: "Guest order created and awaiting card payment."
          }
        }
      },
      include: { items: true }
    });

    return { order };
  },

  async markDelivered(orderId: string, actor: AuthenticatedUser) {
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "delivered",
          deliveredAt: new Date(),
          statusHistory: {
            create: {
              status: "delivered",
              actorUserId: actor.id,
              note: "Order marked delivered."
            }
          }
        }
      });

      return updated;
    });

    return { order };
  }
};
