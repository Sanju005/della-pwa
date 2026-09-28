"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SprayCan, Wrench, GraduationCap, ChefHat, Sparkles } from "lucide-react";
import { PhoneMockup } from "./phone-mockup";

/**
 * Real cutout-style provider photo (transparent-background PNG). Rendered
 * without a card frame — object-contain, bottom-anchored, drop-shadow only —
 * so the person appears to float in the montage the same way the DELLA
 * reference's cutouts do, rather than sitting inside a cropped photo card.
 */
function ProviderPhoto({
  src,
  alt,
  className,
  rotate = 0,
}: {
  src: string;
  alt: string;
  className: string;
  rotate?: number;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        WebkitMaskImage: "linear-gradient(to bottom, black 62%, transparent 96%)",
        maskImage: "linear-gradient(to bottom, black 62%, transparent 96%)",
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="220px"
        className="object-contain object-bottom drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
        priority
      />
    </div>
  );
}

function FloatingIcon({
  icon: Icon,
  className,
  delay = 0,
}: {
  icon: typeof SprayCan;
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { duration: 0.5, delay: 0.5 + delay },
        scale: { duration: 0.5, delay: 0.5 + delay },
        y: { duration: 4, delay: 1.2 + delay, repeat: Infinity, ease: "easeInOut" },
      }}
      className={`absolute z-30 flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)] backdrop-blur-md ${className}`}
    >
      <Icon className="size-5 text-white" strokeWidth={1.75} />
    </motion.div>
  );
}

export function ProviderMontage() {
  return (
    <div className="relative mx-auto h-[560px] w-full max-w-[620px] sm:h-[660px] lg:h-[740px]">
      {/* Curved glowing platform the composition "sits" on, echoing the
          reference's curved foreground surface. */}
      <svg
        aria-hidden
        viewBox="0 0 620 680"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="platform-glow" cx="70%" cy="95%" r="75%">
            <stop offset="0%" stopColor="#8e5eb5" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#645394" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#645394" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="440" cy="640" rx="420" ry="220" fill="url(#platform-glow)" />
      </svg>

      {/* Subtle curved connector lines between the floating elements. */}
      <svg
        aria-hidden
        viewBox="0 0 620 680"
        className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
      >
        <path
          d="M 70 120 Q 180 180 150 300"
          fill="none"
          stroke="white"
          strokeOpacity="0.12"
          strokeWidth="1.5"
        />
        <path
          d="M 520 90 Q 460 200 500 320"
          fill="none"
          stroke="white"
          strokeOpacity="0.12"
          strokeWidth="1.5"
        />
      </svg>

      <ProviderPhoto
        src="/providers/cleaner.png"
        alt="Professional cleaner ready for a booking on Swiper"
        rotate={-2}
        className="left-[2%] top-[2%] h-[190px] w-[150px] sm:h-[210px] sm:w-[165px]"
      />
      <ProviderPhoto
        src="/providers/plumber.png"
        alt="Verified plumber and technician on Swiper"
        rotate={2}
        className="left-[-2%] top-[46%] h-[160px] w-[135px] sm:h-[180px] sm:w-[150px]"
      />
      <ProviderPhoto
        src="/providers/maid.png"
        alt="Maid available to book on Swiper"
        rotate={-3}
        className="left-[10%] top-[76%] hidden h-[130px] w-[115px] sm:block"
      />
      <ProviderPhoto
        src="/providers/tutor.png"
        alt="Tutor helping a student book through Swiper"
        rotate={2}
        className="right-[0%] top-[0%] h-[180px] w-[150px] sm:h-[200px] sm:w-[165px]"
      />
      <ProviderPhoto
        src="/providers/chef.png"
        alt="Private chef available to book on Swiper"
        rotate={-2}
        className="right-[-2%] top-[58%] h-[170px] w-[145px] sm:h-[190px] sm:w-[160px]"
      />

      <FloatingIcon icon={SprayCan} className="left-[26%] top-[10%]" delay={0} />
      <FloatingIcon icon={Wrench} className="left-[0%] top-[38%]" delay={0.5} />
      <FloatingIcon icon={Sparkles} className="left-[16%] top-[70%]" delay={1} />
      <FloatingIcon icon={GraduationCap} className="right-[20%] top-[6%]" delay={0.3} />
      <FloatingIcon icon={ChefHat} className="right-[8%] top-[52%]" delay={0.8} />

      <div className="absolute inset-0 flex items-center justify-center">
        <PhoneMockup />
      </div>
    </div>
  );
}
