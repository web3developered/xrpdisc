import { z } from "zod";

const MAINNET_XRPL_RPC_URL = "wss://s1.ripple.com/";
const MAINNET_XRPL_RPC_FALLBACK_URLS = [
  "wss://s1.ripple.com/",
  "wss://s2.ripple.com/",
  "wss://xrplcluster.com/"
];
const TESTNET_XRPL_RPC_URL = "wss://s.altnet.rippletest.net:51233";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    HOST: z.string().min(1).default("0.0.0.0"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
    XRPL_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
    XRPL_RPC_URL: z.string().min(1).optional(),
    XRPL_RPC_FALLBACK_URLS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean)
      ),
    XRPL_CLIENT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AUTHORIZED_XRP_DESTINATIONS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((destination) => destination.trim())
          .filter(Boolean)
      ),
    MAX_PAYMENT_DROPS: z.coerce.number().int().positive().default(1_000_000),
    XRP_RESERVE_DROPS: z.coerce.number().int().positive().default(10_000_000),
    XRP_TRANSACTION_COST_DROPS: z.coerce.number().int().positive().default(12),
    XRPL_LAST_LEDGER_SEQUENCE_OFFSET: z.coerce.number().int().positive().default(300),
    SUPPORTED_ISSUED_ASSETS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((asset) => asset.trim())
          .filter(Boolean)
      ),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),
    XAMAN_API_KEY: z.string().min(1).optional(),
    XAMAN_API_SECRET: z.string().min(1).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
    REQUIRE_EXPLICIT_MAINNET_ENABLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true")
  })
  .transform((env) => {
    // Railway runs the server with NODE_ENV=production. Production is deliberately
    // mainnet-only so a stale/testnet Railway variable can never send production
    // traffic to the XRPL test network.
    const XRPL_NETWORK = env.NODE_ENV === "production" ? "mainnet" : env.XRPL_NETWORK;
    const configuredRpc = env.XRPL_RPC_URL;
    const XRPL_RPC_URL =
      XRPL_NETWORK === "mainnet"
        ? configuredRpc && !isTestnetXrplEndpoint(configuredRpc)
          ? configuredRpc
          : MAINNET_XRPL_RPC_URL
        : configuredRpc ?? TESTNET_XRPL_RPC_URL;
    const defaultFallbacks =
      XRPL_NETWORK === "mainnet" ? MAINNET_XRPL_RPC_FALLBACK_URLS : [];
    const XRPL_RPC_FALLBACK_URLS = uniqueValues([...env.XRPL_RPC_FALLBACK_URLS, ...defaultFallbacks])
      .filter((url) => normalizeEndpointKey(url) !== normalizeEndpointKey(XRPL_RPC_URL));

    return {
      ...env,
      XRPL_NETWORK,
      XRPL_RPC_URL,
      XRPL_RPC_FALLBACK_URLS,
      XRPL_CLIENT_ENABLED:
        env.NODE_ENV === "production" && XRPL_NETWORK === "mainnet"
          ? true
          : env.XRPL_CLIENT_ENABLED,
      REQUIRE_EXPLICIT_MAINNET_ENABLE:
        XRPL_NETWORK === "mainnet" ? true : env.REQUIRE_EXPLICIT_MAINNET_ENABLE
    };
  })
  .superRefine((env, ctx) => {
    if (env.XRPL_NETWORK === "mainnet" && isTestnetXrplEndpoint(env.XRPL_RPC_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mainnet cannot use a testnet XRPL RPC endpoint"
      });
    }
    if (env.XRPL_NETWORK === "mainnet" && env.XRPL_RPC_FALLBACK_URLS.some(isTestnetXrplEndpoint)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mainnet cannot use a testnet XRPL RPC fallback endpoint"
      });
    }
    if (env.XRPL_NETWORK === "mainnet" && env.AUTHORIZED_XRP_DESTINATIONS.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mainnet requires at least one AUTHORIZED_XRP_DESTINATIONS address"
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}


function isTestnetXrplEndpoint(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    normalized.includes("altnet.rippletest.net") ||
    normalized.includes("testnet") ||
    normalized.includes("devnet") ||
    normalized.includes("hooks-testnet")
  );
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = normalizeEndpointKey(value);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }
  return unique;
}

function normalizeEndpointKey(value: string): string {
  return value.replace(/\/+$/, "").toLowerCase();
}
