import { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import { FieldValue, getAdminDb } from "../firebaseAdmin.js";

const twilioSchema = z.object({
  From: z.string(),
  To: z.string(),
  Body: z.string().optional().default("")
});

const DEFAULT_WELCOME = "Ola! Como posso ajudar hoje?";
const DEFAULT_FALLBACK = "Nao entendi. Pode repetir de outra forma?";
const DEFAULT_HANDOFF = "Vou te encaminhar para um especialista.";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const normalizeNumber = (value: string) => value.replace(/^whatsapp:/, "");

const isWhatsapp = (value: string) => value.startsWith("whatsapp:");

const getChannel = (from: string, to: string) =>
  isWhatsapp(from) || isWhatsapp(to) ? "WhatsApp" : "SMS";

const splitKeywords = (value?: string) => {
  if (!value) {
    return [];
  }
  return value
    .split(/[,\n]/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const makeConversationId = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const makeTwiml = (message: string) =>
  `<Response><Message>${escapeXml(message)}</Message></Response>`;

export function registerWebhooks(app: FastifyInstance) {
  app.post("/webhooks/twilio", async (req, reply) => {
    const parsed = twilioSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: "invalid_payload" };
    }

    const { From, To, Body } = parsed.data;
    app.log.info({ from: From, to: To, body: Body }, "twilio_inbound");

    const db = getAdminDb();
    if (!db) {
      reply.header("Content-Type", "text/xml");
      return makeTwiml("Servico nao configurado. Configure o Firebase Admin.");
    }

    const channel = getChannel(From, To);
    const normalizedTo = normalizeNumber(To);
    const normalizedFrom = normalizeNumber(From);

    let tenantId = env.DEFAULT_TENANT_UID ?? "";
    if (!tenantId) {
      const field = channel === "WhatsApp" ? "whatsappNumber" : "smsNumber";
      const usersRef = db.collection("users");
      let snap = await usersRef.where(field, "==", To).limit(1).get();
      if (snap.empty) {
        snap = await usersRef.where(field, "==", normalizedTo).limit(1).get();
      }
      if (!snap.empty) {
        tenantId = snap.docs[0].id;
      }
    }

    if (!tenantId) {
      reply.header("Content-Type", "text/xml");
      return makeTwiml("Conta nao configurada para este numero.");
    }

    const userRef = db.collection("users").doc(tenantId);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, any>) : {};
    const selectedBots: Array<{ name?: string }> = Array.isArray(userData?.selectedBots)
      ? userData.selectedBots
      : [];
    const selectedNames = new Set(
      selectedBots
        .map((item) => item?.name)
        .filter((value): value is string => Boolean(value))
    );

    const botsSnap = await userRef.collection("bots").get();
    const bots = botsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Array<{
      id: string;
      name?: string;
      area?: string;
      enabled?: boolean;
      keywords?: string;
      welcomeMessage?: string;
      fallbackMessage?: string;
      handoffMessage?: string;
    }>;

    let candidates = bots;
    if (selectedNames.size > 0) {
      const filtered = bots.filter((bot) => bot.name && selectedNames.has(bot.name));
      if (filtered.length) {
        candidates = filtered;
      }
    }

    const enabledBots = candidates.filter((bot) => bot.enabled === true);
    const activeBot = enabledBots[0] ?? candidates[0] ?? null;

    if (!activeBot) {
      reply.header("Content-Type", "text/xml");
      return makeTwiml("Nenhum bot configurado. Configure no painel.");
    }

    if (activeBot.enabled !== true) {
      reply.header("Content-Type", "text/xml");
      return makeTwiml("Bot pausado. Ative no painel para responder.");
    }

    const text = (Body ?? "").trim();
    const lower = text.toLowerCase();
    const keywords = splitKeywords(activeBot.keywords);
    const hasKeyword = keywords.some((keyword) => lower.includes(keyword));
    const wantsHuman = /humano|atendente|pessoa|suporte/i.test(lower);

    const conversationId = makeConversationId(`${channel}:${normalizedFrom}`);
    const convoRef = userRef.collection("conversations").doc(conversationId);
    const convoSnap = await convoRef.get();
    const isNewConversation = !convoSnap.exists;

    let responseText = activeBot.welcomeMessage ?? DEFAULT_WELCOME;
    if (!isNewConversation) {
      if (wantsHuman) {
        responseText = activeBot.handoffMessage ?? DEFAULT_HANDOFF;
      } else if (hasKeyword) {
        responseText = activeBot.welcomeMessage ?? DEFAULT_WELCOME;
      } else {
        responseText = activeBot.fallbackMessage ?? DEFAULT_FALLBACK;
      }
    }

    const now = new Date();
    const timeLabel = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    await convoRef.set(
      {
        area: activeBot.area ?? "Geral",
        period: `Hoje ${timeLabel}`,
        duration: "-",
        status: "Em andamento",
        channel,
        contact: normalizedFrom,
        lastMessage: text,
        lastResponse: responseText,
        botId: activeBot.id,
        botName: activeBot.name ?? activeBot.id,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: isNewConversation ? FieldValue.serverTimestamp() : convoSnap.data()?.createdAt
      },
      { merge: true }
    );

    await userRef.collection("dashboard").doc("summary").set(
      {
        conversationsToday: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    reply.header("Content-Type", "text/xml");
    return makeTwiml(responseText);
  });

  app.post("/webhooks/brevo", async (req) => {
    app.log.info({ payload: req.body }, "brevo_event");
    return { ok: true };
  });

  app.post("/webhooks/mercadopago", async (req) => {
    app.log.info({ payload: req.body, headers: req.headers }, "mp_event");
    return { ok: true };
  });
}
