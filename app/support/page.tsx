import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-[100dvh] bg-[#fbf8ff] px-6 py-10">
      <div className="mx-auto w-full max-w-[430px] rounded-[24px] border border-[#eadff8] bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#1f1630]">
          Support
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[#6f6681]">
          Support is available from your existing help and contact channels.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#645394] px-5 text-[14px] font-bold text-white"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
