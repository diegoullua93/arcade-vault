"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type SessionUser = { name: string };

type SessionContextValue = {
  user: SessionUser | null;
  login: (user: SessionUser | null) => void;
  signOut: () => void;
};

const STORAGE_KEY = "av_user";
const listeners = new Set<() => void>();

// Copia en memoria: respaldo si localStorage está bloqueado (modo privado).
let memoryValue: string | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryValue;
  }
}

function writeRaw(value: string | null) {
  memoryValue = value;
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // El servidor y la hidratación ven null (invitado); el valor real llega tras montar.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  const user = useMemo<SessionUser | null>(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.name === "string" ? { name: parsed.name } : null;
    } catch {
      return null;
    }
  }, [raw]);

  const login = useCallback((u: SessionUser | null) => {
    writeRaw(u ? JSON.stringify(u) : null);
  }, []);
  const signOut = useCallback(() => writeRaw(null), []);

  const value = useMemo(() => ({ user, login, signOut }), [user, login, signOut]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
