import Link from "next/link";
import { FeatureIcon } from "@/components/home/feature-icon";
import { MiniCard } from "@/components/home/mini-card";
import { Reveal } from "@/components/home/reveal";
import { Silhouettes } from "@/components/home/silhouettes";
import { GAMES } from "@/lib/games";
import { FEATURES } from "@/lib/home";

export default function Home() {
  return (
    <main className="av-main">
      <div className="home fade-in">
        {/* HERO */}
        <section className="home-hero">
          <Silhouettes />
          <div className="home-hero-inner">
            <div className="hero-eyebrow pixel neon-yellow">
              ▸ INSERTA UNA MONEDA<span className="blink">_</span>
            </div>
            <h1 className="home-title">
              <span className="line-1">EL ARCADE</span>
              <span className="line-2">CLÁSICO ESTÁ</span>
              <span className="line-3">DE VUELTA</span>
            </h1>
            <p className="home-sub">
              Juega los mejores clásicos directamente en tu navegador.
              <br />
              Sin descargas. Sin costo. Solo diversión.
            </p>
            <div className="home-ctas">
              <Link href="/biblioteca" className="btn xl pulse">
                ▶ EXPLORAR JUEGOS
              </Link>
              <Link href="/auth" className="btn xl magenta">
                ✦ CREAR CUENTA
              </Link>
            </div>
            <div className="hero-scroll" aria-hidden="true">
              <span>DESLIZA</span>
              <span className="arrow">▼</span>
            </div>
          </div>
        </section>

        {/* WHY */}
        <Reveal className="home-section">
          <div className="section-head">
            <div className="kicker pixel neon-magenta">{"// 01"}</div>
            <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
            <div className="section-rule"></div>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <div
                key={f.icon}
                className={"feature-card " + f.color}
                style={{ transitionDelay: i * 80 + "ms" }}
              >
                <FeatureIcon kind={f.icon} />
                <div className="ft-title pixel">{f.title}</div>
                <div className="ft-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* GAMES PREVIEW */}
        <Reveal className="home-section">
          <div className="section-head">
            <div className="kicker pixel neon-cyan">{"// 02"}</div>
            <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
            <div className="section-rule"></div>
          </div>
          <div className="mini-rail">
            {GAMES.slice(0, 6).map((g) => (
              <MiniCard key={g.id} game={g} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/biblioteca" className="btn lg">
              VER TODOS LOS JUEGOS →
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
