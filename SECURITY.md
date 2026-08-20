# Security Policy

Do not report secrets, seed phrases, private keys, or production credentials in issues.

Before Mainnet:
- perform an independent security review;
- add transaction allowlists and policy checks;
- add persistent storage with encryption where appropriate;
- implement rate limiting and idempotency;
- verify wallet signatures and transaction results;
- test all supported wallet versions;
- audit bridge/swap/staking contracts and providers.
