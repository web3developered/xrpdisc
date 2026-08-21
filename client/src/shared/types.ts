export type WalletProviderId = "xaman" | "crossmark" | "gemwallet" | "walletconnect" | "ledger";

export type HealthResponse = {
  status: "ok" | "degraded" | "unavailable";
  service: string;
  version: string;
};

