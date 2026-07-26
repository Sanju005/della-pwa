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
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute left-[57%] top-[17%] h-[8%] w-[9%] rounded-full bg-[linear-gradient(180deg,#7b45d8_0%,#4d1f91_100%)] shadow-[0_0_0_0.5px_rgba(82,31,146,0.55)]"
            style={{ transformOrigin: "center top" }}
            animate={{
              scaleY: [0.08, 1, 0.08, 1, 0.08],
              opacity: [0, 1, 0, 1, 0],
            }}
            transition={{
              duration: 3.2,
              repeat: Number.POSITIVE_INFINITY,
              times: [0, 0.08, 0.16, 0.26, 0.34],
              ease: "easeInOut",
              repeatDelay: 1.8,
            }}
          />
        </motion.div>

        <div className="overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center"
          >
            <Image
              src={textLogo}
              alt="Swiper"
              priority
              className="h-auto w-[154px] object-contain"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
