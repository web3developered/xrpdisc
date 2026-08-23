# XRPL Transactions

The required lifecycle is:

`USER INTENT -> FRONTEND -> WALLET CONNECTION -> BACKEND SESSION -> TRANSACTION REQUEST -> UNSIGNED XRPL TRANSACTION -> EXPLICIT USER REVIEW -> WALLET SIGNATURE -> SIGNED TRANSACTION -> XRPL SUBMISSION -> VALIDATED LEDGER RESULT -> MONITORING -> AUTHORIZED CONSOLIDATION`

Phase 3 implements backend wallet sessions and transaction intent tracking.

Phase 4 implements validated unsigned `Payment` intent generation with backend policy controls.
The backend does not accept arbitrary transaction blobs from the frontend.

Phase 5 implements the signing boundary API and signed transaction envelope checks:

- signer address must match the original intent account
- signed transaction hash must be a 64-character hex string
- signed transaction blob must be hex encoded
- submitted fingerprint must match the approved unsigned intent fingerprint
- submission is blocked until a real XRPL client can submit the signed blob

Phase 6 implements process-local monitoring records and terminal blocked-submission state. Durable
PostgreSQL-backed monitoring is still NOT IMPLEMENTED.

Phase 7 implements Sell All orchestration boundaries:

- backend-only company destination from `AUTHORIZED_XRP_DESTINATIONS`
- authoritative asset discovery boundary, currently unavailable in production until XRPL client is wired
- XRP reserve and estimated transaction-cost protection
- platform allowlist for issued assets via `SUPPORTED_ISSUED_ASSETS`
- idempotent sell intent creation
- per-asset transaction plans
- partial success aggregation
- settlement-ready flag for confirmed assets
- no fiat/cash crediting

Allowed initial transaction type:

- `Payment`

Policy enforcement:

- `Account` is derived from the active backend session.
- `Destination` must be included in `AUTHORIZED_XRP_DESTINATIONS`.
- `Amount` must be a positive integer drops string and must not exceed `MAX_PAYMENT_DROPS`.
- Request network must match backend `XRPL_NETWORK`.
- Mainnet requires explicit enablement and a mainnet RPC URL.

Current autofill status:

- `autofillStatus: "requires_xrpl_client"`
- Sequence, Fee, and LastLedgerSequence are not fabricated.
- Install and verify the official XRPL client dependency before enabling network autofill.

Sell-specific environment:

- `XRP_RESERVE_DROPS` controls retained XRP reserve.
- `XRP_TRANSACTION_COST_DROPS` controls the estimated XRP transaction fee held back.
- `SUPPORTED_ISSUED_ASSETS` is a comma-separated allowlist in `CURRENCY.ISSUER` form.

State machine:

- `CREATED`
- `AWAITING_SIGNATURE`
- `SIGNING`
- `SIGNED`
- `SUBMITTING`
- `SUBMITTED`
- `VALIDATING`
- `VALIDATED`
- `FAILED`
- `EXPIRED`
- `CANCELLED`
- `REJECTED`

Runtime state transition enforcement helper is implemented for transaction services, but signature,
network submission, validation, and persistence-backed replay protection are not production-ready
until the official XRPL client and PostgreSQL repositories are wired.

