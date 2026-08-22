import type { WalletId } from "./types";

export type WalletErrorCode =
  | "WALLET_NOT_AVAILABLE"
  | "WALLET_NOT_CONFIGURED"
  | "WALLET_REJECTED"
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_WALLET_RESPONSE";

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly walletId: WalletId;

  constructor(walletId: WalletId, code: WalletErrorCode, message: string) {
    super(message);
    this.name = "WalletError";
    this.walletId = walletId;
    this.code = code;
  }
}

export function walletUnavailable(walletId: WalletId, message: string): WalletError {
  return new WalletError(walletId, "WALLET_NOT_AVAILABLE", message);
}

export function walletNotConfigured(walletId: WalletId, message: string): WalletError {
  return new WalletError(walletId, "WALLET_NOT_CONFIGURED", message);
}

export function unsupportedCapability(walletId: WalletId, message: string): WalletError {
  return new WalletError(walletId, "UNSUPPORTED_CAPABILITY", message);
}

