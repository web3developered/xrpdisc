import { describe, expect, it, vi } from "vitest";
import { SellFlowController } from "./SellFlowController";
import type { SellFlowSnapshot } from "./types";
import type { WalletAdapter } from "../wallets/types";

const connection = {
  id: "gemwallet" as const,
  name: "GemWallet",
  address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  network: "testnet" as const,
  connectedAt: "2026-08-24T00:00:00.000Z"
};

const adapter: WalletAdapter = {
  id: "gemwallet",
  name: "GemWallet",
  capabilities: {
    connect: { supported: true },
    signTransaction: { supported: true },
    signMessage: { supported: false },
    submitTransaction: { supported: false },
    supportedNetworks: ["testnet", "mainnet"],
    requiresBrowserExtension: true,
    requiresMobileApp: false,
    requiresHardwareDevice: false,
    requiresApiKey: false,
    requiresProjectId: false
  },
  isAvailable: async () => ({ available: true }),
  connect: async () => connection,
  disconnect: async () => undefined,
  getAddress: async () => connection.address,
  signTransaction: async () => ({
    signerAddress: connection.address,
    signature: "signed"
  })
};

describe("SellFlowController", () => {
  it("automatically starts backend Sell All after wallet connection", async () => {
    const snapshots: SellFlowSnapshot[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/sessions")) {
        return Response.json({
          session: {
            id: "11111111-1111-4111-8111-111111111111",
            walletAddress: connection.address,
            walletProvider: "gemwallet",
            network: "testnet",
            status: "active"
          }
        });
      }
      if (url.endsWith("/api/v1/sell/quote")) {
        return Response.json({
          quote: {
            id: "22222222-2222-4222-8222-222222222222",
            sessionId: "11111111-1111-4111-8111-111111111111",
            walletAddress: connection.address,
            network: "testnet",
            destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
            assets: [],
            warnings: []
          }
        });
      }
      if (url.endsWith("/api/v1/sell/intents")) {
        return Response.json({
          intent: {
            id: "33333333-3333-4333-8333-333333333333",
            status: "AWAITING_USER_SIGNATURE",
            transactions: [],
            settlementEventReady: false
          }
        });
      }
      return Response.json({ status: "ok", service: "xrpl-defi-api", version: "0.1.0" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const controller = new SellFlowController((snapshot) => snapshots.push(snapshot));
    await controller.connectWalletAndStartSell(adapter);

    expect(snapshots.map((snapshot) => snapshot.state)).toEqual(
      expect.arrayContaining([
        "CONNECTING_WALLET",
        "WALLET_CONNECTED",
        "CREATING_SESSION",
        "CREATING_SELL_QUOTE",
        "PREPARING_TRANSACTIONS",
        "AWAITING_SIGNATURE"
      ])
    );
    expect(snapshots.at(-1)).toMatchObject({
      state: "AWAITING_SIGNATURE",
      sessionId: "11111111-1111-4111-8111-111111111111",
      quoteId: "22222222-2222-4222-8222-222222222222",
      intentId: "33333333-3333-4333-8333-333333333333"
    });
  });
});

