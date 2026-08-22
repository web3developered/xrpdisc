import { walletNotConfigured } from "../errors";
import type { WalletAvailability, WalletConnection } from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

export class LedgerAdapter extends BaseWalletAdapter {
  readonly id = "ledger" as const;
  readonly name = "Ledger";
  readonly capabilities = createCapabilities({
    connect: {
      supported: false,
      reason: "Requires Ledger WebHID/WebUSB transport and the XRP app."
    },
    signTransaction: {
      supported: false,
      reason: "Requires serialized XRPL transaction signing through Ledger XRP app."
    },
    requiresHardwareDevice: true
  });

  async isAvailable(): Promise<WalletAvailability> {
    const supportsHid = "hid" in navigator;
    return supportsHid
      ? {
          available: false,
          reason: "Browser supports WebHID, but Ledger transport dependency is not installed in this build."
        }
      : {
          available: false,
          reason: "Ledger requires a Chromium browser with WebHID/WebUSB support."
        };
  }

  override async connect(): Promise<WalletConnection> {
    throw walletNotConfigured(
      this.id,
      "Ledger requires @ledgerhq transport packages before connection can be enabled."
    );
  }
}

