"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { useState, useTransition } from "react";
import { signOut } from "@/app/auth/actions";

export function SignOutButton() {
  const router = useRouter();
  const { refresh } = useSession();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const out = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await signOut();
      if (result.ok) {
        router.push("/");
        refresh();
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <>
      <button className="btn magenta" type="button" onClick={out} disabled={pending}>
        {pending ? "SALIENDO…" : "CERRAR SESIÓN"}
      </button>
      {failed && (
        <div role="alert" className="auth-alert" style={{ marginTop: 12 }}>
          No se pudo cerrar la sesión. Inténtalo de nuevo.
        </div>
      )}
    </>
  );
}
