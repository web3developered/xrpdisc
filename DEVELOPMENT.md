# Development

Use Node 22 LTS.

```bash
cd client
npm ci
npm run dev
```

```bash
cd server
npm ci
npm run dev
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

PostgreSQL and Redis are required for later phases. Phase 1 only defines the migration skeleton and environment variables.

