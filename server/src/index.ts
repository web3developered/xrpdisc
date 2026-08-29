import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = await buildApp(config);

const close = async (signal: string) => {
  app.log.info({ signal }, "shutdown requested");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void close("SIGINT"));
process.on("SIGTERM", () => void close("SIGTERM"));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(
    { host: config.HOST, port: config.PORT, xrplNetwork: config.XRPL_NETWORK },
    "xrpl-defi-api listening"
  );
} catch (error) {
  app.log.error({ error }, "server startup failed");
  process.exit(1);
}
