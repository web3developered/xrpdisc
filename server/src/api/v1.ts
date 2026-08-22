import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { InMemorySessionRepository } from "../sessions/repository.js";
import { SessionService } from "../sessions/service.js";
import { InMemoryTransactionIntentRepository } from "../transactions/repository.js";
import { TransactionIntentService } from "../transactions/service.js";

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

function badRequest(error: unknown) {
  return {
    error: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "Request validation failed"
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const notImplemented = (feature: string) => ({
  statusCode: 501,
  error: "NOT_IMPLEMENTED",
  message: `${feature} is NOT IMPLEMENTED in the current phase.`
});

export async function registerV1Routes(app: FastifyInstance, config: AppConfig) {
  const sessionService = new SessionService(config, new InMemorySessionRepository());
  const transactionIntentService = new TransactionIntentService(
    config,
    new InMemoryTransactionIntentRepository()
  );

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
        updatedAt: intent.updatedAt
      });
    } catch (error) {
      return reply.code(404).send({ error: "NOT_FOUND", message: (error as Error).message });
    }
  });

  app.post("/api/v1/sell/quote", async (_request, reply) =>
    reply.code(501).send(notImplemented("Sell quote generation"))
  );

  app.post("/api/v1/sell/intents", async (_request, reply) =>
    reply.code(501).send(notImplemented("Sell intent creation"))
  );
}

