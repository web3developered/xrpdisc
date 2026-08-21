import type { FastifyInstance } from "fastify";

const notImplemented = (feature: string) => ({
  statusCode: 501,
  error: "NOT_IMPLEMENTED",
  message: `${feature} is NOT IMPLEMENTED in Phase 1.`
});

export async function registerV1Routes(app: FastifyInstance) {
  app.post("/api/v1/sessions", async (_request, reply) =>
    reply.code(501).send(notImplemented("Wallet-backed session creation"))
  );

  app.post("/api/v1/transactions/intents", async (_request, reply) =>
    reply.code(501).send(notImplemented("Transaction intent creation"))
  );

  app.get("/api/v1/transactions/:id/status", async (_request, reply) =>
    reply.code(501).send(notImplemented("Transaction status monitoring"))
  );

  app.post("/api/v1/sell/quote", async (_request, reply) =>
    reply.code(501).send(notImplemented("Sell quote generation"))
  );

  app.post("/api/v1/sell/intents", async (_request, reply) =>
    reply.code(501).send(notImplemented("Sell intent creation"))
  );
}

