import { AboutDivider } from "@/components/about/about-divider";
import { AboutHero } from "@/components/about/about-hero";

export default function AcercaDePage() {
  return (
    <main className="av-main">
      <div className="about fade-in">
        <AboutHero />
        <AboutDivider />
      </div>
    </main>
  );
}
