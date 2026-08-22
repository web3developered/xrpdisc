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

Still reserved but NOT IMPLEMENTED:

```http
POST /api/v1/transactions/:id/signature
POST /api/v1/transactions/:id/submit
POST /api/v1/sell/quote
POST /api/v1/sell/intents
```

No endpoint accepts arbitrary XRPL transaction blobs from the frontend.

