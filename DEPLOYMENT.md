# Deployment

Railway must use separate services:

- Frontend root: `/client`
- Backend root: `/server`

Build commands:

```bash
npm ci
npm run build
```

Start commands:

```bash
npm run start
```

Environment:

- `VITE_API_BASE_URL` for the frontend.
- `CORS_ORIGIN` for the backend.
- `XRPL_NETWORK` defaults to `testnet`.
- `XRPL_NETWORK=mainnet` requires `REQUIRE_EXPLICIT_MAINNET_ENABLE=true`.

Production deployment validation is NOT IMPLEMENTED because no live Railway environment has been configured in this workspace.

