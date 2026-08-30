import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cwd } from "node:process";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletAdapter } from "./wallets/types";

const indexHtml = readFileSync(resolve(cwd(), "index.html"), "utf8");

function loadIndexHtml(): void {
  document.open();
  document.write(indexHtml);
  document.close();
}

function testAdapter(): WalletAdapter {
  return {
    id: "xaman",
    name: "Xaman",
    capabilities: {
      connect: { supported: true },
      signTransaction: { supported: true },
      signMessage: { supported: false },
      submitTransaction: { supported: false },
      supportedNetworks: ["testnet", "mainnet"],
      requiresBrowserExtension: false,
      requiresMobileApp: true,
      requiresHardwareDevice: false,
      requiresApiKey: true,
      requiresProjectId: false
    },
    isAvailable: async () => ({ available: true }),
    connect: async () => ({
      id: "xaman",
      name: "Xaman",
      address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      network: "testnet",
      connectedAt: "2026-08-26T00:00:00.000Z"
    }),
    disconnect: async () => undefined,
    getAddress: async () => "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    signTransaction: async () => ({
      signerAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      txBlob: "DEADBEEFDEADBEEF",
      hash: "A".repeat(64)
    })
  };
}

async function waitFor(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 1000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

beforeEach(() => {
  vi.resetModules();
  loadIndexHtml();
  vi.doMock("./wallets/registry", () => ({
    createWalletRegistry: () => ({
      adapters: [testAdapter()],
      get: () => testAdapter()
    })
  }));
  vi.doMock("./shared/api", () => ({
    apiClient: {
      health: async () => ({ status: "ok", service: "xrpl-defi-api", version: "0.1.0" }),
      defaultNetwork: () => "testnet",
      createSession: async () => ({
        session: {
          id: "11111111-1111-4111-8111-111111111111",
          walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
          walletProvider: "xaman",
          network: "testnet",
          status: "active"
        }
      }),
      createSellQuote: async () => ({
        quote: {
          id: "22222222-2222-4222-8222-222222222222",
          sessionId: "11111111-1111-4111-8111-111111111111",
          walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
          network: "testnet",
          destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
          assets: [],
          warnings: []
        }
      }),
      createSellIntent: async () => ({
        intent: {
          id: "33333333-3333-4333-8333-333333333333",
          status: "AWAITING_USER_SIGNATURE",
          transactions: [
            {
              assetId: "XRP",
              status: "PREPARED",
              unsignedTransaction: {
                TransactionType: "Payment",
                Account: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
                Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
                Amount: "1000"
              },
              transactionIntentId: "44444444-4444-4444-8444-444444444444",
              transactionIntentFingerprint: "B".repeat(64)
            }
          ],
          settlementEventReady: false
        }
      }),
      acceptTransactionSignature: async () => ({ intent: { status: "SIGNED" } }),
      submitTransaction: async () => ({ intent: { status: "SUBMITTED" } }),
      monitorTransaction: async () => ({
        transactionId: "44444444-4444-4444-8444-444444444444",
        status: "VALIDATED",
        network: "testnet",
        transactionType: "Payment",
        autofillStatus: "autofilled",
        policyWarnings: [],
        updatedAt: "2026-08-26T00:00:00.000Z"
      })
    }
  }));
});

describe("static HTML sell page", () => {
  it("contains the real Sell All button and wallet modal markup in index.html", () => {
    expect(indexHtml).toContain('id="sell-all-button"');
    expect(indexHtml).toContain("Sell All Assets");
    expect(indexHtml).toContain('id="wallet-modal-backdrop"');
    expect(indexHtml).toContain('id="wallet-list"');
    expect(indexHtml).not.toContain("sell-flow-root");
  });

  it("boots external behavior against the static HTML and opens the wallet selector", async () => {
    await import("./page");

    document.getElementById("sell-all-button")?.click();

    expect(document.getElementById("wallet-modal-backdrop")).not.toHaveAttribute("hidden");
    await waitFor(() => {
      expect(document.querySelector<HTMLButtonElement>('[data-wallet="xaman"]')?.textContent).toContain("Xaman");
    });
  });

  it("continues into the Sell All controller after wallet selection", async () => {
    await import("./page");

    document.getElementById("sell-all-button")?.click();
    await waitFor(() => {
      expect(document.querySelector<HTMLButtonElement>('[data-wallet="xaman"]')).toBeTruthy();
    });
    document.querySelector<HTMLButtonElement>('[data-wallet="xaman"]')?.click();

    await waitFor(() => {
      expect(document.getElementById("sell-state")?.textContent).toBe("COMPLETED");
      expect(document.getElementById("wallet-status")?.textContent).toBe("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh");
    });
  });
});
