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
import { SectionHeading } from "./how-it-works";

const services = [
  { icon: ChefHat, name: "Chef", body: "Home-cooked meals, meal prep, and private events." },
  { icon: SprayCan, name: "Maid", body: "Regular housekeeping, laundry, and daily upkeep." },
  { icon: GraduationCap, name: "Tutor", body: "Subject tuition and exam prep, at home." },
  { icon: Car, name: "Driver", body: "Airport runs, errands, and scheduled trips." },
  { icon: Sparkles, name: "Cleaner", body: "Deep cleans and one-off resets for any space." },
  { icon: Baby, name: "Babysitter", body: "Trusted childcare for a few hours or a full day." },
  { icon: Wrench, name: "Plumber", body: "Leaks, installs, and repairs done right." },
  { icon: Zap, name: "Electrician", body: "Wiring, fixtures, and safety checks." },
];

export function ServicesGrid() {
  return (
    <section id="services" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Services"
          title="Eight categories, one trusted app"
          body="Whatever the job, book it the same simple way — and always know who's on their way."
        />

        <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {services.map(({ icon: Icon, name, body }, index) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (index % 4) * 0.07, ease: "easeOut" }}
              whileHover={{ y: -4 }}
              className="group flex flex-col items-center rounded-2xl border border-white/10 bg-primary p-5 text-center transition-colors hover:border-accent/40"
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 transition-colors group-hover:bg-accent/25">
                <Icon className="size-5 text-white" strokeWidth={2} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">{name}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
