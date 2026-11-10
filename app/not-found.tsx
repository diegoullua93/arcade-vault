import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada · Arcade Vault",
};

export default function NotFound() {
  return (
    <main className="av-main">
      <section className="av-hero fade-in">
        <h1>404</h1>
        <p className="sub">
          ESTA PÁGINA NO EXISTE<span className="blink">_</span>
        </p>
        <p className="mx-auto mt-6 max-w-[48ch] text-[var(--ink-dim)]">
          La dirección que escribiste no está en la bóveda. Revisa que esté bien escrita o vuelve al
          inicio.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn lg">
            VOLVER AL INICIO
          </Link>
          <Link href="/biblioteca" className="btn lg ghost">
            VER BIBLIOTECA
          </Link>
        </div>
      </section>
    </main>
  );
}
