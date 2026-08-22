import type { TransactionIntent } from "./types.js";

export class InMemoryTransactionIntentRepository {
  private readonly intents = new Map<string, TransactionIntent>();
  private readonly fingerprints = new Map<string, string>();

  save(intent: TransactionIntent): TransactionIntent {
    this.intents.set(intent.id, intent);
    this.fingerprints.set(intent.intentFingerprint, intent.id);
    return intent;
  }

  findById(id: string): TransactionIntent | null {
    return this.intents.get(id) ?? null;
  }

  findByFingerprint(fingerprint: string): TransactionIntent | null {
    const id = this.fingerprints.get(fingerprint);
    return id ? this.findById(id) : null;
  }
}

