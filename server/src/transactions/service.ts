import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import { generatePaymentTransaction } from "../xrpl/payment-policy.js";
import type { XrplGateway } from "../xrpl/client.js";
import { createIntentFingerprint } from "./fingerprint.js";
import type { InMemoryTransactionIntentRepository } from "./repository.js";
import { assertTransition } from "./state-machine.js";
import type {
  AcceptSignatureInput,
  CreatePreparedPaymentIntentInput,
  CreatePaymentIntentInput,
  SubmissionRecord,
  TransactionIntent,
  TransactionStatus
} from "./types.js";

export class TransactionIntentService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: InMemoryTransactionIntentRepository,
    private readonly xrpl?: XrplGateway
  ) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<TransactionIntent> {
    const paymentRequest = {
      account: input.session.walletAddress,
      destination: input.destination,
      amountDrops: input.amountDrops,
      network: input.session.network
    };
    let generated = generatePaymentTransaction(this.config, {
      ...paymentRequest,
      ...(input.destinationTag !== undefined ? { destinationTag: input.destinationTag } : {}),
      ...(input.memo !== undefined ? { memo: input.memo } : {})
    });
    if (this.xrpl) {
      generated = {
        transaction: await this.xrpl.autofillPayment(generated.transaction),
        autofillStatus: "autofilled",
        policyWarnings: []
      };
    }
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

  async createPreparedPaymentIntent(input: CreatePreparedPaymentIntentInput): Promise<TransactionIntent> {
    let transaction = input.transaction;
    let autofillStatus: TransactionIntent["autofillStatus"] = "requires_xrpl_client";
    let policyWarnings = input.policyWarnings ?? [
      "Sequence, Fee, and LastLedgerSequence are not autofilled until the official XRPL client is enabled."
    ];

    if (this.xrpl) {
      transaction = await this.xrpl.autofillPayment(input.transaction);
      autofillStatus = "autofilled";
      policyWarnings = [];
    }

    const fingerprint = createIntentFingerprint({
      idempotencyKey: input.idempotencyKey,
      sessionId: input.session.id,
      transaction
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
      unsignedTransaction: transaction,
      autofillStatus,
      policyWarnings,
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

  acceptSignature(input: AcceptSignatureInput): TransactionIntent {
    const intent = this.getIntent(input.intentId);
    if (intent.status !== "AWAITING_SIGNATURE") {
      throw new Error(`Cannot accept signature while transaction is ${intent.status}`);
    }
    if (input.signerAddress !== intent.unsignedTransaction.Account) {
      throw new Error("Signed transaction signer does not match intent account");
    }
    if (input.unsignedTransactionFingerprint !== intent.intentFingerprint) {
      throw new Error("Signed transaction does not correspond to the approved unsigned intent");
    }
    if (!/^[A-Fa-f0-9]+$/.test(input.txBlob) || input.txBlob.length < 16) {
      throw new Error("Signed transaction blob must be hex encoded");
    }
    if (!/^[A-Fa-f0-9]{64}$/.test(input.signedTransactionHash)) {
      throw new Error("Signed transaction hash must be a 64-character hex string");
    }

    return this.transition(intent, "SIGNED", {
      signedTransaction: {
        signerAddress: input.signerAddress,
        signedTransactionHash: input.signedTransactionHash.toUpperCase(),
        txBlob: input.txBlob.toUpperCase(),
        acceptedAt: new Date().toISOString()
      }
    });
  }

  async submit(intentId: string): Promise<TransactionIntent> {
    const intent = this.getIntent(intentId);
    if (intent.status !== "SIGNED") {
      throw new Error(`Cannot submit transaction while it is ${intent.status}`);
    }

    if (this.xrpl && intent.signedTransaction) {
      const submitting = this.transition(intent, "SUBMITTING");
      const result = await this.xrpl.submitSignedTransaction(intent.signedTransaction.txBlob);
      const submission: SubmissionRecord = {
        attemptId: randomUUID(),
        status: result.accepted ? "submitted" : "failed",
        engineResult: result.engineResult,
        ...(result.hash ? { xrplHash: result.hash } : {}),
        ...(result.ledgerIndex ? { ledgerIndex: result.ledgerIndex } : {}),
        createdAt: new Date().toISOString()
      };

      if (!result.accepted) {
        return this.transition(submitting, "FAILED", { submission });
      }
      return this.transition(submitting, "SUBMITTED", { submission });
    }

    const failureReason =
      "XRPL submission is blocked until XRPL_CLIENT_ENABLED=true is configured.";
    const submission: SubmissionRecord = {
      attemptId: randomUUID(),
      status: "blocked",
      failureReason,
      createdAt: new Date().toISOString()
    };

    const submitting = this.transition(intent, "SUBMITTING", {
      submission
    });

    return this.transition(submitting, "FAILED", {
      submission,
      monitoring: {
        status: "terminal",
        lastCheckedAt: new Date().toISOString(),
        terminal: true,
        reason: failureReason
      }
    });
  }

  async monitor(intentId: string): Promise<TransactionIntent> {
    const intent = this.getIntent(intentId);
    const now = new Date().toISOString();
    if (["VALIDATED", "FAILED", "EXPIRED", "CANCELLED", "REJECTED"].includes(intent.status)) {
      const reason = intent.submission?.failureReason ?? `Transaction is terminal: ${intent.status}`;
      return this.repository.update({
        ...intent,
        monitoring: {
          status: "terminal",
          lastCheckedAt: now,
          terminal: true,
          reason
        },
        updatedAt: now
      });
    }

    if (this.xrpl && intent.submission?.xrplHash) {
      const validating = intent.status === "SUBMITTED" ? this.transition(intent, "VALIDATING") : intent;
      const validation = await this.xrpl.lookupTransaction(intent.submission.xrplHash);
      if (validation.validated) {
        return this.transition(validating, "VALIDATED", {
          submission: {
            ...validating.submission!,
            ...(validation.ledgerIndex ? { ledgerIndex: validation.ledgerIndex } : {}),
            ...(validation.engineResult ? { engineResult: validation.engineResult } : {})
          },
          monitoring: {
            status: "terminal",
            lastCheckedAt: now,
            terminal: true,
            reason: "XRPL transaction validated"
          }
        });
      }
    }

    return this.repository.update({
      ...intent,
      monitoring: {
        status: intent.status === "SUBMITTED" ? "waiting_for_validation" : "waiting_for_submission",
        lastCheckedAt: now,
        terminal: false
      },
      updatedAt: now
    });
  }

  private transition(
    intent: TransactionIntent,
    to: TransactionStatus,
    patch: Partial<TransactionIntent> = {}
  ): TransactionIntent {
    assertTransition(intent.status, to);
    return this.repository.update({
      ...intent,
      ...patch,
      status: to,
      updatedAt: new Date().toISOString()
    });
  }
}
