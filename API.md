# API

All product APIs are versioned under `/api/v1`.

Implemented:

```http
GET /health
GET /ready
POST /api/v1/sessions
GET  /api/v1/sessions/:id
POST /api/v1/transactions/intents
GET  /api/v1/transactions/:id/status
POST /api/v1/transactions/:id/signature
POST /api/v1/transactions/:id/submit
POST /api/v1/transactions/:id/monitor
POST /api/v1/sell/quote
POST /api/v1/sell/intents
GET  /api/v1/sell/intents/:id/status
```

`POST /api/v1/sessions`

Creates a wallet-backed session record. A wallet address alone is not treated as authentication.

```json
{
  "walletAddress": "r...",
  "walletProvider": "gemwallet",
  "network": "mainnet"
}
```

`POST /api/v1/transactions/intents`

Creates an allowlisted unsigned XRPL `Payment` intent for an active session. The backend derives
`Account` from the session and rejects arbitrary transaction blobs from the frontend.

```json
{
  "sessionId": "uuid",
  "transactionType": "Payment",
  "destination": "r...",
  "amountDrops": "1000",
  "destinationTag": 123,
  "memo": "optional human intent reference"
}
```

Responses include `intent.unsignedTransaction`, `intent.intentFingerprint`, `intent.status`, and
`intent.autofillStatus`.

`POST /api/v1/transactions/:id/signature`

Accepts a wallet-signed transaction envelope after explicit frontend review. The backend checks that
the signer matches the intent account and that the submitted signature corresponds to the approved
intent fingerprint.

```json
{
  "signerAddress": "r...",
  "signedTransactionHash": "64-character hex hash",
  "txBlob": "hex signed transaction blob",
  "unsignedTransactionFingerprint": "intent fingerprint"
}
```

`POST /api/v1/transactions/:id/submit`

Transitions a signed transaction into submission handling. Current behavior intentionally returns
`409 XRPL_SUBMISSION_BLOCKED` because the official XRPL client dependency is not installed, so the
backend refuses to fake network submission.

`POST /api/v1/transactions/:id/monitor`

Records monitoring status for an intent. For blocked submissions, monitoring becomes terminal with
the failure reason.

`POST /api/v1/sell/quote`

Starts the Sell All flow for an active wallet session. The endpoint never accepts frontend-provided
balances. It must discover authoritative XRPL balances through the backend XRPL asset discovery
boundary. Until the XRPL client is configured, the production route returns
`503 XRPL_ASSET_DISCOVERY_UNAVAILABLE`.

```json
{
  "sessionId": "uuid"
}
```

`POST /api/v1/sell/intents`

Creates an idempotent sell intent from a backend-generated quote. The intent contains exact assets,
eligibility decisions, company destination, and prepared XRPL `Payment` transaction plans.

```json
{
  "quoteId": "uuid"
}
```

`GET /api/v1/sell/intents/:id/status`

Returns the aggregate sell state, per-asset transaction states, destination, and settlement handoff
flag. Confirmed sell records are for the existing settlement/accounting infrastructure; this API
does not credit cash balances.

Still reserved but NOT IMPLEMENTED:

```http
POST /api/v1/transactions/:id/confirm
```

No endpoint accepts arbitrary XRPL transaction blobs from the frontend.

