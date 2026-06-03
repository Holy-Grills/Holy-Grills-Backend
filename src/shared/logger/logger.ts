import { env } from "../config/env.js";

type LogPayload = Record<string, unknown>;

function write(level: "info" | "warn" | "error", payload: LogPayload | string, message?: string) {
  const line =
    typeof payload === "string"
      ? { level, message: payload, at: new Date().toISOString(), env: env.NODE_ENV }
      : { level, message, at: new Date().toISOString(), env: env.NODE_ENV, ...payload };

  const serialized = JSON.stringify(line);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  info: (payload: LogPayload | string, message?: string) => write("info", payload, message),
  warn: (payload: LogPayload | string, message?: string) => write("warn", payload, message),
  error: (payload: LogPayload | string, message?: string) => write("error", payload, message)
};

