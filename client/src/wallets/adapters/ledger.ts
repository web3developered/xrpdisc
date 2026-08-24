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
    if (supportsHid) {
      try {
        const appPackage = "@ledgerhq/hw-app-xrp";
        const transportPackage = "@ledgerhq/hw-transport-webhid";
        await import(/* @vite-ignore */ appPackage);
        await import(/* @vite-ignore */ transportPackage);
      } catch {
        return {
          available: false,
          reason: "Install Ledger XRP and WebHID transport packages before enabling Ledger."
        };
      }
    }
    return supportsHid
      ? {
          available: false,
          reason: "Ledger packages are present, but XRP app signing has not been tested in this build."
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

