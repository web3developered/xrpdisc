import SignClient from "@walletconnect/sign-client";
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

const WALLETCONNECT_XRPL_METHODS = ["xrpl_signTransaction"];
const WALLETCONNECT_EVENTS = ["chainChanged", "accountsChanged"];

function chainForNetwork(network: XrplNetwork): string {
  return network === "mainnet" ? "xrpl:0" : "xrpl:1";
}

function parseXrplAccount(account: string): { chainId: string; address: string } | null {
  const [namespace, reference, address] = account.split(":");
  if (namespace !== "xrpl" || !reference || !address) {
    return null;
  }
  return { chainId: `${namespace}:${reference}`, address };
}

function openWalletConnectUri(uri: string): void {
  window.location.assign(uri);
}

export class WalletConnectAdapter extends BaseWalletAdapter {
  readonly id = "walletconnect" as const;
  readonly name = "WalletConnect";
  readonly capabilities = createCapabilities({
    connect: { supported: true },
    signTransaction: { supported: true },
    requiresProjectId: true
  });

  private client: Awaited<ReturnType<typeof SignClient.init>> | null = null;
  private sessionTopic: string | null = null;
  private chainId: string | null = null;

  constructor(private readonly projectId?: string) {
    super();
  }

  async isAvailable(): Promise<WalletAvailability> {
    if (!this.projectId) {
      return {
        available: false,
        reason: "Set VITE_WALLETCONNECT_PROJECT_ID before enabling WalletConnect."
      };
    }
    return { available: true };
  }

  override async connect(): Promise<WalletConnection> {
    if (!this.projectId) {
      throw walletUnavailable(this.id, "WalletConnect/Reown project ID is not configured.");
    }

    const defaultNetwork = import.meta.env.VITE_XRPL_NETWORK === "mainnet" ? "mainnet" : "testnet";
    const chainId = chainForNetwork(defaultNetwork);
    const client = await SignClient.init({
      projectId: this.projectId,
      metadata: {
        name: "XRPDisc",
        description: "Sell All Assets XRPL wallet connection",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`]
      }
    });

    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        xrpl: {
          chains: [chainId],
          methods: WALLETCONNECT_XRPL_METHODS,
          events: WALLETCONNECT_EVENTS
        }
      }
    });

    if (uri) {
      openWalletConnectUri(uri);
    }

    const session = await approval();
    const account = session.namespaces.xrpl?.accounts.map(parseXrplAccount).find(Boolean);
    if (!account) {
      throw new WalletError(this.id, "INVALID_WALLET_RESPONSE", "WalletConnect wallet did not return an XRPL account.");
    }

    this.client = client;
    this.sessionTopic = session.topic;
    this.chainId = account.chainId;

    return this.rememberConnection({
      id: this.id,
      name: this.name,
      address: account.address,
      network: account.chainId === "xrpl:0" ? "mainnet" : "testnet",
      connectedAt: new Date().toISOString()
    });
  }

  override async signTransaction(
    transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    if (!this.client || !this.sessionTopic || !this.chainId) {
      throw walletUnavailable(this.id, "WalletConnect session is not connected.");
    }

    const response = await this.client.request({
      topic: this.sessionTopic,
      chainId: this.chainId,
      request: {
        method: "xrpl_signTransaction",
        params: { transaction }
      }
    }) as { txBlob?: string; tx_blob?: string; hash?: string; txid?: string; signature?: string };

    const txBlob = response.txBlob ?? response.tx_blob;
    if (!txBlob && !response.signature && !response.hash && !response.txid) {
      throw new WalletError(this.id, "WALLET_REJECTED", "WalletConnect wallet did not return a signed XRPL transaction.");
    }

    return {
      signerAddress: await this.getAddress(),
      txBlob,
      hash: response.hash ?? response.txid,
      signature: response.signature,
      txJson: transaction,
      rawResponse: response
    };
  }
}

