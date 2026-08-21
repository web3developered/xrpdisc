# Security

The application must never request, store, transmit, or log wallet seeds, private keys, recovery phrases, or signing credentials.

Phase 1 implemented:

- Structured logger with secret redaction.
- Mainnet configuration rejection unless explicitly enabled.
- Request IDs on responses.
- CORS origin configured by environment.
- Security headers through Helmet.
- Rate limiting.
- Phase 2+ financial routes return `NOT_IMPLEMENTED`.

NOT IMPLEMENTED:

- Wallet proof/session challenge flow.
- Transaction intent fingerprinting.
- Signed transaction equivalence validation.
- Idempotency-key persistence.
- Replay protection.
- Audit event repositories.
- Dependency vulnerability policy exceptions.
- Penetration testing and production readiness review.

