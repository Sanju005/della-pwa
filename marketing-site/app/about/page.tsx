import type { Metadata } from "next";
import { AboutHero } from "@/components/about-hero";
import { AboutContent } from "@/components/about-content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Swiper is a Malaysia-first marketplace connecting you with identity-verified chefs, cleaners, tutors, drivers, and more.",
};

export default function AboutPage() {
  return (
    <main>
      <AboutHero />
      <AboutContent />
    </main>
  );
}
