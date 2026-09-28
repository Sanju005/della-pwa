import type { ReactNode } from "react";

export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="px-6 py-20">
      <article className="mx-auto max-w-3xl">
        <header className="border-b border-border pb-8">
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-ink-faint">Last updated: {updated}</p>
        </header>

        <div
          role="note"
          className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4 text-sm leading-relaxed text-primary-dark"
        >
          <strong className="font-semibold">Draft document.</strong> This
          page is a starting template prepared for Swiper and has not been
          reviewed by a lawyer. Do not treat it as final or legally binding
          until it has been reviewed by a qualified professional — ideally
          one licensed in Malaysia, given this document references the
          Personal Data Protection Act 2010 and the handling of government
          identity documents.
        </div>

        <div className="legal-prose mt-10 space-y-8 text-[15px] leading-relaxed text-ink-muted">
          {children}
        </div>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
