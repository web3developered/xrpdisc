import { Client } from "xrpl";
import type {
  AccountInfoResponse,
  AccountLinesResponse,
  SubmitResponse,
  TxResponse
} from "xrpl";
import type { AppConfig } from "../config/env.js";
import type { XrplPaymentTransaction } from "./types.js";

export type XrplTrustlineBalance = {
  account: string;
  balance: string;
  currency: string;
  freeze?: boolean;
  peer_authorized?: boolean;
  authorized?: boolean;
};

export type XrplAccountSnapshot = {
  balanceDrops: string;
  ledgerIndex?: number;
  trustlines: XrplTrustlineBalance[];
};

export type XrplSubmitResult = {
  engineResult: string;
  hash?: string;
  ledgerIndex?: number;
  accepted: boolean;
  applied: boolean;
};

export type XrplValidationResult = {
  hash: string;
  ledgerIndex?: number;
  validated: boolean;
  engineResult?: string;
};

export interface XrplGateway {
  getAccountSnapshot(address: string): Promise<XrplAccountSnapshot>;
  autofillPayment(transaction: XrplPaymentTransaction): Promise<XrplPaymentTransaction>;
  submitSignedTransaction(txBlob: string): Promise<XrplSubmitResult>;
  lookupTransaction(hash: string): Promise<XrplValidationResult>;
}

export class XrplJsGateway implements XrplGateway {
  private readonly client: Client;
  private connecting: Promise<void> | null = null;

  constructor(config: AppConfig) {
    this.client = new Client(config.XRPL_RPC_URL);
  }

  async getAccountSnapshot(address: string): Promise<XrplAccountSnapshot> {
    await this.ensureConnected();
    const accountInfo = await this.client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
      strict: true
    }) as AccountInfoResponse;
    const accountLines = await this.client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated"
    }) as AccountLinesResponse;

    return {
      balanceDrops: accountInfo.result.account_data.Balance,
      ...(accountInfo.result.ledger_index !== undefined ? { ledgerIndex: accountInfo.result.ledger_index } : {}),
      trustlines: accountLines.result.lines.map((line) => ({
        account: line.account,
        balance: line.balance,
        currency: line.currency,
        ...(line.freeze !== undefined ? { freeze: line.freeze } : {}),
        ...(line.authorized !== undefined ? { authorized: line.authorized } : {}),
        ...(line.peer_authorized !== undefined ? { peer_authorized: line.peer_authorized } : {})
      }))
    };
  }

  async autofillPayment(transaction: XrplPaymentTransaction): Promise<XrplPaymentTransaction> {
    await this.ensureConnected();
    return await this.client.autofill(transaction as never) as XrplPaymentTransaction;
  }

  async submitSignedTransaction(txBlob: string): Promise<XrplSubmitResult> {
    await this.ensureConnected();
    const response = await this.client.submit(txBlob, { failHard: false }) as SubmitResponse;
    return {
      engineResult: response.result.engine_result,
      ...(response.result.tx_json.hash ? { hash: response.result.tx_json.hash } : {}),
      ledgerIndex: response.result.validated_ledger_index,
      accepted: response.result.accepted,
      applied: response.result.applied
    };
  }

  async lookupTransaction(hash: string): Promise<XrplValidationResult> {
    await this.ensureConnected();
    const response = await this.client.request({
      command: "tx",
      transaction: hash
    }) as TxResponse;
    return {
      hash: response.result.hash,
      ...(response.result.ledger_index !== undefined ? { ledgerIndex: response.result.ledger_index } : {}),
      validated: response.result.validated === true,
      ...(typeof response.result.meta === "object"
        ? { engineResult: response.result.meta.TransactionResult }
        : {})
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isConnected()) {
      return;
    }
    this.connecting ??= this.client.connect();
    await this.connecting;
    this.connecting = null;
  }
}
