"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { signIn, signInWithGoogle, signUp } from "@/app/auth/actions";
import { AuthCard, AuthTerminal } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import {
  AUTH_LIMITS,
  authErrorMessage,
  safeNext,
  validateEmail,
  validatePassword,
  validateUsername,
  type AuthField,
} from "@/lib/auth";

type Tab = "in" | "up";
type FieldErrors = Partial<Record<AuthField, string>>;

const CALLBACK_ERROR = "El enlace no es válido o ya caducó. Inicia sesión o pide uno nuevo.";

export function AuthForm({ next, callbackError }: { next?: string; callbackError?: boolean }) {
  const router = useRouter();
  const { refresh } = useSession();
  const target = safeNext(next);
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(callbackError ? CALLBACK_ERROR : null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setFieldErrors({});
    setFormError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setFormError(null);

    // Validación local: avisa antes de ir al servidor (el servidor vuelve a validar).
    const errors: FieldErrors = {};
    const emailError = validateEmail(email.trim());
    if (emailError) errors.email = emailError;
    if (tab === "up") {
      const userError = validateUsername(username);
      if (userError) errors.username = userError;
      const passError = validatePassword(password);
      if (passError) errors.password = passError;
    } else if (!password) {
      errors.password = "Escribe tu contraseña";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setShake(true);
      return;
    }

    startTransition(async () => {
      if (tab === "in") {
        const result = await signIn({ email, password });
        if (result.ok) {
          router.push(target);
          refresh();
          router.refresh();
        } else {
          setFormError(authErrorMessage(result.error, result.field));
          setShake(true);
        }
        return;
      }
      const result = await signUp({ username, email, password, next: target });
      if (result.ok) {
        setSentTo(email.trim());
      } else if (result.field) {
        setFieldErrors({ [result.field]: authErrorMessage(result.error, result.field) });
        setShake(true);
      } else {
        setFormError(authErrorMessage(result.error));
      }
    });
  };

  const google = () => {
    if (pending) return;
    setFormError(null);
    startTransition(async () => {
      const result = await signInWithGoogle(target);
      if (result.ok) window.location.assign(result.url);
      else setFormError(authErrorMessage("failed"));
    });
  };

  if (sentTo) {
    return (
      <AuthCard subtitle="CUENTA CREADA">
        <AuthTerminal
          command="./verify_email --send"
          lines={["Cuenta registrada", `Enlace enviado a ${sentTo}`]}
          result="REVISA TU CORREO Y ABRE EL ENLACE PARA ACTIVAR LA CUENTA."
        >
          <button className="btn ghost" type="button" onClick={() => setSentTo(null)}>
            USAR OTRO CORREO
          </button>
        </AuthTerminal>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="ACCESO AL SISTEMA">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "in"}
          className={tab === "in" ? "on" : ""}
          onClick={() => switchTab("in")}
        >
          INICIAR SESIÓN
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "up"}
          className={tab === "up" ? "on" : ""}
          onClick={() => switchTab("up")}
        >
          CREAR CUENTA
        </button>
      </div>

      <form onSubmit={submit} noValidate className={shake ? "shake" : ""}>
        {tab === "up" && (
          <Field id="auth-user" label="Nombre de jugador" error={fieldErrors.username}>
            <input
              id="auth-user"
              name="username"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={AUTH_LIMITS.username.max}
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="PX_KAI"
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? "auth-user-err" : "auth-user-hint"}
            />
            <span id="auth-user-hint" className="field-hint">
              3 a 10 caracteres: letras, números y _. Es el nombre que verás en el ranking.
            </span>
          </Field>
        )}
        <Field id="auth-email" label="Correo electrónico" error={fieldErrors.email}>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={AUTH_LIMITS.email.max}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jugador@vault.gg"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "auth-email-err" : undefined}
          />
        </Field>
        <Field id="auth-pass" label="Contraseña" error={fieldErrors.password}>
          <input
            id="auth-pass"
            name="password"
            type="password"
            autoComplete={tab === "in" ? "current-password" : "new-password"}
            maxLength={AUTH_LIMITS.password.max}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "auth-pass-err" : undefined}
          />
          {tab === "up" && !fieldErrors.password && (
            <span className="field-hint">Mínimo {AUTH_LIMITS.password.min} caracteres.</span>
          )}
        </Field>

        {tab === "in" && (
          <div className="auth-aside">
            <Link href="/auth/olvide">¿Olvidaste tu contraseña?</Link>
          </div>
        )}

        {formError && (
          <div role="alert" className="auth-alert">
            {formError}
          </div>
        )}

        <button
          className="btn lg"
          type="submit"
          disabled={pending}
          style={{ width: "100%", marginTop: 8 }}
        >
          {pending
            ? tab === "in"
              ? "ENTRANDO…"
              : "CREANDO…"
            : tab === "in"
              ? "ENTRAR AL VAULT"
              : "CREAR CUENTA"}
        </button>
      </form>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        <button className="btn ghost" type="button" onClick={google} disabled={pending}>
          ◆ GOOGLE
        </button>
      </div>

      <button
        type="button"
        className="btn ghost"
        style={{ width: "100%", marginTop: 10 }}
        onClick={() => router.push("/biblioteca")}
      >
        JUGAR COMO INVITADO
      </button>
      <div className="auth-note">Como invitado puedes jugar, pero tus marcas no se guardan.</div>
    </AuthCard>
  );
}
