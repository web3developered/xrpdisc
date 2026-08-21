# XRPL Transactions

The required lifecycle is:

`USER INTENT -> FRONTEND -> WALLET CONNECTION -> BACKEND SESSION -> TRANSACTION REQUEST -> UNSIGNED XRPL TRANSACTION -> EXPLICIT USER REVIEW -> WALLET SIGNATURE -> SIGNED TRANSACTION -> XRPL SUBMISSION -> VALIDATED LEDGER RESULT -> MONITORING -> AUTHORIZED CONSOLIDATION`

Phase 1 does not generate, sign, submit, or monitor XRPL transactions.

Allowed initial transaction type planned for later phases:

- `Payment`

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

Runtime state transition enforcement is NOT IMPLEMENTED.

