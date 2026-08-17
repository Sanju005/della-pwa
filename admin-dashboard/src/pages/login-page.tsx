import { ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-provider";

export function LoginPage() {
  const { access, initialized, session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized || !session) {
      return;
    }

    if (access === "denied") {
      navigate("/blocked", { replace: true });
      return;
    }

    if (access !== "allowed") {
      return;
    }

    const from = (location.state as { from?: { pathname?: string } } | null)?.from;
    navigate(from?.pathname ?? "/", { replace: true });
  }, [access, initialized, session, location.state, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const error = await signIn(email, password);

      if (error) {
        setFormError(error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-[radial-gradient(circle_at_top,_rgba(142,94,181,0.22),_transparent_28%),linear-gradient(180deg,_#fcf9ff_0%,_#f5effd_45%,_#f8fafc_100%)] px-4 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section className="hidden rounded-[36px] bg-[linear-gradient(135deg,#2b1d45_0%,#6f43b6_42%,#8E5EB5_100%)] p-10 text-white shadow-[0_30px_100px_rgba(86,38,135,0.24)] lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-100">
            admin.myswiper.my
          </p>
          <h1 className="mt-5 max-w-xl font-display text-5xl font-extrabold leading-tight">
            Swiper control room for users, providers, payments, and trust.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/82">
            A premium operational dashboard designed for fast decisions, careful review,
            and clean visibility across the whole marketplace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["12.8K", "total users"],
            ["RM256K", "payments monitored"],
            ["32", "approval actions pending"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="font-display text-3xl font-bold">{value}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.18em] text-white/72">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6f43b6,#8E5EB5)] text-white shadow-lg shadow-violet-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8E5EB5]">
                Swiper Admin
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950">
                Secure sign in
              </h2>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-500">
            Sign in with your Supabase account.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFormError(null);
                }}
                placeholder="admin@myswiper.my"
                autoComplete="username"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition focus:border-[#8E5EB5] focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError(null);
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition focus:border-[#8E5EB5] focus:bg-white"
                required
              />
            </label>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-semibold text-[#8E5EB5]">
                Forgot password?
              </Link>
            </div>

            {formError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#6f43b6,#8E5EB5)] px-4 py-3.5 font-semibold text-white shadow-[0_18px_40px_rgba(111,67,182,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting || (session && access !== "allowed")
                ? "Checking access..."
                : "Sign in to admin"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Main marketplace:{" "}
            <Link to="https://app.myswiper.my" className="font-semibold text-[#8E5EB5]">
              app.myswiper.my
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
