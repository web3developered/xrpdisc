import type { AppConfig } from "../config/env.js";

export function createLoggerOptions(config: Pick<AppConfig, "LOG_LEVEL" | "NODE_ENV">) {
  return {
    level: config.LOG_LEVEL,
    base: {
      service: "xrpl-defi-api",
      environment: config.NODE_ENV
    },
    redact: {
      paths: ["seed", "secret", "privateKey", "recoveryPhrase", "*.seed", "*.secret", "*.privateKey"],
      censor: "[REDACTED]"
    }
  };
}
