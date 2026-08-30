export type ObservabilityEvent = {
  name: string;
  flowId?: string;
  sessionId?: string;
  walletAddress?: string;
  walletProvider?: string;
  network?: string;
  quoteId?: string;
  sellIntentId?: string;
  transactionIntentId?: string;
  assetId?: string;
  xrplHash?: string;
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
};

export interface ObservabilitySink {
  readonly name: string;
  readonly enabled: boolean;
  record(event: ObservabilityEvent): Promise<void>;
}

export class NullObservabilitySink implements ObservabilitySink {
  readonly name = "null";
  readonly enabled = false;

  async record(_event: ObservabilityEvent): Promise<void> {
    return undefined;
  }
}

export class TelegramNotificationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string
  ) {
    super(message);
    this.name = "TelegramNotificationError";
  }
}

const TELEGRAM_MAX_MESSAGE_LENGTH = 3900;
const TELEGRAM_MAX_VALUE_LENGTH = 900;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 32)}...[truncated ${value.length} chars]`;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return truncate(String(value), TELEGRAM_MAX_VALUE_LENGTH);
  }
  return truncate(JSON.stringify(value), TELEGRAM_MAX_VALUE_LENGTH);
}

function formatEvent(event: ObservabilityEvent): string {
  const lines = [
    `XRPDISC ${event.name}`,
    `timestamp=${new Date().toISOString()}`
  ];

  for (const key of [
    "flowId",
    "sessionId",
    "walletAddress",
    "walletProvider",
    "network",
    "quoteId",
    "sellIntentId",
    "transactionIntentId",
    "assetId",
    "xrplHash",
    "status",
    "message"
  ] as const) {
    const value = event[key];
    if (value !== undefined) {
      lines.push(`${key}=${formatValue(value)}`);
    }
  }

  if (event.data) {
    for (const [key, value] of Object.entries(event.data)) {
      lines.push(`${key}=${formatValue(value)}`);
    }
  }

  return truncate(lines.join("\n"), TELEGRAM_MAX_MESSAGE_LENGTH);
}

export class TelegramObservabilitySink implements ObservabilitySink {
  readonly name = "telegram";
  readonly enabled = true;

  constructor(
    private readonly botToken: string,
    private readonly chatId: string
  ) {}

  async record(event: ObservabilityEvent): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: this.chatId, text: formatEvent(event), disable_web_page_preview: true }),
          signal: AbortSignal.timeout(8000)
        });
        const responseBody = await response.text();
        let telegramOk = response.ok;
        if (responseBody) {
          try {
            const parsed = JSON.parse(responseBody) as { ok?: boolean };
            telegramOk = response.ok && parsed.ok === true;
          } catch { telegramOk = false; }
        }
        if (telegramOk) return;
        throw new TelegramNotificationError(`Telegram notification failed with status ${response.status}`, response.status, responseBody);
      } catch (error) {
        lastError = error;
        if (error instanceof TelegramNotificationError && error.status >= 400 && error.status < 500 && error.status !== 429) break;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    if (lastError instanceof TelegramNotificationError) throw lastError;
    throw new TelegramNotificationError("Telegram notification request failed", 0, lastError instanceof Error ? lastError.message : "Unknown Telegram request error");

  }
}

export function createObservabilitySink(config: {
  TELEGRAM_BOT_TOKEN?: string | undefined;
  TELEGRAM_CHAT_ID?: string | undefined;
}): ObservabilitySink {
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
    return new TelegramObservabilitySink(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID);
  }
  return new NullObservabilitySink();
}
