import { FeatureIcon } from "@/components/home/feature-icon";
import { Reveal } from "@/components/home/reveal";
import { SectionHead } from "@/components/home/section-head";
import { FEATURES } from "@/lib/home";

export function WhySection() {
  return (
    <Reveal className="home-section">
      <SectionHead kicker="// 01" color="magenta" title="¿POR QUÉ ARCADE VAULT?" />
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
  );
}
