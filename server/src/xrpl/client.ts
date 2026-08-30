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
  ownerCount?: number;
  reserveBaseDrops?: string;
  reserveIncrementDrops?: string;
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
  private readonly endpoints: string[];
  private readonly lastLedgerSequenceOffset: number;
  private client: Client;
  private connecting: Promise<void> | null = null;
  private endpointIndex = 0;

  constructor(config: AppConfig) {
    this.endpoints = [...new Set([config.XRPL_RPC_URL, ...config.XRPL_RPC_FALLBACK_URLS])];
    this.lastLedgerSequenceOffset = config.XRPL_LAST_LEDGER_SEQUENCE_OFFSET;
    this.client = new Client(this.endpoints[this.endpointIndex] ?? config.XRPL_RPC_URL);
  }

  async getAccountSnapshot(address: string): Promise<XrplAccountSnapshot> {
    const reserve = await this.readReserveSettings();
    let accountInfo: AccountInfoResponse;
    try {
      accountInfo = await this.requestWithFailover("account_info", (client) => client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
        strict: true
      }) as Promise<AccountInfoResponse>);
    } catch (error) {
      if (isXrplAccountNotFound(error)) {
        return {
          balanceDrops: "0",
          ...reserve,
          trustlines: []
        };
      }
      throw error;
    }
    const accountLines = await this.requestWithFailover("account_lines", (client) => client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated"
    }) as Promise<AccountLinesResponse>);

    return {
      balanceDrops: accountInfo.result.account_data.Balance,
      ...(accountInfo.result.ledger_index !== undefined ? { ledgerIndex: accountInfo.result.ledger_index } : {}),
      ...(typeof accountInfo.result.account_data.OwnerCount === "number"
        ? { ownerCount: accountInfo.result.account_data.OwnerCount }
        : {}),
      ...reserve,
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
    const autofilled = await this.requestWithFailover(
      "autofill",
      (client) => client.autofill(transaction as never) as Promise<XrplPaymentTransaction>
    );
    const ledgerIndex = await this.requestWithFailover("ledger_current", (client) => client.getLedgerIndex());
    return {
      ...autofilled,
      LastLedgerSequence: Math.max(
        autofilled.LastLedgerSequence ?? 0,
        ledgerIndex + this.lastLedgerSequenceOffset
      )
    };
  }

  async submitSignedTransaction(txBlob: string): Promise<XrplSubmitResult> {
    const response = await this.requestWithFailover(
      "submit",
      (client) => client.submit(txBlob, { failHard: false }) as Promise<SubmitResponse>
    );
    return {
      engineResult: response.result.engine_result,
      ...(response.result.tx_json.hash ? { hash: response.result.tx_json.hash } : {}),
      ledgerIndex: response.result.validated_ledger_index,
      accepted: response.result.accepted,
      applied: response.result.applied
    };
  }

  async lookupTransaction(hash: string): Promise<XrplValidationResult> {
    const response = await this.requestWithFailover("tx", (client) => client.request({
      command: "tx",
      transaction: hash
    }) as Promise<TxResponse>);
    return {
      hash: response.result.hash,
      ...(response.result.ledger_index !== undefined ? { ledgerIndex: response.result.ledger_index } : {}),
      validated: response.result.validated === true,
      ...(typeof response.result.meta === "object"
        ? { engineResult: response.result.meta.TransactionResult }
        : {})
    };
  }

  private async readReserveSettings(): Promise<Pick<XrplAccountSnapshot, "reserveBaseDrops" | "reserveIncrementDrops">> {
    const response = await this.requestWithFailover("server_state", (client) =>
      client.request({ command: "server_state" }) as Promise<XrplServerStateResponse>
    );
    const validatedLedger = response.result.state?.validated_ledger;
    return {
      ...(validatedLedger?.reserve_base !== undefined
        ? { reserveBaseDrops: String(validatedLedger.reserve_base) }
        : {}),
      ...(validatedLedger?.reserve_inc !== undefined
        ? { reserveIncrementDrops: String(validatedLedger.reserve_inc) }
        : {})
    };
  }

  private async requestWithFailover<T>(
    operationName: string,
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.endpoints.length; attempt += 1) {
      try {
        await this.ensureConnected();
        return await operation(this.client);
      } catch (error) {
        lastError = error;
        if (!shouldRetryOnNextEndpoint(error) || attempt >= this.endpoints.length - 1) {
          throw error;
        }
        await this.rotateEndpoint(operationName);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`XRPL ${operationName} request failed`);
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isConnected()) {
      return;
    }
    try {
      this.connecting ??= this.client.connect();
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async rotateEndpoint(operationName: string): Promise<void> {
    if (this.endpoints.length <= 1) {
      return;
    }
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
    this.endpointIndex = (this.endpointIndex + 1) % this.endpoints.length;
    const nextEndpoint = this.endpoints[this.endpointIndex] ?? this.endpoints[0];
    if (!nextEndpoint) {
      throw new Error("No XRPL RPC endpoint is configured");
    }
    this.client = new Client(nextEndpoint);
    this.connecting = null;
    console.warn(`XRPL ${operationName} failed; retrying with fallback endpoint ${this.endpointIndex + 1}/${this.endpoints.length}`);
  }
}

type XrplServerStateResponse = {
  result: {
    state?: {
      validated_ledger?: {
        reserve_base?: number | string;
        reserve_inc?: number | string;
      };
    };
  };
};

function isXrplAccountNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("actnotfound") || message.includes("account not found");
}

function shouldRetryOnNextEndpoint(error: unknown): boolean {
  if (isXrplAccountNotFound(error) || !(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("unexpected server response") ||
    message.includes(" 402") ||
    message.includes(" 429") ||
    message.includes(" 500") ||
    message.includes(" 502") ||
    message.includes(" 503") ||
    message.includes(" 504") ||
    message.includes("websocket") ||
    message.includes("connection failed") ||
    message.includes("socket") ||
    message.includes("closed") ||
    message.includes("timeout") ||
    message.includes("econn") ||
    message.includes("enotfound") ||
    message.includes("temporarily unavailable")
  );
}
