import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("environment safety", () => {
  it("defaults XRPL to testnet", () => {
    const config = loadConfig({});
    expect(config.XRPL_NETWORK).toBe("testnet");
  });

  it("does not require database configuration for the Phase 1 shell", () => {
    const config = loadConfig({});
    expect(config.DATABASE_URL).toBeUndefined();
  });

  it("rejects mainnet unless explicitly enabled", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/xrpl_defi",
        XRPL_NETWORK: "mainnet",
        AUTHORIZED_XRP_DESTINATIONS: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
      })
    ).toThrow();
  });

  it("accepts explicitly enabled mainnet with destination allowlist and mainnet RPC", () => {
    const config = loadConfig({
      XRPL_NETWORK: "mainnet",
      XRPL_RPC_URL: "wss://xrplcluster.com",
      REQUIRE_EXPLICIT_MAINNET_ENABLE: "true",
      AUTHORIZED_XRP_DESTINATIONS: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
      MAX_PAYMENT_DROPS: "100000"
    });

    expect(config.XRPL_NETWORK).toBe("mainnet");
    expect(config.AUTHORIZED_XRP_DESTINATIONS).toEqual(["rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"]);
    expect(config.MAX_PAYMENT_DROPS).toBe(100000);
  });
});
