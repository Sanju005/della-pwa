import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Swiper"
                width={30}
                height={30}
                className="rounded-[8px]"
              />
              <span className="font-display text-base font-semibold text-ink">
                Swiper
              </span>
            </div>
            <p className="mt-3 max-w-[26ch] text-sm leading-relaxed text-ink-muted">
              Verified home services, on your schedule, anywhere in Malaysia.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Product
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li>
                <Link href="/#how-it-works" className="transition hover:text-primary">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/#services" className="transition hover:text-primary">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/#trust" className="transition hover:text-primary">
                  Trust &amp; safety
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Company
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li>
                <Link href="/#providers" className="transition hover:text-primary">
                  Become a provider
                </Link>
              </li>
              <li>
                <Link href="/#news" className="transition hover:text-primary">
                  News &amp; media
                </Link>
              </li>
              <li>
                <a
                  href="https://app.myswiper.my"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-primary"
                >
                  Open the app
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li>
                <Link href="/terms" className="transition hover:text-primary">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs leading-relaxed text-ink-faint">
            Swiper Resources (Reg. No. 202603157950 / AS0516780-V) · No. 26,
            Jalan Utama 39, Rini Residence, Mutiara Rini, 81300 Skudai, Johor,
            Malaysia
          </p>
          <div className="mt-4 flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-ink-faint">
              © {new Date().getFullYear()} Swiper. All rights reserved.
            </p>
            <p className="text-xs text-ink-faint">Made for Malaysia</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
