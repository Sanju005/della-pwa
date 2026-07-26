import type { Metadata } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AppEntryPage } from "@/app/_components/app-entry-page";
import { Header } from "@/components/marketing/Header";
import { Hero } from "@/components/marketing/Hero";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

function isMarketingHost(host: string) {
  return host.startsWith("myswiper.my") || host.startsWith("www.myswiper.my");
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";

  if (!isMarketingHost(host)) {
    return {
      title: "Swiper",
    };
  }

  return {
    title: "Swiper | Find Trusted Local Services Near You",
    description:
      "Find trusted chefs, maids, drivers, plumbers, technicians and other local professionals near you at reasonable rates with Swiper.",
    alternates: {
      canonical: "https://myswiper.my",
    },
    openGraph: {
      url: "https://myswiper.my",
      title: "Swiper | Find Trusted Local Services Near You",
      description:
        "Find trusted chefs, maids, drivers, plumbers, technicians and other local professionals near you at reasonable rates with Swiper.",
    },
  };
}

export default async function RootPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";

  if (!isMarketingHost(host)) {
    return <AppEntryPage />;
  }

  return (
    <main
      className={`${plusJakartaSans.className} min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(210,189,248,0.18),transparent_32%),linear-gradient(180deg,#ffffff_0%,#fdfbff_54%,#faf7ff_100%)] text-[#11153D]`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_18%_24%,rgba(224,208,255,0.52),rgba(255,255,255,0)_33%),radial-gradient(circle_at_77%_20%,rgba(229,216,255,0.40),rgba(255,255,255,0)_28%)]" />
      <Header />
      <Hero />
    </main>
  );
}
