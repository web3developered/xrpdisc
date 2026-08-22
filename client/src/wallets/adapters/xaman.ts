import { walletNotConfigured } from "../errors";
import type { WalletAvailability, WalletConnection } from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

export class XamanAdapter extends BaseWalletAdapter {
  readonly id = "xaman" as const;
  readonly name = "Xaman";
  readonly capabilities = createCapabilities({
    connect: {
      supported: false,
      reason: "Requires the Xaman SDK and a public Xaman API key."
    },
    signTransaction: {
      supported: false,
      reason: "Requires Xaman payload creation with a configured API key."
    },
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
    return {
      available: false,
      reason: "Xaman SDK dependency is not installed in this build."
    };
  }

  override async connect(): Promise<WalletConnection> {
    throw walletNotConfigured(
      this.id,
      "Xaman requires the official SDK package and VITE_XAMAN_API_KEY before connection can be enabled."
    );
  }
}

