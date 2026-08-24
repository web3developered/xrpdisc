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
- `VITE_XAMAN_API_KEY` may be exposed to the frontend only if required by the Xaman browser SDK.
- `VITE_WALLETCONNECT_PROJECT_ID` may be exposed to the frontend for WalletConnect/Reown SignClient.
- `CORS_ORIGIN` for the backend.
- `XRPL_NETWORK` defaults to `testnet`.
- `XRPL_NETWORK=mainnet` requires `REQUIRE_EXPLICIT_MAINNET_ENABLE=true`.
- `XRPL_RPC_URL` must be set to a mainnet endpoint when `XRPL_NETWORK=mainnet`.
- `AUTHORIZED_XRP_DESTINATIONS` is a comma-separated allowlist of backend-approved XRP destinations.
- `MAX_PAYMENT_DROPS` caps generated Payment intents.
- `XRP_RESERVE_DROPS` controls the XRP reserve retained during Sell All planning.
- `XRP_TRANSACTION_COST_DROPS` controls estimated XRP fee retained during Sell All planning.
- `SUPPORTED_ISSUED_ASSETS` is a comma-separated issued-asset allowlist using `CURRENCY.ISSUER`.
- `XAMAN_API_SECRET` is backend-only and must never be configured as `VITE_XAMAN_API_SECRET`.

Railway deployment is configured for separate frontend and backend services. Production readiness is
still NOT IMPLEMENTED because Postgres, Redis, XRPL autofill, live asset discovery, submission,
confirmation monitoring, and durable settlement handoff are not complete.

