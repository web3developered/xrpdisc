# XRPL Transactions

The required lifecycle is:

`USER INTENT -> FRONTEND -> WALLET CONNECTION -> BACKEND SESSION -> TRANSACTION REQUEST -> UNSIGNED XRPL TRANSACTION -> EXPLICIT USER REVIEW -> WALLET SIGNATURE -> SIGNED TRANSACTION -> XRPL SUBMISSION -> VALIDATED LEDGER RESULT -> MONITORING -> AUTHORIZED CONSOLIDATION`

Phase 3 implements backend wallet sessions and transaction intent tracking.

Phase 4 implements validated unsigned `Payment` intent generation with backend policy controls.
The backend does not accept arbitrary transaction blobs from the frontend.

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
submission, validation, monitoring, and persistence-backed replay protection remain NOT IMPLEMENTED
until later phases.

