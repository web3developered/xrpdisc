# Wallet Integration

Phase 2 implements the wallet adapter boundary used by the frontend. Wallet logic lives under
`client/src/wallets` and must not be scattered through React screens.

## Adapter Contract

```ts
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
```

Connecting a wallet only identifies the wallet account. It does not create a transaction intent,
request a signature, submit a transaction, or imply user approval.

## Phase 2 Status

- Xaman: adapter registered. Requires the official Xaman SDK and `VITE_XAMAN_API_KEY` before connection/signing can be enabled.
- Crossmark: adapter registered with browser-provider detection and connect/sign-in support when the Crossmark provider is present.
- GemWallet: adapter registered with browser-provider detection, address connection, network detection, and isolated `signTransaction` method for later signing workflow use.
- WalletConnect: adapter registered. Requires a WalletConnect/Reown project ID and sign-client integration before connection/signing can be enabled.
- Ledger: adapter registered. Requires Ledger WebHID/WebUSB transport packages and the Ledger XRP app before connection/signing can be enabled.

## Security Rules

- The application must never request seed phrases, private keys, recovery phrases, or wallet secrets.
- Wallet connection must never automatically invoke transaction signing.
- Wallet adapters must expose unsupported capabilities honestly.
- Wallet signing must remain a separate user action after backend intent generation and human-readable transaction review.
- Wallet adapters must not submit transactions directly in Phase 2.

## Remaining Work

SDK package installation was not completed in this environment because npm registry lookups hung.
Before declaring wallet integrations production-ready, install and verify the official current SDKs
for Xaman, WalletConnect/Reown, and Ledger, then replace the configuration-blocked adapters with
fully tested SDK-backed implementations.

