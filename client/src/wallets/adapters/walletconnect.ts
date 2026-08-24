import { walletNotConfigured } from "../errors";
import type { WalletAvailability, WalletConnection } from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

export class WalletConnectAdapter extends BaseWalletAdapter {
  readonly id = "walletconnect" as const;
  readonly name = "WalletConnect";
  readonly capabilities = createCapabilities({
    connect: {
      supported: false,
      reason: "Requires a WalletConnect/Reown project ID and sign-client integration."
    },
    signTransaction: {
      supported: false,
      reason: "Requires configured WalletConnect XRPL namespaces."
    },
    requiresProjectId: true
  });

  constructor(private readonly projectId?: string) {
    super();
  }

  async isAvailable(): Promise<WalletAvailability> {
    if (!this.projectId) {
      return {
        available: false,
        reason: "Set VITE_WALLETCONNECT_PROJECT_ID before enabling WalletConnect."
      };
    }
    try {
      const packageName = "@walletconnect/sign-client";
      await import(/* @vite-ignore */ packageName);
    } catch {
      return {
        available: false,
        reason: "Install @walletconnect/sign-client before enabling WalletConnect."
      };
    }
    return {
      available: false,
      reason: "WalletConnect SignClient is present, but XRPL namespace support has not been verified."
    };
  }

  override async connect(): Promise<WalletConnection> {
    throw walletNotConfigured(
      this.id,
      "WalletConnect requires a project ID and the official sign-client integration before connection can be enabled."
    );
  }
}

