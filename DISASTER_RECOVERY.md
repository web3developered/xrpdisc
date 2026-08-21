# Disaster Recovery

PostgreSQL is the authoritative transaction state store. Redis must never become the permanent source of blockchain transaction truth.

NOT IMPLEMENTED:

- Backup schedule.
- Restore procedure validation.
- Transaction monitor replay after backend restart.
- Redis outage degradation tests.
- PostgreSQL outage runbook tests.
- Incident command workflow.

