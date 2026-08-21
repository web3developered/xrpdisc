import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";

export async function registerHealthRoutes(app: FastifyInstance, config: AppConfig) {
  app.get("/health", async () => ({
    status: "ok",
    service: "xrpl-defi-api",
    version: "0.1.0"
  }));

  app.get("/ready", async () => ({
    status: "ok",
    checks: {
      environment: config.NODE_ENV,
      xrplNetwork: config.XRPL_NETWORK,
      databaseConfigured: Boolean(config.DATABASE_URL),
      redisConfigured: Boolean(config.REDIS_URL)
    }
  }));
}

