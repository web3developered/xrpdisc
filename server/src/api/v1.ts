import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import {
  createObservabilitySink,
  TelegramNotificationError,
  type ObservabilityEvent,
  type ObservabilitySink
} from "../observability/events.js";
import { UnavailableAssetDiscovery, XrplAssetDiscovery } from "../sell/discovery.js";
import { InMemorySellRepository } from "../sell/repository.js";
import { SellService } from "../sell/service.js";
import { InMemorySessionRepository } from "../sessions/repository.js";
import { SessionService } from "../sessions/service.js";
import { InMemoryTransactionIntentRepository } from "../transactions/repository.js";
import { TransactionIntentService } from "../transactions/service.js";
import { XamanPayloadService } from "../wallets/xaman.js";
import { XrplJsGateway } from "../xrpl/client.js";
import type { XrplPaymentTransaction } from "../xrpl/types.js";

const walletProviderSchema = z.enum(["xaman", "crossmark", "gemwallet", "walletconnect", "ledger"]);
const networkSchema = z.enum(["testnet", "mainnet"]);

const createSessionSchema = z.object({
  walletAddress: z.string().min(25).max(35),
  walletProvider: walletProviderSchema,
  network: networkSchema
});

const createPaymentIntentSchema = z.object({
  sessionId: z.string().uuid(),
  transactionType: z.literal("Payment").default("Payment"),
  destination: z.string().min(25).max(35),
  amountDrops: z.string().regex(/^[1-9]\d*$/),
  destinationTag: z.number().int().nonnegative().optional(),
  memo: z.string().max(256).optional()
});

const createSellIntentSchema = z.object({
  quoteId: z.string().uuid()
});

const xamanTransactionPayloadSchema = z.object({
  transaction: z
    .record(z.string(), z.unknown())
    .and(z.object({ TransactionType: z.string().min(1) }))
});

const acceptSignatureSchema = z.object({
  signerAddress: z.string().min(25).max(35),
  signedTransactionHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  txBlob: z.string().regex(/^[A-Fa-f0-9]+$/).min(16),
  unsignedTransactionFingerprint: z.string().regex(/^[A-Fa-f0-9]{64}$/)
});

function badRequest(error: unknown) {
  return {
    error: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "Request validation failed"
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function notify(app: FastifyInstance, sink: ObservabilitySink, event: ObservabilityEvent): Promise<void> {
  try {
    await sink.record(event);
    if (sink.enabled) {
      app.log.info(
        {
          eventName: event.name,
          observability: sink.name
        },
        "observability notification delivered"
      );
    }
  } catch (error) {
    app.log.warn(
      {
        error,
        eventName: event.name,
        ...(error instanceof TelegramNotificationError
          ? {
              telegramStatus: error.status,
              telegramResponseBody: error.responseBody
            }
          : {})
      },
      "observability notification failed"
    );
  }
}

export async function registerV1Routes(app: FastifyInstance, config: AppConfig) {
  const sessionService = new SessionService(config, new InMemorySessionRepository());
  const observability = createObservabilitySink(config);
  app.log.info(
    {
      observability: observability.name,
      enabled: observability.enabled,
      telegramConfigured: Boolean(config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID)
    },
    observability.enabled ? "Telegram observability ENABLED" : "Telegram observability DISABLED"
  );
  const xrplGateway = config.XRPL_CLIENT_ENABLED ? new XrplJsGateway(config) : undefined;
  const transactionIntentService = new TransactionIntentService(
    config,
    new InMemoryTransactionIntentRepository(),
    xrplGateway,
    (event) => notify(app, observability, event)
  );
  const sellService = new SellService(
    config,
    new InMemorySellRepository(),
    xrplGateway ? new XrplAssetDiscovery(xrplGateway) : new UnavailableAssetDiscovery(),
    transactionIntentService,
    (event) => notify(app, observability, event)
  );
  const xamanPayloadService = config.XAMAN_API_KEY && config.XAMAN_API_SECRET
    ? new XamanPayloadService(config)
    : null;

  app.post("/api/v1/observability/test", async (request, reply) => {
    if (!observability.enabled) {
      return reply.code(503).send({
        ok: false,
        error: "OBSERVABILITY_DISABLED",
        observability: observability.name,
        enabled: false
      });
    }

    const event: ObservabilityEvent = {
      name: "telegram.test",
      flowId: _request.id,
      status: "TEST",
      message: "Manual Telegram delivery test from XRPDISC backend",
      data: {
        requestId: request.id,
        userAgent: firstHeader(request.headers["user-agent"])
      }
    };

    try {
      await observability.record(event);
      app.log.info(
        {
          eventName: event.name,
          observability: observability.name,
          requestId: request.id
        },
        "observability diagnostic notification delivered"
      );
      return reply.send({
        ok: true,
        eventName: event.name,
        observability: observability.name,
        enabled: observability.enabled,
        requestId: request.id
      });
    } catch (error) {
      app.log.warn(
        {
          error,
          eventName: event.name,
          ...(error instanceof TelegramNotificationError
            ? {
                telegramStatus: error.status,
                telegramResponseBody: error.responseBody
              }
            : {})
        },
        "observability diagnostic notification failed"
      );
      return reply.code(error instanceof TelegramNotificationError ? 502 : 500).send({
        ok: false,
        error: "OBSERVABILITY_DELIVERY_FAILED",
        observability: observability.name,
        enabled: observability.enabled,
        ...(error instanceof TelegramNotificationError
          ? {
              telegramStatus: error.status,
              telegramResponseBody: error.responseBody
            }
          : {
              message: error instanceof Error ? error.message : "Observability delivery failed"
            })
      });
    }
  });

  app.post("/api/v1/sessions", async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const session = sessionService.create({
        ...parsed.data,
        network: config.NODE_ENV === "production" ? "mainnet" : parsed.data.network
      });
      await notify(app, observability, {
        name: "wallet.connected",
        flowId: session.id,
        sessionId: session.id,
        walletAddress: session.walletAddress,
        walletProvider: session.walletProvider,
        network: session.network,
        status: session.status
      });
      return reply.code(201).send({ session });
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.get<{ Params: { id: string } }>("/api/v1/sessions/:id", async (request, reply) => {
    try {
      const session = sessionService.getActive(request.params.id);
      return reply.send({ session });
    } catch (error) {
      return reply.code(404).send({ error: "NOT_FOUND", message: (error as Error).message });
    }
  });

  app.post("/api/v1/transactions/intents", async (request, reply) => {
    const parsed = createPaymentIntentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const session = sessionService.getActive(parsed.data.sessionId);
      const idempotencyKey = firstHeader(request.headers["idempotency-key"]);
      const intent = await transactionIntentService.createPaymentIntent({
        session,
        destination: parsed.data.destination,
        amountDrops: parsed.data.amountDrops,
        ...(parsed.data.destinationTag !== undefined
          ? { destinationTag: parsed.data.destinationTag }
          : {}),
        ...(parsed.data.memo !== undefined ? { memo: parsed.data.memo } : {}),
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {})
      });
      return reply.code(201).send({ intent });
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.get<{ Params: { id: string } }>("/api/v1/transactions/:id/status", async (request, reply) => {
    try {
      const intent = transactionIntentService.getIntent(request.params.id);
      return reply.send({
        transactionId: intent.id,
        status: intent.status,
        network: intent.network,
        transactionType: intent.transactionType,
        autofillStatus: intent.autofillStatus,
        policyWarnings: intent.policyWarnings,
        signedTransactionHash: intent.signedTransaction?.signedTransactionHash,
        submission: intent.submission,
        monitoring: intent.monitoring,
        updatedAt: intent.updatedAt
      });
    } catch (error) {
      return reply.code(404).send({ error: "NOT_FOUND", message: (error as Error).message });
    }
  });

  app.post<{ Params: { id: string } }>("/api/v1/transactions/:id/signature", async (request, reply) => {
    const parsed = acceptSignatureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const intent = transactionIntentService.acceptSignature({
        intentId: request.params.id,
        signerAddress: parsed.data.signerAddress,
        signedTransactionHash: parsed.data.signedTransactionHash,
        txBlob: parsed.data.txBlob,
        unsignedTransactionFingerprint: parsed.data.unsignedTransactionFingerprint
      });
      await notify(app, observability, {
        name: "transaction.signature.received",
        transactionIntentId: intent.id,
        sessionId: intent.sessionId,
        network: intent.network,
        status: intent.status,
        ...(intent.signedTransaction?.signerAddress
          ? { walletAddress: intent.signedTransaction.signerAddress }
          : {}),
        ...(intent.signedTransaction?.signedTransactionHash
          ? { xrplHash: intent.signedTransaction.signedTransactionHash }
          : {})
      });
      return reply.send({ intent });
    } catch (error) {
      await notify(app, observability, {
        name: "transaction.signature.failed",
        transactionIntentId: request.params.id,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Signed transaction validation failed"
      });
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Params: { id: string } }>("/api/v1/transactions/:id/submit", async (request, reply) => {
    try {
      const intent = await transactionIntentService.submit(request.params.id);
      await notify(app, observability, {
        name: "transaction.submission.response",
        sessionId: intent.sessionId,
        transactionIntentId: intent.id,
        network: intent.network,
        walletAddress: intent.unsignedTransaction.Account,
        status: intent.status,
        ...(intent.submission?.xrplHash ? { xrplHash: intent.submission.xrplHash } : {}),
        data: {
          engineResult: intent.submission?.engineResult,
          submissionStatus: intent.submission?.status
        }
      });
      if (intent.status === "FAILED") {
        const blocked = intent.submission?.status === "blocked";
        return reply.code(409).send({
          error: blocked ? "XRPL_SUBMISSION_BLOCKED" : "XRPL_SUBMISSION_FAILED",
          message: intent.submission?.failureReason ?? intent.submission?.engineResult,
          intent
        });
      }
      return reply.send({ intent });
    } catch (error) {
      await notify(app, observability, {
        name: "transaction.submission.failed",
        transactionIntentId: request.params.id,
        status: "FAILED",
        message: error instanceof Error ? error.message : "XRPL transaction submission failed"
      });
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Params: { id: string } }>("/api/v1/transactions/:id/monitor", async (request, reply) => {
    try {
      const intent = await transactionIntentService.monitor(request.params.id);
      await notify(app, observability, {
        name: "transaction.monitoring",
        transactionIntentId: intent.id,
        status: intent.status,
        data: { monitoring: intent.monitoring }
      });
      return reply.send({
        transactionId: intent.id,
        status: intent.status,
        monitoring: intent.monitoring
      });
    } catch (error) {
      return reply.code(404).send({ error: "NOT_FOUND", message: (error as Error).message });
    }
  });

  app.post("/api/v1/sell/quote", async (request, reply) => {
    const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const session = sessionService.getActive(parsed.data.sessionId);
      const quote = await sellService.createQuote(session);
      return reply.code(201).send({ quote });
    } catch (error) {
      await notify(app, observability, {
        name: "sell.asset_discovery.failed",
        sessionId: parsed.data.sessionId,
        status: "FAILED",
        message: error instanceof Error ? error.message : "XRPL asset discovery failed"
      });
      return reply.code(503).send({
        error: "XRPL_ASSET_DISCOVERY_UNAVAILABLE",
        message: error instanceof Error ? error.message : "XRPL asset discovery is unavailable"
      });
    }
  });

  app.post("/api/v1/sell/intents", async (request, reply) => {
    const parsed = createSellIntentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const idempotencyKey = firstHeader(request.headers["idempotency-key"]);
      const sessionId = sellService.getQuote(parsed.data.quoteId).sessionId;
      const session = sessionService.getActive(sessionId);
      const intent = await sellService.createIntent({
        quoteId: parsed.data.quoteId,
        session,
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {})
      });
      await notify(app, observability, {
        name: "sell.intent.created",
        flowId: intent.id,
        sessionId: intent.sessionId,
        sellIntentId: intent.id,
        walletAddress: intent.walletAddress,
        network: intent.network,
        quoteId: intent.quoteId,
        status: intent.status,
        data: {
          transactionCount: intent.transactions.length,
          eligibleAssets: intent.transactions.map((transaction) => transaction.assetId).join(",")
        }
      });
      return reply.code(201).send({ intent });
    } catch (error) {
      await notify(app, observability, {
        name: "sell.intent.failed",
        quoteId: parsed.data.quoteId,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Sell intent creation failed"
      });
      return reply.code(400).send(badRequest(error));
    }
  });

  app.get<{ Params: { id: string } }>("/api/v1/sell/intents/:id/status", async (request, reply) => {
    try {
      const intent = sellService.getIntent(request.params.id);
      return reply.send({ intent });
    } catch (error) {
      return reply.code(404).send({ error: "NOT_FOUND", message: (error as Error).message });
    }
  });

  app.post("/api/v1/wallets/xaman/payloads/sign-in", async (_request, reply) => {
    if (!xamanPayloadService) {
      return reply.code(503).send({
        error: "XAMAN_NOT_CONFIGURED",
        message: "Xaman API key and secret are not configured on the backend."
      });
    }

    try {
      const payload = await xamanPayloadService.createSignInPayload();
      await notify(app, observability, {
        name: "wallet.xaman.sign_in_payload.created", flowId: payload.uuid, walletProvider: "xaman",
        network: config.XRPL_NETWORK, status: "AWAITING_USER_APPROVAL",
        data: { payloadUuid: payload.uuid, pushed: payload.pushed }
      });
      return reply.code(201).send({ payload });
    } catch (error) {
      await notify(app, observability, {
        name: "wallet.xaman.sign_in_payload.failed",
        flowId: _request.id,
        walletProvider: "xaman",
        network: config.XRPL_NETWORK,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Xaman payload creation failed"
      });
      return reply.code(502).send({
        error: "XAMAN_PAYLOAD_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Xaman payload creation failed"
      });
    }
  });

  app.post("/api/v1/wallets/xaman/payloads/sign-transaction", async (request, reply) => {
    if (!xamanPayloadService) {
      return reply.code(503).send({
        error: "XAMAN_NOT_CONFIGURED",
        message: "Xaman API key and secret are not configured on the backend."
      });
    }

    const parsed = xamanTransactionPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const transaction = parsed.data.transaction as XrplPaymentTransaction;
      const payload = await xamanPayloadService.createTransactionPayload(transaction);
      await notify(app, observability, {
        name: "wallet.xaman.transaction_payload.created", flowId: payload.uuid, walletProvider: "xaman",
        network: config.XRPL_NETWORK, status: "AWAITING_USER_APPROVAL",
        data: { payloadUuid: payload.uuid, transactionType: transaction.TransactionType, account: transaction.Account, destination: transaction.Destination }
      });
      return reply.code(201).send({ payload });
    } catch (error) {
      await notify(app, observability, {
        name: "wallet.xaman.transaction_payload.failed",
        flowId: _request.id,
        walletProvider: "xaman",
        network: config.XRPL_NETWORK,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Xaman transaction payload creation failed"
      });
      return reply.code(502).send({
        error: "XAMAN_PAYLOAD_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Xaman payload creation failed"
      });
    }
  });

  app.get<{ Params: { uuid: string } }>("/api/v1/wallets/xaman/payloads/:uuid", async (request, reply) => {
    if (!xamanPayloadService) {
      return reply.code(503).send({
        error: "XAMAN_NOT_CONFIGURED",
        message: "Xaman API key and secret are not configured on the backend."
      });
    }

    try {
      const payload = await xamanPayloadService.getPayloadStatus(request.params.uuid);
      if (payload.resolved || payload.cancelled || payload.expired) {
        await notify(app, observability, {
          name: "wallet.xaman.payload.resolved", flowId: payload.uuid, walletProvider: "xaman",
          network: config.XRPL_NETWORK,
          status: payload.signed ? "SIGNED" : payload.cancelled ? "CANCELLED" : payload.expired ? "EXPIRED" : "RESOLVED",
          ...(payload.signerAddress ? { walletAddress: payload.signerAddress } : {}),
          ...(payload.txHash ? { xrplHash: payload.txHash } : {}),
          data: { payloadUuid: payload.uuid, opened: payload.opened }
        });
      }
      return reply.send({ payload });
    } catch (error) {
      await notify(app, observability, {
        name: "wallet.xaman.payload_status.failed",
        flowId: _request.id,
        walletProvider: "xaman",
        network: config.XRPL_NETWORK,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Xaman payload status lookup failed",
        data: { payloadUuid: request.params.uuid }
      });
      return reply.code(502).send({
        error: "XAMAN_PAYLOAD_STATUS_FAILED",
        message: error instanceof Error ? error.message : "Xaman payload status lookup failed"
      });
    }
  });
}

