import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("environment safety", () => {
  it("defaults XRPL to testnet", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/xrpl_defi"
    });
    expect(config.XRPL_NETWORK).toBe("testnet");
  });

  it("rejects mainnet unless explicitly enabled", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/xrpl_defi",
        XRPL_NETWORK: "mainnet"
      })
    ).toThrow();
  });
});

