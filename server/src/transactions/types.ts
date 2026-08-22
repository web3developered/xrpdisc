import type { WalletSession } from "../sessions/types.js";
import type { GeneratedPayment, XrplNetwork, XrplPaymentTransaction } from "../xrpl/types.js";

export type TransactionStatus =
  | "CREATED"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "VALIDATING"
  | "VALIDATED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REJECTED";

export type TransactionIntent = {
  id: string;
  sessionId: string;
  network: XrplNetwork;
  transactionType: "Payment";
  status: TransactionStatus;
  intentFingerprint: string;
  unsignedTransaction: XrplPaymentTransaction;
  autofillStatus: GeneratedPayment["autofillStatus"];
  policyWarnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreatePaymentIntentInput = {
  session: WalletSession;
  destination: string;
  amountDrops: string;
  destinationTag?: number;
  memo?: string;
  idempotencyKey?: string;
};

