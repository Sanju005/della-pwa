"use client";

import { motion } from "framer-motion";
import { Send, UserCheck, MapPin, Star } from "lucide-react";

const steps = [
  {
    icon: Send,
    title: "Request a service",
    body: "Pick a category, describe the job, and choose a time — hourly or daily, whichever fits.",
  },
  {
    icon: UserCheck,
    title: "A verified provider accepts",
    body: "Every provider on Swiper goes through identity verification before they can take a booking.",
  },
  {
    icon: MapPin,
    title: "Track them on the way",
    body: "See status updates in real time — accepted, on the way, arrived, job finished.",
  },
  {
    icon: Star,
    title: "Pay and review",
    body: "Confirm the final amount, submit payment, and leave a review for the next customer.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="How it works"
          title="From request to done, in four steps"
          body="No back-and-forth calls, no guessing who's coming. Every booking moves through the same clear, trackable flow."
        />

        <div className="mt-16 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
              className="relative flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center"
            >
              <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft">
                <Icon className="size-8 text-primary" strokeWidth={2} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="mx-auto max-w-2xl text-center"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-accent">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{title}</h2>
      {body ? (
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{body}</p>
      ) : null}
    </motion.div>
  );
}
