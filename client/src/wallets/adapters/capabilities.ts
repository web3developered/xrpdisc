import type { WalletCapabilities, XrplNetwork } from "../types";

const allXrplNetworks: XrplNetwork[] = ["mainnet", "testnet", "devnet"];

export function createCapabilities(
  overrides: Partial<WalletCapabilities> = {}
): WalletCapabilities {
  return {
    connect: { supported: true },
    signTransaction: { supported: false, reason: "This wallet adapter does not support XRPL transaction signing." },
    signMessage: { supported: false, reason: "Message signing is not required for Sell All Assets." },
    submitTransaction: {
      supported: false,
      reason: "Wallet adapters sign transactions; backend services validate, submit, and monitor them."
    },
    supportedNetworks: allXrplNetworks,
    requiresBrowserExtension: false,
    requiresMobileApp: false,
    requiresHardwareDevice: false,
    requiresApiKey: false,
    requiresProjectId: false,
    ...overrides
  };
}

