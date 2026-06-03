import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";
import { slugify } from "../../shared/utils/slug.js";

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

type CreateMenuCategoryInput = {
  name: string;
  sortOrder?: number;
};

export const menuService = {
  async listCategories() {
    const categories = await prisma.menuCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return { categories };
  },

  async createCategory(input: CreateMenuCategoryInput) {
    const slug = slugify(input.name);

    if (!slug) {
      throw appErrors.badRequest("Category name must contain letters or numbers.", "INVALID_CATEGORY_NAME");
    }

    const existingCategory = await prisma.menuCategory.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (existingCategory) {
      throw appErrors.conflict("A menu category with this name already exists.", "MENU_CATEGORY_ALREADY_EXISTS");
    }

    const category = await prisma.menuCategory.create({
      data: {
        name: input.name,
        slug,
        sortOrder: input.sortOrder ?? 0
      }
    });

    return { category };
  },

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

  async getMenuItem(id: string) {
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        archivedAt: null
      },
      include: {
        category: true
      }
    });

    if (!item) {
      throw appErrors.notFound("Menu item not found.", "MENU_ITEM_NOT_FOUND");
    }

    return { item };
  },

  async createMenuItem(input: CreateMenuItemInput) {
    const { price, ...data } = input;
    const category = await prisma.menuCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true }
    });

    if (!category) {
      throw appErrors.badRequest("Menu category does not exist.", "MENU_CATEGORY_NOT_FOUND");
    }

    const existingSku = await prisma.menuItem.findUnique({
      where: { sku: input.sku },
      select: { id: true }
    });

    if (existingSku) {
      throw appErrors.conflict("A menu item with this SKU already exists.", "MENU_ITEM_SKU_ALREADY_EXISTS");
    }

    const item = await prisma.menuItem.create({
      data: {
        ...data,
        priceKobo: Math.round(price * 100)
      }
    });

    return { item };
  }
};
