"use client";

import { motion } from "framer-motion";
import {
  Bell,
  MapPin,
  ChevronRight,
  ChefHat,
  SprayCan,
  Smile,
  Car,
  PaintRoller,
  BookOpen,
  Wrench,
  Zap,
  Wallet,
  Home,
  Calendar,
  CheckCircle2,
  User,
} from "lucide-react";

const popularServices = [
  { icon: ChefHat, label: "Chef" },
  { icon: SprayCan, label: "Maid" },
  { icon: Smile, label: "Babysitter" },
  { icon: Car, label: "Driver" },
  { icon: PaintRoller, label: "Cleaner" },
  { icon: BookOpen, label: "Tutor" },
  { icon: Wrench, label: "Plumber" },
  { icon: Zap, label: "Electrician" },
];

const navItems = [
  { icon: Home, label: "Home", active: true },
  { icon: Calendar, label: "Bookings", active: false },
  { icon: CheckCircle2, label: "Ongoing", active: false },
  { icon: User, label: "Profile", active: false },
];

/**
 * The phone silhouette + a recreation of Swiper's real home screen (matched
 * against an actual in-app screenshot), intentionally the dominant visual
 * element (see ProviderMontage), a large tilted device rather than a small
 * centered one.
 */
export function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -6 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      className="relative z-20 aspect-[9/19.5] w-[230px] shrink-0 rounded-[2.6rem] border-[6px] border-ink/90 bg-ink/90 shadow-[0_50px_100px_-24px_rgba(0,0,0,0.6)] sm:w-[300px] lg:w-[330px]"
    >
      <div
        aria-hidden
        className="absolute left-1/2 top-0 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink/90"
      />
      <div className="flex h-full flex-col overflow-hidden rounded-[2.15rem] bg-paper">
        <div className="relative shrink-0 bg-gradient-to-br from-primary-dark to-primary px-5 pb-9 pt-9">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-white">Hello, User</p>
              <p className="mt-0.5 text-sm text-white/75">Good Evening</p>
            </div>
            <div className="relative flex size-9 items-center justify-center rounded-full bg-white/15">
              <Bell className="size-4 text-white" strokeWidth={2} />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                6
              </span>
            </div>
          </div>

          <div className="absolute inset-x-5 -bottom-6 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.25)]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <MapPin className="size-4 text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium uppercase tracking-wide text-ink-faint">
                Current Location
              </p>
              <p className="truncate text-[11px] font-semibold text-ink">
                Jalan Berkok, Taman Million, Ka...
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-6 pt-10">
          <p className="text-base font-semibold text-ink">What service do you need?</p>

          <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
            {popularServices.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
                  <Icon className="size-[18px] text-primary" strokeWidth={2} />
                </div>
                <span className="text-center text-[10px] font-medium leading-tight text-ink-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/10">
              <Wallet className="size-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] text-white/60">Wallet</p>
              <p className="text-sm font-semibold text-white">Balance : RM 100</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
            {navItems.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex flex-col items-center gap-1 ${active ? "text-primary" : "text-ink-faint"}`}
              >
                <Icon className="size-4" strokeWidth={2} />
                <span className="text-[8.5px] font-medium leading-tight">{label}</span>
                {active ? <span className="mt-0.5 h-[2px] w-3 rounded-full bg-primary" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
