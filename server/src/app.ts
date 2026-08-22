import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastify from "fastify";
import type { AppConfig } from "./config/env.js";
import { registerHealthRoutes } from "./api/health.js";
import { registerV1Routes } from "./api/v1.js";
import { createLoggerOptions } from "./observability/logger.js";
import { registerRequestIdHook } from "./security/request-id.js";

export async function buildApp(config: AppConfig) {
  const app = fastify({
    logger: createLoggerOptions(config),
    requestIdHeader: "x-request-id"
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGIN });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });
  await app.register(registerRequestIdHook);
  await app.register(registerHealthRoutes, config);
  await app.register(registerV1Routes, config);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "request failed");
    reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      requestId: request.id
    });
  });

  return app;
}
