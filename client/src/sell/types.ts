import type { WalletConnection } from "../wallets/types";

export type SellFlowState =
  | "IDLE"
  | "SELL_ALL_SELECTED"
  | "WALLET_SELECTOR_OPEN"
  | "CONNECTING_WALLET"
  | "WALLET_CONNECTED"
  | "CREATING_SESSION"
  | "DISCOVERING_ASSETS"
  | "CREATING_SELL_QUOTE"
  | "PREPARING_TRANSACTIONS"
  | "AWAITING_SIGNATURE"
  | "SUBMITTING"
  | "MONITORING"
  | "COMPLETED"
  | "PARTIAL_FAILURE"
  | "FAILED"
  | "USER_REJECTED";

export type SellFlowSnapshot = {
  state: SellFlowState;
  message: string;
  connection: WalletConnection | null;
  sessionId: string | null;
  quoteId: string | null;
  intentId: string | null;
  error: string | null;
};

export type SellQuoteResponse = {
  quote: {
    id: string;
    sessionId: string;
    walletAddress: string;
    network: string;
    destination: string;
    assets: Array<{
      id: string;
      kind: "XRP" | "ISSUED";
      currency: string;
      issuer?: string;
      balance: string;
      spendableBalance: string;
      eligible: boolean;
      ineligibilityReason?: string;
    }>;
    warnings: string[];
  };
};

export type SellIntentResponse = {
  intent: {
    id: string;
    status: string;
    transactions: Array<{
      assetId: string;
      status: string;
      unsignedTransaction: Record<string, unknown>;
      transactionIntentId?: string;
      transactionIntentFingerprint?: string;
    }>;
    settlementEventReady: boolean;
  };
};
