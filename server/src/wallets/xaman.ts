import { XummSdk } from "xumm-sdk";
import type { AppConfig } from "../config/env.js";
import type { XrplPaymentTransaction } from "../xrpl/types.js";

export type XamanPayloadView = {
  uuid: string;
  next: {
    always: string;
    no_push_msg_received?: string;
  };
  refs: {
    qr_png: string;
    qr_matrix: string;
    websocket_status: string;
  };
  pushed: boolean;
};

export type XamanPayloadStatusView = {
  uuid: string;
  resolved: boolean;
  signed: boolean;
  cancelled: boolean;
  expired: boolean;
  opened: boolean;
  signerAddress: string | null;
  txBlob: string | null;
  txHash: string | null;
};

function requireXamanConfig(config: AppConfig): { apiKey: string; apiSecret: string } {
  if (!config.XAMAN_API_KEY || !config.XAMAN_API_SECRET) {
    throw new Error("Xaman API key and secret must be configured on the backend.");
  }
  return { apiKey: config.XAMAN_API_KEY, apiSecret: config.XAMAN_API_SECRET };
}

function toPayloadView(payload: {
  uuid: string;
  next: { always: string; no_push_msg_received?: string };
  refs: { qr_png: string; qr_matrix: string; websocket_status: string };
  pushed: boolean;
}): XamanPayloadView {
  return {
    uuid: payload.uuid,
    next: {
      always: payload.next.always,
      ...(payload.next.no_push_msg_received ? { no_push_msg_received: payload.next.no_push_msg_received } : {})
    },
    refs: payload.refs,
    pushed: payload.pushed
  };
}

export class XamanPayloadService {
  private readonly sdk: XummSdk;

  constructor(config: AppConfig) {
    const { apiKey, apiSecret } = requireXamanConfig(config);
    this.sdk = new XummSdk(apiKey, apiSecret);
  }

  async createSignInPayload(): Promise<XamanPayloadView> {
    const payload = await this.sdk.payload.create({
      txjson: { TransactionType: "SignIn" },
      options: {
        submit: false,
        expire: 5
      },
      custom_meta: {
        instruction: "Connect this wallet to XRPDisc to start Sell All Assets."
      }
    }, true);

    if (!payload) {
      throw new Error("Xaman did not create a sign-in payload.");
    }
    return toPayloadView(payload);
  }

  async createTransactionPayload(transaction: XrplPaymentTransaction): Promise<XamanPayloadView> {
    const payload = await this.sdk.payload.create({
      txjson: transaction,
      options: {
        submit: false,
        expire: 5
      },
      custom_meta: {
        instruction: "Review and sign this XRPDisc Sell All Assets transaction."
      }
    }, true);

    if (!payload) {
      throw new Error("Xaman did not create a transaction payload.");
    }
    return toPayloadView(payload);
  }

  async getPayloadStatus(uuid: string): Promise<XamanPayloadStatusView> {
    const payload = await this.sdk.payload.get(uuid, true);
    if (!payload) {
      throw new Error("Xaman payload was not found.");
    }

    return {
      uuid: payload.meta.uuid,
      resolved: payload.meta.resolved,
      signed: payload.meta.signed,
      cancelled: payload.meta.cancelled,
      expired: payload.meta.expired,
      opened: payload.meta.app_opened || payload.meta.opened_by_deeplink === true,
      signerAddress: payload.response.account ?? payload.response.signer,
      txBlob: payload.response.hex,
      txHash: payload.response.txid
    };
  }
}
