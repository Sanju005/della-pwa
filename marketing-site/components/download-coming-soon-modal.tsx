"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Rocket, X } from "lucide-react";

export function DownloadComingSoonModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-6 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-modal-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="relative w-full max-w-sm rounded-3xl bg-surface p-8 text-center shadow-[0_40px_80px_-20px_rgba(31,27,46,0.5)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-ink-faint transition hover:bg-paper-alt hover:text-ink"
            >
              <X className="size-4" strokeWidth={2} />
            </button>

            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, -6, 6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary-soft"
            >
              <Rocket className="size-8 text-primary" strokeWidth={1.75} />
            </motion.div>

            <h3 id="download-modal-title" className="mt-5 text-xl font-semibold text-ink">
              We&apos;re on the way!
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              The Swiper app is still in the works. We&apos;re putting the finishing
              touches on it — check back soon to download it.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
