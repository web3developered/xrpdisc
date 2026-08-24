import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { create } from "zustand";
import { SellAllButton } from "./sell/SellAllButton";
import { SellFlowController } from "./sell/SellFlowController";
import type { SellFlowSnapshot } from "./sell/types";
import { apiClient } from "./shared/api";
import { readXrplNetwork } from "./shared/runtime-config";
import type { HealthResponse, WalletProviderId } from "./shared/types";
import { WalletSelector } from "./wallets/WalletSelector";
import { createWalletRegistry } from "./wallets/registry";
import type { WalletAdapter, WalletAvailability, WalletConnection, WalletStatus } from "./wallets/types";

type AppState = {
  selectedWallet: WalletProviderId | null;
  apiHealth: HealthResponse | null;
  walletStatuses: Record<WalletProviderId, WalletStatus>;
  walletAvailability: Partial<Record<WalletProviderId, WalletAvailability>>;
  walletConnection: WalletConnection | null;
  sellFlow: SellFlowSnapshot;
  setSelectedWallet: (wallet: WalletProviderId | null) => void;
  setApiHealth: (health: HealthResponse) => void;
  setWalletStatus: (wallet: WalletProviderId, status: WalletStatus) => void;
  setWalletAvailability: (wallet: WalletProviderId, availability: WalletAvailability) => void;
  setWalletConnection: (connection: WalletConnection | null) => void;
  setSellFlow: (snapshot: SellFlowSnapshot) => void;
};

const registry = createWalletRegistry();

const initialWalletStatuses = registry.adapters.reduce(
  (statuses, adapter) => ({ ...statuses, [adapter.id]: "idle" }),
  {} as Record<WalletProviderId, WalletStatus>
);

const initialSellFlow: SellFlowSnapshot = {
  state: "IDLE",
  message: "Ready.",
  connection: null,
  sessionId: null,
  quoteId: null,
  intentId: null,
  error: null
};

const useAppStore = create<AppState>((set) => ({
  selectedWallet: null,
  apiHealth: null,
  walletStatuses: initialWalletStatuses,
  walletAvailability: {},
  walletConnection: null,
  sellFlow: initialSellFlow,
  setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),
  setApiHealth: (health) => set({ apiHealth: health }),
  setWalletStatus: (wallet, status) =>
    set((state) => ({ walletStatuses: { ...state.walletStatuses, [wallet]: status } })),
  setWalletAvailability: (wallet, availability) =>
    set((state) => ({
      walletAvailability: { ...state.walletAvailability, [wallet]: availability }
    })),
  setWalletConnection: (connection) => set({ walletConnection: connection }),
  setSellFlow: (snapshot) =>
    set({
      sellFlow: snapshot,
      walletConnection: snapshot.connection
    })
}));

export function App() {
  const {
    selectedWallet,
    setSelectedWallet,
    apiHealth,
    setApiHealth,
    walletStatuses,
    walletAvailability,
    walletConnection,
    sellFlow,
    setWalletStatus,
    setWalletAvailability,
    setWalletConnection,
    setSellFlow
  } = useAppStore();

  const controller = React.useMemo(() => new SellFlowController(setSellFlow), [setSellFlow]);
  const walletSelectorOpen = sellFlow.state === "WALLET_SELECTOR_OPEN";

  React.useEffect(() => {
    const networkLabel = document.getElementById("network-label");
    if (networkLabel) {
      networkLabel.textContent = `${readXrplNetwork()} network`;
    }

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

  function openSellFlow() {
    controller.openWalletSelector();
  }

  function cancelWalletSelection() {
    setSelectedWallet(null);
    setWalletConnection(null);
    controller.cancel();
  }

  async function selectWallet(adapter: WalletAdapter) {
    setSelectedWallet(adapter.id);
    setWalletStatus(adapter.id, "connecting");
    await controller.connectWalletAndStartSell(adapter);
    const latestConnection = useAppStore.getState().sellFlow.connection;
    setWalletConnection(latestConnection);
    setWalletStatus(adapter.id, latestConnection ? "connected" : "failed");
  }

  return (
    <>
      <SellAllButton disabled={sellFlow.state === "CONNECTING_WALLET"} onClick={openSellFlow} />

      <div className="status-grid">
        <div>
          <span>API</span>
          <strong>{apiHealth?.status ?? "checking"}</strong>
        </div>
        <div>
          <span>Wallet</span>
          <strong>{walletConnection?.address ?? selectedWallet ?? "not selected"}</strong>
        </div>
        <div>
          <span>Sell state</span>
          <strong>{sellFlow.state}</strong>
        </div>
      </div>

      <div className={sellFlow.error ? "connection-banner warning" : "connection-banner success"}>
        {sellFlow.error ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        <span>{sellFlow.error ?? sellFlow.message}</span>
      </div>

      <WalletSelector
        adapters={registry.adapters}
        availability={walletAvailability}
        open={walletSelectorOpen}
        statuses={walletStatuses}
        onCancel={cancelWalletSelection}
        onSelect={(adapter) => void selectWallet(adapter)}
      />
    </>
  );
}
