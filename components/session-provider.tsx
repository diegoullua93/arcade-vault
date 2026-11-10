"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionUser = { name: string };

type SessionContextValue = {
  // null para invitados, en el servidor y mientras se hidrata o carga el perfil.
  user: SessionUser | null;
  signOut: () => Promise<void>;
  // Vuelve a leer la sesión. Los formularios lo llaman tras iniciar sesión o crear el perfil,
  // porque ahí las cookies las escribe una Server Action y el navegador no recibe ningún evento.
  refresh: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Profile = { id: string; name: string };

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Sesión de Supabase (cookies). INITIAL_SESSION, SIGNED_IN, SIGNED_OUT y TOKEN_REFRESHED
  // llegan por aquí; el id solo cambia si cambia el usuario.
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Username público del usuario (profiles). Se lee aparte: no se debe llamar a Supabase
  // dentro del callback de onAuthStateChange.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data ? { id: userId, name: data.username } : null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const user = useMemo<SessionUser | null>(
    () => (userId && profile?.id === userId ? { name: profile.name } : null),
    [userId, profile],
  );

  const refresh = useCallback(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setUserId(data.session?.user.id ?? null));
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setUserId(null);
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ user, signOut, refresh }), [user, signOut, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
