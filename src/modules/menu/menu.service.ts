import { prisma } from "../../shared/database/prisma.js";

type ListMenuItemsInput = {
  categoryId?: string;
  search?: string;
};

type CreateMenuItemInput = {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  photoUrl?: string;
  hpEarnValue: number;
  sku: string;
  dietaryTags: string[];
};

export const menuService = {
  async listMenuItems(input: ListMenuItemsInput) {
    const items = await prisma.menuItem.findMany({
      where: {
        archivedAt: null,
        categoryId: input.categoryId,
        OR: input.search
          ? [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }]
    });

    return { items };
  },

  async createMenuItem(input: CreateMenuItemInput) {
    const { price, ...data } = input;

    const item = await prisma.menuItem.create({
      data: {
        ...data,
        priceKobo: Math.round(price * 100)
      }
    });

    return { item };
  }
};
