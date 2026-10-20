import Link from "next/link";
import { FeatureIcon } from "@/components/home/feature-icon";
import { MiniCard } from "@/components/home/mini-card";
import { Reveal } from "@/components/home/reveal";
import { Silhouettes } from "@/components/home/silhouettes";
import { GAMES } from "@/lib/games";
import {
  FAQ,
  FEATURES,
  PRICING_FEATURES,
  RECENT_SCORES,
  STATS,
  TOP_PLAYERS,
} from "@/lib/home";

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

        {/* STATS */}
        <Reveal className="home-stats">
          <div className="stats-inner">
            {STATS.map((st, i) => (
              <div
                key={st.u}
                className="stat-block"
                style={{ transitionDelay: i * 90 + "ms" }}
              >
                <div className="stat-n neon-yellow">{st.n}</div>
                <div className="stat-u pixel">{st.u}</div>
                <div className="stat-s">{st.s}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* RECENT ACTIVITY / LEADERBOARD */}
        <Reveal className="home-section">
          <div className="section-head">
            <div className="kicker pixel neon-yellow">{"// 03"}</div>
            <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
            <div className="section-rule"></div>
          </div>
          <div className="activity-grid">
            <div className="activity-card">
              <div className="ac-head">
                <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
              </div>
              <div className="ticker">
                {RECENT_SCORES.map((r, i) => (
                  <div
                    key={r.player}
                    className="tick-row"
                    style={{ animationDelay: i * 60 + "ms" }}
                  >
                    <span className={"tk-p neon-" + r.color}>{r.player}</span>
                    <span className="tk-mid">▸ {r.game}</span>
                    <span className="tk-s">+{r.score.toLocaleString("es-ES")}</span>
                    <span className="tk-t">{r.ago}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="activity-card">
              <div className="ac-head">
                <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
                <Link href="/salon" className="lb-link">
                  VER SALÓN →
                </Link>
              </div>
              <div className="top-list">
                {TOP_PLAYERS.map((r, i) => (
                  <div
                    key={r.player}
                    className={
                      "top-row" + (i < 3 ? ` top${i + 1}` : "")
                    }
                  >
                    <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
                    <span className="tp-bar">
                      <span className="tp-fill" style={{ width: 100 - i * 16 + "%" }}></span>
                    </span>
                    <span className="tp-p">{r.player}</span>
                    <span className="tp-s">{r.score.toLocaleString("es-ES")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* PRICING */}
        <Reveal className="home-section">
          <div className="section-head">
            <div className="kicker pixel neon-green">{"// 04"}</div>
            <h2 className="section-title">PRECIOS</h2>
            <div className="section-rule"></div>
          </div>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="pc-label pixel">PLAN ÚNICO</div>
              <div className="pc-name pixel">JUGADOR VAULT</div>
              <div className="pc-amount">
                <span className="pc-amount-n">$0</span>
                <span className="pc-amount-u">/ SIEMPRE</span>
              </div>
              <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
              <ul className="pc-list">
                {PRICING_FEATURES.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href="/auth" className="btn xl pulse" style={{ width: "100%" }}>
                EMPEZAR GRATIS →
              </Link>
              <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
              <div className="pc-stamp pixel">
                FREE
                <br />
                PLAY
              </div>
            </div>

            <div className="pricing-faq">
              {FAQ.map((f) => (
                <div key={f.q} className="faq-item">
                  <div className="faq-q pixel">{f.q}</div>
                  <div className="faq-a">{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* FINAL CTA */}
        <Reveal className="home-final">
          <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
          <Link href="/biblioteca" className="btn xl pulse final-cta">
            INSERTAR MONEDA →
          </Link>
          <div className="final-tag">
            Gratis. Sin registro obligatorio. Empieza en segundos.
          </div>
        </Reveal>
      </div>
    </main>
  );
}
