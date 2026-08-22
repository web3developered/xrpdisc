import type { XrplNetwork } from "../xrpl/types.js";

export type WalletProviderId = "xaman" | "crossmark" | "gemwallet" | "walletconnect" | "ledger";
export type SessionStatus = "active" | "expired" | "revoked";

export type WalletSession = {
  id: string;
  walletAddress: string;
  walletProvider: WalletProviderId;
  network: XrplNetwork;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  status: SessionStatus;
};

