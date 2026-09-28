"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Wallet,
  MapPinned,
  Users,
  Sparkles,
  Heart,
} from "lucide-react";
import { SectionHeading } from "./how-it-works";

const posts = [
  {
    tag: "Trust & Safety",
    title: "How Swiper verifies every provider",
    excerpt:
      "Every chef, cleaner, and technician on Swiper goes through an identity check before they can accept a single booking. Here's what that process looks like.",
    readTime: "4 min read",
    icon: ShieldCheck,
  },
  {
    tag: "Payments",
    title: "Cash payments, made simple",
    excerpt:
      "No cards on file, no surprise charges. Here's how Swiper's cash-plus-photo-proof flow keeps every payment clear for both sides.",
    readTime: "3 min read",
    icon: Wallet,
  },
  {
    tag: "How It Works",
    title: "Tracking your booking in real time",
    excerpt:
      "From request to reviewed — a look at the status updates that tell you exactly where your provider is.",
    readTime: "3 min read",
    icon: MapPinned,
  },
  {
    tag: "For Providers",
    title: "Becoming a Swiper provider: what to expect",
    excerpt:
      "From sign-up to your first booking — the verification steps, the tools you'll use, and how payouts work.",
    readTime: "5 min read",
    icon: Users,
  },
  {
    tag: "Tips",
    title: "5 questions to ask before booking a home cleaner",
    excerpt: "A quick checklist for getting the right person for the job, every time.",
    readTime: "3 min read",
    icon: Sparkles,
  },
  {
    tag: "Our Story",
    title: "Why we built Swiper for Malaysia's home services market",
    excerpt:
      "A short note from the team on the problem we set out to solve — and why trust had to come first.",
    readTime: "4 min read",
    icon: Heart,
  },
];

export function NewsMedia() {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const gap = 24;
    const distance = card ? card.offsetWidth + gap : track.clientWidth;
    track.scrollBy({ left: distance * direction, behavior: "smooth" });
  }

  return (
    <section id="news" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="News & Media"
            title="From the Swiper blog"
            body="Tips, product updates, and stories from behind the app."
          />
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Previous posts"
              className="flex size-10 items-center justify-center rounded-full border border-border text-ink-muted transition hover:border-primary/40 hover:text-primary"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Next posts"
              className="flex size-10 items-center justify-center rounded-full border border-border text-ink-muted transition hover:border-primary/40 hover:text-primary"
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <motion.div
          ref={trackRef}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {posts.map(({ tag, title, excerpt, readTime, icon: Icon }) => (
            <article
              key={title}
              className="w-full shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-surface lg:w-[calc((100%-3rem)/3)]"
            >
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-primary to-accent">
                <Icon className="size-12 text-white/90" strokeWidth={1.5} />
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                  {tag}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{excerpt}</p>
                <p className="mt-4 text-xs font-medium text-ink-faint">{readTime}</p>
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
