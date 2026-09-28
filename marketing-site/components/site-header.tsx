"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export function SiteHeader() {
  const pathname = usePathname();
  const overDarkHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overDarkHero) {
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overDarkHero]);

  const transparent = overDarkHero && !scrolled;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        transparent
          ? "border-transparent bg-transparent"
          : "border-border/70 bg-paper/80 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Swiper"
            width={34}
            height={34}
            className="rounded-[9px]"
            priority
          />
          <span className="relative block h-6 w-[79px]">
            <Image
              src="/swiper-wordmark.png"
              alt="Swiper"
              fill
              className="object-contain object-left"
              priority
            />
            <span
              aria-hidden
              className="absolute inset-0 overflow-hidden"
              style={{
                WebkitMaskImage: "url(/swiper-wordmark.png)",
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "left center",
                maskImage: "url(/swiper-wordmark.png)",
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "left center",
              }}
            >
              <motion.span
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent"
                animate={{ x: ["-120%", "320%"] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatDelay: 1.4,
                  ease: "easeInOut",
                }}
              />
            </span>
          </span>
        </Link>

        <nav
          className={`hidden items-center gap-8 text-sm font-medium transition-colors duration-300 md:flex ${
            transparent ? "text-white/75" : "text-ink-muted"
          }`}
        >
          <Link
            href="/#how-it-works"
            className={transparent ? "transition hover:text-white" : "transition hover:text-ink"}
          >
            How it works
          </Link>
          <Link
            href="/#services"
            className={transparent ? "transition hover:text-white" : "transition hover:text-ink"}
          >
            Services
          </Link>
          <Link
            href="/#providers"
            className={transparent ? "transition hover:text-white" : "transition hover:text-ink"}
          >
            For providers
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
