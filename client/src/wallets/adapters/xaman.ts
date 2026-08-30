import { apiClient, type XamanPayloadStatus } from "../../shared/api";
import { WalletError, walletUnavailable } from "../errors";
import type {
  SignedXrplTransaction,
  UnsignedXrplTransaction,
  WalletAvailability,
  WalletConnection
} from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

const XAMAN_POLL_INTERVAL_MS = 2500;
const XAMAN_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function openXamanApproval(url: string): void {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
  }
}

async function waitForResolvedPayload(uuid: string): Promise<XamanPayloadStatus> {
  const expiresAt = Date.now() + XAMAN_TIMEOUT_MS;
  while (Date.now() < expiresAt) {
    const { payload } = await apiClient.getXamanPayloadStatus(uuid);
    if (payload.resolved || payload.cancelled || payload.expired) {
      return payload;
    }
    await sleep(XAMAN_POLL_INTERVAL_MS);
  }

  throw new WalletError("xaman", "WALLET_REJECTED", "Xaman approval timed out.");
}

export class XamanAdapter extends BaseWalletAdapter {
  readonly id = "xaman" as const;
  readonly name = "Xaman";
  readonly capabilities = createCapabilities({
    connect: { supported: true },
    signTransaction: { supported: true },
    requiresMobileApp: true,
    requiresApiKey: true
  });

  constructor(private readonly apiKey?: string) {
    super();
  }

  async isAvailable(): Promise<WalletAvailability> {
    if (!this.apiKey) {
      return {
        available: false,
        reason: "Set VITE_XAMAN_API_KEY after creating an app in the Xaman developer console."
      };
    }
    return { available: true };
  }

  override async connect(): Promise<WalletConnection> {
    if (!this.apiKey) {
      throw walletUnavailable(this.id, "Xaman public API key is not configured.");
    }

    const { payload } = await apiClient.createXamanSignInPayload();
    openXamanApproval(payload.next.always);
    const resolved = await waitForResolvedPayload(payload.uuid);

    if (!resolved.signed || !resolved.signerAddress) {
      throw new WalletError(this.id, "WALLET_REJECTED", "Xaman sign-in was rejected or expired.");
    }

    return this.rememberConnection({
      id: this.id,
      name: this.name,
      address: resolved.signerAddress,
      network: "mainnet",
      connectedAt: new Date().toISOString()
    });
  }

  override async signTransaction(
    transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    const { payload } = await apiClient.createXamanTransactionPayload({ transaction });
    openXamanApproval(payload.next.always);
    const resolved = await waitForResolvedPayload(payload.uuid);

    if (!resolved.signed || !resolved.signerAddress || !resolved.txBlob) {
      throw new WalletError(this.id, "WALLET_REJECTED", "Xaman transaction signing was rejected or expired.");
    }

    return {
      signerAddress: resolved.signerAddress,
      txBlob: resolved.txBlob,
      hash: resolved.txHash ?? undefined,
      txJson: transaction,
      rawResponse: resolved
    };
  }
}

