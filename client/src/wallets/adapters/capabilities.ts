import type { WalletCapabilities, XrplNetwork } from "../types";

const allXrplNetworks: XrplNetwork[] = ["mainnet", "testnet", "devnet"];

export function createCapabilities(
  overrides: Partial<WalletCapabilities> = {}
): WalletCapabilities {
  return {
    connect: { supported: true },
    signTransaction: { supported: false, reason: "Transaction signing is enabled in later phases." },
    signMessage: { supported: false, reason: "Message signing is not required for Phase 2." },
    submitTransaction: {
      supported: false,
      reason: "Submission is intentionally isolated until Phase 5."
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

