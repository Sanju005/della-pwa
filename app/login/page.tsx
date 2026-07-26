"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MoveRight,
  UserPlus,
} from "lucide-react";
import { AnimatedSwiperLogo } from "@/app/_components/animated-swiper-logo";
import { getSupabaseClient } from "@/lib/supabase";
import { requestNotificationPermission, saveFCMToken } from "@/lib/notifications";

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  function getNextPath() {
    if (typeof window === "undefined") {
      return "/home";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("next") ?? "/home";
  }

  useEffect(() => {
    let active = true;

    async function continueSession() {
      const supabase = getSupabaseClient();

      if (!supabase) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active || !session) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (isProviderRole(profile?.role)) {
        router.replace("/provider/dashboard");
        return;
      }

      router.replace(getNextPath());
    }

    void continueSession();

    return () => {
      active = false;
    };
  }, [router]);

  function handleSubmit() {
    startTransition(async () => {
      setError("");
      const supabase = getSupabaseClient();

      if (!supabase) {
        setError("Supabase is not configured yet.");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.user) {
        setError(signInError?.message || "Unable to sign in.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message || "Unable to load your account.");
        return;
      }

      try {
        const fcmToken = await requestNotificationPermission();

        if (fcmToken) {
          const saveResult = await saveFCMToken(fcmToken);

          if (!saveResult.success) {
            console.error("[FCM] Failed to persist token:", saveResult.error);
          }
        }
      } catch (notificationError) {
        console.error("[FCM] Notification setup failed after login:", notificationError);
      }

      if (isProviderRole(profile?.role)) {
        router.replace("/provider/dashboard");
        return;
      }

      router.replace(getNextPath());
    });
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fbf8ff]">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] items-center justify-center overflow-hidden px-5 py-6">
        <div className="pointer-events-none absolute left-[-20%] top-[-5%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(142,94,181,0.12)_0%,rgba(142,94,181,0)_72%)]" />
        <div className="pointer-events-none absolute right-[-15%] top-[16%] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(166,121,207,0.18)_0%,rgba(166,121,207,0)_70%)]" />
        <div className="pointer-events-none absolute bottom-[-12%] right-[-8%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(142,94,181,0.18)_0%,rgba(142,94,181,0)_72%)]" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-12%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(166,121,207,0.16)_0%,rgba(166,121,207,0)_72%)]" />

        <section className="relative z-10 w-full rounded-[32px] bg-white/94 px-5 py-7 shadow-[0_24px_60px_rgba(67,35,104,0.12)] ring-1 ring-[#f0e8fa] backdrop-blur">
          <div className="flex flex-col items-center text-center">
            <AnimatedSwiperLogo />
            <h1 className="mt-2 text-[2rem] font-extrabold tracking-[-0.05em] text-[#1f1830]">
              Welcome back!
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-[#625877]">
              Log in to continue to your account
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <Field label="Email">
              <InputShell icon={<Mail className="h-4.5 w-4.5" />}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-full flex-1 border-0 bg-transparent text-[14px] text-[#1f1830] outline-none placeholder:text-[#b3a6c6]"
                />
              </InputShell>
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-[13px] font-bold text-[#2b1f40]">Password</label>
                <Link href="/forgot-password" className="text-[12px] font-semibold text-[#8E5EB5]">
                  Forgot password?
                </Link>
              </div>
              <InputShell icon={<Lock className="h-4.5 w-4.5" />}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-full flex-1 border-0 bg-transparent text-[14px] text-[#1f1830] outline-none placeholder:text-[#b3a6c6]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="ml-3 text-[#a08db7]"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </InputShell>
            </div>

            <label className="inline-flex items-center gap-2.5 text-[13px] font-medium text-[#55486b]">
              <button
                type="button"
                aria-pressed={rememberMe}
                onClick={() => setRememberMe((current) => !current)}
                className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-[5px] border transition ${
                  rememberMe
                    ? "border-[#8E5EB5] bg-[#8E5EB5] text-white"
                    : "border-[#d8caea] bg-white text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </button>
              Remember me
            </label>
          </div>

          {error ? (
            <p className="mt-5 rounded-[16px] border border-[#f4d8de] bg-[#fff6f7] px-4 py-3 text-[12px] font-semibold text-[#c2415b]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#9b69c3_0%,#8E5EB5_100%)] px-5 text-[18px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.28)] transition hover:brightness-105 disabled:opacity-60"
          >
            <span>{isSubmitting ? "Logging in..." : "Log in"}</span>
            <MoveRight className="h-4.5 w-4.5" />
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#eadff6]" />
            <span className="text-[12px] font-medium text-[#9d8fb2]">or</span>
            <div className="h-px flex-1 bg-[#eadff6]" />
          </div>

          <Link
            href="/signup"
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#cfaeea] bg-white px-5 text-[17px] font-bold text-[#8E5EB5] shadow-[0_8px_18px_rgba(142,94,181,0.06)]"
          >
            <span>Create account</span>
            <UserPlus className="h-4.5 w-4.5" />
          </Link>

          <div className="mt-9 text-center">
            <p className="text-[12px] font-semibold text-[#4c415f]">Need help?</p>
            <Link href="/support" className="mt-1 inline-block text-[13px] font-bold text-[#8E5EB5]">
              Contact support
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-bold text-[#2b1f40]">{label}</label>
      {children}
    </div>
  );
}

function InputShell({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex h-12 items-center rounded-[14px] border border-[#eadff6] bg-white px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <span className="mr-2.5 text-[#b08ad3]">{icon}</span>
      {children}
    </div>
  );
}
