# Wallet Integration

The wallet adapter boundary is used by the frontend Sell All flow. Wallet logic lives under
`client/src/wallets` and must not be scattered through React screens or `client/index.html`.

The homepage exposes one primary action: `Sell All Assets`. Clicking it opens the wallet selector.
After the user selects and connects a wallet, the frontend automatically starts the backend Sell All
workflow by creating a wallet session and requesting `/api/v1/sell/quote`.

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

Connecting a wallet only identifies the wallet account and starts backend Sell All preparation
because the user already clicked `Sell All Assets`. It does not authorize asset transfer. The asset
transfer still requires an explicit native wallet transaction-signing approval.

## Current Status

- Xaman: adapter registered. Uses `VITE_XAMAN_API_KEY` as a public browser value. `XAMAN_API_SECRET` must remain backend-only. The adapter checks for the official `xumm` package and fails explicitly until the SDK flow is installed and tested.
- Crossmark: adapter registered with browser-provider detection and connect/sign-in support when the Crossmark provider is present.
- GemWallet: adapter registered with browser-provider detection, address connection, network detection, and isolated `signTransaction` method for later signing workflow use.
- WalletConnect: adapter registered. Uses `VITE_WALLETCONNECT_PROJECT_ID` as a public browser value. The adapter checks for `@walletconnect/sign-client` and fails explicitly until XRPL namespace support is verified.
- Ledger: adapter registered. The adapter checks for WebHID plus official Ledger XRP/WebHID packages and fails explicitly until device signing is tested.

## Security Rules

- The application must never request seed phrases, private keys, recovery phrases, or wallet secrets.
- Wallet connection must never automatically invoke transaction signing.
- Wallet adapters must expose unsupported capabilities honestly.
- Wallet signing must remain a separate user action after backend intent generation and human-readable transaction review.
- Wallet adapters must not submit transactions directly.
- `XAMAN_API_SECRET` must never be exposed through `VITE_*` variables or browser bundles.
- The frontend must never decide Sell All balances, destination, or transaction amounts.

## Remaining Work

SDK package installation was not completed in this environment because npm registry lookups hung.
Before declaring wallet integrations production-ready, install and verify the official current SDKs
for Xaman, Crossmark, GemWallet, WalletConnect/Reown, and Ledger, then replace any
configuration-blocked paths with fully tested SDK-backed implementations. Full Sell All functionality
also requires backend XRPL asset discovery, transaction autofill/submission, durable PostgreSQL
persistence, and Testnet end-to-end confirmation.

