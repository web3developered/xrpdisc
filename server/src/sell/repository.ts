import type { SellIntent, SellQuote } from "./types.js";

export class InMemorySellRepository {
  private readonly quotes = new Map<string, SellQuote>();
  private readonly intents = new Map<string, SellIntent>();
  private readonly idempotencyKeys = new Map<string, string>();

  saveQuote(quote: SellQuote): SellQuote {
    this.quotes.set(quote.id, quote);
    return quote;
  }

  findQuote(id: string): SellQuote | null {
    return this.quotes.get(id) ?? null;
  }

  saveIntent(intent: SellIntent, idempotencyKey?: string): SellIntent {
    this.intents.set(intent.id, intent);
    if (idempotencyKey) {
      this.idempotencyKeys.set(idempotencyKey, intent.id);
    }
    return intent;
  }

  updateIntent(intent: SellIntent): SellIntent {
    this.intents.set(intent.id, intent);
    return intent;
  }

  findIntent(id: string): SellIntent | null {
    return this.intents.get(id) ?? null;
  }

  findIntentByIdempotencyKey(idempotencyKey: string): SellIntent | null {
    const id = this.idempotencyKeys.get(idempotencyKey);
    return id ? this.findIntent(id) : null;
  }
}

