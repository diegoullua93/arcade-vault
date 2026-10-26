import type { Metadata } from "next";
import { AboutDivider } from "@/components/about/about-divider";
import { AboutHero } from "@/components/about/about-hero";
import { ContactSection } from "@/components/about/contact-section";

export const metadata: Metadata = {
  title: "Acerca de · Arcade Vault",
};

export default function AcercaDePage() {
  return (
    <main className="av-main">
      <div className="about fade-in">
        <AboutHero />
        <AboutDivider />
        <ContactSection />
      </div>
    </main>
  );
}
