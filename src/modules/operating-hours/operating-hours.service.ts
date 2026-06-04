import type { OperatingHour } from "@prisma/client";
import { env } from "../../shared/config/env.js";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type OperatingHourInput = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed?: boolean;
  overrideMessage?: string | null;
};

function parseTimeToMinutes(value: string): number {
  const match = timePattern.exec(value);

  if (!match) {
    throw appErrors.badRequest("Time must use HH:mm 24-hour format.", "INVALID_TIME_FORMAT");
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function serializeHour(hour: OperatingHour) {
  return {
    id: hour.id,
    dayOfWeek: hour.dayOfWeek,
    dayName: dayNames[hour.dayOfWeek],
    opensAt: formatMinutes(hour.opensAtMinutes),
    closesAt: formatMinutes(hour.closesAtMinutes),
    isClosed: hour.isClosed,
    overrideMessage: hour.overrideMessage,
    createdAt: hour.createdAt,
    updatedAt: hour.updatedAt
  };
}

function normalizeInput(input: OperatingHourInput) {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw appErrors.badRequest("dayOfWeek must be an integer from 0 to 6.", "INVALID_DAY_OF_WEEK");
  }

  const opensAtMinutes = parseTimeToMinutes(input.opensAt);
  const closesAtMinutes = parseTimeToMinutes(input.closesAt);
  const isClosed = input.isClosed ?? false;

  if (!isClosed && closesAtMinutes <= opensAtMinutes) {
    throw appErrors.badRequest("closesAt must be after opensAt for open days.", "INVALID_OPERATING_HOURS_RANGE");
  }

  return {
    dayOfWeek: input.dayOfWeek,
    opensAtMinutes,
    closesAtMinutes,
    isClosed,
    overrideMessage: input.overrideMessage ?? null
  };
}

function getLocalDayAndMinutes(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: env.STORE_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday ?? "");

  return {
    dayOfWeek: dayOfWeek === -1 ? now.getDay() : dayOfWeek,
    currentMinutes: hour * 60 + minute
  };
}

export const operatingHoursService = {
  async listHours() {
    const hours = await prisma.operatingHour.findMany({
      orderBy: { dayOfWeek: "asc" }
    });

    return { hours: hours.map(serializeHour) };
  },

  async upsertHours(inputs: OperatingHourInput[]) {
    if (inputs.length === 0) {
      throw appErrors.badRequest("At least one operating hour entry is required.", "OPERATING_HOURS_REQUIRED");
    }

    const seenDays = new Set<number>();
    const normalized = inputs.map((input) => {
      const hour = normalizeInput(input);

      if (seenDays.has(hour.dayOfWeek)) {
        throw appErrors.badRequest("Each dayOfWeek can appear only once.", "DUPLICATE_DAY_OF_WEEK");
      }

      seenDays.add(hour.dayOfWeek);
      return hour;
    });

    const previous = await prisma.operatingHour.findMany({
      where: {
        dayOfWeek: {
          in: normalized.map((hour) => hour.dayOfWeek)
        }
      },
      orderBy: { dayOfWeek: "asc" }
    });

    await prisma.$transaction(
      normalized.map((hour) =>
        prisma.operatingHour.upsert({
          where: { dayOfWeek: hour.dayOfWeek },
          create: hour,
          update: {
            opensAtMinutes: hour.opensAtMinutes,
            closesAtMinutes: hour.closesAtMinutes,
            isClosed: hour.isClosed,
            overrideMessage: hour.overrideMessage
          }
        })
      )
    );

    const hours = await prisma.operatingHour.findMany({
      orderBy: { dayOfWeek: "asc" }
    });

    return {
      hours: hours.map(serializeHour),
      previous: previous.map(serializeHour)
    };
  },

  async getCurrentStatus(now = new Date()) {
    const { dayOfWeek, currentMinutes } = getLocalDayAndMinutes(now);
    const hours = await prisma.operatingHour.findMany({
      orderBy: { dayOfWeek: "asc" }
    });
    const today = hours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? null;

    if (!today) {
      return {
        isOpen: false,
        checkedAt: now,
        timezone: env.STORE_TIMEZONE,
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        currentTime: formatMinutes(currentMinutes),
        schedule: null,
        nextOpening: null,
        message: "Operating hours have not been configured."
      };
    }

    const isOpen = !today.isClosed && currentMinutes >= today.opensAtMinutes && currentMinutes < today.closesAtMinutes;
    const nextOpening = this.findNextOpening(hours, dayOfWeek, currentMinutes);

    return {
      isOpen,
      checkedAt: now,
      timezone: env.STORE_TIMEZONE,
      dayOfWeek,
      dayName: dayNames[dayOfWeek],
      currentTime: formatMinutes(currentMinutes),
      schedule: serializeHour(today),
      nextOpening,
      message: today.overrideMessage
    };
  },

  findNextOpening(hours: OperatingHour[], dayOfWeek: number, currentMinutes: number) {
    for (let offset = 0; offset < 7; offset += 1) {
      const targetDay = (dayOfWeek + offset) % 7;
      const hour = hours.find((entry) => entry.dayOfWeek === targetDay);

      if (!hour || hour.isClosed) {
        continue;
      }

      if (offset === 0 && hour.opensAtMinutes <= currentMinutes) {
        continue;
      }

      return {
        dayOfWeek: targetDay,
        dayName: dayNames[targetDay],
        opensAt: formatMinutes(hour.opensAtMinutes),
        closesAt: formatMinutes(hour.closesAtMinutes)
      };
    }

    return null;
  }
};
