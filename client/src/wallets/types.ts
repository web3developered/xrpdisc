export type WalletId = "xaman" | "crossmark" | "gemwallet" | "walletconnect" | "ledger";

export type XrplNetwork = "mainnet" | "testnet" | "devnet";

export type WalletCapability = {
  supported: boolean;
  reason?: string;
};

export type WalletCapabilities = {
  connect: WalletCapability;
  signTransaction: WalletCapability;
  signMessage: WalletCapability;
  submitTransaction: WalletCapability;
  supportedNetworks: XrplNetwork[];
  requiresBrowserExtension: boolean;
  requiresMobileApp: boolean;
  requiresHardwareDevice: boolean;
  requiresApiKey: boolean;
  requiresProjectId: boolean;
};

export type WalletAvailability = {
  available: boolean;
  reason?: string;
};

export type WalletConnection = {
  id: WalletId;
  name: string;
  address: string;
  network: XrplNetwork | "unknown";
  connectedAt: string;
};

export type UnsignedXrplTransaction = {
  TransactionType: string;
  Account?: string;
  [key: string]: unknown;
};

export type SignedXrplTransaction = {
  signerAddress: string;
  txBlob?: string;
  hash?: string;
  signature?: string;
  txJson?: UnsignedXrplTransaction;
  rawResponse?: unknown;
};

export type WalletAdapter = {
  id: WalletId;
  name: string;
  capabilities: WalletCapabilities;
  isAvailable(): Promise<WalletAvailability>;
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string>;
  signTransaction(transaction: UnsignedXrplTransaction): Promise<SignedXrplTransaction>;
};

export type WalletStatus = "idle" | "checking" | "available" | "unavailable" | "connecting" | "connected" | "failed";

