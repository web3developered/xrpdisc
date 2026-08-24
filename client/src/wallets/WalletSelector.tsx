import { X } from "lucide-react";
import type { WalletAdapter, WalletAvailability, WalletId, WalletStatus } from "./types";

type WalletSelectorProps = {
  adapters: WalletAdapter[];
  availability: Partial<Record<WalletId, WalletAvailability>>;
  statuses: Record<WalletId, WalletStatus>;
  open: boolean;
  onCancel: () => void;
  onSelect: (adapter: WalletAdapter) => void;
};

function walletRequirementLabel(adapter: WalletAdapter): string {
  const labels = [
    adapter.capabilities.requiresBrowserExtension ? "Extension" : null,
    adapter.capabilities.requiresMobileApp ? "Mobile app" : null,
    adapter.capabilities.requiresHardwareDevice ? "Hardware device" : null,
    adapter.capabilities.requiresApiKey ? "API key" : null,
    adapter.capabilities.requiresProjectId ? "Project ID" : null
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(" + ") : "Browser provider";
}

export function WalletSelector({
  adapters,
  availability,
  statuses,
  open,
  onCancel,
  onSelect
}: WalletSelectorProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="wallet-selector-title" aria-modal="true" className="wallet-modal" role="dialog">
        <div className="wallet-modal-header">
          <h2 id="wallet-selector-title">Select Wallet</h2>
          <button aria-label="Cancel wallet selection" className="icon-button" type="button" onClick={onCancel}>
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="wallet-list">
          {adapters.map((wallet) => {
            const walletAvailability = availability[wallet.id];
            const unavailable = walletAvailability?.available === false;
            return (
              <button
                key={wallet.id}
                className="wallet-option"
                type="button"
                onClick={() => onSelect(wallet)}
              >
                <span className="wallet-option-title">
                  <span>{wallet.name}</span>
                  <strong>{statuses[wallet.id]}</strong>
                </span>
                <small>{walletRequirementLabel(wallet)}</small>
                {unavailable && walletAvailability.reason ? <em>{walletAvailability.reason}</em> : null}
              </button>
            );
          })}
        </div>

        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </section>
    </div>
  );
}

