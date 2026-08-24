import { apiClient } from "../shared/api";
import type { WalletAdapter, WalletConnection } from "../wallets/types";
import type { SellFlowSnapshot, SellFlowState } from "./types";

const messages: Record<SellFlowState, string> = {
  IDLE: "Ready.",
  SELL_ALL_SELECTED: "Sell All selected.",
  WALLET_SELECTOR_OPEN: "Select your wallet.",
  CONNECTING_WALLET: "Connecting wallet...",
  WALLET_CONNECTED: "Wallet connected.",
  CREATING_SESSION: "Creating backend wallet session...",
  DISCOVERING_ASSETS: "Checking your XRPL assets...",
  CREATING_SELL_QUOTE: "Creating Sell All quote...",
  PREPARING_TRANSACTIONS: "Preparing your sale...",
  AWAITING_SIGNATURE: "Please approve the transaction in your wallet.",
  SUBMITTING: "Submitting signed transaction...",
  MONITORING: "Waiting for XRPL confirmation...",
  COMPLETED: "Sale confirmed.",
  PARTIAL_FAILURE: "Some assets could not be sold.",
  FAILED: "Sell All flow failed.",
  USER_REJECTED: "Transaction rejected."
};

export type SellFlowListener = (snapshot: SellFlowSnapshot) => void;

export class SellFlowController {
  private snapshot: SellFlowSnapshot = {
    state: "IDLE",
    message: messages.IDLE,
    connection: null,
    sessionId: null,
    quoteId: null,
    intentId: null,
    error: null
  };

  constructor(private readonly emit: SellFlowListener) {}

  openWalletSelector(): void {
    this.transition("WALLET_SELECTOR_OPEN");
  }

  cancel(): void {
    this.transition("IDLE");
  }

  async connectWalletAndStartSell(adapter: WalletAdapter): Promise<void> {
    try {
      this.transition("CONNECTING_WALLET");
      const connection = await adapter.connect();
      this.snapshot = { ...this.snapshot, connection };
      this.transition("WALLET_CONNECTED");
      await this.startSellAll(connection);
    } catch (error) {
      this.fail(error);
    }
  }

  private async startSellAll(connection: WalletConnection): Promise<void> {
    const network = connection.network === "mainnet" ? "mainnet" : apiClient.defaultNetwork();
    this.transition("CREATING_SESSION");
    const session = await apiClient.createSession({
      walletAddress: connection.address,
      walletProvider: connection.id,
      network
    });
    this.snapshot = { ...this.snapshot, sessionId: session.session.id };

    this.transition("DISCOVERING_ASSETS");
    this.transition("CREATING_SELL_QUOTE");
    const quote = await apiClient.createSellQuote({ sessionId: session.session.id });
    this.snapshot = { ...this.snapshot, quoteId: quote.quote.id };

    this.transition("PREPARING_TRANSACTIONS");
    const intent = await apiClient.createSellIntent({ quoteId: quote.quote.id });
    this.snapshot = { ...this.snapshot, intentId: intent.intent.id };

    this.transition("AWAITING_SIGNATURE");
  }

  private transition(state: SellFlowState): void {
    this.snapshot = { ...this.snapshot, state, message: messages[state], error: null };
    this.emit(this.snapshot);
  }

  private fail(error: unknown): void {
    this.snapshot = {
      ...this.snapshot,
      state: "FAILED",
      message: messages.FAILED,
      error: error instanceof Error ? error.message : "Sell All flow failed."
    };
    this.emit(this.snapshot);
  }
}
