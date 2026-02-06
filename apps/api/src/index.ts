import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { env } from "./config.js";
import { registerHealth } from "./routes/health.js";
import { registerMessages } from "./routes/messages.js";
import { registerPayments } from "./routes/payments.js";
import { registerWebhooks } from "./routes/webhooks.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(formbody);

registerHealth(app);
registerMessages(app);
registerPayments(app);
registerWebhooks(app);

const port = env.PORT;
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
