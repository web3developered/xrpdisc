import type { WalletSession } from "../sessions/types.js";
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

