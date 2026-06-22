import Hero from "@/components/blocks/Hero";
import TrustSection from "@/components/blocks/TrustSection";
import FeatureSection from "@/components/blocks/FeatureSection";
import HowItWorksSection from "@/components/blocks/HowItWorksSection";
import WordGeneratorSection from "@/components/blocks/WordGeneratorSection";
import TestimonialsSection from "@/components/blocks/TestimonialsSection";
import CTASection from "@/components/blocks/CTASection";

export default function Home() {
  return (
    <main>
      <Hero />
      <TrustSection />
      <FeatureSection />
      <HowItWorksSection />
      <WordGeneratorSection />
      <TestimonialsSection />
      <CTASection />
    </main>
  );
}
