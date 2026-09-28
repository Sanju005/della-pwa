"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { DownloadComingSoonModal } from "./download-coming-soon-modal";

const benefits = [
  "Set your own hourly and daily rates per service",
  "Build a public profile with your work photos and reviews",
  "Get booking requests directly — no bidding, no lead fees",
  "Get paid once the customer confirms the job is done",
];

export function ForProviders() {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  return (
    <section id="providers" className="px-6 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 rounded-[32px] bg-primary px-6 py-16 sm:px-12 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-soft">
            For providers
          </span>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Turn your skill into a steady stream of bookings
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-primary-soft sm:text-base">
            Register in minutes, verify your identity once, and start
            receiving real requests from customers near you — as a chef,
            maid, tutor, driver, cleaner, babysitter, plumber, or
            electrician.
          </p>
          <button
            type="button"
            onClick={() => setShowDownloadModal(true)}
            className="mt-8 inline-block rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-primary-dark transition hover:bg-accent-soft"
          >
            Register as a provider
          </button>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="space-y-4"
        >
          {benefits.map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-3 rounded-2xl bg-white/10 px-5 py-4 text-sm text-white backdrop-blur-sm"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-soft" strokeWidth={2} />
              <span className="leading-relaxed">{benefit}</span>
            </li>
          ))}
        </motion.ul>
      </div>

      <DownloadComingSoonModal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </section>
  );
}
