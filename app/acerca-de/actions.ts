"use server";

import { Resend } from "resend";
import { CONTACT_LIMITS, type ContactInput, type ContactResult } from "@/lib/contact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Quita saltos de línea y caracteres de control: evita inyectar cabeceras en el asunto.
function oneLine(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
    : "";
}

export async function sendContactMessage(
  input: ContactInput & { website?: string },
): Promise<ContactResult> {
  const name = oneLine(input?.name);
  const email = oneLine(input?.email);
  const message = typeof input?.message === "string" ? input.message.trim() : "";

  // Honeypot: un bot rellena el campo oculto. Respondemos éxito sin enviar nada.
  if (typeof input?.website === "string" && input.website.trim() !== "") {
    return { ok: true, name };
  }

  if (
    !name ||
    !email ||
    !message ||
    name.length > CONTACT_LIMITS.name ||
    email.length > CONTACT_LIMITS.email ||
    message.length > CONTACT_LIMITS.message ||
    !EMAIL_RE.test(email)
  ) {
    return { ok: false, error: "invalid" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    console.error("[contacto] Faltan RESEND_API_KEY, CONTACT_TO_EMAIL o CONTACT_FROM_EMAIL");
    return { ok: false, error: "send_failed" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`,
    });
    if (error) {
      console.error("[contacto] Resend rechazó el envío:", error.message);
      return { ok: false, error: "send_failed" };
    }
  } catch (err) {
    console.error("[contacto] Fallo al enviar:", err);
    return { ok: false, error: "send_failed" };
  }

  return { ok: true, name };
}
