import type { NeonColor } from "@/lib/home";

type SectionHeadProps = {
  kicker: string;
  color: NeonColor;
  title: string;
};

export function SectionHead({ kicker, color, title }: SectionHeadProps) {
  return (
    <div className="section-head">
      <div className={`kicker pixel neon-${color}`}>{kicker}</div>
      <h2 className="section-title">{title}</h2>
      <div className="section-rule"></div>
    </div>
  );
}
