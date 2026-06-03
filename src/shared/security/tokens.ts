import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function durationToDate(duration: string): Date {
  const match = /^(\d+)([mhd])$/.exec(duration);

  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;

  return new Date(Date.now() + value * multiplier);
}

