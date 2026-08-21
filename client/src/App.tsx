import React from "react";
import { ShieldCheck, WalletCards } from "lucide-react";
import { create } from "zustand";
import { apiClient } from "./shared/api";
import type { HealthResponse, WalletProviderId } from "./shared/types";

type AppState = {
  selectedWallet: WalletProviderId | null;
  apiHealth: HealthResponse | null;
  setSelectedWallet: (wallet: WalletProviderId) => void;
  setApiHealth: (health: HealthResponse) => void;
};

const useAppStore = create<AppState>((set) => ({
  selectedWallet: null,
  apiHealth: null,
  setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),
  setApiHealth: (health) => set({ apiHealth: health })
}));

const walletOptions: Array<{ id: WalletProviderId; name: string; phase: string }> = [
  { id: "xaman", name: "Xaman", phase: "Phase 2" },
  { id: "crossmark", name: "Crossmark", phase: "Phase 2" },
  { id: "gemwallet", name: "GemWallet", phase: "Phase 2" },
  { id: "walletconnect", name: "WalletConnect", phase: "Phase 2" },
  { id: "ledger", name: "Ledger", phase: "Phase 2" }
];

export function App() {
  const { selectedWallet, setSelectedWallet, apiHealth, setApiHealth } = useAppStore();

  React.useEffect(() => {
    apiClient
      .health()
      .then(setApiHealth)
      .catch(() => {
        setApiHealth({ status: "unavailable", service: "xrpl-defi-api", version: "unknown" });
      });
  }, [setApiHealth]);

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Application status">
        <div className="brand">
          <ShieldCheck aria-hidden="true" />
          <span>XRPL DeFi</span>
        </div>
        <div className="network-pill">XRPL Testnet default</div>
      </section>

      <section className="workspace">
        <div className="panel intent-panel">
          <p className="eyebrow">Phase 1 foundation</p>
          <h1>Sell XRP flow shell with explicit signing boundary</h1>
          <p>
            This screen intentionally stops before signing. Wallet connections, XRPL transaction
            generation, submission, and monitoring are NOT IMPLEMENTED until their scheduled phases.
          </p>
          <div className="status-grid">
            <div>
              <span>API</span>
              <strong>{apiHealth?.status ?? "checking"}</strong>
            </div>
            <div>
              <span>Network</span>
              <strong>{import.meta.env.VITE_XRPL_NETWORK ?? "testnet"}</strong>
            </div>
            <div>
              <span>Wallet</span>
              <strong>{selectedWallet ?? "not connected"}</strong>
            </div>
          </div>
        </div>

        <aside className="panel wallet-panel" aria-labelledby="wallet-heading">
          <div className="panel-heading">
            <WalletCards aria-hidden="true" />
            <h2 id="wallet-heading">Wallet selection</h2>
          </div>
          <div className="wallet-list">
            {walletOptions.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                className={selectedWallet === wallet.id ? "wallet-option active" : "wallet-option"}
                onClick={() => setSelectedWallet(wallet.id)}
              >
                <span>{wallet.name}</span>
                <small>{wallet.phase} adapter</small>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

