import { Reveal } from "@/components/home/reveal";

export function AboutDivider() {
  return (
    <Reveal as="div" className="about-divider">
      <div className="div-bar" aria-hidden="true"></div>
      <div className="div-pixels" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
        ))}
      </div>
      <div className="div-bar" aria-hidden="true"></div>
    </Reveal>
  );
}
