import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { ServicesGrid } from "@/components/services-grid";
import { TrustSafety } from "@/components/trust-safety";
import { ForProviders } from "@/components/for-providers";
import { NewsMedia } from "@/components/news-media";

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <ServicesGrid />
      <TrustSafety />
      <ForProviders />
      <NewsMedia />
    </main>
  );
}
