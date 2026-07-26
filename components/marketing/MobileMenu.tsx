"use client";

import Link from "next/link";
import { Menu, Smartphone, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "For Providers", href: "/providers" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-controls="marketing-mobile-menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#EBE2FB] bg-white text-[#2B2750] shadow-[0_12px_24px_rgba(137,104,205,0.10)]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          id="marketing-mobile-menu"
          className="absolute inset-x-0 top-[calc(100%+0.85rem)] z-40 rounded-[28px] border border-[#EEE6FC] bg-white/96 p-5 shadow-[0_28px_54px_rgba(111,76,182,0.18)] backdrop-blur"
        >
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-[15px] font-semibold text-[#23214B] transition hover:bg-[#F7F2FE] hover:text-[#8968CD]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href="https://app.myswiper.my"
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#8968CD_0%,#7444D2_100%)] px-5 text-[15px] font-bold text-white shadow-[0_16px_32px_rgba(137,104,205,0.26)]"
          >
            <Smartphone className="h-4.5 w-4.5" />
            Download App
          </a>
        </div>
      ) : null}
    </div>
  );
}
