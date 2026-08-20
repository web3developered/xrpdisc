import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Client, isValidClassicAddress, xrpToDrops } from "xrpl";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const origin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const network = process.env.XRPL_NETWORK ?? "testnet";
const wsUrl = process.env.XRPL_WS_URL ?? "wss://s.altnet.rippletest.net:51233";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: origin === "*" ? true : origin }));
app.use(express.json({ limit: "100kb" }));
app.use(morgan("combined"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "xrpl-defi", network, time: new Date().toISOString() });
});

const transactionSchema = z.object({
  account: z.string().refine(isValidClassicAddress, "Invalid XRPL classic address"),
  destination: z.string().refine(isValidClassicAddress, "Invalid XRPL destination"),
  amountXrp: z.string().regex(/^\\d+(\\.\\d{1,6})?$/, "Invalid XRP amount")
});

app.post("/api/transactions/payment", async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid transaction request", details: parsed.error.flatten() });

  const { account, destination, amountXrp } = parsed.data;
  const drops = xrpToDrops(amountXrp);
  const client = new Client(wsUrl);

  try {
    await client.connect();
    const prepared = await client.autofill({
      TransactionType: "Payment",
      Account: account,
      Destination: destination,
      Amount: drops
    });
    res.json({
      network,
      transaction: prepared,
      warning: "Unsigned transaction only. The user must review and sign it in their wallet."
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "Unable to prepare XRPL transaction" });
  } finally {
    await client.disconnect().catch(() => {});
  }
});

app.post("/api/transactions/submit", async (req, res) => {
  const schema = z.object({ txBlob: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "txBlob is required" });

  const client = new Client(wsUrl);
  try {
    await client.connect();
    const result = await client.submitAndWait(parsed.data.txBlob);
    res.json({
      engineResult: result.result.engine_result,
      hash: result.result.hash,
      validated: result.result.validated,
      ledgerIndex: result.result.ledger_index
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "XRPL submission failed" });
  } finally {
    await client.disconnect().catch(() => {});
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientDist));
app.get("*splat", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

app.listen(port, () => console.log(`XRPL DeFi server listening on ${port}`));
