# Architecture

## 1. Current Architecture Assessment

The workspace previously contained unrelated P2P and Tron experiments. This Phase 1 repository starts a clean XRPL platform at `xrpl-defi-platform` to avoid inheriting wallet-key custody patterns, simulated chain behavior, or product assumptions from older projects.

## 2. Target Architecture Mapped To 10 Stages

1. Company XRP DeFi product layer: sell intent domain, NOT IMPLEMENTED beyond route shell.
2. Frontend: React/Vite shell with wallet-selection UI and signing-boundary language.
3. Wallet connect: adapter contract planned, NOT IMPLEMENTED.
4. Backend: Fastify API shell, request IDs, rate limits, security headers, config validation.
5. TX generation: dedicated XRPL service planned, NOT IMPLEMENTED.
6. Wallet prompt: explicit review flow planned; no automatic signing exists.
7. Signed TX: validation endpoint planned, NOT IMPLEMENTED.
8. Submission: dedicated submission service planned, NOT IMPLEMENTED.
9. Monitoring: state schema planned; worker NOT IMPLEMENTED.
10. Consolidation: allowlisted privileged service planned, NOT IMPLEMENTED.

## 3. Repository/File Structure

- `client/src`: frontend shell, typed API client, UI state.
- `server/src/api`: health and versioned API route shells.
- `server/src/config`: environment validation and mainnet guard.
- `server/src/security`: request ID handling.
- `server/src/observability`: structured logger with secret redaction.
- `server/database/migrations`: PostgreSQL migration skeleton.
- `.github/workflows`: CI.
- `railway.*.json`, `*/Dockerfile`: deployment foundation.

## 4. Technology Choices

- React + TypeScript + Vite for a typed, production frontend.
- Zustand for small, explicit client state.
- Fastify for a performant TypeScript API.
- Zod for runtime validation.
- PostgreSQL as authoritative persistence.
- Redis planned for queues, locks, rate limiting, and short-lived state.
- Pino JSON logs for auditability and traceability.

## 5. Security Threat Model

Primary risks: deceptive signing, arbitrary transaction injection, cross-network transaction mistakes, replay/duplicate submission, forged frontend values, wallet-address-only authentication, secrets leakage, insufficient audit trails, node outages, and unverified blockchain state.

Controls in Phase 1: mainnet opt-in guard, explicit NOT IMPLEMENTED endpoints, no seed/private-key paths, redacted logs, request IDs, rate limiting, CORS configuration, security headers, and architecture docs.

## 6. Database Schema

Phase 1 migration defines:

- `wallet_sessions`
- `transaction_intents`
- `transaction_state_transitions`
- `audit_events`

Full indexes, repositories, migrations runner, and database tests are NOT IMPLEMENTED.

## 7. API Contracts

- `GET /health`
- `GET /ready`
- `POST /api/v1/sessions` returns `501 NOT_IMPLEMENTED`
- `POST /api/v1/transactions/intents` returns `501 NOT_IMPLEMENTED`
- `GET /api/v1/transactions/:id/status` returns `501 NOT_IMPLEMENTED`
- `POST /api/v1/sell/quote` returns `501 NOT_IMPLEMENTED`
- `POST /api/v1/sell/intents` returns `501 NOT_IMPLEMENTED`

## 8. Wallet Adapter Contracts

The planned adapter boundary is documented in `WALLET_INTEGRATION.md`. Actual SDK integrations are NOT IMPLEMENTED.

## 9. Transaction State Machine

Allowed happy path:

`CREATED -> AWAITING_SIGNATURE -> SIGNED -> SUBMITTING -> SUBMITTED -> VALIDATING -> VALIDATED`

Failure branches are documented in `XRPL_TRANSACTIONS.md`. Runtime transition enforcement is NOT IMPLEMENTED.

## 10. Deployment Architecture

Railway deploys two services:

- Frontend root: `/client`
- Backend root: `/server`

Both use Node 22, lockfiles, production builds, non-root Docker runtime users, and environment-driven backend/frontend URLs.

