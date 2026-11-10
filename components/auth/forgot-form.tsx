"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthCard, AuthTerminal } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { AUTH_LIMITS, authErrorMessage, validateEmail } from "@/lib/auth";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const invalid = validateEmail(email.trim());
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset({ email });
      if (result.ok) setSentTo(email.trim());
      else setError(authErrorMessage(result.error, result.field));
    });
  };

  if (sentTo) {
    return (
      <AuthCard subtitle="RECUPERAR CONTRASEÑA">
        <AuthTerminal
          command="./reset_password --send"
          lines={["Solicitud registrada"]}
          result={`SI ${sentTo.toUpperCase()} TIENE CUENTA, RECIBIRÁS UN ENLACE EN UNOS MINUTOS.`}
        >
          <Link href="/auth" className="btn ghost">
            VOLVER A INICIAR SESIÓN
          </Link>
        </AuthTerminal>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="RECUPERAR CONTRASEÑA">
      <p className="auth-copy">
        Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
      </p>
      <form onSubmit={submit} noValidate>
        <Field id="forgot-email" label="Correo electrónico" error={error ?? undefined}>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={AUTH_LIMITS.email.max}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jugador@vault.gg"
            aria-invalid={!!error}
            aria-describedby={error ? "forgot-email-err" : undefined}
          />
        </Field>
        <button className="btn lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "ENVIANDO…" : "ENVIAR ENLACE"}
        </button>
      </form>
      <div className="auth-aside auth-aside--center">
        <Link href="/auth">Volver a iniciar sesión</Link>
      </div>
    </AuthCard>
  );
}
