export type { WalletId as WalletProviderId } from "../wallets/types";

export type HealthResponse = {
  status: "ok" | "degraded" | "unavailable";
  service: string;
  version: string;
};

