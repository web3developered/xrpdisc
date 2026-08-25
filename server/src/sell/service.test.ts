import { describe, expect, it } from "vitest";
import type { AppConfig } from "../config/env.js";
import type { WalletSession } from "../sessions/types.js";
import { StaticAssetDiscovery } from "./discovery.js";
import { InMemorySellRepository } from "./repository.js";
import { SellService } from "./service.js";

const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 8080,
  LOG_LEVEL: "fatal",
  CORS_ORIGIN: "http://localhost:5173",
  XRPL_NETWORK: "testnet",
  XRPL_RPC_URL: "wss://s.altnet.rippletest.net:51233",
  XRPL_CLIENT_ENABLED: false,
  AUTHORIZED_XRP_DESTINATIONS: ["rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"],
  MAX_PAYMENT_DROPS: 100_000_000,
  XRP_RESERVE_DROPS: 10_000_000,
  XRP_TRANSACTION_COST_DROPS: 12,
  SUPPORTED_ISSUED_ASSETS: ["USD.rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"],
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/xrpl_defi",
  REDIS_URL: "redis://localhost:6379",
  SESSION_TTL_SECONDS: 1800,
  REQUIRE_EXPLICIT_MAINNET_ENABLE: false
};

const session: WalletSession = {
  id: "11111111-1111-4111-8111-111111111111",
  walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  walletProvider: "gemwallet",
  network: "testnet",
  createdAt: "2026-08-23T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  lastActivityAt: "2026-08-23T00:00:00.000Z",
  status: "active"
};

describe("SellService", () => {
  it("quotes sell all with XRP reserve protection and supported issued assets", async () => {
    const service = new SellService(
      config,
      new InMemorySellRepository(),
      new StaticAssetDiscovery([
        {
          id: "xrp",
          kind: "XRP",
          currency: "XRP",
          balance: "20000000",
          spendableBalance: "20000000",
          eligible: true
        },
        {
          id: "usd",
          kind: "ISSUED",
          currency: "USD",
          issuer: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
          balance: "25",
          spendableBalance: "25",
          eligible: true
        },
        {
          id: "eur",
          kind: "ISSUED",
          currency: "EUR",
          issuer: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
          balance: "4",
          spendableBalance: "4",
          eligible: true
        }
      ])
    );

    const quote = await service.createQuote(session);

    expect(quote.destination).toBe("rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe");
    expect(quote.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "xrp",
          spendableBalance: "9999988",
          eligible: true
        }),
        expect.objectContaining({
          id: "usd",
          eligible: true
        }),
        expect.objectContaining({
          id: "eur",
          eligible: false,
          ineligibilityReason: "Issued asset is not supported by platform policy"
        })
      ])
    );
  });

  it("creates an idempotent sell intent with transactions only for eligible assets", async () => {
    const repository = new InMemorySellRepository();
    const service = new SellService(
      config,
      repository,
      new StaticAssetDiscovery([
        {
          id: "xrp",
          kind: "XRP",
          currency: "XRP",
          balance: "20000000",
          spendableBalance: "20000000",
          eligible: true
        },
        {
          id: "usd",
          kind: "ISSUED",
          currency: "USD",
          issuer: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
          balance: "25",
          spendableBalance: "25",
          eligible: true
        }
      ])
    );

    const quote = await service.createQuote(session);
    const first = await service.createIntent({ quoteId: quote.id, session, idempotencyKey: "sell-once" });
    const second = await service.createIntent({ quoteId: quote.id, session, idempotencyKey: "sell-once" });

    expect(second.id).toBe(first.id);
    expect(first.status).toBe("AWAITING_USER_SIGNATURE");
    expect(first.transactions).toHaveLength(2);
    expect(first.transactions[0]?.unsignedTransaction.Destination).toBe(config.AUTHORIZED_XRP_DESTINATIONS[0]);
  });

  it("allows sell all XRP to exceed the generic payment cap after reserve protection", async () => {
    const service = new SellService(
      config,
      new InMemorySellRepository(),
      new StaticAssetDiscovery([
        {
          id: "xrp",
          kind: "XRP",
          currency: "XRP",
          balance: "500000000",
          spendableBalance: "489999988",
          eligible: true
        }
      ])
    );

    const quote = await service.createQuote(session);
    const intent = await service.createIntent({ quoteId: quote.id, session });

    expect(intent.transactions).toHaveLength(1);
    expect(intent.transactions[0]?.unsignedTransaction.Amount).toBe("489999988");
  });

  it("records partial success and marks settlement handoff ready for confirmed assets only", async () => {
    const service = new SellService(
      config,
      new InMemorySellRepository(),
      new StaticAssetDiscovery([
        {
          id: "xrp",
          kind: "XRP",
          currency: "XRP",
          balance: "20000000",
          spendableBalance: "20000000",
          eligible: true
        },
        {
          id: "usd",
          kind: "ISSUED",
          currency: "USD",
          issuer: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
          balance: "25",
          spendableBalance: "25",
          eligible: true
        }
      ])
    );

    const quote = await service.createQuote(session);
    const intent = await service.createIntent({ quoteId: quote.id, session });
    service.confirmAsset(intent.id, "xrp", "A".repeat(64), 12345);
    const partial = service.recordAssetFailure(intent.id, "usd", "tesSUCCESS not observed before timeout");

    expect(partial.status).toBe("PARTIAL_FAILURE");
    expect(partial.settlementEventReady).toBe(true);
    expect(partial.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: "xrp", status: "CONFIRMED", confirmedLedgerIndex: 12345 }),
        expect.objectContaining({ assetId: "usd", status: "FAILED" })
      ])
    );
  });
});
