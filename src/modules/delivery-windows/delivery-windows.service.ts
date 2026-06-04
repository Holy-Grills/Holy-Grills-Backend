import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";

const deliveryWindowStatuses = [
  "draft",
  "open",
  "closed",
  "batching",
  "batched",
  "in_delivery",
  "completed",
  "cancelled",
] as const;

type DeliveryWindowStatus = (typeof deliveryWindowStatuses)[number];

type CreateDeliveryWindowInput = {
  label: string;
  opensAt: string;
  closesAt: string;
  cutoffAt?: string | null;
  capacity?: number | null;
};

type UpdateDeliveryWindowInput = {
  label?: string;
  opensAt?: string;
  closesAt?: string;
  cutoffAt?: string | null;
  capacity?: number | null;
};

type ListDeliveryWindowsInput = {
  status?: DeliveryWindowStatus;
};

function parseDate(value: string, fieldName: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw appErrors.badRequest(
      `${fieldName} must be a valid ISO datetime.`,
      "INVALID_DATETIME",
    );
  }

  return date;
}

function validateWindowTimes(
  opensAt: Date,
  closesAt: Date,
  cutoffAt?: Date | null,
) {
  if (opensAt >= closesAt) {
    throw appErrors.badRequest(
      "Delivery window opensAt must be before closesAt.",
      "INVALID_WINDOW_TIMES",
    );
  }

  if (cutoffAt && (cutoffAt < opensAt || cutoffAt > closesAt)) {
    throw appErrors.badRequest(
      "Cutoff time must be between opensAt and closesAt.",
      "INVALID_CUTOFF_TIME",
    );
  }
}

export const deliveryWindowService = {
  async listAdminWindows(input: ListDeliveryWindowsInput) {
    const windows = await prisma.deliveryWindow.findMany({
      where: {
        status: input.status,
      },
      orderBy: { opensAt: "asc" },
    });

    return { windows };
  },

  async createWindow(input: CreateDeliveryWindowInput, createdById: string) {
    const opensAt = parseDate(input.opensAt, "opensAt");
    const closesAt = parseDate(input.closesAt, "closesAt");
    const cutoffAt = input.cutoffAt
      ? parseDate(input.cutoffAt, "cutoffAt")
      : null;

    validateWindowTimes(opensAt, closesAt, cutoffAt);

    const window = await prisma.deliveryWindow.create({
      data: {
        label: input.label,
        opensAt,
        closesAt,
        cutoffAt,
        capacity: input.capacity ?? null,
        createdById,
      },
    });

    return { window };
  },

  async updateWindow(id: string, input: UpdateDeliveryWindowInput) {
    const existing = await prisma.deliveryWindow.findUnique({
      where: { id },
    });

    if (!existing) {
      throw appErrors.notFound(
        "Delivery window not found.",
        "DELIVERY_WINDOW_NOT_FOUND",
      );
    }

    const opensAt = input.opensAt
      ? parseDate(input.opensAt, "opensAt")
      : existing.opensAt;
    const closesAt = input.closesAt
      ? parseDate(input.closesAt, "closesAt")
      : existing.closesAt;

    let cutoffAt: Date | null | undefined = undefined;
    if (input.cutoffAt === null) {
      cutoffAt = null;
    } else if (input.cutoffAt) {
      cutoffAt = parseDate(input.cutoffAt, "cutoffAt");
    }

    const finalCutoffAt = cutoffAt === undefined ? existing.cutoffAt : cutoffAt;

    validateWindowTimes(opensAt, closesAt, finalCutoffAt ?? undefined);

    const window = await prisma.deliveryWindow.update({
      where: { id },
      data: {
        label: input.label ?? undefined,
        opensAt,
        closesAt,
        cutoffAt: cutoffAt === undefined ? undefined : cutoffAt,
        capacity: input.capacity === undefined ? undefined : input.capacity,
      },
    });

    return { window, previous: existing };
  },

  async openWindow(id: string) {
    const existing = await prisma.deliveryWindow.findUnique({
      where: { id },
    });

    if (!existing) {
      throw appErrors.notFound(
        "Delivery window not found.",
        "DELIVERY_WINDOW_NOT_FOUND",
      );
    }

    if (existing.status !== "draft") {
      throw appErrors.conflict(
        "Only draft delivery windows can be opened.",
        "DELIVERY_WINDOW_NOT_DRAFT",
      );
    }

    const window = await prisma.deliveryWindow.update({
      where: { id },
      data: { status: "open" },
    });

    return { window, previous: existing };
  },

  async closeWindow(id: string) {
    const existing = await prisma.deliveryWindow.findUnique({
      where: { id },
    });

    if (!existing) {
      throw appErrors.notFound(
        "Delivery window not found.",
        "DELIVERY_WINDOW_NOT_FOUND",
      );
    }

    if (existing.status !== "open") {
      throw appErrors.conflict(
        "Only open delivery windows can be closed.",
        "DELIVERY_WINDOW_NOT_OPEN",
      );
    }

    const window = await prisma.deliveryWindow.update({
      where: { id },
      data: { status: "closed" },
    });

    return { window, previous: existing };
  },

  async getCurrentWindow() {
    const now = new Date();

    const window = await prisma.deliveryWindow.findFirst({
      where: {
        status: "open",
        opensAt: { lte: now },
        closesAt: { gte: now },
      },
      orderBy: { opensAt: "desc" },
    });

    return { window };
  },

  async getNextWindow() {
    const now = new Date();

    const window = await prisma.deliveryWindow.findFirst({
      where: {
        opensAt: { gt: now },
        status: { in: ["draft", "open"] },
      },
      orderBy: { opensAt: "asc" },
    });

    return { window };
  },
};
