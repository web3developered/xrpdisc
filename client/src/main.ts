import { Buffer } from "buffer";
import { SellFlowController } from "./sell/SellFlowController";
import type { SellFlowSnapshot } from "./sell/types";
import { apiClient } from "./shared/api";
import { readXrplNetwork } from "./shared/runtime-config";
import { createWalletRegistry } from "./wallets/registry";
import type { WalletAdapter } from "./wallets/types";

const browserGlobal = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
browserGlobal.Buffer ??= Buffer;

const registry = createWalletRegistry();

const sellButton = getElement<HTMLButtonElement>("sell-all-button");
const walletModal = getElement<HTMLDivElement>("wallet-modal-backdrop");
const cancelButton = getElement<HTMLButtonElement>("wallet-cancel-button");
const cancelBottomButton = getElement<HTMLButtonElement>("wallet-cancel-button-bottom");
const apiStatus = getElement<HTMLElement>("api-status");
const walletStatus = getElement<HTMLElement>("wallet-status");
const sellState = getElement<HTMLElement>("sell-state");
const flowMessage = getElement<HTMLElement>("flow-message");
const networkLabel = getElement<HTMLElement>("network-label");
const connectionBanner = getElement<HTMLElement>("connection-banner");

const controller = new SellFlowController(updateFlow);

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required page element not found: #${id}`);
  }
  return element as T;
}

function updateFlow(snapshot: SellFlowSnapshot): void {
  sellState.textContent = snapshot.state;
  flowMessage.textContent = snapshot.error ?? snapshot.message;

  connectionBanner.classList.toggle("warning", Boolean(snapshot.error));
  connectionBanner.classList.toggle("success", !snapshot.error);

  if (snapshot.connection) {
    walletStatus.textContent = snapshot.connection.address;
  }

  const busy = [
    "CONNECTING_WALLET",
    "CREATING_SESSION",
    "DISCOVERING_ASSETS",
    "CREATING_SELL_QUOTE",
    "PREPARING_TRANSACTIONS",
    "AWAITING_SIGNATURE",
    "SUBMITTING",
    "MONITORING"
  ].includes(snapshot.state);

  sellButton.disabled = busy;
}

function openWalletSelector(): void {
  walletModal.hidden = false;
  const firstAvailable = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-wallet]")
  ).find((button) => !button.disabled);
  firstAvailable?.focus();
}

function closeWalletSelector(): void {
  walletModal.hidden = true;
  sellButton.focus();
}

function setWalletStatus(walletId: string, status: string): void {
  const statusElement = document.querySelector<HTMLElement>(
    `[data-wallet-status="${walletId}"]`
  );
  if (statusElement) {
    statusElement.textContent = status;
  }
}

function setWalletReason(walletId: string, reason?: string): void {
  const reasonElement = document.querySelector<HTMLElement>(
    `[data-wallet-reason="${walletId}"]`
  );
  if (!reasonElement) return;

  reasonElement.textContent = reason ?? "";
  reasonElement.hidden = !reason;
}

function setWalletButtonDisabled(walletId: string, disabled: boolean): void {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-wallet="${walletId}"]`
  );
  if (button) {
    button.disabled = disabled;
  }
}

networkLabel.textContent = `${readXrplNetwork()} network`;

apiClient
  .health()
  .then((health) => {
    apiStatus.textContent = health.status;
  })
  .catch(() => {
    apiStatus.textContent = "unavailable";
  });

for (const adapter of registry.adapters) {
  setWalletStatus(adapter.id, "checking");

  adapter
    .isAvailable()
    .then((availability) => {
      setWalletStatus(
        adapter.id,
        availability.available ? "available" : "unavailable"
      );
      setWalletReason(adapter.id, availability.reason);
      setWalletButtonDisabled(adapter.id, !availability.available);
    })
    .catch((error: unknown) => {
      setWalletStatus(adapter.id, "failed");
      setWalletReason(
        adapter.id,
        error instanceof Error
          ? error.message
          : "Wallet availability check failed."
      );
      setWalletButtonDisabled(adapter.id, true);
    });
}

sellButton.addEventListener("click", () => {
  controller.openWalletSelector();
  openWalletSelector();
});

function cancelWalletSelection(): void {
  closeWalletSelector();
  controller.cancel();
}

cancelButton.addEventListener("click", cancelWalletSelection);
cancelBottomButton.addEventListener("click", cancelWalletSelection);

walletModal.addEventListener("click", (event) => {
  if (event.target === walletModal) {
    cancelWalletSelection();
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-wallet]").forEach((button) => {
  button.addEventListener("click", async () => {
    const walletId = button.dataset.wallet;
    if (!walletId) return;

    const adapter: WalletAdapter | undefined = registry.adapters.find(
      (candidate) => candidate.id === walletId
    );
    if (!adapter) return;

    button.disabled = true;
    setWalletStatus(adapter.id, "connecting");
    closeWalletSelector();

    try {
      await controller.connectWalletAndStartSell(adapter);
      const snapshot = controller.getSnapshot();
      walletStatus.textContent =
        snapshot.connection?.address ?? "connected";
      setWalletStatus(
        adapter.id,
        snapshot.connection ? "connected" : "failed"
      );
    } catch (error: unknown) {
      setWalletStatus(adapter.id, "failed");
      flowMessage.textContent =
        error instanceof Error ? error.message : "Wallet connection failed.";
      connectionBanner.classList.remove("success");
      connectionBanner.classList.add("warning");
    } finally {
      button.disabled = false;
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !walletModal.hidden) {
    cancelWalletSelection();
  }
});
