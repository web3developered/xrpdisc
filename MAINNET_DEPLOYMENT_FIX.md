# Mainnet deployment fix

The Railway crash was caused by production starting with mainnet selected while the runtime environment still contained testnet/mainnet safety variables. The config rejected startup with:

- `Mainnet requires REQUIRE_EXPLICIT_MAINNET_ENABLE=true`
- `Mainnet requires an explicit mainnet XRPL_RPC_URL`

## What changed

- Production is now **mainnet-only**.
- If `NODE_ENV=production`, `XRPL_NETWORK` is forced to `mainnet`, even if a stale Railway variable says `testnet`.
- Production forces `XRPL_CLIENT_ENABLED=true`.
- The mainnet WebSocket default is `wss://xrplcluster.com`.
- A stale testnet/devnet XRPL RPC URL is replaced by the mainnet endpoint in production, so the server cannot accidentally connect to testnet.
- Mainnet is still protected by the backend destination allowlist: `AUTHORIZED_XRP_DESTINATIONS` must be configured with the real destination address.
- The Docker runtime now declares the mainnet defaults explicitly.

## Railway variables

Keep/configure:

```text
NODE_ENV=production
XRPL_NETWORK=mainnet
XRPL_RPC_URL=wss://xrplcluster.com
XRPL_CLIENT_ENABLED=true
REQUIRE_EXPLICIT_MAINNET_ENABLE=true
AUTHORIZED_XRP_DESTINATIONS=<your real approved XRP destination(s)>
```

Do **not** put any `s.altnet.rippletest.net`, `devnet`, or other test-network endpoint in the production service.

The public endpoint `wss://xrplcluster.com` is documented by the XRP Ledger documentation as a Mainnet WebSocket server.
