import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";

const cartInclude = {
  items: {
    include: {
      menuItem: {
        include: {
          category: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  }
} as const;

function serializeCart(cart: Awaited<ReturnType<typeof findOrCreateCart>>) {
  const items = cart.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    subtotalKobo: item.menuItem.priceKobo * item.quantity,
    menuItem: item.menuItem
  }));

  return {
    id: cart.id,
    userId: cart.userId,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalKobo: items.reduce((sum, item) => sum + item.subtotalKobo, 0),
    updatedAt: cart.updatedAt
  };
}

async function findOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: cartInclude
  });
}

async function getCartForUser(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude
  });

  if (!cart) {
    return findOrCreateCart(userId);
  }

  return cart;
}

export const cartService = {
  async getCart(userId: string) {
    const cart = await getCartForUser(userId);

    return { cart: serializeCart(cart) };
  },

  async addItem(userId: string, menuItemId: string, quantity: number) {
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: menuItemId,
        isAvailable: true,
        archivedAt: null
      },
      select: { id: true }
    });

    if (!menuItem) {
      throw appErrors.badRequest("Menu item is unavailable.", "MENU_ITEM_UNAVAILABLE");
    }

    const cart = await findOrCreateCart(userId);
    const existingItem = cart.items.find((item) => item.menuItemId === menuItemId);

    if ((existingItem?.quantity ?? 0) + quantity > 99) {
      throw appErrors.badRequest("Cart item quantity cannot exceed 99.", "CART_ITEM_QUANTITY_LIMIT");
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_menuItemId: {
          cartId: cart.id,
          menuItemId
        }
      },
      create: {
        cartId: cart.id,
        menuItemId,
        quantity
      },
      update: {
        quantity: {
          increment: quantity
        }
      }
    });

    return this.getCart(userId);
  },

  async updateItem(userId: string, itemId: string, quantity: number) {
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId }
      },
      include: {
        menuItem: {
          select: {
            isAvailable: true,
            archivedAt: true
          }
        }
      }
    });

    if (!item) {
      throw appErrors.notFound("Cart item not found.", "CART_ITEM_NOT_FOUND");
    }

    if (!item.menuItem.isAvailable || item.menuItem.archivedAt) {
      throw appErrors.badRequest("Menu item is unavailable.", "MENU_ITEM_UNAVAILABLE");
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity }
    });

    return this.getCart(userId);
  },

  async removeItem(userId: string, itemId: string) {
    const result = await prisma.cartItem.deleteMany({
      where: {
        id: itemId,
        cart: { userId }
      }
    });

    if (result.count === 0) {
      throw appErrors.notFound("Cart item not found.", "CART_ITEM_NOT_FOUND");
    }

    return this.getCart(userId);
  }
};
