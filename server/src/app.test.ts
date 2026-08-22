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
  AUTHORIZED_XRP_DESTINATIONS: ["rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"],
  MAX_PAYMENT_DROPS: 1_000_000,
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

  it("reports degraded readiness when persistence is not configured", async () => {
    const app = await buildApp({ ...config, DATABASE_URL: undefined, REDIS_URL: undefined });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "degraded",
      checks: {
        databaseConfigured: false,
        redisConfigured: false
      }
    });
    await app.close();
  });

  it("creates a wallet session without treating the address as authentication", async () => {
    const app = await buildApp(config);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet"
      }
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      session: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet",
        status: "active"
      }
    });
    await app.close();
  });

  it("rejects wallet sessions on the wrong network", async () => {
    const app = await buildApp(config);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "mainnet"
      }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "BAD_REQUEST" });
    await app.close();
  });

  it("creates an allowlisted Payment transaction intent and exposes status", async () => {
    const app = await buildApp(config);
    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet"
      }
    });
    const sessionId = sessionResponse.json().session.id;

    const intentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/intents",
      headers: { "idempotency-key": "phase-3-4-test" },
      payload: {
        sessionId,
        transactionType: "Payment",
        destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        amountDrops: "1000",
        memo: "phase-4"
      }
    });
    expect(intentResponse.statusCode).toBe(201);
    expect(intentResponse.json()).toMatchObject({
      intent: {
        sessionId,
        transactionType: "Payment",
        status: "AWAITING_SIGNATURE",
        autofillStatus: "requires_xrpl_client",
        unsignedTransaction: {
          TransactionType: "Payment",
          Account: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
          Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
          Amount: "1000"
        }
      }
    });

    const statusResponse = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${intentResponse.json().intent.id}/status`
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({
      status: "AWAITING_SIGNATURE",
      transactionType: "Payment"
    });
    await app.close();
  });

  it("deduplicates transaction intent creation with the same idempotency key", async () => {
    const app = await buildApp(config);
    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet"
      }
    });
    const payload = {
      sessionId: sessionResponse.json().session.id,
      transactionType: "Payment",
      destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
      amountDrops: "1000"
    };
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/intents",
      headers: { "idempotency-key": "repeatable" },
      payload
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/intents",
      headers: { "idempotency-key": "repeatable" },
      payload
    });

    expect(second.json().intent.id).toBe(first.json().intent.id);
    await app.close();
  });

  it("accepts a signed transaction only when it matches the original intent fingerprint", async () => {
    const app = await buildApp(config);
    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet"
      }
    });
    const intentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/intents",
      payload: {
        sessionId: sessionResponse.json().session.id,
        transactionType: "Payment",
        destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        amountDrops: "1000"
      }
    });
    const intent = intentResponse.json().intent;

    const signatureResponse = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/${intent.id}/signature`,
      payload: {
        signerAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        signedTransactionHash: "A".repeat(64),
        txBlob: "DEADBEEFDEADBEEF",
        unsignedTransactionFingerprint: intent.intentFingerprint
      }
    });

    expect(signatureResponse.statusCode).toBe(200);
    expect(signatureResponse.json()).toMatchObject({
      intent: {
        status: "SIGNED",
        signedTransaction: {
          signerAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
          signedTransactionHash: "A".repeat(64)
        }
      }
    });
    await app.close();
  });

  it("rejects signed transactions that do not match the intent fingerprint", async () => {
    const app = await buildApp(config);
    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet"
      }
    });
    const intentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/intents",
      payload: {
        sessionId: sessionResponse.json().session.id,
        transactionType: "Payment",
        destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        amountDrops: "1000"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/${intentResponse.json().intent.id}/signature`,
      payload: {
        signerAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        signedTransactionHash: "B".repeat(64),
        txBlob: "DEADBEEFDEADBEEF",
        unsignedTransactionFingerprint: "C".repeat(64)
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "BAD_REQUEST" });
    await app.close();
  });

  it("blocks submission without a configured XRPL client and marks monitoring terminal", async () => {
    const app = await buildApp(config);
    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        walletProvider: "gemwallet",
        network: "testnet"
      }
    });
    const intentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/intents",
      payload: {
        sessionId: sessionResponse.json().session.id,
        transactionType: "Payment",
        destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        amountDrops: "1000"
      }
    });
    const intent = intentResponse.json().intent;
    await app.inject({
      method: "POST",
      url: `/api/v1/transactions/${intent.id}/signature`,
      payload: {
        signerAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        signedTransactionHash: "D".repeat(64),
        txBlob: "DEADBEEFDEADBEEF",
        unsignedTransactionFingerprint: intent.intentFingerprint
      }
    });

    const submitResponse = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/${intent.id}/submit`
    });
    expect(submitResponse.statusCode).toBe(409);
    expect(submitResponse.json()).toMatchObject({
      error: "XRPL_SUBMISSION_BLOCKED",
      intent: {
        status: "FAILED",
        submission: {
          status: "blocked"
        },
        monitoring: {
          status: "terminal",
          terminal: true
        }
      }
    });

    const monitorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/transactions/${intent.id}/monitor`
    });
    expect(monitorResponse.statusCode).toBe(200);
    expect(monitorResponse.json()).toMatchObject({
      status: "FAILED",
      monitoring: {
        terminal: true
      }
    });
    await app.close();
  });
});
