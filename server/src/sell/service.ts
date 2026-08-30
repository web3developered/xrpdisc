import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import type { ObservabilityEvent } from "../observability/events.js";
import type { WalletSession } from "../sessions/types.js";
import type { TransactionIntentService } from "../transactions/service.js";
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
  session: WalletSession;
  idempotencyKey?: string;
};

type Notify = (event: ObservabilityEvent) => Promise<void>;

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
    private readonly discovery: AssetDiscovery,
    private readonly transactionIntentService?: TransactionIntentService,
    private readonly notify: Notify = async () => undefined
  ) {}

  async createQuote(session: WalletSession): Promise<SellQuote> {
    const destination = this.config.AUTHORIZED_XRP_DESTINATIONS[0];
    if (!destination) {
      throw new Error("No company-controlled XRP destination is configured");
    }

    await this.notify({
      name: "sell.begin",
      flowId: session.id,
      sessionId: session.id,
      walletAddress: session.walletAddress,
      walletProvider: session.walletProvider,
      network: session.network,
      status: "STARTED"
    });
    await this.notify({
      name: "sell.asset_discovery.started",
      flowId: session.id,
      sessionId: session.id,
      walletAddress: session.walletAddress,
      walletProvider: session.walletProvider,
      network: session.network
    });
    const discovered = await this.discovery.discover(session);
    const assets = discovered.map((asset) => this.applyEligibilityPolicy(asset));
    const now = new Date();
    const eligibleAssets = assets.filter((asset) => asset.eligible);
    const ineligibleAssets = assets.filter((asset) => !asset.eligible);
    await this.notify({
      name: "sell.asset_discovery.completed",
      flowId: session.id,
      sessionId: session.id,
      walletAddress: session.walletAddress,
      walletProvider: session.walletProvider,
      network: session.network,
      status: "COMPLETED",
      data: {
        totalAssets: assets.length,
        eligibleAssets: eligibleAssets.length,
        ineligibleAssets: ineligibleAssets.length,
        eligibleSummary: eligibleAssets
          .map((asset) => `${asset.id}:${asset.kind}:${asset.spendableBalance}:eligible`)
          .join(";") || "none",
        ineligibleSample: ineligibleAssets
          .slice(0, 10)
          .map((asset) => `${asset.id}:${asset.kind}:${asset.spendableBalance}:ineligible`)
          .join(";") || "none"
      }
    });
    const quote = this.repository.saveQuote({
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
    await this.notify({
      name: "sell.quote.created",
      flowId: quote.id,
      sessionId: quote.sessionId,
      quoteId: quote.id,
      walletAddress: quote.walletAddress,
      network: quote.network,
      status: "CREATED",
      data: {
        destination: quote.destination,
        expiresAt: quote.expiresAt,
        assetCount: quote.assets.length
      }
    });
    return quote;
  }

  getQuote(id: string): SellQuote {
    const quote = this.repository.findQuote(id);
    if (!quote) {
      throw new Error("Sell quote not found");
    }
    return quote;
  }

  async createIntent(input: CreateIntentInput): Promise<SellIntent> {
    if (input.idempotencyKey) {
      const existing = this.repository.findIntentByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const quote = this.getQuote(input.quoteId);
    if (quote.sessionId !== input.session.id) {
      throw new Error("Sell quote does not match active wallet session");
    }
    if (Date.parse(quote.expiresAt) <= Date.now()) {
      throw new Error("Sell quote expired");
    }

    const eligibleAssets = quote.assets.filter((asset) => asset.eligible);
    if (eligibleAssets.length === 0) {
      throw new Error("No eligible XRPL assets are available to sell");
    }

    const transactions = await Promise.all(
      eligibleAssets.map((asset) => this.planAssetTransaction(quote, input.session, asset))
    );
    const now = new Date().toISOString();
    const intent = this.repository.saveIntent(
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
    await this.notify({
      name: "sell.wallet_signing.requested",
      flowId: intent.id,
      sessionId: intent.sessionId,
      quoteId: intent.quoteId,
      sellIntentId: intent.id,
      walletAddress: intent.walletAddress,
      network: intent.network,
      status: intent.status,
      data: {
        transactionCount: intent.transactions.length
      }
    });
    return intent;
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
    const updated = this.repository.updateIntent({
      ...intent,
      transactions,
      status: this.aggregateStatus(transactions),
      settlementEventReady: this.hasSettlementReadyRecord(transactions),
      updatedAt: new Date().toISOString()
    });
    void this.notify({
      name: "sell.asset.confirmed",
      flowId: updated.id,
      sessionId: updated.sessionId,
      quoteId: updated.quoteId,
      sellIntentId: updated.id,
      assetId,
      walletAddress: updated.walletAddress,
      network: updated.network,
      xrplHash: signedTransactionHash,
      status: updated.status,
      data: { ledgerIndex }
    });
    void this.notify({
      name: "settlement.handoff.ready",
      flowId: updated.id,
      sessionId: updated.sessionId,
      quoteId: updated.quoteId,
      sellIntentId: updated.id,
      walletAddress: updated.walletAddress,
      network: updated.network,
      xrplHash: signedTransactionHash,
      status: updated.status
    });
    return updated;
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
    const updated = this.repository.updateIntent({
      ...intent,
      transactions,
      status: this.aggregateStatus(transactions),
      settlementEventReady: this.hasSettlementReadyRecord(transactions),
      updatedAt: new Date().toISOString()
    });
    void this.notify({
      name: "sell.asset.failed",
      flowId: updated.id,
      sessionId: updated.sessionId,
      quoteId: updated.quoteId,
      sellIntentId: updated.id,
      assetId,
      walletAddress: updated.walletAddress,
      network: updated.network,
      status: updated.status,
      message: failureReason
    });
    return updated;
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

  private async planAssetTransaction(
    quote: SellQuote,
    session: WalletSession,
    asset: DiscoveredSellAsset
  ): Promise<SellTransactionPlan> {
    let unsignedTransaction: XrplPaymentTransaction;
    if (asset.kind === "XRP") {
      unsignedTransaction = generatePaymentTransaction(
        this.config,
        {
          account: quote.walletAddress,
          destination: quote.destination,
          amountDrops: asset.spendableBalance,
          memo: `sell-all:${asset.id}`,
          network: quote.network
        },
        {
          skipConfiguredAmountCap: true
        }
      ).transaction;
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

    const transactionIntent = this.transactionIntentService
      ? await this.transactionIntentService.createPreparedPaymentIntent({
          session,
          transaction: unsignedTransaction,
          idempotencyKey: `${quote.id}:${asset.id}`
        })
      : null;
    await this.notify({
      name: "sell.transaction.generated",
      flowId: quote.id,
      sessionId: quote.sessionId,
      quoteId: quote.id,
      assetId: asset.id,
      walletAddress: quote.walletAddress,
      network: quote.network,
      status: "PREPARED",
      ...(transactionIntent?.id ? { transactionIntentId: transactionIntent.id } : {}),
      data: {
        transactionType: unsignedTransaction.TransactionType,
        destination: unsignedTransaction.Destination,
        amount: typeof unsignedTransaction.Amount === "string"
          ? unsignedTransaction.Amount
          : `${unsignedTransaction.Amount.value} ${unsignedTransaction.Amount.currency}.${unsignedTransaction.Amount.issuer}`
      }
    });

    return {
      assetId: asset.id,
      status: "PREPARED",
      unsignedTransaction: transactionIntent?.unsignedTransaction ?? unsignedTransaction,
      ...(transactionIntent
        ? {
            transactionIntentId: transactionIntent.id,
            transactionIntentFingerprint: transactionIntent.intentFingerprint
          }
        : {})
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
