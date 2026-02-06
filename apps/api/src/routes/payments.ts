import { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { env } from "../config.js";

const planPrices = {
  starter: 49,
  pro: 149,
  business: 399
};

const requestSchema = z.object({
  planId: z.enum(["starter", "pro", "business"]),
  email: z.string().email()
});

export function registerPayments(app: FastifyInstance) {
  app.post("/payments/pix", async (req, reply) => {
    if (!env.MP_ACCESS_TOKEN) {
      reply.code(500);
      return { ok: false, error: "missing_mp_access_token" };
    }

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: "invalid_payload" };
    }

    const { planId, email } = parsed.data;
    const amount = planPrices[planId];
    const idempotencyKey = crypto.randomUUID();
    const notificationUrl =
      env.APP_BASE_URL && env.APP_BASE_URL.startsWith("https://")
        ? `${env.APP_BASE_URL}/webhooks/mercadopago`
        : undefined;

    const payload = {
      transaction_amount: amount,
      description: `Plano ${planId}`,
      payment_method_id: "pix",
      payer: { email },
      notification_url: notificationUrl,
      external_reference: `plan:${planId}`
    };

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      app.log.error({ status: response.status, data }, "mp_payment_error");
      reply.code(400);
      return { ok: false, error: "mp_payment_failed", details: data };
    }

    const tx = data.point_of_interaction?.transaction_data ?? {};

    return {
      ok: true,
      id: data.id,
      status: data.status,
      amount: data.transaction_amount,
      ticket_url: tx.ticket_url ?? data.ticket_url ?? null,
      qr_code: tx.qr_code ?? null,
      qr_code_base64: tx.qr_code_base64 ?? null,
      date_of_expiration: data.date_of_expiration ?? null
    };
  });
}
