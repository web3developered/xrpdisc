export type XrplNetwork = "testnet" | "mainnet";

export type XrplPaymentTransaction = {
  TransactionType: "Payment";
  Account: string;
  Destination: string;
  Amount:
    | string
    | {
        currency: string;
        issuer: string;
        value: string;
      };
  DestinationTag?: number;
  Fee?: string;
  Flags?: number;
  LastLedgerSequence?: number;
  Memos?: Array<{
    Memo: {
      MemoType?: string;
      MemoData?: string;
    };
  }>;
  Sequence?: number;
  SigningPubKey?: string;
  TxnSignature?: string;
};

export type GeneratedPayment = {
  transaction: XrplPaymentTransaction;
  autofillStatus: "requires_xrpl_client" | "autofilled";
  policyWarnings: string[];
};
