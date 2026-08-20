# Railway deployment

1. Push this folder to a new GitHub repository.
2. Create a Railway project and deploy the GitHub repository.
3. Railway will use `railway.toml`.
4. Set environment variables:
   - `NODE_ENV=production`
   - `PORT` is normally provided by Railway; do not hardcode it.
   - `XRPL_NETWORK=mainnet`
   - `XRPL_WS_URL=wss://xrplcluster.com`
   - `CORS_ORIGIN=https://your-production-domain`
   - Xaman secrets only if using Xaman backend integration.
5. Deploy.
6. Verify `/api/health`.
7. Configure your production domain and HTTPS.
8. Only then enable Mainnet transaction flows.

For initial testing, keep `XRPL_NETWORK=testnet`.
