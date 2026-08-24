import { CrossmarkAdapter } from "./adapters/crossmark";
import { GemWalletAdapter } from "./adapters/gemwallet";
import { LedgerAdapter } from "./adapters/ledger";
import { WalletConnectAdapter } from "./adapters/walletconnect";
import { XamanAdapter } from "./adapters/xaman";
import { readPublicConfig } from "../shared/runtime-config";
import type { WalletAdapter, WalletId } from "./types";

export type WalletRegistry = {
  adapters: WalletAdapter[];
  get(walletId: WalletId): WalletAdapter;
};

export function createWalletRegistry(): WalletRegistry {
  const adapters: WalletAdapter[] = [
    new XamanAdapter(readPublicConfig("VITE_XAMAN_API_KEY")),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new WalletConnectAdapter(readPublicConfig("VITE_WALLETCONNECT_PROJECT_ID")),
    new LedgerAdapter()
  ];

  return {
    adapters,
    get(walletId) {
      const adapter = adapters.find((candidate) => candidate.id === walletId);
      if (!adapter) {
        throw new Error(`Unknown wallet adapter: ${walletId}`);
      }
      return adapter;
    }
  };
}
