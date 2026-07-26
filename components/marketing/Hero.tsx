import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Headphones,
  Star,
  Users,
} from "lucide-react";

import { FeatureItem } from "./FeatureItem";
import { HeroVisual } from "./HeroVisual";
import { StatsBar } from "./StatsBar";

// Placeholder marketing figures until final business-approved numbers are confirmed.
const marketingStats = [
  { value: "10K+", label: "Happy Customers", icon: Users },
  { value: "5K+", label: "Verified Professionals", icon: BadgeCheck },
  { value: "50K+", label: "Services Completed", icon: CalendarDays },
  { value: "4.8/5", label: "Customer Rating", icon: Star },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-10">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 pt-3 sm:px-6 lg:min-h-[740px] lg:flex-row lg:items-center lg:gap-6 lg:px-8 xl:px-10">
        <div className="w-full lg:w-[43%]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,rgba(137,104,205,0.12)_0%,rgba(137,104,205,0.06)_100%)] px-5 py-3 text-[15px] font-semibold text-[#7751C7] shadow-[0_10px_20px_rgba(137,104,205,0.08)]">
            <Star className="h-4 w-4 fill-current" />
            <span>Your Everyday Help, Anytime</span>
          </div>

          <h1 className="mt-7 text-[clamp(2.75rem,7vw,5.7rem)] font-extrabold leading-[0.95] tracking-[-0.07em] text-[#11153D]">
            Find the Right
            <br />
            Service, Right
            <br />
            When{" "}
            <span className="bg-[linear-gradient(135deg,#7B49D3_0%,#A576F0_100%)] bg-clip-text text-transparent">
              You Need It
            </span>
          </h1>

          <p className="mt-8 max-w-[35rem] text-[clamp(1.05rem,2vw,1.65rem)] font-medium leading-[1.55] text-[#414777]">
            Swiper connects you with trusted local professionals
            <br className="hidden sm:block" />
            {" "}for home services, tutoring, repairs, beauty, and more
            <br className="hidden sm:block" />
            {" "}— all at reasonable rates.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <a
              href="https://app.myswiper.my"
              className="inline-flex h-17 items-center justify-center gap-3 rounded-[24px] bg-[linear-gradient(135deg,#8968CD_0%,#7444D2_100%)] px-8 text-[20px] font-bold text-white shadow-[0_18px_38px_rgba(137,104,205,0.28)]"
            >
              <span className="text-[22px]">↓</span>
              Download the App
            </a>
            <a
              href="https://app.myswiper.my"
              className="inline-flex h-17 items-center justify-center gap-4 rounded-[24px] border-2 border-[#D9C5F6] bg-white/92 px-8 text-[20px] font-bold text-[#7B49D3] shadow-[0_12px_24px_rgba(137,104,205,0.08)]"
            >
              Explore Services
              <ArrowRight className="h-6 w-6" />
            </a>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 sm:gap-x-8">
            <FeatureItem icon={BadgeCheck} label="Trusted Professionals" />
            <FeatureItem icon={CalendarDays} label="On-Demand Booking" />
            <FeatureItem icon={CreditCard} label="Secure Payments" />
            <FeatureItem icon={Headphones} label="24/7 Support" />
          </div>
        </div>

        <div className="w-full lg:w-[57%]">
          <HeroVisual />
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <StatsBar stats={marketingStats} />
      </div>
    </section>
  );
}
