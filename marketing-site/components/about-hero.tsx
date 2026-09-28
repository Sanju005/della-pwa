"use client";

import { motion } from "framer-motion";
import {
  ChefHat,
  SprayCan,
  GraduationCap,
  Car,
  Sparkles,
  Baby,
  Wrench,
  Zap,
} from "lucide-react";

const cloudIcons = [
  { icon: ChefHat, className: "left-[6%] top-[14%]", delay: 0 },
  { icon: SprayCan, className: "left-[18%] top-[64%]", delay: 0.4 },
  { icon: GraduationCap, className: "left-[40%] top-[8%]", delay: 0.2 },
  { icon: Car, className: "right-[36%] top-[58%]", delay: 0.7 },
  { icon: Sparkles, className: "right-[18%] top-[12%]", delay: 0.5 },
  { icon: Baby, className: "right-[6%] top-[54%]", delay: 0.9 },
  { icon: Wrench, className: "left-[8%] top-[40%]", delay: 1.1 },
  { icon: Zap, className: "right-[10%] top-[34%]", delay: 0.3 },
];

export function AboutHero() {
  return (
    <section className="relative overflow-hidden bg-ink px-6 pb-20 pt-32 sm:pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(142,94,181,0.35),_transparent_55%)]"
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
        {cloudIcons.map(({ icon: Icon, className, delay }, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.6, delay: 0.3 + delay },
              scale: { duration: 0.6, delay: 0.3 + delay },
              y: { duration: 4.5, delay: 1 + delay, repeat: Infinity, ease: "easeInOut" },
            }}
            className={`absolute flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md ${className}`}
          >
            <Icon className="size-5 text-white/70" strokeWidth={1.75} />
          </motion.div>
        ))}
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-wide text-accent-soft"
        >
          About Swiper
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Home services,{" "}
          <span className="bg-gradient-to-r from-accent to-primary-soft bg-clip-text text-transparent">
            without the guesswork.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.22, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
        >
          Swiper is a Malaysia-first marketplace connecting you with
          identity-verified chefs, cleaners, tutors, drivers, and more —
          booked, tracked, and paid for in one simple app.
        </motion.p>
      </div>
    </section>
  );
}
