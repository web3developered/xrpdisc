import type { WalletSession } from "../sessions/types.js";
import type { XrplGateway } from "../xrpl/client.js";
import type { AssetDiscovery, DiscoveredSellAsset } from "./types.js";

export class UnavailableAssetDiscovery implements AssetDiscovery {
  async discover(_session: WalletSession): Promise<DiscoveredSellAsset[]> {
    throw new Error(
      "XRPL asset discovery is unavailable until the official XRPL client and persistence are configured."
    );
  }
}

export class StaticAssetDiscovery implements AssetDiscovery {
  constructor(private readonly assets: DiscoveredSellAsset[]) {}

  async discover(_session: WalletSession): Promise<DiscoveredSellAsset[]> {
    return this.assets;
  }
}

export class XrplAssetDiscovery implements AssetDiscovery {
  constructor(private readonly xrpl: XrplGateway) {}

  async discover(session: WalletSession): Promise<DiscoveredSellAsset[]> {
    const snapshot = await this.xrpl.getAccountSnapshot(session.walletAddress);
    const assets: DiscoveredSellAsset[] = [
      {
        id: "XRP",
        kind: "XRP",
        currency: "XRP",
        balance: snapshot.balanceDrops,
        spendableBalance: snapshot.balanceDrops,
        eligible: true
      }
    ];

    for (const line of snapshot.trustlines) {
      const balance = Number(line.balance);
      const malformed = !Number.isFinite(balance) || balance <= 0;
      assets.push({
        id: `${line.currency}.${line.account}`,
        kind: "ISSUED",
        currency: line.currency,
        issuer: line.account,
        balance: line.balance,
        spendableBalance: malformed ? "0" : line.balance,
        eligible: !malformed && line.freeze !== true,
        ...(malformed
          ? { ineligibilityReason: "Issued asset balance is zero, negative, or malformed" }
          : {}),
        ...(line.freeze === true ? { ineligibilityReason: "Issued asset trustline is frozen" } : {})
      });
    }

    return assets;
  }
}
