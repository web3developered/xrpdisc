# XRPL DeFi Platform

This repository is the Phase 1 foundation for a production XRP Ledger DeFi platform.

Production readiness is NOT IMPLEMENTED. Phase 1 provides repository architecture, React/Vite frontend shell, TypeScript backend shell, CI, Docker/Railway configuration, environment safety, baseline observability, and documentation.

## Services

- `client`: React, TypeScript, Vite frontend.
- `server`: Fastify, TypeScript backend.

## Required Commands

```bash
npm --prefix client ci
npm --prefix client run build
npm --prefix client run start

npm --prefix server ci
npm --prefix server run build
npm --prefix server run start
```

## Phase Status

- Phase 1: IMPLEMENTED
- Phase 2 wallet adapters: NOT IMPLEMENTED
- Phase 3 sessions/intents: NOT IMPLEMENTED
- Phase 4 XRPL transaction generation: NOT IMPLEMENTED
- Phase 5 signing/submission: NOT IMPLEMENTED
- Phase 6 monitoring/persistence workers: NOT IMPLEMENTED
- Phase 7 sell execution: NOT IMPLEMENTED
- Phase 11 hardening/load/failure testing: NOT IMPLEMENTED
- Phase 12 production readiness review: NOT IMPLEMENTED

