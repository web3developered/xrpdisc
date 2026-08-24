import { z } from "zod";
import type { WalletProviderId } from "./types";
import type { SellIntentResponse, SellQuoteResponse } from "../sell/types";
import type { HealthResponse } from "./types";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "unavailable"]),
  service: z.string(),
  version: z.string()
});

const sessionResponseSchema = z.object({
  session: z.object({
    id: z.string(),
    walletAddress: z.string(),
    walletProvider: z.string(),
    network: z.string(),
    status: z.string()
  })
});

const sellQuoteResponseSchema = z.object({
  quote: z.object({
    id: z.string(),
    sessionId: z.string(),
    walletAddress: z.string(),
    network: z.string(),
    destination: z.string(),
    assets: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(["XRP", "ISSUED"]),
        currency: z.string(),
        issuer: z.string().optional(),
        balance: z.string(),
        spendableBalance: z.string(),
        eligible: z.boolean(),
        ineligibilityReason: z.string().optional()
      })
    ),
    warnings: z.array(z.string())
  })
});

const sellIntentResponseSchema = z.object({
  intent: z.object({
    id: z.string(),
    status: z.string(),
    transactions: z.array(
      z.object({
        assetId: z.string(),
        status: z.string(),
        unsignedTransaction: z.record(z.string(), z.unknown())
      })
    ),
    settlementEventReady: z.boolean()
  })
});

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed with status ${response.status}`);
  }

  return schema.parse(await response.json());
}

export const apiClient = {
  defaultNetwork: (): "testnet" | "mainnet" =>
    import.meta.env.VITE_XRPL_NETWORK === "mainnet" ? "mainnet" : "testnet",
  health: (): Promise<HealthResponse> => request("/health", healthResponseSchema),
  createSession: (input: {
    walletAddress: string;
    walletProvider: WalletProviderId;
    network: "testnet" | "mainnet";
  }) =>
    request("/api/v1/sessions", sessionResponseSchema, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  createSellQuote: (input: { sessionId: string }): Promise<SellQuoteResponse> =>
    request("/api/v1/sell/quote", sellQuoteResponseSchema, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  createSellIntent: (input: { quoteId: string }): Promise<SellIntentResponse> =>
    request("/api/v1/sell/intents", sellIntentResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": input.quoteId }
    })
};

