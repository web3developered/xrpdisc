import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import type { WalletSession } from "../sessions/types.js";
import { generatePaymentTransaction } from "../xrpl/payment-policy.js";
import type { XrplPaymentTransaction } from "../xrpl/types.js";
import type { InMemorySellRepository } from "./repository.js";
import type {
  AssetDiscovery,
  DiscoveredSellAsset,
  SellIntent,
  SellQuote,
  SellTransactionPlan
} from "./types.js";

type CreateIntentInput = {
  quoteId: string;
  idempotencyKey?: string;
};

function parseDrops(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error("XRP balance must be a drops integer string");
  }
  return BigInt(value);
}

function assetKey(asset: DiscoveredSellAsset): string {
  return asset.kind === "XRP" ? "XRP" : `${asset.currency}.${asset.issuer}`;
}

export class SellService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: InMemorySellRepository,
    private readonly discovery: AssetDiscovery
  ) {}

  async createQuote(session: WalletSession): Promise<SellQuote> {
    const destination = this.config.AUTHORIZED_XRP_DESTINATIONS[0];
    if (!destination) {
      throw new Error("No company-controlled XRP destination is configured");
    }

    const discovered = await this.discovery.discover(session);
    const assets = discovered.map((asset) => this.applyEligibilityPolicy(asset));
    const now = new Date();
    return this.repository.saveQuote({
      id: randomUUID(),
      sessionId: session.id,
      walletAddress: session.walletAddress,
      network: session.network,
      destination,
      assets,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      warnings: [
        "Fiat/cash settlement is out of scope. Confirmed records are handed to existing settlement infrastructure."
      ]
    });
  }

  createIntent(input: CreateIntentInput): SellIntent {
    if (input.idempotencyKey) {
      const existing = this.repository.findIntentByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const quote = this.repository.findQuote(input.quoteId);
    if (!quote) {
      throw new Error("Sell quote not found");
    }
    if (Date.parse(quote.expiresAt) <= Date.now()) {
      throw new Error("Sell quote expired");
    }

    const eligibleAssets = quote.assets.filter((asset) => asset.eligible);
    if (eligibleAssets.length === 0) {
      throw new Error("No eligible XRPL assets are available to sell");
    }

    const transactions = eligibleAssets.map((asset) => this.planAssetTransaction(quote, asset));
    const now = new Date().toISOString();
    return this.repository.saveIntent(
      {
        id: randomUUID(),
        quoteId: quote.id,
        sessionId: quote.sessionId,
        walletAddress: quote.walletAddress,
        network: quote.network,
        destination: quote.destination,
        status: "AWAITING_USER_SIGNATURE",
        assets: quote.assets,
        transactions,
        settlementEventReady: false,
        createdAt: now,
        updatedAt: now
      },
      input.idempotencyKey
    );
  }

  getIntent(id: string): SellIntent {
    const intent = this.repository.findIntent(id);
    if (!intent) {
      throw new Error("Sell intent not found");
    }
    return intent;
  }

  confirmAsset(intentId: string, assetId: string, signedTransactionHash: string, ledgerIndex: number): SellIntent {
    const intent = this.getIntent(intentId);
    const transactions = intent.transactions.map((transaction) =>
      transaction.assetId === assetId
        ? {
            ...transaction,
            status: "CONFIRMED" as const,
            signedTransactionHash,
            confirmedLedgerIndex: ledgerIndex
          }
        : transaction
    );
    return this.repository.updateIntent({
      ...intent,
      transactions,
      status: this.aggregateStatus(transactions),
      settlementEventReady: this.hasSettlementReadyRecord(transactions),
      updatedAt: new Date().toISOString()
    });
  }

  recordAssetFailure(intentId: string, assetId: string, failureReason: string): SellIntent {
    const intent = this.getIntent(intentId);
    const transactions = intent.transactions.map((transaction) =>
      transaction.assetId === assetId
        ? {
            ...transaction,
            status: "FAILED" as const,
            failureReason
          }
        : transaction
    );
    return this.repository.updateIntent({
      ...intent,
      transactions,
      status: this.aggregateStatus(transactions),
      settlementEventReady: this.hasSettlementReadyRecord(transactions),
      updatedAt: new Date().toISOString()
    });
  }

  private applyEligibilityPolicy(asset: DiscoveredSellAsset): DiscoveredSellAsset {
    if (asset.kind === "XRP") {
      const balance = parseDrops(asset.balance);
      const reserve = BigInt(this.config.XRP_RESERVE_DROPS);
      const cost = BigInt(this.config.XRP_TRANSACTION_COST_DROPS);
      if (balance <= reserve + cost) {
        return {
          ...asset,
          spendableBalance: "0",
          eligible: false,
          ineligibilityReason: "XRP balance does not exceed reserve plus estimated transaction cost"
        };
      }
      return {
        ...asset,
        spendableBalance: (balance - reserve - cost).toString(),
        eligible: true
      };
    }

    const key = assetKey(asset);
    if (!asset.issuer || !this.config.SUPPORTED_ISSUED_ASSETS.includes(key)) {
      return {
        ...asset,
        eligible: false,
        ineligibilityReason: "Issued asset is not supported by platform policy"
      };
    }
    return asset;
  }

  private planAssetTransaction(quote: SellQuote, asset: DiscoveredSellAsset): SellTransactionPlan {
    let unsignedTransaction: XrplPaymentTransaction;
    if (asset.kind === "XRP") {
      unsignedTransaction = generatePaymentTransaction(this.config, {
        account: quote.walletAddress,
        destination: quote.destination,
        amountDrops: asset.spendableBalance,
        memo: `sell-all:${asset.id}`,
        network: quote.network
      }).transaction;
    } else {
      unsignedTransaction = {
        TransactionType: "Payment",
        Account: quote.walletAddress,
        Destination: quote.destination,
        Amount: {
          currency: asset.currency,
          issuer: asset.issuer ?? "",
          value: asset.spendableBalance
        }
      };
    }

    if (unsignedTransaction.Destination !== quote.destination) {
      throw new Error("Generated sell transaction destination does not match company destination");
    }

    return {
      assetId: asset.id,
      status: "PREPARED",
      unsignedTransaction
    };
  }

  private aggregateStatus(transactions: SellTransactionPlan[]): SellIntent["status"] {
    const confirmed = transactions.filter((transaction) => transaction.status === "CONFIRMED").length;
    const failed = transactions.filter((transaction) => transaction.status === "FAILED").length;
    if (confirmed === transactions.length) {
      return "CONFIRMED";
    }
    if (failed === transactions.length) {
      return "FAILED";
    }
    if (confirmed > 0 && failed > 0) {
      return "PARTIAL_FAILURE";
    }
    return "AWAITING_USER_SIGNATURE";
  }

  private hasSettlementReadyRecord(transactions: SellTransactionPlan[]): boolean {
    return transactions.some((transaction) => transaction.status === "CONFIRMED");
  }
}

