import { z } from "zod";
import type { WalletProviderId } from "./types";
import type { SellIntentResponse, SellQuoteResponse } from "../sell/types";
import type { SignedXrplTransaction, UnsignedXrplTransaction } from "../wallets/types";
import type { HealthResponse } from "./types";
import { readPublicConfig, readXrplNetwork } from "./runtime-config";

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
        unsignedTransaction: z.record(z.string(), z.unknown()),
        transactionIntentId: z.string().optional(),
        transactionIntentFingerprint: z.string().optional()
      })
    ),
    settlementEventReady: z.boolean()
  })
});

const transactionStatusResponseSchema = z.object({
  transactionId: z.string(),
  status: z.string(),
  network: z.string(),
  transactionType: z.string(),
  autofillStatus: z.string(),
  policyWarnings: z.array(z.string()),
  signedTransactionHash: z.string().optional(),
  submission: z.unknown().optional(),
  monitoring: z.unknown().optional(),
  updatedAt: z.string()
});

const transactionIntentEnvelopeSchema = z.object({
  intent: z.unknown()
});

const xamanPayloadResponseSchema = z.object({
  payload: z.object({
    uuid: z.string(),
    next: z.object({
      always: z.string().url(),
      no_push_msg_received: z.string().url().optional()
    }),
    refs: z.object({
      qr_png: z.string().url(),
      qr_matrix: z.string(),
      websocket_status: z.string().url()
    }),
    pushed: z.boolean()
  })
});

const xamanPayloadStatusSchema = z.object({
  payload: z.object({
    uuid: z.string(),
    resolved: z.boolean(),
    signed: z.boolean(),
    cancelled: z.boolean(),
    expired: z.boolean(),
    opened: z.boolean(),
    signerAddress: z.string().nullable(),
    txBlob: z.string().nullable(),
    txHash: z.string().nullable()
  })
});

const apiBaseUrl = readPublicConfig("VITE_API_BASE_URL") ?? "http://localhost:8080";

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
    readXrplNetwork(),
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
    }),
  acceptTransactionSignature: (input: {
    transactionIntentId: string;
    signerAddress: string;
    signedTransactionHash: string;
    txBlob: string;
    unsignedTransactionFingerprint: string;
  }) =>
    request(`/api/v1/transactions/${input.transactionIntentId}/signature`, transactionIntentEnvelopeSchema, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  submitTransaction: (transactionIntentId: string) =>
    request(`/api/v1/transactions/${transactionIntentId}/submit`, transactionIntentEnvelopeSchema, {
      method: "POST"
    }),
  monitorTransaction: (transactionIntentId: string) =>
    request(`/api/v1/transactions/${transactionIntentId}/monitor`, transactionStatusResponseSchema, {
      method: "POST"
    }),
  createXamanSignInPayload: () =>
    request("/api/v1/wallets/xaman/payloads/sign-in", xamanPayloadResponseSchema, {
      method: "POST"
    }),
  createXamanTransactionPayload: (input: { transaction: UnsignedXrplTransaction }) =>
    request("/api/v1/wallets/xaman/payloads/sign-transaction", xamanPayloadResponseSchema, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getXamanPayloadStatus: (uuid: string) =>
    request(`/api/v1/wallets/xaman/payloads/${uuid}`, xamanPayloadStatusSchema),
  apiBaseUrl: () => apiBaseUrl
};

export type XamanPayloadStatus = Awaited<ReturnType<typeof apiClient.getXamanPayloadStatus>>["payload"];
export type TransactionStatusResponse = z.infer<typeof transactionStatusResponseSchema>;
export type SignedTransactionBody = SignedXrplTransaction & {
  signedTransactionHash?: string;
};

