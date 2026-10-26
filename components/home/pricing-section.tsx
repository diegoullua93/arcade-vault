import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { SectionHead } from "@/components/home/section-head";
import { FAQ, PRICING_FEATURES } from "@/lib/home";

function PriceCard() {
  return (
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
  );
}

function PricingFaq() {
  return (
    <div className="pricing-faq">
      {FAQ.map((f) => (
        <div key={f.q} className="faq-item">
          <div className="faq-q pixel">{f.q}</div>
          <div className="faq-a">{f.a}</div>
        </div>
      ))}
    </div>
  );
}

export function PricingSection() {
  return (
    <Reveal className="home-section">
      <SectionHead kicker="// 04" color="green" title="PRECIOS" />
      <div className="pricing-grid">
        <PriceCard />
        <PricingFaq />
      </div>
    </Reveal>
  );
}
