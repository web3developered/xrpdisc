type RuntimeConfig = {
  VITE_API_BASE_URL?: string;
  VITE_XAMAN_API_KEY?: string;
  VITE_WALLETCONNECT_PROJECT_ID?: string;
  VITE_XRPL_NETWORK?: string;
};

declare global {
  interface Window {
    __XRP_DISC_CONFIG__?: RuntimeConfig;
  }
}

export function readPublicConfig(key: keyof RuntimeConfig): string | undefined {
  return window.__XRP_DISC_CONFIG__?.[key] ?? import.meta.env[key];
}

export function readXrplNetwork(): "testnet" | "mainnet" {
  return readPublicConfig("VITE_XRPL_NETWORK") === "testnet" ? "testnet" : "mainnet";
}
