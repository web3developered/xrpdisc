import { describe, expect, it } from "vitest";
import { GemWalletAdapter } from "./gemwallet";

describe("GemWalletAdapter", () => {
  it("connects using the detected provider address without signing", async () => {
    const adapter = new GemWalletAdapter(() => ({
      isInstalled: async () => ({ type: "response", result: { isInstalled: true } }),
      getAddress: async () => ({ type: "response", result: { address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh" } }),
      getNetwork: async () => ({ type: "response", result: { network: "testnet" } })
    }));

    await expect(adapter.isAvailable()).resolves.toEqual({ available: true });
    await expect(adapter.connect()).resolves.toMatchObject({
      id: "gemwallet",
      address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      network: "testnet"
    });
  });
});

