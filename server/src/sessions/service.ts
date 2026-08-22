import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import { assertClassicXrplAddress } from "../xrpl/address.js";
import type { XrplNetwork } from "../xrpl/types.js";
import type { InMemorySessionRepository } from "./repository.js";
import type { WalletProviderId, WalletSession } from "./types.js";

type CreateSessionInput = {
  walletAddress: string;
  walletProvider: WalletProviderId;
  network: XrplNetwork;
};

export class SessionService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: InMemorySessionRepository
  ) {}

  create(input: CreateSessionInput): WalletSession {
    if (input.network !== this.config.XRPL_NETWORK) {
      throw new Error(
        `Session network ${input.network} does not match backend network ${this.config.XRPL_NETWORK}`
      );
    }
    assertClassicXrplAddress(input.walletAddress, "walletAddress");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.SESSION_TTL_SECONDS * 1000);
    return this.repository.save({
      id: randomUUID(),
      walletAddress: input.walletAddress,
      walletProvider: input.walletProvider,
      network: input.network,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivityAt: now.toISOString(),
      status: "active"
    });
  }

  getActive(id: string): WalletSession {
    const session = this.repository.findById(id);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.status !== "active" || Date.parse(session.expiresAt) <= Date.now()) {
      throw new Error("Session is not active");
    }
    return session;
  }
}

