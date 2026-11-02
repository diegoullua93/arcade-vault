import { ActivitySection } from "@/components/home/activity-section";
import { FinalCtaSection } from "@/components/home/final-cta-section";
import { GamesSection } from "@/components/home/games-section";
import { HeroSection } from "@/components/home/hero-section";
import { PricingSection } from "@/components/home/pricing-section";
import { StatsSection } from "@/components/home/stats-section";
import { WhySection } from "@/components/home/why-section";
import { getGames } from "@/lib/queries/games";

export default async function Home() {
  const games = await getGames();

  return (
    <main className="av-main">
      <div className="home fade-in">
        <HeroSection />
        <WhySection />
        <GamesSection games={games} />
        <StatsSection gameCount={games.length} />
        <ActivitySection />
        <PricingSection />
        <FinalCtaSection />
      </div>
    </main>
  );
}
