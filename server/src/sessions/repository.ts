import type { WalletSession } from "./types.js";

export class InMemorySessionRepository {
  private readonly sessions = new Map<string, WalletSession>();

  save(session: WalletSession): WalletSession {
    this.sessions.set(session.id, session);
    return session;
  }

  findById(id: string): WalletSession | null {
    return this.sessions.get(id) ?? null;
  }
}

