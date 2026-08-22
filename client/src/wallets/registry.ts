import { CrossmarkAdapter } from "./adapters/crossmark";
import { GemWalletAdapter } from "./adapters/gemwallet";
import { LedgerAdapter } from "./adapters/ledger";
import { WalletConnectAdapter } from "./adapters/walletconnect";
import { XamanAdapter } from "./adapters/xaman";
import type { WalletAdapter, WalletId } from "./types";

type WalletGlobals = typeof globalThis & {
  crossmark?: ConstructorParameters<typeof CrossmarkAdapter>[0] extends () => infer T ? T : never;
  gemWallet?: ConstructorParameters<typeof GemWalletAdapter>[0] extends () => infer T ? T : never;
};

export type WalletRegistry = {
  adapters: WalletAdapter[];
  get(walletId: WalletId): WalletAdapter;
};

function readWalletGlobals(): WalletGlobals {
  return globalThis as WalletGlobals;
}

export function createWalletRegistry(): WalletRegistry {
  const globals = readWalletGlobals();
  const adapters: WalletAdapter[] = [
    new XamanAdapter(import.meta.env.VITE_XAMAN_API_KEY),
    new CrossmarkAdapter(() => globals.crossmark),
    new GemWalletAdapter(() => globals.gemWallet),
    new WalletConnectAdapter(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID),
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
