"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithPopup
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  getFirebaseAuth,
  isFirebaseConfigured
} from "../../lib/firebase";
import { planCatalog, planOrder, type PlanId } from "../../lib/plans";
import { seedUserData } from "../../lib/seedUser";

const planOptions = planOrder.map((id) => ({
  id,
  ...planCatalog[id]
}));

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<PlanId>(planOptions[0].id);
  const [remember] = useState(true);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Preencha email e senha.");
      setStatus("error");
      return;
    }

    if (!isFirebaseConfigured) {
      setError("Configure o Firebase antes de continuar.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      const auth = getFirebaseAuth();
      const persistence = remember
        ? browserLocalPersistence
        : browserSessionPersistence;

      await setPersistence(auth, persistence);
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await seedUserData({
        uid: credential.user.uid,
        email,
        plan
      });

      router.push("/dashboard");
    } catch (err) {
      let message = "Nao foi possivel criar a conta.";
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/email-already-in-use":
            message = "Este email ja esta cadastrado.";
            break;
          case "auth/invalid-email":
            message = "Email invalido.";
            break;
          case "auth/weak-password":
            message = "Senha muito fraca (minimo 6 caracteres).";
            break;
          case "permission-denied":
            message = "Permissao negada no Firestore. Verifique as regras.";
            break;
          default:
            message = `Erro: ${err.code}`;
            break;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      console.error(err);
      setError(message);
      setStatus("error");
    }
  };

  const handleGoogle = () => {
    if (!isFirebaseConfigured) {
      setError("Configure o Firebase antes de continuar.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (result) => {
        await seedUserData({
          uid: result.user.uid,
          email: result.user.email,
          plan
        });
        router.push("/dashboard");
      })
      .catch(() => {
        setError("Nao foi possivel entrar com Google.");
        setStatus("error");
      });
  };

  const isSubmitting = status === "submitting";

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">SistemaBote</div>
        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">
          Preencha seus dados para comecar a automatizar o WhatsApp.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              className="input"
              type="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              className="input"
              type="password"
              placeholder="Crie uma senha forte"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
            <div className="plan-selector">
              <div className="plan-selector-head">
                <span>Escolha seu plano</span>
                <span className="plan-hint">Limite de mensagens por mes</span>
              </div>
              <div className="plan-grid">
              {planOptions.map((item) => (
                <label className="plan-option" key={item.id}>
                  <input
                    type="radio"
                    name="plan"
                    value={item.id}
                    checked={plan === item.id}
                    onChange={() => setPlan(item.id)}
                  />
                  <div className="plan-card">
                    <div className="plan-card-top">
                      <strong>{item.label}</strong>
                      <span className="plan-limit">{item.messageLimit}</span>
                    </div>
                    <div className="plan-price">
                      <span>{item.price}</span>
                      <small>{item.billing}</small>
                    </div>
                    <ul className="plan-features">
                      {item.features.map((feature) => (
                        <li key={`${item.id}-${feature}`}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </label>
              ))}
            </div>
            <div className="payment-note">
              Pagamento via Mercado Pago (Pix, Cartao e Boleto).
            </div>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          <button className="btn primary full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>

          <div className="divider">
            <span>ou</span>
          </div>

          <button
            className="btn ghost full google"
            type="button"
            onClick={handleGoogle}
            disabled={isSubmitting}
          >
            <span className="google-badge">G</span>
            Continuar com Google
          </button>
        </form>

        <p className="auth-footer">
          Ja tem conta? <a className="link" href="/login">Entrar</a>
        </p>
      </div>
    </main>
  );
}
