import { describe, expect, it } from "vitest";
import { CrossmarkAdapter } from "./crossmark";

describe("CrossmarkAdapter", () => {
  it("connects using the detected provider address", async () => {
    const adapter = new CrossmarkAdapter(() => ({
      methods: {
        signInAndWait: async () => ({
          response: { address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh" }
        })
      }
    }));

    await expect(adapter.isAvailable()).resolves.toEqual({ available: true });
    await expect(adapter.connect()).resolves.toMatchObject({
      id: "crossmark",
      address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
    });
  });
});

