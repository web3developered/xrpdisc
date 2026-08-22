import React from "react";
import { AlertCircle, CheckCircle2, Plug, ShieldCheck, WalletCards } from "lucide-react";
import { create } from "zustand";
import { apiClient } from "./shared/api";
import type { HealthResponse, WalletProviderId } from "./shared/types";
import { createWalletRegistry } from "./wallets/registry";
import type { WalletAdapter, WalletAvailability, WalletConnection, WalletStatus } from "./wallets/types";

type AppState = {
  selectedWallet: WalletProviderId | null;
  apiHealth: HealthResponse | null;
  walletStatuses: Record<WalletProviderId, WalletStatus>;
  walletAvailability: Partial<Record<WalletProviderId, WalletAvailability>>;
  walletConnection: WalletConnection | null;
  walletError: string | null;
  setSelectedWallet: (wallet: WalletProviderId) => void;
  setApiHealth: (health: HealthResponse) => void;
  setWalletStatus: (wallet: WalletProviderId, status: WalletStatus) => void;
  setWalletAvailability: (wallet: WalletProviderId, availability: WalletAvailability) => void;
  setWalletConnection: (connection: WalletConnection | null) => void;
  setWalletError: (error: string | null) => void;
};

const registry = createWalletRegistry();

const initialWalletStatuses = registry.adapters.reduce(
  (statuses, adapter) => ({ ...statuses, [adapter.id]: "idle" }),
  {} as Record<WalletProviderId, WalletStatus>
);

const useAppStore = create<AppState>((set) => ({
  selectedWallet: null,
  apiHealth: null,
  walletStatuses: initialWalletStatuses,
  walletAvailability: {},
  walletConnection: null,
  walletError: null,
  setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),
  setApiHealth: (health) => set({ apiHealth: health }),
  setWalletStatus: (wallet, status) =>
    set((state) => ({ walletStatuses: { ...state.walletStatuses, [wallet]: status } })),
  setWalletAvailability: (wallet, availability) =>
    set((state) => ({
      walletAvailability: { ...state.walletAvailability, [wallet]: availability }
    })),
  setWalletConnection: (connection) => set({ walletConnection: connection }),
  setWalletError: (error) => set({ walletError: error })
}));

function capabilitySummary(adapter: WalletAdapter): string {
  const labels = [
    adapter.capabilities.requiresBrowserExtension ? "extension" : null,
    adapter.capabilities.requiresMobileApp ? "mobile" : null,
    adapter.capabilities.requiresHardwareDevice ? "hardware" : null,
    adapter.capabilities.requiresApiKey ? "API key" : null,
    adapter.capabilities.requiresProjectId ? "project ID" : null
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(" + ") : "browser wallet";
}

export function App() {
  const {
    selectedWallet,
    setSelectedWallet,
    apiHealth,
    setApiHealth,
    walletStatuses,
    walletAvailability,
    walletConnection,
    walletError,
    setWalletStatus,
    setWalletAvailability,
    setWalletConnection,
    setWalletError
  } = useAppStore();

  React.useEffect(() => {
    apiClient
      .health()
      .then(setApiHealth)
      .catch(() => {
        setApiHealth({ status: "unavailable", service: "xrpl-defi-api", version: "unknown" });
      });
  }, [setApiHealth]);

  React.useEffect(() => {
    registry.adapters.forEach((adapter) => {
      setWalletStatus(adapter.id, "checking");
      adapter
        .isAvailable()
        .then((availability) => {
          setWalletAvailability(adapter.id, availability);
          setWalletStatus(adapter.id, availability.available ? "available" : "unavailable");
        })
        .catch((error: unknown) => {
          setWalletAvailability(adapter.id, {
            available: false,
            reason: error instanceof Error ? error.message : "Wallet availability check failed."
          });
          setWalletStatus(adapter.id, "failed");
        });
    });
  }, [setWalletAvailability, setWalletStatus]);

  async function connectWallet(adapter: WalletAdapter) {
    setSelectedWallet(adapter.id);
    setWalletError(null);
    setWalletStatus(adapter.id, "connecting");
    try {
      const connection = await adapter.connect();
      setWalletConnection(connection);
      setWalletStatus(adapter.id, "connected");
    } catch (error) {
      setWalletConnection(null);
      setWalletStatus(adapter.id, "failed");
      setWalletError(error instanceof Error ? error.message : "Wallet connection failed.");
    }
  }

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
          <p className="eyebrow">Phase 2 wallet boundary</p>
          <h1>Connect an XRPL wallet before any transaction request exists</h1>
          <p>
            Wallet adapters are isolated from transaction logic. Connecting a wallet only identifies
            the account; signing still requires a later explicit transaction review.
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
              <strong>{walletConnection?.address ?? selectedWallet ?? "not connected"}</strong>
            </div>
          </div>
          {walletConnection ? (
            <div className="connection-banner success">
              <CheckCircle2 aria-hidden="true" />
              <span>
                Connected with {walletConnection.name} on {walletConnection.network}
              </span>
            </div>
          ) : null}
          {walletError ? (
            <div className="connection-banner warning" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{walletError}</span>
            </div>
          ) : null}
        </div>

        <aside className="panel wallet-panel" aria-labelledby="wallet-heading">
          <div className="panel-heading">
            <WalletCards aria-hidden="true" />
            <h2 id="wallet-heading">Wallet selection</h2>
          </div>
          <div className="wallet-list">
            {registry.adapters.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                className={selectedWallet === wallet.id ? "wallet-option active" : "wallet-option"}
                onClick={() => void connectWallet(wallet)}
              >
                <span className="wallet-option-title">
                  <span>{wallet.name}</span>
                  <Plug aria-hidden="true" />
                </span>
                <small>{capabilitySummary(wallet)}</small>
                <em>
                  {walletStatuses[wallet.id]}
                  {walletAvailability[wallet.id]?.reason
                    ? `: ${walletAvailability[wallet.id]?.reason}`
                    : ""}
                </em>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

