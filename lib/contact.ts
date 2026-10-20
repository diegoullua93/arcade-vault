export const CONTACT_LIMITS = { name: 60, email: 120, message: 2000 } as const;

export type ContactInput = {
  name: string;
  email: string;
  message: string;
};

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "send_failed" };

export type Highlight = {
  icon: "HEART" | "BROWSER" | "PLANT";
  text: string;
  color: "magenta" | "cyan" | "green";
};

export type ContactTip = { text: string; led?: "y" | "m" };

export const HIGHLIGHTS: Highlight[] = [
  { icon: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  {
    icon: "BROWSER",
    text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR",
    color: "cyan",
  },
  { icon: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

export const CONTACT_TIPS: ContactTip[] = [
  { text: "RESPUESTA EN 24-48H" },
  { text: "SUGERENCIAS BIENVENIDAS", led: "y" },
  { text: "SIN SPAM, JAMÁS", led: "m" },
];
