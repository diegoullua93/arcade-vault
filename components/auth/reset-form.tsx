"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { updatePassword } from "@/app/auth/actions";
import { AuthCard, AuthTerminal } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { AUTH_LIMITS, authErrorMessage, validatePassword } from "@/lib/auth";

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<{ text: string; expired: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setFormError(null);

    const next: typeof errors = {};
    const passError = validatePassword(password);
    if (passError) next.password = passError;
    else if (confirm !== password) next.confirm = "Las contraseñas no coinciden";
    setErrors(next);
    if (next.password || next.confirm) return;

    startTransition(async () => {
      const result = await updatePassword({ password });
      if (result.ok) {
        setDone(true);
        router.refresh();
      } else {
        setFormError({
          text: authErrorMessage(result.error, result.field),
          expired: result.error === "no_session",
        });
      }
    });
  };

  if (done) {
    return (
      <AuthCard subtitle="NUEVA CONTRASEÑA">
        <AuthTerminal
          command="./set_password"
          lines={["Contraseña actualizada"]}
          result="LISTO. YA PUEDES SEGUIR JUGANDO."
        >
          <Link href="/biblioteca" className="btn">
            IR A LA BIBLIOTECA
          </Link>
        </AuthTerminal>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="NUEVA CONTRASEÑA">
      <form onSubmit={submit} noValidate>
        <Field id="reset-pass" label="Contraseña nueva" error={errors.password}>
          <input
            id="reset-pass"
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={AUTH_LIMITS.password.max}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "reset-pass-err" : undefined}
          />
          {!errors.password && (
            <span className="field-hint">Mínimo {AUTH_LIMITS.password.min} caracteres.</span>
          )}
        </Field>
        <Field id="reset-confirm" label="Repite la contraseña" error={errors.confirm}>
          <input
            id="reset-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            maxLength={AUTH_LIMITS.password.max}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "reset-confirm-err" : undefined}
          />
        </Field>

        {formError && (
          <div role="alert" className="auth-alert">
            {formError.text}{" "}
            {formError.expired && <Link href="/auth/olvide">Pedir un enlace nuevo</Link>}
          </div>
        )}

        <button className="btn lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
        </button>
      </form>
    </AuthCard>
  );
}
