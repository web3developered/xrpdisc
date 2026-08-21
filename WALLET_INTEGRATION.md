# Wallet Integration

Planned common adapter contract:

```ts
export interface WalletAdapter {
  id: WalletId;
  name: string;
  isAvailable(): Promise<boolean>;
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string>;
  signTransaction(transaction: UnsignedTransaction): Promise<SignedTransaction>;
  getCapabilities(): WalletCapabilities;
}
```

Adapters planned for Phase 2:

- Xaman: NOT IMPLEMENTED
- Crossmark: NOT IMPLEMENTED
- GemWallet: NOT IMPLEMENTED
- WalletConnect: NOT IMPLEMENTED
- Ledger: NOT IMPLEMENTED

No wallet-specific logic should be added directly to React screens.

