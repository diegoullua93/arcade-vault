"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_SKIN, isSkinId, type SkinId } from "@/lib/games/skins";

// Vista elegida, persistida en localStorage (`av_skin`). Mismo patrón que la sesión mock:
// el servidor y la hidratación ven DEFAULT_SKIN; el valor guardado llega tras montar.
const STORAGE_KEY = "av_skin";
const listeners = new Set<() => void>();

// Copia en memoria: respaldo si localStorage está bloqueado (modo privado).
let memoryValue: SkinId = DEFAULT_SKIN;

function read(): SkinId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isSkinId(raw) ? raw : DEFAULT_SKIN;
  } catch {
    return memoryValue;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// false durante la hidratación, true después. Durante la hidratación `useSkin` devuelve DEFAULT_SKIN
// aunque haya otra guardada: quien cree algo costoso según la vista (el motor del juego) espera a
// que esto sea true para no construir y descartar uno con la vista equivocada.
const noopSubscribe = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useSkin(): [SkinId, (skin: SkinId) => void] {
  const skin = useSyncExternalStore(subscribe, read, () => DEFAULT_SKIN);
  const setSkin = useCallback((next: SkinId) => {
    memoryValue = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    listeners.forEach((l) => l());
  }, []);
  return [skin, setSkin];
}
