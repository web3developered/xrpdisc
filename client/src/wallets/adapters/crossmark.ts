import { WalletError, unsupportedCapability, walletUnavailable } from "../errors";
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
    signInAndWait?: () => Promise<CrossmarkSignInResponse>;
  };
};

function readAddress(response: CrossmarkSignInResponse): string | null {
  return response.response?.address ?? response.responseData?.address ?? null;
}

export class CrossmarkAdapter extends BaseWalletAdapter {
  readonly id = "crossmark" as const;
  readonly name = "Crossmark";
  readonly capabilities = createCapabilities({
    signTransaction: {
      supported: false,
      reason:
        "Phase 2 only connects. Submission-coupled signing stays disabled until the signing/submission phases."
    },
    requiresBrowserExtension: true
  });

  constructor(private readonly sdkProvider: () => CrossmarkSdk | undefined = () => undefined) {
    super();
  }

  async isAvailable(): Promise<WalletAvailability> {
    const sdk = this.sdkProvider();
    return sdk?.methods?.signInAndWait
      ? { available: true }
      : { available: false, reason: "Crossmark SDK/provider was not detected in this browser." };
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
    _transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    throw unsupportedCapability(
      this.id,
      "Crossmark transaction signing is intentionally disabled until the explicit signing workflow is implemented."
    );
  }
}

