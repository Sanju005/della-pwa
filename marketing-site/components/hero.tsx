"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, Clock, Lock, Headphones } from "lucide-react";
import { ProviderMontage } from "./provider-montage";
import { DownloadComingSoonModal } from "./download-coming-soon-modal";

const trustPoints = [
  { icon: ShieldCheck, label: "Verified Professionals" },
  { icon: Clock, label: "On-Demand Booking" },
  { icon: Lock, label: "Secure Payments" },
  { icon: Headphones, label: "24/7 Support" },
];

export function Hero() {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  return (
    <>
    <section className="relative overflow-hidden bg-ink px-6 pb-16 pt-28 sm:pb-24">
      {/* Darker on the left for text contrast, a brighter purple glow
          building toward the bottom-right, behind the phone/provider
          montage — mirrors the reference's lighting direction. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_90%,_rgba(142,94,181,0.5),_transparent_55%),radial-gradient(ellipse_at_0%_0%,_rgba(100,83,148,0.25),_transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-25%] right-[-15%] h-[75%] w-[75%] rounded-full bg-accent/30 blur-[150px]"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-6">
        <div className="text-center lg:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-[4rem]"
          >
            Find the right
            <br />
            service{" "}
            <span className="bg-gradient-to-r from-accent to-primary-soft bg-clip-text text-transparent">
              faster.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: "easeOut" }}
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0"
          >
            Book trusted chefs, maids, tutors, drivers, cleaners, babysitters,
            plumbers, electricians and more from one simple Swiper app.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34, ease: "easeOut" }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <button
              type="button"
              onClick={() => setShowDownloadModal(true)}
              className="rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_-12px_rgba(142,94,181,0.7)] transition hover:bg-accent/90"
            >
              Download the App
            </button>
            <Link
              href="/about"
              className="rounded-full border-2 border-accent/70 bg-transparent px-8 py-4 text-sm font-semibold text-white transition hover:bg-accent/10"
            >
              About Swiper
            </Link>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.46, ease: "easeOut" }}
            className="mx-auto mt-14 grid max-w-md grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:mx-0"
          >
            {trustPoints.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 lg:items-start">
                <Icon className="size-6 text-accent" strokeWidth={1.75} />
                <dt className="text-center text-xs font-medium leading-tight text-white/70 lg:text-left">
                  {label}
                </dt>
              </div>
            ))}
          </motion.dl>
        </div>

        <ProviderMontage />
      </div>
    </section>
    <DownloadComingSoonModal
      open={showDownloadModal}
      onClose={() => setShowDownloadModal(false)}
    />
    </>
  );
}
