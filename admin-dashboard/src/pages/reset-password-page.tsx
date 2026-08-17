import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!supabase) {
        if (active) {
          setError("Supabase environment variables are missing.");
          setLoading(false);
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      setReady(Boolean(session));
      setLoading(false);

      if (!session) {
        setError("Open the password reset link from your email to set a new password.");
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice("Your password has been updated. You can sign in with the new password now.");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(142,94,181,0.22),_transparent_28%),linear-gradient(180deg,_#fcf9ff_0%,_#f5effd_45%,_#f8fafc_100%)] px-4 py-8">
      <div className="w-full max-w-lg rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6f43b6,#8E5EB5)] text-white shadow-lg shadow-violet-500/20">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8E5EB5]">
              Swiper Admin
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
              Create a new password
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-500">
          Use the recovery link from your email, then set a fresh password for your admin account.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition focus:border-[#8E5EB5] focus:bg-white"
              required
              disabled={!ready || loading}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Confirm password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition focus:border-[#8E5EB5] focus:bg-white"
              required
              disabled={!ready || loading}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              {notice}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!ready || loading || submitting}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#6f43b6,#8E5EB5)] px-4 py-3.5 font-semibold text-white shadow-[0_18px_40px_rgba(111,67,182,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Checking recovery session..." : submitting ? "Updating password..." : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Return to{" "}
          <Link to="/login" className="font-semibold text-[#8E5EB5]">
            admin sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
