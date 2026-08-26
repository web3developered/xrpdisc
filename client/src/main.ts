import { Buffer } from "buffer";
import "./styles.css";
import { SellFlowController } from "./sell/SellFlowController";
import type { SellFlowSnapshot } from "./sell/types";
import { apiClient } from "./shared/api";
import { readXrplNetwork } from "./shared/runtime-config";
import { createWalletRegistry } from "./wallets/registry";
import type { WalletAdapter } from "./wallets/types";

const browserGlobal = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
browserGlobal.Buffer ??= Buffer;

const registry = createWalletRegistry();

const sellButton = required<HTMLButtonElement>("sell-all-button");
const modal = required<HTMLDivElement>("wallet-modal-backdrop");
const walletList = required<HTMLDivElement>("wallet-list");
const cancelButton = required<HTMLButtonElement>("wallet-cancel-button");
const cancelBottom = required<HTMLButtonElement>("wallet-cancel-button-bottom");
const apiStatus = required<HTMLElement>("api-status");
const walletStatus = required<HTMLElement>("wallet-status");
const sellState = required<HTMLElement>("sell-state");
const flowMessage = required<HTMLElement>("flow-message");
const networkLabel = required<HTMLElement>("network-label");

networkLabel.textContent = `${readXrplNetwork()} network`;

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required element #${id} was not found.`);
  return element as T;
}

function renderSnapshot(snapshot: SellFlowSnapshot): void {
  sellState.textContent = snapshot.state;
  flowMessage.textContent = snapshot.error ?? snapshot.message;
  walletStatus.textContent = snapshot.connection?.address ?? "not selected";
  const banner = document.getElementById("connection-banner");
  banner?.classList.toggle("warning", Boolean(snapshot.error));
  banner?.classList.toggle("success", !snapshot.error);
  sellButton.disabled = ["CONNECTING_WALLET", "CREATING_SESSION", "DISCOVERING_ASSETS", "CREATING_SELL_QUOTE", "PREPARING_TRANSACTIONS", "AWAITING_SIGNATURE", "SUBMITTING", "MONITORING"].includes(snapshot.state);
}

const controller = new SellFlowController(renderSnapshot);

function closeWalletSelector(): void {
  modal.hidden = true;
}

function openWalletSelector(): void {
  controller.openWalletSelector();
  modal.hidden = false;
}

function requirementLabel(adapter: WalletAdapter): string {
  const labels = [
    adapter.capabilities.requiresBrowserExtension ? "Extension" : null,
    adapter.capabilities.requiresMobileApp ? "Mobile app" : null,
    adapter.capabilities.requiresHardwareDevice ? "Hardware device" : null,
    adapter.capabilities.requiresApiKey ? "API key" : null,
    adapter.capabilities.requiresProjectId ? "Project ID" : null
  ].filter(Boolean) as string[];
  return labels.length ? labels.join(" + ") : "Browser provider";
}

function renderWallets(): void {
  walletList.replaceChildren();
  for (const adapter of registry.adapters) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wallet-option";
    button.dataset.wallet = adapter.id;
    button.innerHTML = `<span class="wallet-option-title"><span>${escapeHtml(adapter.name)}</span><strong data-status>checking</strong></span><small>${escapeHtml(requirementLabel(adapter))}</small><em data-reason hidden></em>`;
    walletList.appendChild(button);

    void adapter.isAvailable().then((availability) => {
      const status = button.querySelector<HTMLElement>("[data-status]");
      const reason = button.querySelector<HTMLElement>("[data-reason]");
      if (status) status.textContent = availability.available ? "available" : "unavailable";
      button.disabled = !availability.available;
      if (reason) {
        reason.textContent = availability.reason ?? "";
        reason.hidden = !availability.reason;
      }
    }).catch((error: unknown) => {
      const status = button.querySelector<HTMLElement>("[data-status]");
      if (status) status.textContent = "failed";
      button.disabled = true;
      const reason = button.querySelector<HTMLElement>("[data-reason]");
      if (reason) {
        reason.textContent = error instanceof Error ? error.message : "Availability check failed.";
        reason.hidden = false;
      }
    });

    button.addEventListener("click", async () => {
      button.disabled = true;
      closeWalletSelector();
      try {
        await controller.connectWalletAndStartSell(adapter);
      } finally {
        button.disabled = false;
      }
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character] ?? character);
}

sellButton.addEventListener("click", openWalletSelector);
cancelButton.addEventListener("click", () => { closeWalletSelector(); controller.cancel(); });
cancelBottom.addEventListener("click", () => { closeWalletSelector(); controller.cancel(); });
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeWalletSelector();
    controller.cancel();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeWalletSelector();
    controller.cancel();
  }
});

renderWallets();

void apiClient.health().then((health) => {
  apiStatus.textContent = health.status;
}).catch(() => {
  apiStatus.textContent = "unavailable";
});

renderSnapshot({
  state: "IDLE",
  message: "Ready.",
  connection: null,
  sessionId: null,
  quoteId: null,
  intentId: null,
  error: null
});
