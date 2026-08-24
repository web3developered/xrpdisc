import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { UnavailableAssetDiscovery } from "../sell/discovery.js";
import { InMemorySellRepository } from "../sell/repository.js";
import { SellService } from "../sell/service.js";
import { InMemorySessionRepository } from "../sessions/repository.js";
import { SessionService } from "../sessions/service.js";
import { InMemoryTransactionIntentRepository } from "../transactions/repository.js";
import { TransactionIntentService } from "../transactions/service.js";
import { XamanPayloadService } from "../wallets/xaman.js";
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

export async function registerV1Routes(app: FastifyInstance, config: AppConfig) {
  const sessionService = new SessionService(config, new InMemorySessionRepository());
  const transactionIntentService = new TransactionIntentService(
    config,
    new InMemoryTransactionIntentRepository()
  );
  const sellService = new SellService(
    config,
    new InMemorySellRepository(),
    new UnavailableAssetDiscovery()
  );
  const xamanPayloadService = config.XAMAN_API_KEY && config.XAMAN_API_SECRET
    ? new XamanPayloadService(config)
    : null;

  app.post("/api/v1/sessions", async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error));
    }

    try {
      const session = sessionService.create(parsed.data);
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
      const intent = transactionIntentService.createPaymentIntent({
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
      return reply.send({ intent });
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Params: { id: string } }>("/api/v1/transactions/:id/submit", async (request, reply) => {
    try {
      const intent = transactionIntentService.submit(request.params.id);
      return reply.code(409).send({
        error: "XRPL_SUBMISSION_BLOCKED",
        message: intent.submission?.failureReason,
        intent
      });
    } catch (error) {
      return reply.code(400).send(badRequest(error));
    }
  });

  app.post<{ Params: { id: string } }>("/api/v1/transactions/:id/monitor", async (request, reply) => {
    try {
      const intent = transactionIntentService.monitor(request.params.id);
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
      const intent = sellService.createIntent({
        quoteId: parsed.data.quoteId,
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {})
      });
      return reply.code(201).send({ intent });
    } catch (error) {
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
      return reply.code(201).send({ payload });
    } catch (error) {
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
      const payload = await xamanPayloadService.createTransactionPayload(parsed.data.transaction as XrplPaymentTransaction);
      return reply.code(201).send({ payload });
    } catch (error) {
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
      return reply.send({ payload });
    } catch (error) {
      return reply.code(502).send({
        error: "XAMAN_PAYLOAD_STATUS_FAILED",
        message: error instanceof Error ? error.message : "Xaman payload status lookup failed"
      });
    }
  });
}

