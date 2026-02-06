import { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config.js";

const smsSchema = z.object({
  to: z.string().min(6),
  body: z.string().min(1)
});

const whatsappSchema = z.object({
  to: z.string().min(6),
  body: z.string().optional(),
  contentSid: z.string().optional(),
  contentVariables: z.record(z.string(), z.string()).optional()
});

const toWhatsApp = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

async function twilioSend(form: Record<string, string>) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error("missing_twilio_credentials");
  }

  const auth = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const body = new URLSearchParams(form).toString();

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? "twilio_error");
  }

  return data;
}

export function registerMessages(app: FastifyInstance) {
  app.post("/send/sms", async (req, reply) => {
    if (!env.TWILIO_SMS_NUMBER) {
      reply.code(500);
      return { ok: false, error: "missing_twilio_sms_number" };
    }

    const parsed = smsSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: "invalid_payload" };
    }

    try {
      const data = await twilioSend({
        From: env.TWILIO_SMS_NUMBER,
        To: parsed.data.to,
        Body: parsed.data.body
      });

      return { ok: true, sid: data.sid, status: data.status };
    } catch (err) {
      reply.code(400);
      return { ok: false, error: err instanceof Error ? err.message : "twilio_error" };
    }
  });

  app.post("/send/whatsapp", async (req, reply) => {
    if (!env.TWILIO_WHATSAPP_NUMBER) {
      reply.code(500);
      return { ok: false, error: "missing_twilio_whatsapp_number" };
    }

    const parsed = whatsappSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: "invalid_payload" };
    }

    const { to, body, contentSid, contentVariables } = parsed.data;
    if (!body && !contentSid) {
      reply.code(400);
      return { ok: false, error: "missing_body_or_template" };
    }

    try {
      const payload: Record<string, string> = {
        From: env.TWILIO_WHATSAPP_NUMBER,
        To: toWhatsApp(to)
      };

      if (contentSid) {
        payload.ContentSid = contentSid;
        if (contentVariables) {
          payload.ContentVariables = JSON.stringify(contentVariables);
        }
      } else if (body) {
        payload.Body = body;
      }

      const data = await twilioSend(payload);
      return { ok: true, sid: data.sid, status: data.status };
    } catch (err) {
      reply.code(400);
      return { ok: false, error: err instanceof Error ? err.message : "twilio_error" };
    }
  });
}
