"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { sendContactMessage } from "@/app/acerca-de/actions";
import { CONTACT_LIMITS } from "@/lib/contact";

const EMPTY = { name: "", email: "", message: "" };

const ERROR_TEXT = {
  invalid: "[ERROR] Revisa los datos: usa un correo válido y un mensaje de hasta 2000 caracteres.",
  send_failed: "[ERROR] No se pudo enviar el mensaje. Inténtalo de nuevo.",
} as const;

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<keyof typeof ERROR_TEXT | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setShake(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await sendContactMessage({ ...form, website });
      if (result.ok) setSent(result.name);
      else setError(result.error);
    });
  };

  const reset = () => {
    setSent(null);
    setError(null);
    setForm(EMPTY);
    setWebsite("");
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      {sent === null ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              maxLength={CONTACT_LIMITS.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              maxLength={CONTACT_LIMITS.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-message">MENSAJE</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={form.message}
              maxLength={CONTACT_LIMITS.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
            ></textarea>
          </div>

          {/* Honeypot: invisible para personas, los bots lo rellenan. */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
          >
            <label htmlFor="contact-website">Sitio web</label>
            <input
              id="contact-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="term-body"
              style={{ padding: "0 0 14px", color: "var(--magenta)" }}
            >
              <div className="line" style={{ color: "var(--magenta)" }}>
                {ERROR_TEXT[error]}
              </div>
            </div>
          )}

          <button
            className="btn xl press"
            type="submit"
            disabled={pending}
            style={{ width: "100%" }}
          >
            {pending ? "ENVIANDO…" : "▶ ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sent.toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={reset}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
