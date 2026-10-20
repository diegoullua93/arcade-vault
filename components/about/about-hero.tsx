import { HighlightIcon } from "@/components/about/highlight-icon";
import { HIGHLIGHTS } from "@/lib/contact";

export function AboutHero() {
  return (
    <section className="about-hero">
      <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
      <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
      <p className="about-mission">
        ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y
        celebrar los arcades que definieron una generación, haciéndolos accesibles para todos, en
        cualquier lugar y sin costo.
      </p>

      <div className="highlight-row">
        {HIGHLIGHTS.map((h, i) => (
          <div
            key={h.icon}
            className={"highlight " + h.color}
            style={{ transitionDelay: i * 80 + "ms" }}
          >
            <HighlightIcon kind={h.icon} />
            <div className="hl-text pixel">{h.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
