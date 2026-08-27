import "./styles.css";
import { SellFlowController } from "./sell/SellFlowController";
import type { SellFlowSnapshot } from "./sell/types";
import { apiClient } from "./shared/api";
import { readXrplNetwork } from "./shared/runtime-config";
import { createWalletRegistry } from "./wallets/registry";
import type { WalletAdapter } from "./wallets/types";

const registry = createWalletRegistry();

const modal = required<HTMLDivElement>("wallet-modal-backdrop");
const walletList = required<HTMLDivElement>("wallet-list");
const cancelButton = required<HTMLButtonElement>("wallet-cancel-button");
const cancelBottom = required<HTMLButtonElement>(
  "wallet-cancel-button-bottom"
);
const apiStatus = required<HTMLElement>("api-status");
const walletStatus = required<HTMLElement>("wallet-status");
const sellState = required<HTMLElement>("sell-state");
const flowMessage = required<HTMLElement>("flow-message");
const networkLabel = required<HTMLElement>("network-label");
const walletSearchInput = document.getElementById("wallet-search-input") as HTMLInputElement | null;
const walletSearchCount = document.getElementById("wallet-search-count");

/*
 * Any HTML element containing:
 *
 * data-open-wallet-selector
 *
 * will open the wallet selector.
 *
 * Examples:
 *
 * <a href="#" data-open-wallet-selector>Wallets</a>
 * <a href="#" data-open-wallet-selector>Developers</a>
 * <button data-open-wallet-selector>Sell All Assets</button>
 */
const walletTriggers = Array.from(
  document.querySelectorAll<HTMLElement>(
    "[data-open-wallet-selector]"
  )
);

networkLabel.textContent = `${readXrplNetwork()} network`;

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }

  return element as T;
}

function isBusyState(state: SellFlowSnapshot["state"]): boolean {
  return [
    "CONNECTING_WALLET",
    "CREATING_SESSION",
    "DISCOVERING_ASSETS",
    "CREATING_SELL_QUOTE",
    "PREPARING_TRANSACTIONS",
    "AWAITING_SIGNATURE",
    "SUBMITTING",
    "MONITORING"
  ].includes(state);
}

function renderSnapshot(snapshot: SellFlowSnapshot): void {
  sellState.textContent = snapshot.state;

  flowMessage.textContent =
    snapshot.error ?? snapshot.message;

  walletStatus.textContent =
    snapshot.connection?.address ?? "not selected";

  const banner =
    document.getElementById("connection-banner");

  banner?.classList.toggle(
    "warning",
    Boolean(snapshot.error)
  );

  banner?.classList.toggle(
    "success",
    !snapshot.error
  );

  /*
   * Disable all wallet-selector triggers while
   * the Sell All workflow is actively processing.
   *
   * This supports both buttons and anchor elements.
   */
  const busy = isBusyState(snapshot.state);

  walletTriggers.forEach((element) => {
    if (element instanceof HTMLButtonElement) {
      element.disabled = busy;
    }

    if (busy) {
      element.setAttribute(
        "aria-disabled",
        "true"
      );
    } else {
      element.removeAttribute(
        "aria-disabled"
      );
    }

    element.classList.toggle(
      "is-disabled",
      busy
    );
  });
}

const controller =
  new SellFlowController(renderSnapshot);

function closeWalletSelector(): void {
  modal.hidden = true;
}

function openWalletSelector(): void {
  controller.openWalletSelector();
  modal.hidden = false;
}

/*
 * Attach the same wallet-selector action to every
 * element using data-open-wallet-selector.
 */
walletTriggers.forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();

    /*
     * Do not allow a wallet selector trigger to open
     * while an existing Sell All transaction is running.
     */
    const currentState =
      controller.getSnapshot().state;

    if (isBusyState(currentState)) {
      return;
    }

    openWalletSelector();
  });
});

const walletLogoSources: Record<string, string> = {
  xaman: "/images/xaman-wallet.png",
  crossmark: "https://lh3.googleusercontent.com/FyU6qEipebpS98wYcAXannNf_FP0IB1mcSLYoz6SsYDY84R9-sTJB4n0-YbAhyUVJONJlK29ArmScw24tqoJlaFI=s60",
  gemwallet: "https://gemwallet.com/images/presskit/gemwallet-icon-1024x1024.png",
  walletconnect: "/images/wallet-connect.png",
  ledger: "/images/ledger.png"
};

function requirementLabel(
  adapter: WalletAdapter
): string {
  const labels = [
    adapter.capabilities.requiresBrowserExtension
      ? "Extension"
      : null,

    adapter.capabilities.requiresMobileApp
      ? "Mobile app"
      : null,

    adapter.capabilities.requiresHardwareDevice
      ? "Hardware device"
      : null,

    adapter.capabilities.requiresApiKey
      ? "API key"
      : null,

    adapter.capabilities.requiresProjectId
      ? "Project ID"
      : null
  ].filter(Boolean) as string[];

  return labels.length
    ? labels.join(" + ")
    : "Browser provider";
}

function renderWallets(): void {
  walletList.replaceChildren();

  for (const adapter of registry.adapters) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "wallet-option";
    button.dataset.wallet = adapter.id;

    const logo = document.createElement("img");
    logo.className = "wallet-option-logo";
    logo.alt = "";
    logo.decoding = "async";
    logo.src = walletLogoSources[adapter.id] ?? "/favicon.ico";

    const content = document.createElement("span");
    content.className = "wallet-option-title";

    const name = document.createElement("span");
    name.className = "wallet-option-name";
    name.textContent = adapter.name;

    const status = document.createElement("strong");
    status.dataset.status = "";
    status.textContent = "checking";

    const requirement = document.createElement("small");
    requirement.className = "wallet-option-requirement";
    requirement.textContent = requirementLabel(adapter);

    const reason = document.createElement("em");
    reason.dataset.reason = "";
    reason.hidden = true;

    content.append(name, status, requirement, reason);
    button.append(logo, content);

    walletList.appendChild(button);

    /*
     * Determine whether this wallet adapter is
     * available on the current device/browser.
     */
    void adapter
      .isAvailable()
      .then((availability) => {
        const status =
          button.querySelector<HTMLElement>(
            "[data-status]"
          );

        const reason =
          button.querySelector<HTMLElement>(
            "[data-reason]"
          );

        if (status) {
          status.textContent =
            availability.available
              ? ""
              : "unavailable";
          status.classList.toggle("is-available", availability.available);
          status.classList.toggle("is-unavailable", !availability.available);
        }

        button.disabled =
          !availability.available;

        if (reason) {
          reason.textContent =
            availability.reason ?? "";

          reason.hidden =
            !availability.reason;
        }
      })
      .catch((error: unknown) => {
        const status =
          button.querySelector<HTMLElement>(
            "[data-status]"
          );

        if (status) {
          status.textContent = "unavailable";
          status.classList.add("is-unavailable");
        }

        button.disabled = true;

        const reason =
          button.querySelector<HTMLElement>(
            "[data-reason]"
          );

        if (reason) {
          reason.textContent =
            error instanceof Error
              ? error.message
              : "Availability check failed.";

          reason.hidden = false;
        }
      });

    /*
     * Wallet selected.
     *
     * This preserves the existing Sell All flow:
     *
     * wallet connection
     * → session
     * → asset discovery
     * → quote
     * → transaction preparation
     * → signing
     * → submission
     * → monitoring
     */
    button.addEventListener(
      "click",
      async () => {
        button.disabled = true;

        closeWalletSelector();

        try {
          await controller.connectWalletAndStartSell(
            adapter
          );
        } finally {
          button.disabled = false;
        }
      }
    );
  }
}

if (walletSearchInput) {
  walletSearchInput.addEventListener("input", () => {
    const query = walletSearchInput.value.trim().toLowerCase();
    let visible = 0;

    walletList.querySelectorAll<HTMLButtonElement>(".wallet-option").forEach((button) => {
      const adapterName = button.querySelector<HTMLElement>(".wallet-option-title > span")?.textContent ?? "";
      const matches = adapterName.toLowerCase().includes(query);
      button.hidden = !matches;
      if (matches) visible += 1;
    });

    if (walletSearchCount) {
      walletSearchCount.textContent = query ? String(visible) : String(registry.adapters.length);
    }
  });
}


/*
 * Cancel wallet selector.
 */
cancelButton.addEventListener(
  "click",
  () => {
    closeWalletSelector();
    controller.cancel();
  }
);

cancelBottom.addEventListener(
  "click",
  () => {
    closeWalletSelector();
    controller.cancel();
  }
);

/*
 * Close when clicking outside the wallet modal.
 */
modal.addEventListener(
  "click",
  (event) => {
    if (event.target === modal) {
      closeWalletSelector();
      controller.cancel();
    }
  }
);

/*
 * Escape closes wallet selector.
 */
document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      !modal.hidden
    ) {
      closeWalletSelector();
      controller.cancel();
    }
  }
);

/*
 * Render available wallet adapters.
 */
renderWallets();

/*
 * Backend health check.
 */
void apiClient
  .health()
  .then((health) => {
    apiStatus.textContent = health.status;
  })
  .catch(() => {
    apiStatus.textContent = "unavailable";
  });

/*
 * Initial application state.
 */
renderSnapshot({
  state: "IDLE",
  message: "Ready.",
  connection: null,
  sessionId: null,
  quoteId: null,
  intentId: null,
  error: null
});
