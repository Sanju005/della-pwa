"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ReceiptText, MessageCircle } from "lucide-react";
import { SectionHeading } from "./how-it-works";

const points = [
  {
    icon: ShieldCheck,
    title: "Identity-verified providers",
    body: "Every provider submits government ID for review before their profile goes live — reviewed by our team, not just self-declared.",
  },
  {
    icon: ReceiptText,
    title: "Clear pricing, every time",
    body: "Rates are set by the provider up front. The final amount is confirmed before you pay — no surprise charges.",
  },
  {
    icon: MessageCircle,
    title: "Real reviews from real jobs",
    body: "Ratings are only left after a completed booking, so what you read reflects actual work, not marketing.",
  },
];

export function TrustSafety() {
  return (
    <section id="trust" className="px-6 py-24">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-border bg-surface px-6 py-16 sm:px-12">
        <SectionHeading
          eyebrow="Trust & safety"
          title="Verification isn't a checkbox here"
          body="Bringing someone into your home is a big decision. Swiper is built around that, not around it."
        />

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {points.map(({ icon: Icon, title, body }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
              className="text-center sm:text-left"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft sm:mx-0">
                <Icon className="size-6 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
