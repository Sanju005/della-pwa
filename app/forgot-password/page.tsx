"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { AppButton, AuthInfoPanel, MobilePage, SecureNotice } from "@/app/_components/della-ui";
import { getSupabaseClient } from "@/lib/supabase";

const userResetRedirectUrl = "https://app.myswiper.my/reset-password";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setError("");
      setNotice("");
      const supabase = getSupabaseClient();

      if (!supabase) {
        setError("Supabase is not configured yet.");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: userResetRedirectUrl,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setNotice("Password reset link sent. Check your email to continue.");
    });
  };

  return (
    <MobilePage className="min-h-[100dvh] py-6">
          <Link
            href="/login"
            aria-label="Back"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#16A34A] shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="mt-6 space-y-4">
            <AuthInfoPanel
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Reset password"
              description={`Enter your account email and we'll send a secure reset link to ${userResetRedirectUrl}.`}
            />

            <div className="rounded-[32px] border border-[#E3ECE5] bg-white px-5 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)] sm:px-6 sm:py-7">
            <label className="block text-[16px] font-extrabold text-[#0F172A]">
              Email
              <div className="mt-3 flex h-[58px] items-center rounded-[18px] border border-[#DDE5E0] bg-white px-5 shadow-[0_4px_10px_rgba(15,23,42,0.02)]">
                <Mail className="mr-4 h-5 w-5 text-[#16A34A]" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-full flex-1 border-0 bg-transparent text-[16px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
            </label>

            {error ? (
              <p className="mt-4 rounded-[14px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
                {error}
              </p>
            ) : null}

            {notice ? (
              <p className="mt-4 rounded-[14px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
                {notice}
              </p>
            ) : null}

            <AppButton
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-7 h-[56px] w-full rounded-[20px] text-[18px] disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending link..." : "Send reset link"}
            </AppButton>
            </div>
            <SecureNotice />
          </div>
    </MobilePage>
  );
}
