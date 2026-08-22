import type { AppConfig } from "../config/env.js";
import { assertClassicXrplAddress } from "./address.js";
import type { GeneratedPayment, XrplNetwork, XrplPaymentTransaction } from "./types.js";

type PaymentRequest = {
  account: string;
  destination: string;
  amountDrops: string;
  destinationTag?: number;
  memo?: string;
  network: XrplNetwork;
};

function toHexMemo(value: string): string {
  return Buffer.from(value, "utf8").toString("hex").toUpperCase();
}

function validateDrops(amountDrops: string, maxPaymentDrops: number): void {
  if (!/^[1-9]\d*$/.test(amountDrops)) {
    throw new Error("amountDrops must be a positive integer string");
  }
  const amount = BigInt(amountDrops);
  if (amount > BigInt(maxPaymentDrops)) {
    throw new Error(`amountDrops exceeds configured MAX_PAYMENT_DROPS ${maxPaymentDrops}`);
  }
}

export function generatePaymentTransaction(
  config: AppConfig,
  request: PaymentRequest
): GeneratedPayment {
  if (request.network !== config.XRPL_NETWORK) {
    throw new Error(`Request network ${request.network} does not match backend network ${config.XRPL_NETWORK}`);
  }

  assertClassicXrplAddress(request.account, "account");
  assertClassicXrplAddress(request.destination, "destination");
  validateDrops(request.amountDrops, config.MAX_PAYMENT_DROPS);

  if (request.account === request.destination) {
    throw new Error("Payment destination must differ from account");
  }

  if (!config.AUTHORIZED_XRP_DESTINATIONS.includes(request.destination)) {
    throw new Error("Payment destination is not allowlisted by backend policy");
  }

  const transaction: XrplPaymentTransaction = {
    TransactionType: "Payment",
    Account: request.account,
    Destination: request.destination,
    Amount: request.amountDrops
  };

  if (request.destinationTag !== undefined) {
    transaction.DestinationTag = request.destinationTag;
  }

  if (request.memo) {
    transaction.Memos = [
      {
        Memo: {
          MemoType: toHexMemo("xrpl-defi-intent"),
          MemoData: toHexMemo(request.memo)
        }
      }
    ];
  }

  return {
    transaction,
    autofillStatus: "requires_xrpl_client",
    policyWarnings: [
      "Sequence, Fee, and LastLedgerSequence are not autofilled until the official XRPL client dependency is installed."
    ]
  };
}

