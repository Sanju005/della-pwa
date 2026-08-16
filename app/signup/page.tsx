import Link from "next/link";
import { AnimatedSwiperLogo } from "@/app/_components/animated-swiper-logo";
import { RegisterHeader, RegisterShell, RegisterTitle } from "../register/_components/register-ui";

export default function SignupPage() {
  return (
    <RegisterShell>
      <RegisterHeader showBack backHref="/" />
      <RegisterTitle
        title="Create your account"
        subtitle="Join as a User or Service Provider and get started with Swiper."
      />

      <div className="mt-8 space-y-5">
        <ChoiceCard
          href="/signup/user"
          title="I'm a User"
          description="Book trusted services for your home and lifestyle needs."
          features={["Book Services", "Secure Payments", "Track Bookings", "24/7 Support"]}
          role="user"
        />
        <ChoiceCard
          href="/provider/register"
          title="I'm a Service Provider"
          description="Offer your services, grow your business, and reach more customers."
          features={["Manage Jobs", "Grow Business", "Secure Earnings", "Flexible Schedule"]}
          role="provider"
        />
      </div>

      <div className="mt-8 rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(166,121,207,0.18),_transparent_48%),linear-gradient(180deg,#fdfbff_0%,#f6f0fc_100%)] px-6 py-8 text-center shadow-[0_18px_36px_rgba(67,35,104,0.08)]">
        <AnimatedSwiperLogo className="scale-[0.94]" />
        <p className="mt-4 text-[14px] leading-7 text-[#4b5563]">
          Swiper connects people with trusted home and lifestyle services across one simple app.
        </p>
      </div>

      <p className="mt-7 text-center text-[15px] text-[#4b5563]">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-[#8E5EB5]">
          Log in
        </Link>
      </p>
    </RegisterShell>
  );
}

function ChoiceCard({
  href,
  title,
  description,
  features,
  role,
}: {
  href: string;
  title: string;
  description: string;
  features: string[];
  role: "user" | "provider";
}) {
  return (
    <Link
      href={href}
      className="block rounded-[24px] border border-[#e4d7f3] bg-white p-5 shadow-[0_16px_30px_rgba(67,35,104,0.08)]"
    >
      <div className="flex items-start gap-4">
        <div className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f2e9fb_0%,#e4d3f7_100%)] text-[28px] font-extrabold text-[#8E5EB5]">
          {role === "user" ? <UserBadgeIllustration /> : <ProviderBadgeIllustration />}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-extrabold tracking-[-0.04em] text-[#111827]">
                {title}
              </h2>
              <p className="mt-2 text-[15px] leading-7 text-[#4b5563]">
                {description}
              </p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f3ebfc] text-[22px] font-bold text-[#8E5EB5]">
              →
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {features.map((feature) => (
          <div
            key={feature}
            className="rounded-[14px] bg-[#faf6fe] px-3 py-2 text-[12px] font-semibold text-[#4d4361]"
          >
            {feature}
          </div>
        ))}
      </div>
    </Link>
  );
}

function UserBadgeIllustration() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
      <defs>
        <linearGradient id="user-badge-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A679CF" />
          <stop offset="100%" stopColor="#8E5EB5" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="23" r="10" fill="url(#user-badge-fill)" />
      <path
        d="M17 49c2.9-7.8 8.8-11.7 15-11.7 6.2 0 12.1 3.9 15 11.7"
        fill="none"
        stroke="url(#user-badge-fill)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="45" cy="18" r="5.5" fill="#F5EEFF" />
      <path
        d="M45 15v6M42 18h6"
        stroke="#8E5EB5"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProviderBadgeIllustration() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
      <defs>
        <linearGradient id="provider-badge-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A679CF" />
          <stop offset="100%" stopColor="#8E5EB5" />
        </linearGradient>
      </defs>
      <circle cx="23" cy="24" r="9" fill="url(#provider-badge-fill)" />
      <path
        d="M12 49c2.5-6.8 7.7-10.5 13-10.5 3.5 0 6.8 1.4 9.6 4.2"
        fill="none"
        stroke="url(#provider-badge-fill)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="36" y="18" width="15" height="18" rx="3.5" fill="#F5EEFF" stroke="#8E5EB5" strokeWidth="2.5" />
      <path d="M40 18v-2.8a3.5 3.5 0 0 1 7 0V18" fill="none" stroke="#8E5EB5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m40.5 28.5 3 3 5.5-6.5" fill="none" stroke="#8E5EB5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
