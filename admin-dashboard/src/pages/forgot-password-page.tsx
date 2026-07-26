import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

const adminResetRedirectUrl = "https://admin.myswiper.my/reset-password";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    if (!supabase) {
      setSubmitting(false);
      setError("Supabase environment variables are missing.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: adminResetRedirectUrl,
    });

    setSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setNotice("Password reset link sent. Check your email to continue.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.24),_transparent_28%),linear-gradient(180deg,_#f8fff9_0%,_#eaf8ef_45%,_#f8fafc_100%)] px-4 py-8">
      <div className="w-full max-w-lg rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#4F46E5,#7C3AED)] text-white shadow-lg shadow-violet-500/20">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
              DELLA Admin
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
              Reset password
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-500">
          Enter your admin email and we&apos;ll send a secure password reset link to{" "}
          <span className="font-semibold text-slate-700">{adminResetRedirectUrl}</span>.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@myswiper.my"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition focus:border-emerald-400 focus:bg-white"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#0f8b3d,#16a34a)] px-4 py-3.5 font-semibold text-white shadow-[0_18px_40px_rgba(15,139,61,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Sending link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-emerald-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
