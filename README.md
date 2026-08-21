# XRPL DeFi Platform — Production-Oriented Starter

This repository is a clean starting point for an XRPL DeFi application matching the supplied flow:

1. Product intent (buy / sell / stake / swap / bridge)
2. Frontend
3. Wallet selection
4. Backend session + transaction orchestration
5. XRPL transaction generation
6. Wallet signing prompt
7. Signed transaction returned
8. XRPL submission
9. Monitoring
10. Company-controlled consolidation

## Important security boundary

The frontend never receives a wallet seed/private key. Wallets sign user-approved transaction payloads. The backend can construct and validate unsigned transactions and monitor results.

This starter deliberately does **not** implement a hidden or deceptive "claim", "verify", or approval flow. Every transaction must be presented to the user with the actual transaction intent before signing.

## Stack

- React + TypeScript + Vite
- Express + TypeScript
- `xrpl.js`
- Crossmark SDK
- GemWallet API
- Xaman integration boundary (backend-ready)
- Helmet / CORS / structured validation
- Railway-compatible single service deployment
- Testnet by default

## Local development

Requirements: Node 20+ (Node 22 recommended).

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

## Production

Set the required Railway variables, especially:

- `NODE_ENV=production`
- `XRPL_NETWORK=mainnet`
- `XRPL_WS_URL=wss://xrplcluster.com`
- `CORS_ORIGIN=https://your-domain.example`

Then:

```bash
npm ci
npm run build
npm start
```

The Express server serves the built React app and exposes `/api/*`.

## Wallet adapters

Crossmark and GemWallet are wired behind a common adapter interface. Xaman is intentionally represented as a secure backend integration boundary because Xaman backend credentials must never be shipped to the browser.

WalletConnect is left behind a capability boundary rather than pretending XRPL support where a current official chain/method configuration is not confirmed for this app.

## Next implementation stages

1. Replace the demo transaction builder with your approved product transaction schemas.
2. Add Xaman payload creation + webhook verification.
3. Add persistent session/transaction storage (PostgreSQL/Redis).
4. Add swap/bridge protocol integrations and quote validation.
5. Add idempotency, rate limits, replay protection and audit logs.
6. Add automated integration tests against XRPL Testnet.
7. Security review and transaction-policy review before Mainnet.

## Railway two-service deployment

Use the same GitHub repository for two Railway services.

### Frontend
- Root Directory: `/client`
- Build Command: `npm run build`
- Start Command: `npm run start`
- Healthcheck: `/`
- Variable: `VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN`

### Backend
- Root Directory: `/server`
- Build Command: `npm run build`
- Start Command: `npm run start`
- Healthcheck: `/api/health`
- `NODE_ENV=production`
- `XRPL_NETWORK=testnet`
- `XRPL_WS_URL=wss://s.altnet.rippletest.net:51233`
- `CORS_ORIGIN=https://YOUR-FRONTEND-DOMAIN`

The frontend and backend are intentionally separate Railway services. Do not use `/api/health` as the frontend healthcheck.
