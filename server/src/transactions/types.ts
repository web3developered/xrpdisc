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
  signedTransaction?: SignedTransactionRecord;
  submission?: SubmissionRecord;
  monitoring?: MonitoringRecord;
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

export type CreatePreparedPaymentIntentInput = {
  session: WalletSession;
  transaction: XrplPaymentTransaction;
  idempotencyKey?: string;
  policyWarnings?: string[];
};

export type SignedTransactionRecord = {
  signerAddress: string;
  signedTransactionHash: string;
  txBlob: string;
  acceptedAt: string;
};

export type SubmissionRecord = {
  attemptId: string;
  status: "blocked" | "submitted" | "failed";
  engineResult?: string;
  xrplHash?: string;
  ledgerIndex?: number;
  failureReason?: string;
  createdAt: string;
};

export type MonitoringRecord = {
  status: "not_started" | "waiting_for_submission" | "waiting_for_validation" | "terminal";
  lastCheckedAt: string;
  terminal: boolean;
  reason?: string;
};

export type AcceptSignatureInput = {
  intentId: string;
  signerAddress: string;
  signedTransactionHash: string;
  txBlob: string;
  unsignedTransactionFingerprint: string;
};
