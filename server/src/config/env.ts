import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
    XRPL_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
    XRPL_RPC_URL: z.string().min(1).default("wss://s.altnet.rippletest.net:51233"),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
    REQUIRE_EXPLICIT_MAINNET_ENABLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
  })
  .superRefine((env, ctx) => {
    if (env.XRPL_NETWORK === "mainnet" && env.REQUIRE_EXPLICIT_MAINNET_ENABLE !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mainnet requires REQUIRE_EXPLICIT_MAINNET_ENABLE=true"
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
