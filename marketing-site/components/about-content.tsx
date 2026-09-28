"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  MapPinned,
  Wallet,
  Headphones,
  ChefHat,
  SprayCan,
  GraduationCap,
  Car,
  Sparkles,
  Baby,
  Wrench,
  Zap,
} from "lucide-react";
import { SectionHeading } from "./how-it-works";
import { DownloadComingSoonModal } from "./download-coming-soon-modal";

const pillars = [
  {
    icon: ShieldCheck,
    title: "Verified providers",
    body: "Every provider submits a government ID for review before their profile goes live.",
  },
  {
    icon: MapPinned,
    title: "Real-time tracking",
    body: "See every stage of your booking — accepted, on the way, arrived, done.",
  },
  {
    icon: Wallet,
    title: "Transparent payments",
    body: "Pay in cash with photo proof — a clear record for both sides, no hidden fees.",
  },
  {
    icon: Headphones,
    title: "Support when you need it",
    body: "Help is available whenever a booking needs a human.",
  },
];

const categories = [
  { icon: ChefHat, label: "Chef" },
  { icon: SprayCan, label: "Maid" },
  { icon: GraduationCap, label: "Tutor" },
  { icon: Car, label: "Driver" },
  { icon: Sparkles, label: "Cleaner" },
  { icon: Baby, label: "Babysitter" },
  { icon: Wrench, label: "Plumber" },
  { icon: Zap, label: "Electrician" },
];

export function AboutContent() {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  return (
    <>
      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Our mission
            </span>
            <h2 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
              Why we&apos;re building Swiper
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-muted">
              Finding someone trustworthy for a one-off job — a leaking pipe,
              a last-minute babysitter, dinner for guests — usually means
              asking around, hoping a stranger&apos;s number checks out, and
              negotiating in the dark.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              Swiper replaces that with a single app. Every provider is
              identity-verified before they can accept a booking, every job
              is tracked from request to completion, and every payment has a
              clear paper trail — built for how home services actually get
              booked in Malaysia.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="relative mx-auto flex h-72 w-full max-w-sm items-center justify-center"
          >
            <div
              aria-hidden
              className="absolute h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(142,94,181,0.3),_transparent_70%)] blur-2xl"
            />
            {categories.map(({ icon: Icon, label }, index) => {
              const angle = (index / categories.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 108;
              const x = Math.cos(angle) * radius - 28;
              const y = Math.sin(angle) * radius - 28;
              return (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.6, x, y }}
                  whileInView={{ opacity: 1, scale: 1, x, y: [y, y - 8, y] }}
                  viewport={{ once: true }}
                  transition={{
                    opacity: { duration: 0.5, delay: 0.2 + index * 0.06 },
                    scale: { duration: 0.5, delay: 0.2 + index * 0.06 },
                    x: { duration: 0.5, delay: 0.2 + index * 0.06 },
                    y: {
                      duration: 3.5,
                      delay: 1 + index * 0.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                  className="absolute left-1/2 top-1/2 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface shadow-[0_16px_32px_-16px_rgba(31,27,46,0.3)]"
                  title={label}
                >
                  <Icon className="size-6 text-primary" strokeWidth={1.75} />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="What makes it different"
            title="Built around trust, not just convenience"
            body="Bringing someone into your home is a big decision. Every part of Swiper is designed around that."
          />

          <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {pillars.map(({ icon: Icon, title, body }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (index % 4) * 0.08, ease: "easeOut" }}
                className="flex flex-col items-center rounded-2xl border border-white/10 bg-primary p-5 text-center"
              >
                <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="size-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{body}</p>
              </motion.div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-ink-muted">
            Eight categories, one app —{" "}
            <Link
              href="/#services"
              className="font-semibold text-primary underline underline-offset-2"
            >
              see all services
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-2xl rounded-[32px] border border-border bg-surface px-8 py-14 text-center"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            Where we are
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">
            Swiper is currently in development
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-muted">
            We&apos;re putting the finishing touches on the app before it
            launches. Want to know the moment it&apos;s ready?
          </p>
          <button
            type="button"
            onClick={() => setShowDownloadModal(true)}
            className="mt-8 inline-block rounded-full bg-primary px-8 py-4 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Get notified
          </button>
        </motion.div>
      </section>

      <DownloadComingSoonModal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </>
  );
}
