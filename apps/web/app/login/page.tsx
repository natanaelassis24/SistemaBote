"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../../lib/firebase";
import { seedUserData } from "../../lib/seedUser";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await seedUserData({
        uid: credential.user.uid,
        email: credential.user.email ?? email
      });
      router.push("/dashboard");
    } catch (err) {
      setError("Email ou senha invalidos.");
      setStatus("error");
    }
  };

  const handleGoogle = () => {
    setError("");
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
          email: result.user.email
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
        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">
          Digite suas credenciais para acessar o painel.
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
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <div className="auth-row">
            <span />
            <a className="link" href="/forgot">
              Esqueceu a senha?
            </a>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          <button className="btn primary full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
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
          Nao tem conta? <a className="link" href="/signup">Criar conta</a>
        </p>
      </div>
    </main>
  );
}
