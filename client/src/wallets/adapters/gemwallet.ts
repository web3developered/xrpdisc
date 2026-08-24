import * as gemWalletApi from "@gemwallet/api";
import { WalletError, walletUnavailable } from "../errors";
import type {
  SignedXrplTransaction,
  UnsignedXrplTransaction,
  WalletAvailability,
  WalletConnection,
  XrplNetwork
} from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

type GemWalletResponse<T> = {
  type?: "response" | "reject";
  result?: T;
};

type GemWalletApi = {
  isInstalled?: () => Promise<GemWalletResponse<{ isInstalled: boolean }>>;
  getAddress?: () => Promise<GemWalletResponse<{ address: string }>>;
  getNetwork?: () => Promise<GemWalletResponse<{ network: string }>>;
  signTransaction?: (request: {
    transaction: UnsignedXrplTransaction;
  }) => Promise<GemWalletResponse<{ signature: string }>>;
};

function normalizeNetwork(network?: string): XrplNetwork | "unknown" {
  switch (network?.toLowerCase()) {
    case "mainnet":
      return "mainnet";
    case "testnet":
      return "testnet";
    case "devnet":
      return "devnet";
    default:
      return "unknown";
  }
}

export class GemWalletAdapter extends BaseWalletAdapter {
  readonly id = "gemwallet" as const;
  readonly name = "GemWallet";
  readonly capabilities = createCapabilities({
    signTransaction: { supported: true },
    requiresBrowserExtension: true
  });

  constructor(private readonly apiProvider: () => GemWalletApi | undefined = () => gemWalletApi as unknown as GemWalletApi) {
    super();
  }

  async isAvailable(): Promise<WalletAvailability> {
    const api = this.apiProvider();
    if (!api?.isInstalled || !api.getAddress) {
      return { available: false, reason: "GemWallet API/provider was not detected in this browser." };
    }

    const installed = await api.isInstalled();
    return installed.result?.isInstalled
      ? { available: true }
      : { available: false, reason: "GemWallet extension is not installed or not enabled." };
  }

  override async connect(): Promise<WalletConnection> {
    const api = this.apiProvider();
    if (!api?.getAddress) {
      throw walletUnavailable(this.id, "GemWallet API/provider was not detected.");
    }

    const addressResponse = await api.getAddress();
    if (addressResponse.type === "reject" || !addressResponse.result?.address) {
      throw new WalletError(this.id, "WALLET_REJECTED", "GemWallet did not return an address.");
    }

    const networkResponse = api.getNetwork ? await api.getNetwork() : undefined;
    return this.rememberConnection({
      id: this.id,
      name: this.name,
      address: addressResponse.result.address,
      network: normalizeNetwork(networkResponse?.result?.network),
      connectedAt: new Date().toISOString()
    });
  }

  override async signTransaction(
    transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    const api = this.apiProvider();
    if (!api?.signTransaction) {
      throw walletUnavailable(this.id, "GemWallet signTransaction API was not detected.");
    }

    const address = await this.getAddress();
    const response = await api.signTransaction({ transaction });
    if (response.type === "reject" || !response.result?.signature) {
      throw new WalletError(this.id, "WALLET_REJECTED", "GemWallet rejected the transaction.");
    }

    return {
      signerAddress: address,
      signature: response.result.signature,
      rawResponse: response
    };
  }
}

