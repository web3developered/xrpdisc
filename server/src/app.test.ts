import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { AppConfig } from "./config/env.js";

const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 8080,
  LOG_LEVEL: "fatal",
  CORS_ORIGIN: "http://localhost:5173",
  XRPL_NETWORK: "testnet",
  XRPL_RPC_URL: "wss://s.altnet.rippletest.net:51233",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/xrpl_defi",
  REDIS_URL: "redis://localhost:6379",
  SESSION_TTL_SECONDS: 1800,
  REQUIRE_EXPLICIT_MAINNET_ENABLE: false
};

describe("server shell", () => {
  it("serves health", async () => {
    const app = await buildApp(config);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "xrpl-defi-api" });
    await app.close();
  });

  it("marks Phase 2+ APIs as not implemented", async () => {
    const app = await buildApp(config);
    const response = await app.inject({ method: "POST", url: "/api/v1/sessions" });
    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({ error: "NOT_IMPLEMENTED" });
    await app.close();
  });
});

