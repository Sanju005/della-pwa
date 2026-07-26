import Image from "next/image";
import Link from "next/link";
import { Smartphone } from "lucide-react";

import { MobileMenu } from "./MobileMenu";

const navItems = [
  { label: "Home", href: "/", active: true },
  { label: "Services", href: "/services", active: false },
  { label: "For Providers", href: "/providers", active: false },
  { label: "How It Works", href: "/#how-it-works", active: false },
  { label: "About Us", href: "/about", active: false },
  { label: "Contact", href: "/contact", active: false },
] as const satisfies ReadonlyArray<{
  label: string;
  href: string;
  active?: boolean;
}>;

export function Header() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-[88px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[94px] lg:px-8 xl:px-10">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5">
          <Image
            src="/branding/swiper-icon.png"
            alt="Swiper icon"
            width={54}
            height={54}
            priority
            className="h-[36px] w-auto sm:h-[40px] lg:h-[50px]"
          />
          <Image
            src="/branding/swiper-wordmark.png"
            alt="Swiper"
            width={165}
            height={54}
            priority
            className="h-auto w-[100px] sm:w-[118px] lg:w-[154px]"
          />
        </Link>

        <nav className="hidden items-center justify-center gap-9 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative text-[15px] font-semibold transition ${
                item.active ? "text-[#8968CD]" : "text-[#191A45] hover:text-[#8968CD]"
              }`}
            >
              {item.label}
              {item.active ? (
                <span className="absolute left-1/2 top-[calc(100%+0.95rem)] h-[3px] w-10 -translate-x-1/2 rounded-full bg-[#8968CD]" />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="relative flex items-center gap-3">
          <a
            href="https://app.myswiper.my"
            className="hidden h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#8968CD_0%,#7342D1_100%)] px-5 text-[15px] font-bold text-white shadow-[0_16px_32px_rgba(137,104,205,0.22)] lg:inline-flex"
          >
            <Smartphone className="h-4.5 w-4.5" />
            Download App
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
