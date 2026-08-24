import Xrp from "@ledgerhq/hw-app-xrp";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import { encode, encodeForSigning } from "xrpl/dist/npm/utils";
import { WalletError, walletUnavailable } from "../errors";
import type {
  SignedXrplTransaction,
  UnsignedXrplTransaction,
  WalletAvailability,
  WalletConnection
} from "../types";
import { BaseWalletAdapter } from "./base";
import { createCapabilities } from "./capabilities";

const DEFAULT_LEDGER_XRP_PATH = "44'/144'/0'/0/0";

export class LedgerAdapter extends BaseWalletAdapter {
  readonly id = "ledger" as const;
  readonly name = "Ledger";
  readonly capabilities = createCapabilities({
    connect: { supported: true },
    signTransaction: { supported: true },
    requiresHardwareDevice: true
  });

  private app: Xrp | null = null;
  private publicKey: string | null = null;

  async isAvailable(): Promise<WalletAvailability> {
    const supportsHid = "hid" in navigator;
    return supportsHid
      ? { available: true }
      : {
          available: false,
          reason: "Ledger requires a Chromium browser with WebHID/WebUSB support."
        };
  }

  override async connect(): Promise<WalletConnection> {
    if (!("hid" in navigator)) {
      throw walletUnavailable(this.id, "Ledger requires a Chromium browser with WebHID support.");
    }

    const transport = await TransportWebHID.create();
    const app = new Xrp(transport);
    const deviceData = await app.getAddress(DEFAULT_LEDGER_XRP_PATH, true);
    this.app = app;
    this.publicKey = deviceData.publicKey.toUpperCase();

    return this.rememberConnection({
      id: this.id,
      name: this.name,
      address: deviceData.address,
      network: "unknown",
      connectedAt: new Date().toISOString()
    });
  }

  override async signTransaction(
    transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    if (!this.app || !this.publicKey) {
      throw walletUnavailable(this.id, "Ledger is not connected.");
    }

    if (!transaction.Sequence || !transaction.Fee) {
      throw new WalletError(
        this.id,
        "INVALID_WALLET_RESPONSE",
        "Ledger signing requires an autofilled XRPL transaction with Sequence and Fee."
      );
    }

    const txJson = {
      ...transaction,
      Account: await this.getAddress(),
      SigningPubKey: this.publicKey
    };
    const signingBlob = encodeForSigning(txJson as never);
    const signature = await this.app.signTransaction(DEFAULT_LEDGER_XRP_PATH, signingBlob);
    const signedTx = {
      ...txJson,
      TxnSignature: signature
    };

    return {
      signerAddress: await this.getAddress(),
      signature,
      txBlob: encode(signedTx as never),
      txJson: signedTx,
      rawResponse: { signature }
    };
  }
}

