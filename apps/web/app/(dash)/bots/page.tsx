"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "../../../lib/firebase";
import { planCatalog, type PlanId } from "../../../lib/plans";
import { createPixPayment, type PixPaymentResponse } from "../../../lib/payments";
import { seedUserData } from "../../../lib/seedUser";
import { useUserProfile } from "../../../lib/useUserProfile";

type BotItem = {
  id: string;
  name: string;
  area: string;
  status?: string;
  activity?: string;
  enabled?: boolean;
  channels?: string[];
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

export default function BotsPage() {
  const [selectedArea, setSelectedArea] = useState("Todos");
  const [selectedBots, setSelectedBots] = useState<Array<{ name: string; area: string }>>([]);
  const [bots, setBots] = useState<BotItem[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [botsError, setBotsError] = useState("");
  const [seedAttempted, setSeedAttempted] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [savingSelection, setSavingSelection] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [statusSaving, setStatusSaving] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [notifSeen, setNotifSeen] = useState(true);
  const [paymentData, setPaymentData] = useState<PixPaymentResponse | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { profile, selectedBots: storedBots, userId, loading } = useUserProfile();
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
    setSelectedBots(storedBots);
  }, [storedBots]);

  useEffect(() => {
    if (!isFirebaseConfigured || !userId) {
      setBots([]);
      setBotsLoading(false);
      return;
    }

    setBotsLoading(true);
    const db = getFirebaseDb();
    const q = query(collection(db, "users", userId, "bots"), orderBy("area", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<BotItem, "id">;
          return {
            id: docSnap.id,
            name: data.name ?? docSnap.id,
            area: data.area ?? "Geral",
            status: data.status,
            activity: data.activity,
            enabled: typeof data.enabled === "boolean" ? data.enabled : undefined,
            channels: Array.isArray(data.channels) ? data.channels : undefined
          } satisfies BotItem;
        });
        setBots(items);
        setBotsError("");
        setBotsLoading(false);
      },
      () => {
        setBots([]);
        setBotsLoading(false);
        setBotsError("Nao foi possivel carregar os bots.");
      }
    );

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (botsLoading || seedAttempted || !userId) {
      return;
    }
    if (bots.length > 0) {
      return;
    }
    setSeedAttempted(true);
    seedUserData({
      uid: userId,
      email: profile?.email ?? undefined,
      plan: planId
    }).catch(() => {
      setBotsError("Nao foi possivel carregar os bots.");
    });
  }, [botsLoading, bots.length, seedAttempted, userId, profile?.email, planId]);

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

  const availableAreas = useMemo(() => {
    const allAreas = Array.from(new Set(bots.map((bot) => bot.area)));
    return ["Todos", ...allAreas];
  }, [bots]);
  const visibleBots = useMemo(() => {
    if (selectedArea === "Todos") {
      return bots;
    }
    return bots.filter((bot) => bot.area === selectedArea);
  }, [selectedArea, bots]);
  const selectedBotNames = useMemo(
    () => new Set(selectedBots.map((bot) => bot.name)),
    [selectedBots]
  );
  const hasSelection = selectedBotNames.size > 0;
  const showSelectionNote = bots.length > 0 && selectedBots.length > 0;

  useEffect(() => {
    if (!availableAreas.includes(selectedArea)) {
      setSelectedArea("Todos");
    }
  }, [availableAreas, selectedArea]);

  const handleSelectBot = async (bot: (typeof bots)[number]) => {
    setSelectionError("");
    const alreadySelected = selectedBots.some((item) => item.name === bot.name);
    let nextSelected = selectedBots;

    if (alreadySelected) {
      nextSelected = selectedBots.filter((item) => item.name !== bot.name);
    } else {
      if (selectedBots.length >= plan.botLimit) {
        setSelectionError(`Limite do plano: ${plan.botLimit} bots.`);
        return;
      }
      nextSelected = [...selectedBots, { name: bot.name, area: bot.area }];
    }

    setSelectedBots(nextSelected);

    if (!isFirebaseConfigured || !userId) {
      return;
    }

    try {
      setSavingSelection(bot.name);
      const db = getFirebaseDb();
      await updateDoc(doc(db, "users", userId), {
        selectedBots: nextSelected,
        selectedBotName: nextSelected[0]?.name ?? null,
        selectedBotArea: nextSelected[0]?.area ?? null,
        selectedBotUpdatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      setSelectionError("Nao foi possivel salvar a selecao do bot.");
    } finally {
      setSavingSelection(null);
    }
  };

  const handleSeedBots = async () => {
    if (!userId) {
      return;
    }
    setSeedLoading(true);
    setSeedError("");
    setSeedSuccess(false);
    try {
      await seedUserData({
        uid: userId,
        email: profile?.email ?? undefined,
        plan: planId,
        forceBots: true
      });
      setSeedSuccess(true);
      window.setTimeout(() => setSeedSuccess(false), 2000);
    } catch (err) {
      setSeedError("Nao foi possivel recriar os bots.");
    } finally {
      setSeedLoading(false);
    }
  };

  useEffect(() => {
    if (!userId || bots.length === 0) {
      return;
    }
    const existing = new Set(bots.map((bot) => bot.name));
    const filtered = selectedBots.filter((item) => existing.has(item.name));
    if (filtered.length === selectedBots.length) {
      return;
    }
    setSelectedBots(filtered);
    if (!isFirebaseConfigured) {
      return;
    }
    const db = getFirebaseDb();
    updateDoc(doc(db, "users", userId), {
      selectedBots: filtered,
      selectedBotName: filtered[0]?.name ?? null,
      selectedBotArea: filtered[0]?.area ?? null,
      selectedBotUpdatedAt: serverTimestamp()
    }).catch((err) => console.error(err));
  }, [bots, selectedBots, userId]);
  const handleToggleBotStatus = async (bot: BotItem) => {
    if (!isFirebaseConfigured || !userId) {
      return;
    }
    const currentEnabled = bot.enabled === true;
    const nextEnabled = !currentEnabled;
    try {
      setStatusSaving(bot.id);
      const db = getFirebaseDb();
      await updateDoc(doc(db, "users", userId, "bots", bot.id), {
        enabled: nextEnabled,
        status: nextEnabled ? "Ativo" : "Pausado",
        activity: nextEnabled ? "Respondendo" : "Pausado",
        health: nextEnabled ? "Ativo" : "Pausado",
        tone: nextEnabled ? "ok" : "warn",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      setSelectionError("Nao foi possivel atualizar o status do bot.");
    } finally {
      setStatusSaving(null);
    }
  };

  useEffect(() => {
    if (selectedBots.length <= plan.botLimit) {
      return;
    }

    const trimmed = selectedBots.slice(0, plan.botLimit);
    setSelectedBots(trimmed);
    setSelectionError(`Limite do plano: ${plan.botLimit} bots.`);

    if (!isFirebaseConfigured || !userId) {
      return;
    }

    const db = getFirebaseDb();
    updateDoc(doc(db, "users", userId), {
      selectedBots: trimmed,
      selectedBotName: trimmed[0]?.name ?? null,
      selectedBotArea: trimmed[0]?.area ?? null,
      selectedBotUpdatedAt: serverTimestamp()
    }).catch((err) => console.error(err));
  }, [plan.botLimit, selectedBots, userId]);

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
              <span className="dash-eyebrow">Bots</span>
              <h1>Gerencie seus bots</h1>
            </div>
            <div className="plan-summary">
              <span>Plano</span>
              <strong>{plan.label}</strong>
              <em>{plan.messageLimit}</em>
              <small>{plan.botLimit} bots ativos</small>
              {loadingPlan ? <span className="plan-loading">Carregando...</span> : null}
            </div>
          </header>

          <section className="dash-table-card bots-card">
            <div className="table-headline">
              <h2>Lista de bots</h2>
              <div className="table-controls">
                <label className="filter-field">
                  <span>Tipo de bot</span>
                  <select
                    value={selectedArea}
                    onChange={(event) => setSelectedArea(event.target.value)}
                  >
                    {availableAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </label>
                <span>Total</span>
                <button className="ghost-pill">{visibleBots.length}</button>
              </div>
            </div>
            {showSelectionNote ? (
              <div className="selection-note">
                Bots selecionados: {selectedBots.length}/{plan.botLimit}
              </div>
            ) : null}
            {selectionError ? <div className="error-banner">{selectionError}</div> : null}
            {seedError ? <div className="error-banner">{seedError}</div> : null}
            {seedSuccess ? <div className="success-banner">Bots recriados.</div> : null}
            {botsError ? <div className="error-banner">{botsError}</div> : null}
            <div className="bot-grid">
              {botsLoading ? (
                <div className="empty-state">Carregando bots...</div>
              ) : visibleBots.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum bot cadastrado.</p>
                  <button className="btn small" type="button" onClick={handleSeedBots} disabled={seedLoading}>
                    {seedLoading ? "Recriando..." : "Recriar bots padrao"}
                  </button>
                </div>
              ) : (
                visibleBots.map((bot) => {
                const isSelected = selectedBots.some((item) => item.name === bot.name);
                const isSaving = savingSelection === bot.name;
                const isLimitReached = selectedBots.length >= plan.botLimit;
                const isBlocked = !isSelected && isLimitReached;
                const isEnabled = bot.enabled === true;
                const isLockedByLimit = !isSelected && isLimitReached;
                const canToggle = isSelected;
                const canConfigure = isSelected && !isEnabled;
                const channels = bot.channels?.length ? bot.channels : plan.channels;
                return (
                  <article
                    className={`bot-card ${isSelected ? "selected" : ""} ${isBlocked ? "blocked" : ""}`}
                    key={bot.id}
                  >
                    <div className="bot-card-top">
                      <div>
                        <h3>{bot.name}</h3>
                        <span className="bot-area">{bot.area}</span>
                      </div>
                      <span className={`status-pill ${isEnabled ? "" : "warn"}`}>
                        {bot.status ?? (isEnabled ? "Ativo" : "Pausado")}
                      </span>
                    </div>
                    <div className="bot-meta">
                      <span>Disponibilidade</span>
                      <strong>{bot.activity ?? (isEnabled ? "Respondendo" : "Pausado")}</strong>
                    </div>
                    <div className="channel-pills">
                      {channels.map((channel) => (
                        <span className="channel-pill" key={`${bot.name}-${channel}`}>
                          {channel}
                        </span>
                      ))}
                    </div>
                    <div className="bot-actions">
                      <button
                        className="btn small select-btn"
                        type="button"
                        disabled={isSaving || isBlocked}
                        onClick={() => handleSelectBot(bot)}
                      >
                        {isSelected ? "Desselecionar" : isLimitReached ? "Limite" : "Selecionar"}
                      </button>
                      <button
                        className="btn small ghost"
                        type="button"
                        disabled={!canToggle || statusSaving === bot.id || isLockedByLimit}
                        onClick={() => handleToggleBotStatus(bot)}
                      >
                        {!canToggle
                          ? "Selecione p/ iniciar"
                          : statusSaving === bot.id
                            ? "Atualizando..."
                            : isEnabled
                              ? "Pausar"
                              : "Iniciar"}
                      </button>
                      {canConfigure ? (
                        <a className="btn small ghost" href={`/bots/${bot.id}`}>
                          Configurar
                        </a>
                      ) : (
                        <button className="btn small ghost" type="button" disabled>
                          {isEnabled ? "Pausar p/ editar" : "Selecione p/ editar"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
              )}
            </div>
            <div className="plan-note">
              Plano {plan.label}: limite de {plan.messageLimit} e ate {plan.botLimit} bots ativos.
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
