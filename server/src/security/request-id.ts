import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export async function registerRequestIdHook(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const requestId = Array.isArray(incoming) ? incoming[0] : incoming;
    const safeRequestId = requestId && requestId.length <= 128 ? requestId : randomUUID();
    request.id = safeRequestId;
    reply.header("x-request-id", safeRequestId);
  });
}

