import { describe, expect, it } from "vitest";
import { createWalletRegistry } from "./registry";

describe("wallet registry", () => {
  it("registers all Phase 2 wallet adapters", () => {
    const registry = createWalletRegistry();

    expect(registry.adapters.map((adapter) => adapter.id)).toEqual([
      "xaman",
      "crossmark",
      "gemwallet",
      "walletconnect",
      "ledger"
    ]);
  });

  it("does not advertise backend submission from wallet adapters", () => {
    const registry = createWalletRegistry();

    for (const adapter of registry.adapters) {
      expect(adapter.capabilities.submitTransaction.supported).toBe(false);
    }
  });
});

