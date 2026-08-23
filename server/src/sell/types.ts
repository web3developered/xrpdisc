import type { WalletSession } from "../sessions/types.js";
import type { XrplPaymentTransaction } from "../xrpl/types.js";

export type SellAssetKind = "XRP" | "ISSUED";

export type DiscoveredSellAsset = {
  id: string;
  kind: SellAssetKind;
  currency: string;
  issuer?: string;
  balance: string;
  spendableBalance: string;
  eligible: boolean;
  ineligibilityReason?: string;
};

export type SellQuote = {
  id: string;
  sessionId: string;
  walletAddress: string;
  network: WalletSession["network"];
  destination: string;
  assets: DiscoveredSellAsset[];
  createdAt: string;
  expiresAt: string;
  warnings: string[];
};

export type SellAssetExecutionStatus =
  | "PREPARED"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "SUBMITTED"
  | "VALIDATING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export type SellTransactionPlan = {
  assetId: string;
  status: SellAssetExecutionStatus;
  unsignedTransaction: XrplPaymentTransaction;
  transactionIntentId?: string;
  signedTransactionHash?: string;
  confirmedLedgerIndex?: number;
  failureReason?: string;
};

export type SellIntentStatus =
  | "PREPARED"
  | "AWAITING_USER_SIGNATURE"
  | "PARTIAL_FAILURE"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export type SellIntent = {
  id: string;
  quoteId: string;
  sessionId: string;
  walletAddress: string;
  network: WalletSession["network"];
  destination: string;
  status: SellIntentStatus;
  assets: DiscoveredSellAsset[];
  transactions: SellTransactionPlan[];
  settlementEventReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssetDiscovery = {
  discover(session: WalletSession): Promise<DiscoveredSellAsset[]>;
};

