import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("environment safety", () => {
  it("defaults non-production XRPL configuration to testnet", () => {
    const config = loadConfig({});
    expect(config.XRPL_NETWORK).toBe("testnet");
    expect(config.HOST).toBe("0.0.0.0");
    expect(config.XRPL_RPC_URL).toBe("wss://s.altnet.rippletest.net:51233");
  });

  it("forces production onto XRPL mainnet even when stale testnet variables are present", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      XRPL_NETWORK: "testnet",
      XRPL_RPC_URL: "wss://s.altnet.rippletest.net:51233",
      XRPL_CLIENT_ENABLED: "false",
      REQUIRE_EXPLICIT_MAINNET_ENABLE: "false",
      AUTHORIZED_XRP_DESTINATIONS: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
    });

    expect(config.XRPL_NETWORK).toBe("mainnet");
    expect(config.XRPL_RPC_URL).toBe("wss://xrplcluster.com");
    expect(config.XRPL_CLIENT_ENABLED).toBe(true);
    expect(config.REQUIRE_EXPLICIT_MAINNET_ENABLE).toBe(true);
  });

  it("does not require database configuration for the Phase 1 shell", () => {
    const config = loadConfig({});
    expect(config.DATABASE_URL).toBeUndefined();
  });

  it("uses the mainnet XRPL endpoint when mainnet is selected without an RPC override", () => {
    const config = loadConfig({
      XRPL_NETWORK: "mainnet",
      AUTHORIZED_XRP_DESTINATIONS: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
    });

    expect(config.XRPL_NETWORK).toBe("mainnet");
    expect(config.XRPL_RPC_URL).toBe("wss://xrplcluster.com");
    expect(config.REQUIRE_EXPLICIT_MAINNET_ENABLE).toBe(true);
  });

  it("rejects mainnet without an authorized company destination", () => {
    expect(() =>
      loadConfig({
        XRPL_NETWORK: "mainnet"
      })
    ).toThrow(/AUTHORIZED_XRP_DESTINATIONS/);
  });

  it("accepts explicitly configured mainnet with destination allowlist and RPC", () => {
    const config = loadConfig({
      XRPL_NETWORK: "mainnet",
      XRPL_RPC_URL: "wss://xrplcluster.com",
      REQUIRE_EXPLICIT_MAINNET_ENABLE: "true",
      AUTHORIZED_XRP_DESTINATIONS: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
      MAX_PAYMENT_DROPS: "100000"
    });

    expect(config.XRPL_NETWORK).toBe("mainnet");
    expect(config.XRPL_RPC_URL).toBe("wss://xrplcluster.com");
    expect(config.AUTHORIZED_XRP_DESTINATIONS).toEqual(["rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"]);
    expect(config.MAX_PAYMENT_DROPS).toBe(100000);
  });
});
