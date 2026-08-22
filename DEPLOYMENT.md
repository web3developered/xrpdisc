# Deployment

Railway must use separate services:

- Frontend root: `/client`
- Backend root: `/server`

Build commands:

```bash
npm ci
npm run build
```

Start commands:

```bash
npm run start
```

Environment:

- `VITE_API_BASE_URL` for the frontend.
- `CORS_ORIGIN` for the backend.
- `XRPL_NETWORK` defaults to `testnet`.
- `XRPL_NETWORK=mainnet` requires `REQUIRE_EXPLICIT_MAINNET_ENABLE=true`.
- `XRPL_RPC_URL` must be set to a mainnet endpoint when `XRPL_NETWORK=mainnet`.
- `AUTHORIZED_XRP_DESTINATIONS` is a comma-separated allowlist of backend-approved XRP destinations.
- `MAX_PAYMENT_DROPS` caps generated Payment intents.

Railway deployment is configured for separate frontend and backend services. Production readiness is
still NOT IMPLEMENTED because Postgres, Redis, XRPL autofill, signing, submission, monitoring, and
sell execution are not complete.

