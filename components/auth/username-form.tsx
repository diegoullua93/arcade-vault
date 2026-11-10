"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createProfile } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { AUTH_LIMITS, authErrorMessage, safeNext, validateUsername } from "@/lib/auth";

export function UsernameForm({ next }: { next?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const invalid = validateUsername(username);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createProfile({ username });
      if (result.ok) {
        router.push(safeNext(next));
        router.refresh();
      } else {
        setError(authErrorMessage(result.error, result.field));
      }
    });
  };

  return (
    <AuthCard subtitle="ÚLTIMO PASO">
      <p className="auth-copy">
        Elige el nombre con el que aparecerás en el ranking. No podrás cambiarlo después.
      </p>
      <form onSubmit={submit} noValidate>
        <Field id="profile-user" label="Nombre de jugador" error={error ?? undefined}>
          <input
            id="profile-user"
            name="username"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={AUTH_LIMITS.username.max}
            value={username}
            onChange={(e) => setUsername(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="PX_KAI"
            aria-invalid={!!error}
            aria-describedby={error ? "profile-user-err" : "profile-user-hint"}
          />
          <span id="profile-user-hint" className="field-hint">
            3 a 10 caracteres: letras, números y _.
          </span>
        </Field>
        <button className="btn lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "GUARDANDO…" : "ENTRAR AL VAULT"}
        </button>
      </form>
    </AuthCard>
  );
}
