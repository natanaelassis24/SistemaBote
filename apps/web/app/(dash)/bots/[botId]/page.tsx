"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "../../../../lib/firebase";
import { planCatalog, type PlanId } from "../../../../lib/plans";
import { createPixPayment, type PixPaymentResponse } from "../../../../lib/payments";
import { useUserProfile } from "../../../../lib/useUserProfile";

const DAYS = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sab" },
  { id: "dom", label: "Dom" }
];

type BotDoc = {
  name?: string;
  area?: string;
  status?: string;
  activity?: string;
  channels?: string[];
  displayName?: string;
  description?: string;
  objective?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
  handoffMessage?: string;
  keywords?: string;
  activeStart?: string;
  activeEnd?: string;
  activeDays?: string[];
  enabled?: boolean;
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

export default function BotConfigPage() {
  const params = useParams();
  const router = useRouter();
  const botIdParam = params?.botId;
  const botId = Array.isArray(botIdParam) ? botIdParam[0] : botIdParam;
  const [bot, setBot] = useState<BotDoc | null>(null);
  const [botError, setBotError] = useState("");
  const [loadingBot, setLoadingBot] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [numbersDirty, setNumbersDirty] = useState(false);
  const [numbersSaving, setNumbersSaving] = useState(false);
  const [numbersError, setNumbersError] = useState("");
  const [numbersSaved, setNumbersSaved] = useState(false);
  const [copyUidDone, setCopyUidDone] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const [keywords, setKeywords] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [activeStart, setActiveStart] = useState("08:00");
  const [activeEnd, setActiveEnd] = useState("18:00");
  const [activeDays, setActiveDays] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [smsNumber, setSmsNumber] = useState("");

  const [notifOpen, setNotifOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [notifSeen, setNotifSeen] = useState(true);
  const [paymentData, setPaymentData] = useState<PixPaymentResponse | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { profile, loading, userId } = useUserProfile();
  const planId = (profile?.plan && profile.plan in planCatalog
    ? profile.plan
    : "starter") as PlanId;
  const plan = useMemo(() => planCatalog[planId], [planId]);
  const configLocked = enabled;
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
    if (!profile || numbersDirty) {
      return;
    }
    setWhatsappNumber(profile.whatsappNumber ?? "");
    setSmsNumber(profile.smsNumber ?? "");
  }, [profile?.whatsappNumber, profile?.smsNumber, numbersDirty, profile]);

  useEffect(() => {
    if (!botId || !isFirebaseConfigured || !userId) {
      setBot(null);
      setBotError("Bot nao encontrado.");
      setLoadingBot(false);
      return;
    }

    const db = getFirebaseDb();
    const botRef = doc(db, "users", userId, "bots", botId);
    const unsubscribe = onSnapshot(
      botRef,
      (snap) => {
        if (!snap.exists()) {
          setBot(null);
          setBotError("Bot nao encontrado.");
          setLoadingBot(false);
          return;
        }
        const data = snap.data() as BotDoc;
        setBot(data);
        setBotError("");
        setLoadingBot(false);
        if (!dirty) {
          setEnabled(data.enabled ?? false);
          setDisplayName(data.displayName ?? data.name ?? "");
          setDescription(data.description ?? "");
          setObjective(data.objective ?? "");
          setWelcomeMessage(
            data.welcomeMessage ??
              "Ola! Como posso ajudar hoje?"
          );
          setFallbackMessage(
            data.fallbackMessage ??
              "Nao entendi. Pode repetir de outra forma?"
          );
          setHandoffMessage(
            data.handoffMessage ??
              "Vou te encaminhar para um especialista."
          );
          setKeywords(data.keywords ?? "");
          setActiveStart(data.activeStart ?? "08:00");
          setActiveEnd(data.activeEnd ?? "18:00");
          setActiveDays(
            Array.isArray(data.activeDays) && data.activeDays.length
              ? data.activeDays
              : ["seg", "ter", "qua", "qui", "sex"]
          );
          setChannels(
            Array.isArray(data.channels) && data.channels.length
              ? data.channels
              : [...plan.channels]
          );
        }
      },
      () => {
        setBot(null);
        setBotError("Nao foi possivel carregar o bot.");
        setLoadingBot(false);
      }
    );

    return () => unsubscribe();
  }, [botId, userId, dirty, plan.channels]);

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

  const toggleChannel = (channel: string) => {
    setDirty(true);
    setChannels((prev) => {
      if (prev.includes(channel)) {
        return prev.filter((item) => item !== channel);
      }
      return [...prev, channel];
    });
  };

  const handleToggleStatus = async () => {
    if (!botId || !userId || !isFirebaseConfigured) {
      return;
    }
    const nextEnabled = !enabled;
    setStatusLoading(true);
    setSaveError("");
    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, "users", userId, "bots", botId),
        {
          enabled: nextEnabled,
          status: nextEnabled ? "Ativo" : "Pausado",
          activity: nextEnabled ? "Respondendo" : "Pausado",
          health: nextEnabled ? "Ativo" : "Pausado",
          tone: nextEnabled ? "ok" : "warn",
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setEnabled(nextEnabled);
    } catch (err) {
      setSaveError("Nao foi possivel atualizar o status do bot.");
    } finally {
      setStatusLoading(false);
    }
  };

  const toggleDay = (dayId: string) => {
    setDirty(true);
    setActiveDays((prev) => {
      if (prev.includes(dayId)) {
        return prev.filter((item) => item !== dayId);
      }
      return [...prev, dayId];
    });
  };

  const handleSave = async () => {
    if (configLocked) {
      setSaveError("Pausar o bot para editar configuracoes.");
      return;
    }
    if (!botId || !userId || !isFirebaseConfigured) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    const db = getFirebaseDb();
    const allowedChannels = channels.filter((channel) =>
      (plan.channels as readonly string[]).includes(channel)
    );
    try {
      await setDoc(
        doc(db, "users", userId, "bots", botId),
        {
          displayName: displayName.trim(),
          description: description.trim(),
          objective: objective.trim(),
          welcomeMessage: welcomeMessage.trim(),
          fallbackMessage: fallbackMessage.trim(),
          handoffMessage: handoffMessage.trim(),
          keywords: keywords.trim(),
          enabled,
          activeStart,
          activeEnd,
          activeDays,
          channels: allowedChannels,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setDirty(false);
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      setSaveError("Nao foi possivel salvar as configuracoes.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChannels = async () => {
    if (!userId || !isFirebaseConfigured) {
      return;
    }
    setNumbersSaving(true);
    setNumbersError("");
    setNumbersSaved(false);
    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, "users", userId),
        {
          whatsappNumber: whatsappNumber.trim(),
          smsNumber: smsNumber.trim(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setNumbersDirty(false);
      setNumbersSaved(true);
      window.setTimeout(() => setNumbersSaved(false), 2000);
    } catch (err) {
      setNumbersError("Nao foi possivel salvar os canais.");
    } finally {
      setNumbersSaving(false);
    }
  };

  const handleCopyUid = async () => {
    if (!userId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(userId);
      setCopyUidDone(true);
      window.setTimeout(() => setCopyUidDone(false), 2000);
    } catch {
      setCopyUidDone(false);
    }
  };

  if (!botId) {
    return (
      <main className="dashboard-outer">
        <div className="dashboard-shell">
          <div className="error-banner">Bot nao encontrado.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-outer">
      <div className="dashboard-shell">
        <header className="dash-nav">
          <div className="dash-nav-inner">
            <div className="dash-brand">SistemaBote</div>
            <nav className="dash-links">
              <a href="/dashboard">Dashboard</a>
              <a className="active" href="/bots">Bots</a>
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
                                Plano {plan.label} - {plan.price}
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

        <section className="dashboard-content bot-config">
          <header className="dash-top">
            <div>
              <span className="dash-eyebrow">Bots</span>
              <h1>Configurar bot</h1>
              <p className="dash-subtitle">
                Ajuste mensagens, canais e horarios do bot selecionado.
              </p>
            </div>
            <div className="config-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={handleToggleStatus}
                disabled={statusLoading || loadingBot}
              >
                {statusLoading
                  ? "Atualizando..."
                  : enabled
                    ? "Pausar bot"
                    : "Iniciar bot"}
              </button>
              <button className="btn ghost" type="button" onClick={() => router.push("/bots")}>
                Voltar
              </button>
              <button className="btn primary" type="button" onClick={handleSave} disabled={saving || loadingBot || configLocked}>
                {saving ? "Salvando..." : "Salvar configuracao"}
              </button>
            </div>
          </header>

          {botError ? <div className="error-banner">{botError}</div> : null}
          {configLocked ? (
            <div className="warn-banner">Pausar o bot para editar as configuracoes.</div>
          ) : null}

          <div className="config-grid">
            <section className="dash-table-card config-card">
              <div className="table-headline">
                <h2>Conectar canais</h2>
                <span className="muted">Twilio</span>
              </div>
              <div className="config-form">
                <label className="form-field">
                  <span>WhatsApp do Twilio</span>
                  <input
                    className="input"
                    value={whatsappNumber}
                    onChange={(event) => {
                      setNumbersDirty(true);
                      setWhatsappNumber(event.target.value);
                    }}
                    placeholder="whatsapp:+5511999999999"
                  />
                  <small className="field-hint">
                    Use o mesmo numero configurado no Twilio (sandbox ou producao).
                  </small>
                </label>
                <label className="form-field">
                  <span>SMS do Twilio</span>
                  <input
                    className="input"
                    value={smsNumber}
                    onChange={(event) => {
                      setNumbersDirty(true);
                      setSmsNumber(event.target.value);
                    }}
                    placeholder="+5511999999999"
                  />
                </label>
                <div className="uid-row">
                  <div>
                    <span className="muted">Seu UID (use em DEFAULT_TENANT_UID)</span>
                    <code className="uid-pill">{userId ?? "-"}</code>
                  </div>
                  <button className="btn small ghost" type="button" onClick={handleCopyUid}>
                    {copyUidDone ? "Copiado" : "Copiar UID"}
                  </button>
                </div>
                <div className="webhook-hint">
                  Webhook Twilio: <code>https://seu-dominio/webhooks/twilio</code>
                </div>
                {numbersError ? <div className="error-banner">{numbersError}</div> : null}
                {numbersSaved ? <div className="success-banner">Canais salvos.</div> : null}
                <button
                  className="btn primary"
                  type="button"
                  onClick={handleSaveChannels}
                  disabled={numbersSaving}
                >
                  {numbersSaving ? "Salvando..." : "Salvar canais"}
                </button>
              </div>
            </section>
            <section className="dash-table-card config-card">
              <div className="table-headline">
                <h2>Informacoes do bot</h2>
                <span className={`status-pill ${enabled ? "ok" : "crit"}`}>
                  {enabled ? "Ativo" : "Desativado"}
                </span>
              </div>
              {loadingBot ? (
                <div className="empty-state">Carregando bot...</div>
              ) : bot ? (
                <div className="config-form">
                  <label className="form-field">
                    <span>Nome exibido</span>
                    <input
                      className="input"
                      value={displayName}
                      onChange={(event) => {
                        setDirty(true);
                        setDisplayName(event.target.value);
                      }}
                      placeholder={bot.name ?? "Nome do bot"}
                      disabled={configLocked}
                    />
                  </label>
                  <label className="form-field">
                    <span>Descricao curta</span>
                    <input
                      className="input"
                      value={description}
                      onChange={(event) => {
                        setDirty(true);
                        setDescription(event.target.value);
                      }}
                      placeholder="Ex: Atendimento rapido para clientes"
                      disabled={configLocked}
                    />
                  </label>
                  <label className="form-field">
                    <span>Objetivo principal</span>
                    <textarea
                      className="input textarea"
                      value={objective}
                      onChange={(event) => {
                        setDirty(true);
                        setObjective(event.target.value);
                      }}
                      placeholder="Descreva o que o bot precisa resolver."
                      rows={3}
                      disabled={configLocked}
                    />
                  </label>

                  <div className="toggle-row">
                    <span>Bot ativo</span>
                    <button
                      className={`toggle-btn ${enabled ? "on" : "off"}`}
                      type="button"
                      onClick={handleToggleStatus}
                    >
                      {statusLoading ? "Atualizando..." : enabled ? "Ativo" : "Pausado"}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="dash-table-card config-card">
              <div className="table-headline">
                <h2>Mensagens</h2>
                <span className="muted">Personalize a conversa</span>
              </div>
              <div className="config-form">
                <label className="form-field">
                  <span>Mensagem de boas-vindas</span>
                  <textarea
                    className="input textarea"
                    value={welcomeMessage}
                    onChange={(event) => {
                      setDirty(true);
                      setWelcomeMessage(event.target.value);
                    }}
                    rows={3}
                    disabled={configLocked}
                  />
                </label>
                <label className="form-field">
                  <span>Mensagem de fallback</span>
                  <textarea
                    className="input textarea"
                    value={fallbackMessage}
                    onChange={(event) => {
                      setDirty(true);
                      setFallbackMessage(event.target.value);
                    }}
                    rows={3}
                    disabled={configLocked}
                  />
                </label>
                <label className="form-field">
                  <span>Transferencia para humano</span>
                  <textarea
                    className="input textarea"
                    value={handoffMessage}
                    onChange={(event) => {
                      setDirty(true);
                      setHandoffMessage(event.target.value);
                    }}
                    rows={3}
                    disabled={configLocked}
                  />
                </label>
              </div>
            </section>

            <section className="dash-table-card config-card">
              <div className="table-headline">
                <h2>Canais</h2>
                <span className="muted">Disponivel no seu plano</span>
              </div>
              <div className="channel-list">
                {["WhatsApp", "SMS", "Email"].map((channel) => {
                  const allowed = (plan.channels as readonly string[]).includes(channel);
                  const checked = channels.includes(channel);
                  return (
                    <label
                      key={channel}
                      className={`channel-option ${allowed ? "" : "blocked"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!allowed || configLocked}
                        onChange={() => toggleChannel(channel)}
                      />
                      <span>{channel}</span>
                      {!allowed ? <em>Bloqueado no plano</em> : null}
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="dash-table-card config-card">
              <div className="table-headline">
                <h2>Regras de atendimento</h2>
                <span className="muted">Horarios e gatilhos</span>
              </div>
              <div className="config-form">
                <div className="form-row">
                  <label className="form-field">
                    <span>Inicio</span>
                    <input
                      className="input"
                      type="time"
                      value={activeStart}
                      onChange={(event) => {
                        setDirty(true);
                        setActiveStart(event.target.value);
                      }}
                      disabled={configLocked}
                    />
                  </label>
                  <label className="form-field">
                    <span>Fim</span>
                    <input
                      className="input"
                      type="time"
                      value={activeEnd}
                      onChange={(event) => {
                        setDirty(true);
                        setActiveEnd(event.target.value);
                      }}
                      disabled={configLocked}
                    />
                  </label>
                </div>
                <div className="form-field">
                  <span>Dias ativos</span>
                  <div className="days-grid">
                    {DAYS.map((day) => (
                      <button
                        key={day.id}
                        type="button"
                        className={`day-pill ${activeDays.includes(day.id) ? "on" : ""}`}
                        onClick={() => toggleDay(day.id)}
                        disabled={configLocked}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="form-field">
                  <span>Palavras-chave</span>
                  <input
                    className="input"
                    value={keywords}
                    onChange={(event) => {
                      setDirty(true);
                      setKeywords(event.target.value);
                    }}
                    placeholder="Ex: suporte, fatura, proposta"
                    disabled={configLocked}
                  />
                </label>
              </div>
            </section>
          </div>

          <section className="dash-table-card config-card preview-card">
            <div className="table-headline">
              <h2>Resumo</h2>
              <span className="muted">Como o bot vai atuar</span>
            </div>
            <div className="preview-grid">
              <div>
                <strong>{displayName || bot?.name}</strong>
                <span>{bot?.area ?? "Area"} · {enabled ? "Ativo" : "Pausado"}</span>
                <p>{description || "Sem descricao definida."}</p>
              </div>
              <div>
                <span>Canais</span>
                <div className="pill-row">
                  {(channels.length ? channels : plan.channels).map((channel) => (
                    <span key={channel} className="channel-pill">
                      {channel}
                    </span>
                  ))}
                </div>
                <span>Horario</span>
                <p>
                  {activeStart} - {activeEnd} · {activeDays.length} dias ativos
                </p>
              </div>
              <div>
                <span>Mensagem inicial</span>
                <p className="preview-msg">{welcomeMessage || "Nao definida."}</p>
              </div>
            </div>
            {saveError ? <div className="error-banner">{saveError}</div> : null}
            {saveOk ? <div className="success-banner">Configuracao salva.</div> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
