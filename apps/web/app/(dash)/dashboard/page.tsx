"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "../../../lib/firebase";
import { planCatalog, type PlanId } from "../../../lib/plans";
import { createPixPayment, type PixPaymentResponse } from "../../../lib/payments";
import { useUserProfile } from "../../../lib/useUserProfile";

type DashboardSummary = {
  conversationsToday?: string | number;
  avgResponse?: string;
  sla?: string | number;
  dailyCost?: string;
  deltaConversations?: string;
  deltaConversationsTone?: string;
  deltaAvg?: string;
  deltaAvgTone?: string;
  deltaSla?: string;
  deltaSlaTone?: string;
  deltaCost?: string;
  deltaCostTone?: string;
};

type ConversationRow = {
  id: string;
  area?: string;
  period?: string;
  duration?: string;
  status?: string;
};

type BotStatus = {
  id: string;
  name: string;
  area?: string;
  health?: string;
  tone?: string;
};

const parseDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000);
    }
  }
  return null;
};

export default function Dashboard() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [notifSeen, setNotifSeen] = useState(true);
  const [paymentData, setPaymentData] = useState<PixPaymentResponse | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { profile, selectedBots, loading, userId } = useUserProfile();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentRows, setRecentRows] = useState<ConversationRow[]>([]);
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [dashboardError, setDashboardError] = useState("");
  const planId = (profile?.plan && profile.plan in planCatalog
    ? profile.plan
    : "starter") as PlanId;
  const plan = useMemo(() => planCatalog[planId], [planId]);
  const loadingPlan = loading;
  const paymentDueAt = useMemo(
    () => parseDate(profile?.paymentDueAt ?? profile?.nextBillingAt),
    [profile?.nextBillingAt, profile?.paymentDueAt]
  );
  const daysUntilDue = paymentDueAt
    ? Math.ceil((paymentDueAt.getTime() - Date.now()) / 86400000)
    : null;
  const shouldShowPayment =
    daysUntilDue !== null && daysUntilDue <= 5;
  const dueKey = paymentDueAt ? String(paymentDueAt.getTime()) : null;
  const dueLabel =
    daysUntilDue === null
      ? null
      : daysUntilDue <= 0
        ? "Vencimento hoje"
        : `Vence em ${daysUntilDue} dias`;

  useEffect(() => {
    if (!userId) {
      setAvatarUrl(null);
      return;
    }
    try {
      const saved = window.localStorage.getItem(`sb_avatar_${userId}`);
      setAvatarUrl(saved ?? null);
    } catch {
      // ignore storage errors
    }
  }, [userId]);

  useEffect(() => {
    if (!isFirebaseConfigured || !userId) {
      setSummary(null);
      setRecentRows([]);
      setBotStatuses([]);
      return;
    }

    const db = getFirebaseDb();
    const summaryRef = doc(db, "users", userId, "dashboard", "summary");
    const recentQuery = query(
      collection(db, "users", userId, "conversations"),
      orderBy("updatedAt", "desc"),
      limit(4)
    );
    const botsQuery = query(
      collection(db, "users", userId, "bots"),
      orderBy("area", "asc")
    );

    const unsubSummary = onSnapshot(
      summaryRef,
      (snap) => {
        setSummary(snap.exists() ? (snap.data() as DashboardSummary) : null);
      },
      () => setDashboardError("Nao foi possivel carregar o resumo.")
    );

    const unsubRecent = onSnapshot(
      recentQuery,
      (snap) => {
        const rows = snap.docs.map((docSnap) => {
          const data = docSnap.data() as ConversationRow;
          return {
            id: docSnap.id,
            area: data.area,
            period: data.period,
            duration: data.duration,
            status: data.status
          };
        });
        setRecentRows(rows);
      },
      () => setDashboardError("Nao foi possivel carregar as conversas.")
    );

    const unsubBots = onSnapshot(
      botsQuery,
      (snap) => {
        const items = snap.docs.map((docSnap) => {
          const data = docSnap.data() as BotStatus;
          return {
            id: docSnap.id,
            name: data.name ?? docSnap.id,
            area: data.area,
            health: data.health ?? "—",
            tone: typeof data.tone === "string" ? data.tone : ""
          } satisfies BotStatus;
        });
        setBotStatuses(items);
      },
      () => setDashboardError("Nao foi possivel carregar o status dos bots.")
    );

    return () => {
      unsubSummary();
      unsubRecent();
      unsubBots();
    };
  }, [userId]);

  useEffect(() => {
    if (!notifOpen) {
      setPaymentOpen(false);
      setCopyDone(false);
      setPaymentError("");
    }
  }, [notifOpen]);

  useEffect(() => {
    setPaymentData(null);
    setPaymentOpen(false);
    setPaymentError("");
  }, [planId]);

  useEffect(() => {
    if (!dueKey) {
      setNotifSeen(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`sb_notif_seen_${dueKey}`);
      setNotifSeen(stored === "1");
    } catch {
      setNotifSeen(false);
    }
  }, [dueKey]);

  useEffect(() => {
    if (notifOpen && shouldShowPayment) {
      setNotifSeen(true);
      if (dueKey) {
        try {
          window.localStorage.setItem(`sb_notif_seen_${dueKey}`, "1");
        } catch {
          // ignore storage errors
        }
      }
    }
  }, [notifOpen, shouldShowPayment, dueKey]);

  useEffect(() => {
    if (!shouldShowPayment) {
      setPaymentOpen(false);
    }
  }, [shouldShowPayment]);

  const hasUnread = shouldShowPayment && !notifSeen;

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        return;
      }
      setAvatarUrl(result);
      if (userId) {
        try {
          window.localStorage.setItem(`sb_avatar_${userId}`, result);
        } catch {
          // ignore storage errors
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPix = async () => {
    if (!paymentData?.qr_code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(paymentData.qr_code);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  };

  const handleOpenPayment = async () => {
    if (!profile?.email) {
      setPaymentError("Email do usuario nao encontrado.");
      return;
    }
    if (paymentData || paymentLoading) {
      setPaymentOpen((open) => !open);
      return;
    }
    try {
      setPaymentLoading(true);
      setPaymentError("");
      const data = await createPixPayment(planId, profile.email);
      setPaymentData(data);
      setPaymentOpen(true);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Nao foi possivel gerar o pagamento.");
      setPaymentOpen(false);
    } finally {
      setPaymentLoading(false);
    }
  };


  const stats = useMemo(() => [
    {
      label: "Conversas hoje",
      value: summary?.conversationsToday ?? "—",
      delta: summary?.deltaConversations ?? "",
      tone: summary?.deltaConversationsTone ?? "neutral"
    },
    {
      label: "Tempo medio",
      value: summary?.avgResponse ?? "—",
      delta: summary?.deltaAvg ?? "",
      tone: summary?.deltaAvgTone ?? "neutral"
    },
    {
      label: "SLA",
      value: summary?.sla ?? "—",
      delta: summary?.deltaSla ?? "",
      tone: summary?.deltaSlaTone ?? "neutral"
    },
    {
      label: "Custo diario",
      value: summary?.dailyCost ?? "—",
      delta: summary?.deltaCost ?? "",
      tone: summary?.deltaCostTone ?? "neutral"
    }
  ], [summary]);

  const visibleSelectedBots = useMemo(
    () => selectedBots.slice(0, plan.botLimit),
    [selectedBots, plan.botLimit]
  );
  const selectedBotCards = useMemo(() => {
    if (!visibleSelectedBots.length) {
      return [];
    }
    const selectedNames = new Set(visibleSelectedBots.map((bot) => bot.name));
    const matched = botStatuses.filter((bot) => selectedNames.has(bot.name));
    return matched.map((bot) => ({
      label: bot.name,
      area: bot.area,
      value: bot.health ?? "—",
      tone: bot.tone ?? "ok"
    }));
  }, [botStatuses, visibleSelectedBots]);

  return (
    <main className="dashboard-outer">
      <div className="dashboard-shell">
        <header className="dash-nav">
          <div className="dash-nav-inner">
            <div className="dash-brand">SistemaBote</div>
            <nav className="dash-links">
              <a className="active" href="/dashboard">Dashboard</a>
              <a href="/bots">Bots</a>
            </nav>
            <div className="dash-nav-actions">
              <div className="dash-icons">
                <div className="notif-wrap">
                  <button
                    className={`icon-btn ${hasUnread ? "has-unread" : ""}`}
                    aria-label="Notificacoes"
                    aria-expanded={notifOpen}
                    onClick={() => setNotifOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 9a6 6 0 1 1 12 0v5l2 2H4l2-2V9z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.5 18a2.5 2.5 0 0 0 5 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    {hasUnread ? <span className="notif-dot" /> : null}
                  </button>
                  {notifOpen ? (
                    <div
                      className={`notif-panel ${hasUnread ? "unread" : ""}`}
                      role="dialog"
                      aria-label="Notificacoes"
                    >
                      <div className="notif-head">Notificacoes</div>
                      {shouldShowPayment ? (
                        <>
                          <div className="notif-item">
                            <div>
                              <strong>Pagamento pendente</strong>
                              <span>
                                Plano {plan.label} — {plan.price}
                                {plan.billing}
                              </span>
                              {dueLabel ? <em className="notif-muted">{dueLabel}</em> : null}
                            </div>
                            <button
                              className="btn small"
                              type="button"
                              onClick={handleOpenPayment}
                            >
                              {paymentLoading ? "Gerando..." : paymentOpen ? "Ocultar" : "Ver pagamento"}
                            </button>
                          </div>
                          {paymentError ? (
                            <div className="error-banner">{paymentError}</div>
                          ) : null}
                          {paymentOpen && paymentData ? (
                            <div className="payment-box">
                              <div className="payment-qr">
                                {paymentData.qr_code_base64 ? (
                                  <img
                                    className="qr-image"
                                    src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                                    alt="QR Code Pix"
                                  />
                                ) : (
                                  <div className="qr-sim" aria-hidden="true" />
                                )}
                                <div>
                                  <div className="payment-label">QR Code Pix</div>
                                  <div className="payment-muted">Escaneie para pagar</div>
                                </div>
                              </div>
                              <div className="payment-code">
                                <div className="payment-label">Pix copia e cola</div>
                                <code>{paymentData.qr_code ?? "Codigo nao disponivel."}</code>
                                <div className="payment-actions">
                                  <button className="btn small" type="button" onClick={handleCopyPix}>
                                    {copyDone ? "Copiado" : "Copiar codigo"}
                                  </button>
                                  <span className="payment-muted">
                                    Link: {paymentData.ticket_url ?? "Indisponivel"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="notif-empty">Sem notificacoes no momento.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <a className="icon-btn" aria-label="Sair" href="/login">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M15 7l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 12H9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </a>
                <div className="avatar-wrap">
                  <input
                    ref={avatarInputRef}
                    className="avatar-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                  <button
                    className="dash-avatar-btn"
                    type="button"
                    aria-label="Selecionar foto"
                    onClick={handleAvatarPick}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Foto do perfil" />
                    ) : (
                      "N"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="dashboard-content">
          <header className="dash-top">
            <div>
              <span className="dash-eyebrow">Monitoramento</span>
              <h1>My Dashboard</h1>
            </div>
          </header>
          {dashboardError ? <div className="error-banner">{dashboardError}</div> : null}

          <section className="dash-stats">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.delta ? <em className={stat.tone}>{stat.delta}</em> : <em className="neutral">—</em>}
              </div>
            ))}
          </section>

          <section className="dash-main">
            <div className="dash-table-card">
              <div className="table-headline">
                <h2>Conversas recentes</h2>
                <div className="table-controls">
                  <span>Ultimos 7 dias</span>
                  <button className="ghost-pill">2026</button>
                </div>
              </div>
              <div className="table-rows">
                <div className="table-row header">
                  <span>Area</span>
                  <span>Periodo</span>
                  <span>Tempo</span>
                  <span>Status</span>
                </div>
                {recentRows.length === 0 ? (
                  <div className="empty-state">Nenhuma conversa recente.</div>
                ) : (
                  recentRows.map((row) => (
                    <div className="table-row" key={row.id}>
                      <span className="row-area">{row.area ?? "—"}</span>
                      <span>{row.period ?? "—"}</span>
                      <span>{row.duration ?? "—"}</span>
                      <span className="status-pill">{row.status ?? "—"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dash-side-card">
              <div className="side-top">
                <h2>Status dos bots</h2>
                <span>Hoje</span>
              </div>
              <div className="plan-summary plan-summary-card">
                <span>Plano atual</span>
                <strong>{plan.label}</strong>
                <small>{plan.price}{plan.billing}</small>
                <em>{plan.messageLimit}</em>
                <small>{plan.botLimit} bots ativos</small>
                {loadingPlan ? <span className="plan-loading">Carregando...</span> : null}
              </div>
              <div className="side-list">
                {selectedBotCards.length ? (
                  selectedBotCards.map((item) => (
                    <div className="side-row" key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.area}</span>
                      </div>
                      <span className={`status-pill ${item.tone}`}>{item.value}</span>
                    </div>
                  ))
                ) : (
                  <div className="side-row">
                    <div>
                      <strong>Nenhum bot selecionado</strong>
                      <span>Escolha um bot na aba Bots</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="side-illustration" />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
