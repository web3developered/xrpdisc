import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import { generatePaymentTransaction } from "../xrpl/payment-policy.js";
import { createIntentFingerprint } from "./fingerprint.js";
import type { InMemoryTransactionIntentRepository } from "./repository.js";
import type { CreatePaymentIntentInput, TransactionIntent } from "./types.js";

export class TransactionIntentService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: InMemoryTransactionIntentRepository
  ) {}

  createPaymentIntent(input: CreatePaymentIntentInput): TransactionIntent {
    const paymentRequest = {
      account: input.session.walletAddress,
      destination: input.destination,
      amountDrops: input.amountDrops,
      network: input.session.network
    };
    const generated = generatePaymentTransaction(this.config, {
      ...paymentRequest,
      ...(input.destinationTag !== undefined ? { destinationTag: input.destinationTag } : {}),
      ...(input.memo !== undefined ? { memo: input.memo } : {})
    });
    const fingerprint = createIntentFingerprint({
      idempotencyKey: input.idempotencyKey,
      sessionId: input.session.id,
      transaction: generated.transaction
    });
    const existing = this.repository.findByFingerprint(fingerprint);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    return this.repository.save({
      id: randomUUID(),
      sessionId: input.session.id,
      network: input.session.network,
      transactionType: "Payment",
      status: "AWAITING_SIGNATURE",
      intentFingerprint: fingerprint,
      unsignedTransaction: generated.transaction,
      autofillStatus: generated.autofillStatus,
      policyWarnings: generated.policyWarnings,
      createdAt: now,
      updatedAt: now
    });
  }

  getIntent(id: string): TransactionIntent {
    const intent = this.repository.findById(id);
    if (!intent) {
      throw new Error("Transaction intent not found");
    }
    return intent;
  }
}
