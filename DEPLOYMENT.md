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
- Production (`NODE_ENV=production`) is **mainnet-only**. The server forces `XRPL_NETWORK=mainnet` even if a stale Railway variable says `testnet`.
- Production also forces `XRPL_CLIENT_ENABLED=true` so real XRPL autofill, submission, and monitoring use the mainnet client.
- A stale/testnet `XRPL_RPC_URL` is rejected/overridden in production; the safe default is `wss://xrplcluster.com`.
- `REQUIRE_EXPLICIT_MAINNET_ENABLE` is retained for compatibility but is automatically enabled for mainnet.
- `AUTHORIZED_XRP_DESTINATIONS` is a comma-separated allowlist of backend-approved XRP destinations.
- `MAX_PAYMENT_DROPS` caps generated Payment intents.
- `XRP_RESERVE_DROPS` controls the XRP reserve retained during Sell All planning.
- `XRP_TRANSACTION_COST_DROPS` controls estimated XRP fee retained during Sell All planning.
- `SUPPORTED_ISSUED_ASSETS` is a comma-separated issued-asset allowlist using `CURRENCY.ISSUER`.
- `XAMAN_API_SECRET` is backend-only and must never be configured as `VITE_XAMAN_API_SECRET`.

Railway deployment is configured for separate frontend and backend services. The current deployment uses the configured XRPL gateway for live mainnet asset discovery, autofill, submission, and monitoring. Persistence remains in-memory until Postgres/Redis are wired into the repositories.

