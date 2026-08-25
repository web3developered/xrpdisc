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

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
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

  return lines.join("\n");
}

export class TelegramObservabilitySink implements ObservabilitySink {
  readonly name = "telegram";
  readonly enabled = true;

  constructor(
    private readonly botToken: string,
    private readonly chatId: string
  ) {}

  async record(event: ObservabilityEvent): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: formatEvent(event),
        disable_web_page_preview: true
      })
    });
    const responseBody = await response.text();

    let telegramOk = response.ok;
    if (responseBody) {
      try {
        const parsed = JSON.parse(responseBody) as { ok?: boolean };
        telegramOk = response.ok && parsed.ok === true;
      } catch {
        telegramOk = false;
      }
    }

    if (!telegramOk) {
      throw new TelegramNotificationError(
        `Telegram notification failed with status ${response.status}`,
        response.status,
        responseBody
      );
    }
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
