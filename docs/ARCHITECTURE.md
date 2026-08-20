# Architecture and transaction safety

## Request lifecycle

Browser -> wallet adapter -> unsigned transaction -> wallet confirmation -> signed transaction -> backend submission -> validated ledger result.

### Rules

- Never request or store seed phrases/private keys.
- Never call a transaction "claim", "verification", or "approval" if the actual action is a payment/transfer. Show the actual transaction intent.
- Server validates addresses and amount formats.
- Server autofills transaction fields using XRPL.
- Mainnet requires explicit environment configuration and security review.
- Add idempotency keys before allowing retryable production submissions.
- Store audit events without storing secrets.

## Wallet support

### Crossmark

Browser SDK sign-in is implemented in the starter. Transaction signing should be added only after the product's exact transaction schemas and confirmation UX are approved.

### GemWallet

Browser API detection, connection state and address retrieval are implemented. Raw transaction signing should be wired to the exact API method after testing against the installed extension version.

### Xaman

Use the `xumm` package/server SDK from the backend for sign requests. API credentials must remain server-side. The Xaman docs explicitly warn against putting API secrets in frontend code.

### WalletConnect

Treat as a separate connector capability. Do not assume an XRPL namespace/method set without confirming the currently supported wallet/protocol configuration.

### Ledger

Hardware wallet support should be implemented as a dedicated signing adapter, with device/browser compatibility tested before production.

## DeFi-specific next steps

Swap:
- quote source
- slippage limits
- path validation
- trustline requirements
- transaction type allowlist

Bridge:
- destination chain
- bridge provider
- finality assumptions
- recipient validation
- replay protection

Stake:
- staking protocol
- lock period
- reward calculation
- unstake semantics

Consolidation:
- company-controlled destination allowlist
- policy engine
- multisignature/secure signer
- transaction limits
- alerting
