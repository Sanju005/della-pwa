"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import mainLogo from "@/Logo/main logo.png";
import textLogo from "@/Logo/Swiper.png";

type AnimatedSwiperLogoProps = {
  className?: string;
};

export function AnimatedSwiperLogo({ className = "" }: AnimatedSwiperLogoProps) {
  return (
    <div className={`mx-auto flex w-fit items-center justify-center ${className}`.trim()}>
      <div className="flex items-center justify-center gap-2.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-[56px] w-[54px] shrink-0"
        >
          <Image
            src={mainLogo}
            alt="Swiper icon"
            priority
            className="h-full w-full object-contain"
          />
        </motion.div>

        <div className="overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center"
          >
            <motion.div
              animate={{
                y: [0, -1.5, 0],
                opacity: [1, 0.94, 1],
              }}
              transition={{
                duration: 2.6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                repeatDelay: 0.5,
              }}
              className="relative"
            >
              <Image
                src={textLogo}
                alt="Swiper"
                priority
                className="h-auto w-[154px] object-contain"
              />
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-[-18%] w-[22%] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0)_100%)] mix-blend-screen"
                animate={{ x: ["0%", "560%"] }}
                transition={{
                  duration: 1.8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                  repeatDelay: 1.4,
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
