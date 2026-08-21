# API

All product APIs are versioned under `/api/v1`.

Implemented in Phase 1:

```http
GET /health
GET /ready
```

Reserved but NOT IMPLEMENTED:

```http
POST /api/v1/sessions
GET  /api/v1/sessions/:id
POST /api/v1/transactions/intents
GET  /api/v1/transactions/:id
POST /api/v1/transactions/:id/signature
POST /api/v1/transactions/:id/submit
GET  /api/v1/transactions/:id/status
POST /api/v1/sell/quote
POST /api/v1/sell/intents
```

No endpoint accepts arbitrary XRPL transaction blobs from the frontend.

