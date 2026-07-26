import Image from "next/image";
import {
  BookOpenText,
  CookingPot,
  Sparkles,
  Wrench,
} from "lucide-react";

function FloatingBadge({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute flex h-18 w-18 items-center justify-center rounded-[24px] bg-white/96 text-[#9B72ED] shadow-[0_22px_46px_rgba(137,104,205,0.18)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

function PersonCutout({
  src,
  alt,
  className,
  glowClassName,
}: {
  src: string;
  alt: string;
  className: string;
  glowClassName?: string;
}) {
  return (
    <div className={`absolute overflow-hidden ${className}`}>
      {glowClassName ? <div className={`absolute inset-0 ${glowClassName}`} /> : null}
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
        sizes="(max-width: 1024px) 42vw, 220px"
      />
    </div>
  );
}

function ServiceTile({
  color,
  label,
  glyph,
}: {
  color: string;
  label: string;
  glyph: string;
}) {
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl shadow-[0_10px_20px_rgba(137,104,205,0.08)]"
        style={{ backgroundColor: color }}
      >
        <span className="text-[18px] font-semibold">{glyph}</span>
      </div>
      <p className="mt-2 text-[10px] font-medium leading-3 text-[#3E446B]">{label}</p>
    </div>
  );
}

function StepBubble({
  glyph,
  label,
}: {
  glyph: string;
  label: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F3ECFF] text-[#8968CD]">
        <span className="text-[16px]">{glyph}</span>
      </div>
      <p className="mt-2 text-[9px] font-medium leading-3 text-[#3E446B]">{label}</p>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[820px] overflow-hidden pb-6 pt-2">
      <div className="absolute right-[11%] top-[6%] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(205,186,247,0.6),rgba(205,186,247,0)_72%)]" />
      <div className="absolute left-[25%] top-[31%] h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(222,208,255,0.62),rgba(222,208,255,0)_72%)]" />
      <div className="absolute inset-x-[18%] bottom-[2%] h-24 rounded-t-[120px] bg-[radial-gradient(circle_at_center,rgba(182,155,241,0.35),rgba(182,155,241,0)_74%)] blur-2xl" />

      <svg
        aria-hidden="true"
        viewBox="0 0 920 760"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d="M650 110c109-2 208 55 221 132 13 79-55 125-155 141-71 12-139 38-186 92"
          fill="none"
          stroke="rgba(171,138,237,0.56)"
          strokeDasharray="7 8"
          strokeWidth="2"
        />
        <path
          d="M225 292c-68 33-106 105-76 164 26 50 88 68 162 41"
          fill="none"
          stroke="rgba(171,138,237,0.52)"
          strokeDasharray="7 8"
          strokeWidth="2"
        />
        <path
          d="M694 414c76 17 132 75 129 143-2 52-28 94-77 123"
          fill="none"
          stroke="rgba(171,138,237,0.5)"
          strokeDasharray="7 8"
          strokeWidth="2"
        />
      </svg>

      <PersonCutout
        src="/Images/Providers/maid/siti-maid.jpg"
        alt="Cleaner"
        className="right-1 top-0 h-[225px] w-[205px] rounded-[34px] sm:right-8 sm:h-[250px] sm:w-[225px]"
        glowClassName="bg-[radial-gradient(circle_at_top,rgba(209,188,255,0.6),rgba(255,255,255,0)_72%)]"
      />
      <PersonCutout
        src="/Images/Providers/Plumber/murugan-plumber.jpg"
        alt="Technician"
        className="left-0 top-[176px] h-[228px] w-[200px] rounded-[34px] sm:left-7 sm:h-[265px] sm:w-[225px]"
        glowClassName="bg-[radial-gradient(circle_at_top,rgba(212,190,255,0.55),rgba(255,255,255,0)_72%)]"
      />
      <PersonCutout
        src="/Images/Providers/Tutor/nadiya-tutor.jpg"
        alt="Tutor and child"
        className="right-0 top-[270px] h-[208px] w-[214px] rounded-[34px] sm:right-3 sm:h-[245px] sm:w-[250px]"
        glowClassName="bg-[radial-gradient(circle_at_top,rgba(216,194,255,0.58),rgba(255,255,255,0)_72%)]"
      />
      <PersonCutout
        src="/Images/Providers/Cleaner/fresha-cleaner.jpg"
        alt="Beauty provider"
        className="left-[92px] top-[500px] h-[185px] w-[150px] rounded-[34px] sm:left-[150px] sm:h-[205px] sm:w-[168px]"
        glowClassName="bg-[radial-gradient(circle_at_top,rgba(218,196,255,0.52),rgba(255,255,255,0)_72%)]"
      />
      <PersonCutout
        src="/Images/Providers/Chef/chef-daniel.jpg"
        alt="Chef"
        className="bottom-0 right-0 h-[205px] w-[200px] rounded-[34px] sm:bottom-3 sm:right-5 sm:h-[230px] sm:w-[220px]"
        glowClassName="bg-[radial-gradient(circle_at_top,rgba(213,191,255,0.5),rgba(255,255,255,0)_72%)]"
      />

      <FloatingBadge className="left-[4%] top-[432px] sm:left-[8%]">
        <Sparkles className="h-8 w-8" />
      </FloatingBadge>
      <FloatingBadge className="left-[34%] top-[14%]">
        <Wrench className="h-8 w-8" />
      </FloatingBadge>
      <FloatingBadge className="left-[39%] top-[617px] h-18 w-18">
        <span className="text-[34px] leading-none">✿</span>
      </FloatingBadge>
      <FloatingBadge className="right-[4%] top-[302px]">
        <BookOpenText className="h-8 w-8" />
      </FloatingBadge>
      <FloatingBadge className="right-[2%] bottom-[80px]">
        <CookingPot className="h-8 w-8" />
      </FloatingBadge>

      <div className="relative mx-auto mt-14 h-[560px] w-[302px] rounded-[42px] border-[8px] border-black bg-black p-[8px] shadow-[0_34px_72px_rgba(17,21,61,0.22)] sm:mt-8 sm:h-[680px] sm:w-[352px] sm:rotate-[11deg]">
        <div className="absolute left-1/2 top-[10px] z-20 h-6 w-[118px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full overflow-hidden rounded-[34px] bg-white">
          <div className="h-[37%] bg-[linear-gradient(180deg,#6C34C7_0%,#7E49D7_42%,#9B77EC_100%)] px-5 pb-6 pt-5 text-white">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <div className="flex items-center gap-2">
                <Image
                  src="/branding/swiper-icon.png"
                  alt=""
                  width={22}
                  height={22}
                  className="h-5 w-auto brightness-[8]"
                />
                <span className="text-[18px] font-bold">Swiper</span>
              </div>
              <span className="text-[11px]">9:37</span>
            </div>

            <p className="mt-7 text-[13px] font-medium text-white/84">Hello, 👋</p>
            <h3 className="mt-2 max-w-[10rem] text-[31px] font-extrabold leading-[1.1]">
              What service do you need today?
            </h3>
          </div>

          <div className="-mt-8 px-4">
            <div className="flex h-14 items-center rounded-[18px] bg-white px-4 shadow-[0_18px_34px_rgba(91,57,167,0.16)]">
              <span className="text-[16px] text-[#8968CD]">⌕</span>
              <span className="ml-3 text-[13px] text-[#8D91AA]">Search for a service...</span>
              <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F3ECFF] text-[#8968CD]">
                <span className="text-[15px]">○</span>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h4 className="text-[20px] font-extrabold text-[#11153D]">Popular Services</h4>
                <span className="text-[12px] font-semibold text-[#8968CD]">View all</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                <ServiceTile color="#F4EEFF" label="Cleaning" glyph="✣" />
                <ServiceTile color="#FFF1E9" label="Babysitting" glyph="✺" />
                <ServiceTile color="#EEF8F0" label="Tutoring" glyph="⌘" />
                <ServiceTile color="#F5EEFF" label="Plumbing" glyph="✄" />
                <ServiceTile color="#FFF2F5" label="Cooking" glyph="✕" />
                <ServiceTile color="#EEF8F0" label="Laundry" glyph="✓" />
                <ServiceTile color="#F7EFFF" label="Repairs" glyph="◫" />
                <ServiceTile color="#F4EEFF" label="More" glyph="⋮" />
              </div>
            </div>

            <div id="how-it-works" className="mt-6">
              <h4 className="text-[20px] font-extrabold text-[#11153D]">How it works</h4>
              <div className="mt-4 grid grid-cols-4 gap-2.5">
                <StepBubble glyph="◻" label="Choose a service" />
                <StepBubble glyph="⌑" label="Book instantly" />
                <StepBubble glyph="◌" label="Connect with pro" />
                <StepBubble glyph="☆" label="Enjoy quality service" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[-1] h-40 rounded-t-[140px] bg-[linear-gradient(180deg,rgba(216,199,252,0)_0%,rgba(208,188,248,0.45)_72%,rgba(201,180,246,0.52)_100%)]" />
    </div>
  );
}
