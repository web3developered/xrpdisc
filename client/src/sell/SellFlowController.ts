import { apiClient } from "../shared/api";
import { hashSignedTx } from "xrpl/dist/npm/utils/hashes";
import type { SignedXrplTransaction, WalletAdapter, WalletConnection } from "../wallets/types";
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

  getSnapshot(): SellFlowSnapshot {
    return this.snapshot;
  }

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
      await this.startSellAll(connection, adapter);
    } catch (error) {
      this.fail(error);
    }
  }

  private async startSellAll(connection: WalletConnection, adapter: WalletAdapter): Promise<void> {
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
    const signableTransactions = intent.intent.transactions.filter(
      (transaction) => transaction.transactionIntentId && transaction.transactionIntentFingerprint
    );

    if (signableTransactions.length === 0) {
      return;
    }

    for (const transaction of signableTransactions) {
      const signedTransaction = await this.signWithConnectedWallet(
        adapter,
        transaction.unsignedTransaction
      );
      if (!signedTransaction.txBlob) {
        throw new Error("Wallet did not return a signed XRPL transaction blob.");
      }

      this.transition("SUBMITTING");
      await apiClient.acceptTransactionSignature({
        transactionIntentId: transaction.transactionIntentId!,
        signerAddress: signedTransaction.signerAddress,
        signedTransactionHash: readSignedTransactionHash(signedTransaction),
        txBlob: signedTransaction.txBlob,
        unsignedTransactionFingerprint: transaction.transactionIntentFingerprint!
      });
      await apiClient.submitTransaction(transaction.transactionIntentId!);

      this.transition("MONITORING");
      await apiClient.monitorTransaction(transaction.transactionIntentId!);
    }

    this.transition("COMPLETED");
  }

  private async signWithConnectedWallet(
    adapter: WalletAdapter,
    transaction: Record<string, unknown>
  ): Promise<SignedXrplTransaction> {
    const connection = this.snapshot.connection;
    if (!connection) {
      throw new Error("Wallet is not connected.");
    }
    return adapter.signTransaction(transaction as { TransactionType: string; [key: string]: unknown });
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

function readSignedTransactionHash(signedTransaction: SignedXrplTransaction): string {
  if (signedTransaction.hash) {
    return signedTransaction.hash;
  }
  if (signedTransaction.txBlob) {
    return hashSignedTx(signedTransaction.txBlob);
  }
  throw new Error("Wallet did not return a signed XRPL transaction hash.");
}
