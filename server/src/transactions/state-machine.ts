import type { TransactionStatus } from "./types.js";

const allowedTransitions: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: ["AWAITING_SIGNATURE", "FAILED", "EXPIRED", "CANCELLED"],
  AWAITING_SIGNATURE: ["SIGNED", "EXPIRED", "CANCELLED", "REJECTED"],
  SIGNED: ["SUBMITTING", "REJECTED"],
  SUBMITTING: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["VALIDATING", "FAILED"],
  VALIDATING: ["VALIDATED", "FAILED"],
  VALIDATED: [],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
  REJECTED: []
};

export function assertTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid transaction status transition ${from} -> ${to}`);
  }
}

