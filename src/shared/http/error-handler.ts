import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: error.flatten()
      }
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  const statusCode = error.statusCode ?? 500;

  return reply.status(statusCode).send({
    error: {
      code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: statusCode >= 500 ? "Something went wrong." : error.message
    }
  });
}
