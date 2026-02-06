"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../../lib/firebase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email) {
      setError("Informe um email valido.");
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
      await sendPasswordResetEmail(auth, email);
      setStatus("done");
    } catch (err) {
      setError("Nao foi possivel enviar o email.");
      setStatus("error");
    }
  };

  const isSubmitting = status === "submitting";

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">SistemaBote</div>
        <h1 className="auth-title">Recuperar senha</h1>
        <p className="auth-subtitle">
          Enviaremos um link para redefinir sua senha.
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

          {error ? <div className="error-banner">{error}</div> : null}
          {status === "done" ? (
            <div className="success-banner">Email enviado com sucesso.</div>
          ) : null}

          <button className="btn primary full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar link"}
          </button>
        </form>

        <p className="auth-footer">
          Lembrou da senha? <a className="link" href="/login">Voltar</a>
        </p>
      </div>
    </main>
  );
}
