import crossmarkSdk from "@crossmarkio/sdk";
import { WalletError, walletUnavailable } from "../errors";
import type {
  SignedXrplTransaction,
  UnsignedXrplTransaction,
  WalletAvailability,
  WalletConnection
} from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

type CrossmarkSignInResponse = {
  response?: { address?: string };
  responseData?: { address?: string };
};

type CrossmarkSdk = {
  methods?: {
    detect?: (timeout?: number) => Promise<boolean>;
    signInAndWait?: () => Promise<CrossmarkSignInResponse>;
    signAndSubmitAndWait?: (
      transaction: UnsignedXrplTransaction,
      opts?: Record<string, unknown>
    ) => Promise<CrossmarkSignResponse>;
  };
};

type CrossmarkSignResponse = {
  response?: {
    address?: string;
    account?: string;
    txblob?: string;
    txBlob?: string;
    hash?: string;
    txid?: string;
    id?: string;
  };
  responseData?: {
    address?: string;
    account?: string;
    txblob?: string;
    txBlob?: string;
    hash?: string;
    txid?: string;
    id?: string;
  };
};

function readAddress(response: CrossmarkSignInResponse): string | null {
  return response.response?.address ?? response.responseData?.address ?? null;
}

function readCrossmarkValue(response: CrossmarkSignResponse, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = response.response?.[key as keyof NonNullable<CrossmarkSignResponse["response"]>]
      ?? response.responseData?.[key as keyof NonNullable<CrossmarkSignResponse["responseData"]>];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export class CrossmarkAdapter extends BaseWalletAdapter {
  readonly id = "crossmark" as const;
  readonly name = "Crossmark";
  readonly capabilities = createCapabilities({
    signTransaction: { supported: true },
    requiresBrowserExtension: true
  });

  constructor(private readonly sdkProvider: () => CrossmarkSdk | undefined = () => crossmarkSdk as CrossmarkSdk) {
    super();
  }

  async isAvailable(): Promise<WalletAvailability> {
    const sdk = this.sdkProvider();
    if (!sdk?.methods?.signInAndWait) {
      return { available: false, reason: "Crossmark SDK/provider was not detected in this browser." };
    }

    if (sdk.methods.detect) {
      const detected = await sdk.methods.detect(1500);
      if (!detected) {
        return { available: false, reason: "Crossmark extension is not installed or not enabled." };
      }
    }

    return { available: true };
  }

  override async connect(): Promise<WalletConnection> {
    const sdk = this.sdkProvider();
    if (!sdk?.methods?.signInAndWait) {
      throw walletUnavailable(this.id, "Crossmark SDK/provider was not detected.");
    }

    const response = await sdk.methods.signInAndWait();
    const address = readAddress(response);
    if (!address) {
      throw new WalletError(this.id, "INVALID_WALLET_RESPONSE", "Crossmark did not return an address.");
    }

    return this.rememberConnection({
      id: this.id,
      name: this.name,
      address,
      network: "unknown",
      connectedAt: new Date().toISOString()
    });
  }

  override async signTransaction(
    transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    const sdk = this.sdkProvider();
    if (!sdk?.methods?.signAndSubmitAndWait) {
      throw walletUnavailable(this.id, "Crossmark signAndSubmitAndWait API was not detected.");
    }

    const response = await sdk.methods.signAndSubmitAndWait(transaction);
    const signerAddress = readCrossmarkValue(response, ["address", "account"]) ?? await this.getAddress();
    const txBlob = readCrossmarkValue(response, ["txblob", "txBlob"]);
    const hash = readCrossmarkValue(response, ["hash", "txid", "id"]);

    if (!txBlob && !hash) {
      throw new WalletError(this.id, "WALLET_REJECTED", "Crossmark did not return a signed transaction result.");
    }

    return {
      signerAddress,
      txBlob,
      hash,
      txJson: transaction,
      rawResponse: response
    };
  }
}

