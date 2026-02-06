"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "./firebase";
import type { PlanId } from "./plans";

type SeedBot = {
  id: string;
  name: string;
  area: string;
  status: string;
  activity: string;
  health: string;
  tone: string;
  enabled: boolean;
};

const BOT_CATALOG: SeedBot[] = [
  {
    id: "suporte-faq",
    name: "FAQ inteligente",
    area: "Suporte",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "suporte-triagem",
    name: "Triagem de tickets",
    area: "Suporte",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "vendas-leads",
    name: "Qualificacao de leads",
    area: "Vendas",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "vendas-followup",
    name: "Follow-up de propostas",
    area: "Vendas",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "cobranca-pix",
    name: "Cobranca Pix",
    area: "Cobranca",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "cobranca-aviso",
    name: "Aviso de fatura",
    area: "Cobranca",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "agendamento-consultas",
    name: "Agendamento de consultas",
    area: "Agendamento",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "posvenda-nps",
    name: "Pesquisa NPS",
    area: "Pos-venda",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  },
  {
    id: "financeiro-confirmacao",
    name: "Confirmacao de pagamento",
    area: "Financeiro",
    status: "Disponivel",
    activity: "Pronto para ativar",
    health: "Pronto",
    tone: "ok",
    enabled: false
  }
];

const DEFAULT_SUMMARY = {
  conversationsToday: 0,
  avgResponse: "0s",
  sla: "0%",
  dailyCost: "R$ 0,00"
};

type SeedUserArgs = {
  uid: string;
  email?: string | null;
  plan?: PlanId;
  forceBots?: boolean;
};

export async function seedUserData({ uid, email, plan, forceBots }: SeedUserArgs) {
  if (!isFirebaseConfigured) {
    return;
  }

  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  const nextBillingAt = Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: email ?? null,
      plan: plan ?? "starter",
      createdAt: serverTimestamp(),
      nextBillingAt,
      selectedBots: []
    });
  } else {
    const data = userSnap.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (!data.email && email) {
      patch.email = email;
    }
    if (!data.plan && plan) {
      patch.plan = plan;
    }
    if (!data.createdAt) {
      patch.createdAt = serverTimestamp();
    }
    if (!data.nextBillingAt) {
      patch.nextBillingAt = nextBillingAt;
    }
    if (!data.selectedBots) {
      patch.selectedBots = [];
    }
    if (Object.keys(patch).length > 0) {
      await setDoc(userRef, patch, { merge: true });
    }
  }

  const summaryRef = doc(db, "users", uid, "dashboard", "summary");
  const summarySnap = await getDoc(summaryRef);
  if (!summarySnap.exists()) {
    await setDoc(summaryRef, DEFAULT_SUMMARY);
  }

  const botsRef = collection(db, "users", uid, "bots");
  const botsSnap = await getDocs(query(botsRef, limit(1)));
  if (botsSnap.empty || forceBots) {
    const batch = writeBatch(db);
    BOT_CATALOG.forEach((bot) => {
      batch.set(doc(botsRef, bot.id), {
        name: bot.name,
        area: bot.area,
        status: bot.status,
        activity: bot.activity,
        health: bot.health,
        tone: bot.tone,
        enabled: bot.enabled
      }, { merge: true });
    });
    await batch.commit();
  }
}
