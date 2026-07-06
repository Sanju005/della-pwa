"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Globe,
  HelpCircle,
  IdCard,
  Landmark,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircleMore,
  Phone,
  PencilLine,
  Upload,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import {
  AppButton,
  EmptyState,
  LoadingState,
  MobilePage,
  StatusBadge,
} from "@/app/_components/della-ui";
import { BookingMessagesPanel } from "@/app/_components/booking-messages-panel";
import { ImageCropModal, cropImageFromSelection, type CropTone } from "@/app/_components/image-crop-modal";
import { getFirebaseClientConfig } from "@/lib/firebase";
import {
  disablePushNotifications,
  getLastPushError,
  getPushSetupState,
  getPushSupportDiagnostics,
  requestNotificationPermission,
  saveFCMToken,
  type PushSupportDiagnostics,
  type PushSetupState,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";
import { serviceSpecialties } from "@/lib/provider-registration-config";
import { isPaymentProofMimeType, PAYMENT_PROOF_MAX_BYTES, readFileAsDataUrl } from "@/lib/upload-proof";

import {
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
  formatRelativeDate,
  formatServiceLabel,
  formatTimeLabel,
  getGreeting,
  getInitials,
  getTodayKey,
  providerStatusTone,
  ProviderBottomNav,
  type ProviderBookingItem,
  useProviderAppData,
} from "./provider-app";

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const PROVIDER_SERVICE_OPTIONS = Object.keys(serviceSpecialties);

function normalizeServiceFormValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function isActiveTaskStatus(status: ProviderBookingItem["bookingStatus"]) {
  return [
    "accepted",
    "on_the_way",
    "arrived",
    "work_finished_by_provider",
    "work_confirmed_by_user",
    "final_payment_sent",
    "cash_paid_by_user",
    "payment_received_by_provider",
  ].includes(status);
}

type DashboardTaskStep = {
  label: string;
  status: "done" | "current" | "waiting";
};

function buildDashboardTaskPath(booking: ProviderBookingItem): DashboardTaskStep[] {
  const status = booking.bookingStatus;
  const steps: Array<[string, DashboardTaskStep["status"]]> = [
    ["Confirmed", status === "accepted" || isActiveTaskStatus(status) ? "done" : "current"],
    [
      "On The Way",
      ["on_the_way", "arrived", "work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider"].includes(status)
        ? "done"
        : status === "accepted"
          ? "current"
          : "waiting",
    ],
    [
      "Arrived",
      ["arrived", "work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider"].includes(status)
        ? "done"
        : status === "on_the_way"
          ? "current"
          : "waiting",
    ],
    [
      "Job Done",
      ["work_finished_by_provider", "work_confirmed_by_user", "final_payment_sent", "cash_paid_by_user", "payment_received_by_provider"].includes(status)
        ? "done"
        : status === "arrived"
          ? "current"
          : "waiting",
    ],
    [
      "Payment Sent",
      ["final_payment_sent", "cash_paid_by_user", "payment_received_by_provider"].includes(status)
        ? "done"
        : status === "work_finished_by_provider" || status === "work_confirmed_by_user"
          ? "current"
          : "waiting",
    ],
    [
      "Payment Received",
      ["cash_paid_by_user", "payment_received_by_provider"].includes(status)
        ? "done"
        : status === "final_payment_sent"
          ? "current"
          : "waiting",
    ],
    [
      "Completed",
      ["completed", "paid", "review_requested", "reviewed"].includes(status)
        ? "done"
        : ["cash_paid_by_user", "payment_received_by_provider"].includes(status)
          ? "current"
          : "waiting",
    ],
    [
      "Review",
      booking.providerReviewStatus === "submitted" || booking.providerReviewedAt
        ? "done"
        : ["completed", "review_requested", "reviewed"].includes(status)
          ? "current"
          : "waiting",
    ],
  ];

  return steps.map(([label, stepStatus]) => ({ label, status: stepStatus }));
}

function DashboardTaskPath({
  steps,
}: {
  steps: DashboardTaskStep[];
}) {
  return (
    <div className="rounded-[18px] border border-[#efe6fb] bg-white px-4 py-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
        Task Path
      </p>
      <div className="mt-3 space-y-3">
        {steps.map((step, index) => (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-black ${
                  step.status === "done"
                    ? "border-[#8E5EB5] bg-[#8E5EB5] text-white"
                    : step.status === "current"
                      ? "border-[#8E5EB5] bg-white text-[#8E5EB5]"
                      : "border-[#e2e8f0] bg-white text-[#94a3b8]"
                }`}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={`mt-1 h-6 w-[2px] ${
                    step.status === "done" ? "bg-[#8E5EB5]" : "bg-[#e5e7eb]"
                  }`}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center justify-between gap-3">
                <p className={`text-[13px] font-bold ${step.status === "waiting" ? "text-[#94a3b8]" : "text-[#1f1630]"}`}>
                  {step.label}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    step.status === "done"
                      ? "bg-[#eef9f1] text-[#16a34a]"
                      : step.status === "current"
                        ? "bg-[#f3e8ff] text-[#8E5EB5]"
                        : "bg-[#f1f5f9] text-[#94a3b8]"
                  }`}
                >
                  {step.status === "done" ? "Done" : step.status === "current" ? "Current" : "Waiting"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getProviderAccessToken() {
  const client = getSupabaseClient();

  if (!client) {
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  return session?.access_token ?? null;
}

function LoadingOrError(state: ReturnType<typeof useProviderAppData>) {
  if (state.loading) {
    return (
      <MobilePage className="pb-28">
        <LoadingState
          title="Loading provider app"
          description="We are preparing your provider workspace."
        />
      </MobilePage>
    );
  }

  if (!state.data) {
    return (
      <MobilePage className="pb-28">
        <section className="rounded-[28px] border border-[#dbe8df] bg-white p-5 shadow-[0_20px_60px_rgba(22,163,74,0.08)]">
          <h1 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#16a34a]">
            Provider App
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-[#6b7280]">
            {state.error || "We couldn't load your provider account right now."}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-[12px] bg-[#16a34a] px-4 text-[14px] font-extrabold text-white"
          >
            Back to login
          </Link>
        </section>
      </MobilePage>
    );
  }

  return null;
}

function isPdfProof(mimeType?: string, fileName?: string) {
  return mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
}

function ProofPreviewCard({
  title,
  dataUrl,
  fileName,
  mimeType,
}: {
  title: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
}) {
  if (!dataUrl) {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-[#eee5f7] bg-[#fcfaff] p-4">
      <p className="text-[13px] font-semibold text-[#111827]">{title}</p>
      {isPdfProof(mimeType, fileName) ? (
        <div className="mt-3 rounded-[14px] border border-dashed border-[#d9c7ef] bg-white px-4 py-4 text-[13px] text-[#6d6480]">
          PDF proof attached: {fileName || "Payment proof.pdf"}
        </div>
      ) : (
        <img
          src={dataUrl}
          alt={fileName || title}
          className="mt-3 h-40 w-full rounded-[14px] object-cover"
        />
      )}
      {fileName ? (
        <p className="mt-2 text-[12px] text-[#6d6480]">{fileName}</p>
      ) : null}
    </div>
  );
}

function PageShell({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <MobilePage className="pb-28">
      <section className="space-y-4">
        <header className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)] ring-1 ring-[#eee5f7]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#8E5EB5]">
                Provider App
              </p>
              <h1 className="mt-2 text-[1.9rem] font-black tracking-[-0.06em] text-[#1f1630]">
                {title}
              </h1>
              <p className="mt-1 text-[13px] leading-6 text-[#7b728a]">{subtitle}</p>
            </div>
            {action}
          </div>
        </header>
        {children}
      </section>
      <ProviderBottomNav />
    </MobilePage>
  );
}

function MetricCard({
  label,
  value,
  meta,
  accent = "text-[#8E5EB5]",
}: {
  label: string;
  value: string;
  meta: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#eee5f7] bg-[#fcfaff] p-4 shadow-[0_10px_20px_rgba(86,38,135,0.05)]">
      <p className={`text-[1.2rem] font-black tracking-[-0.05em] ${accent}`}>{value}</p>
      <p className="mt-1 text-[12px] font-semibold text-[#544b66]">{label}</p>
      <p className="mt-1 text-[11px] text-[#9a90ac]">{meta}</p>
    </div>
  );
}

function VerificationStatusPill({
  verified,
}: {
  verified: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${
        verified
          ? "bg-[#ecf9f0] text-[#16a34a]"
          : "bg-[#fff5e8] text-[#f59e0b]"
      }`}
    >
      {verified ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {verified ? "Verified" : "Pending"}
    </span>
  );
}

function VerificationStatusCard({
  href,
  icon,
  title,
  subtitle,
  verified,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  verified: boolean;
}) {
  const content = (
    <div className="group rounded-[24px] border border-[#eee7f8] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(86,38,135,0.06)] transition hover:border-[#d8c8f0] hover:shadow-[0_18px_36px_rgba(86,38,135,0.09)]">
      <div className="flex items-center gap-4">
        <span
          className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${
            verified ? "bg-[#ecf9f0] text-[#16a34a]" : "bg-[#fff3e8] text-[#f59e0b]"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.05rem] font-black tracking-[-0.04em] text-[#1f1630]">{title}</p>
          <p className="mt-1 text-[13px] text-[#7b728a]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <VerificationStatusPill verified={verified} />
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fbf8ff] text-[#8E5EB5] transition group-hover:bg-[#f4eefc]">
            <ChevronRight className="h-5 w-5" />
          </span>
        </div>
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function OtpInputSlots({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  return (
    <div className="mt-4 flex items-center gap-3">
      {Array.from({ length: 6 }, (_, index) => {
        const char = value[index] ?? "";

        return (
          <input
            key={index}
            ref={(node) => {
              inputsRef.current[index] = node;
            }}
            inputMode="numeric"
            maxLength={1}
            value={char}
            onChange={(event) => {
              const nextChar = event.target.value.replace(/\D/g, "").slice(-1);
              const next = value.split("");
              next[index] = nextChar;
              onChange(next.join("").slice(0, 6));

              if (nextChar && index < 5) {
                inputsRef.current[index + 1]?.focus();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !char && index > 0) {
                inputsRef.current[index - 1]?.focus();
              }
            }}
            className="h-14 w-12 rounded-[14px] border border-[#e5def3] bg-white text-center text-[1.25rem] font-black text-[#1f1630] outline-none transition focus:border-[#8E5EB5] focus:ring-2 focus:ring-[#efe6fb]"
          />
        );
      })}
    </div>
  );
}

type VerificationFlowScreenProps = {
  backHref: string;
  title: string;
  description: string;
  statusVerified: boolean;
  fieldLabel: string;
  fieldType: "email" | "phone";
  fieldValue: string;
  onFieldValueChange: (value: string) => void;
  fieldPlaceholder: string;
  leadingPrefix?: React.ReactNode;
  sendLabel: string;
  sentMessage: string;
  idleMessage: string;
  securityMessage: string;
  verifyLabel: string;
  successMessage: string;
};

function VerificationFlowScreen({
  backHref,
  title,
  description,
  statusVerified,
  fieldLabel,
  fieldType,
  fieldValue,
  onFieldValueChange,
  fieldPlaceholder,
  leadingPrefix,
  sendLabel,
  sentMessage,
  idleMessage,
  securityMessage,
  verifyLabel,
  successMessage,
}: VerificationFlowScreenProps) {
  const state = useProviderAppData();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [screenNotice, setScreenNotice] = useState("");
  const fallback = LoadingOrError(state);

  useEffect(() => {
    if (!otpSent || countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, countdown]);

  if (fallback) {
    return fallback;
  }

  const normalizedValue = fieldValue.trim();
  const canSendOtp =
    fieldType === "email"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)
      : normalizedValue.length >= 7;
  const canVerify = canSendOtp && otp.length === 6;

  return (
    <MobilePage className="pb-40">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#eee5f7] bg-white text-[#8E5EB5] shadow-[0_10px_24px_rgba(86,38,135,0.06)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <VerificationStatusPill verified={statusVerified} />
        </div>

        <header className="pt-2">
          <h1 className="text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">{title}</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#7b728a]">{description}</p>
        </header>

        <section className="rounded-[26px] border border-[#eee5f7] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)]">
          <div>
            <p className="text-[15px] font-black text-[#1f1630]">{fieldLabel}</p>
            <div className="mt-4 overflow-hidden rounded-[16px] border border-[#e7def4]">
              <div className="flex items-stretch">
                {leadingPrefix ? (
                  <div className="flex min-w-[96px] items-center gap-2 border-r border-[#e7def4] bg-white px-3">
                    {leadingPrefix}
                  </div>
                ) : null}
                <div className="flex flex-1 items-center gap-3 bg-white px-4">
                  {!leadingPrefix ? (
                    <Mail className="h-5 w-5 shrink-0 text-[#8E5EB5]" />
                  ) : null}
                  <input
                    type={fieldType}
                    inputMode={fieldType === "email" ? "email" : "numeric"}
                    value={fieldValue}
                    onChange={(event) => onFieldValueChange(event.target.value)}
                    placeholder={fieldPlaceholder}
                    className="h-[52px] flex-1 bg-white text-[15px] text-[#1f1630] outline-none placeholder:text-[#b3a9c7]"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!canSendOtp) {
                return;
              }

              setOtp("");
              setOtpSent(true);
              setCountdown(30);
              setScreenNotice(sentMessage);
            }}
            disabled={!canSendOtp}
            className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border text-[15px] font-black transition ${
              canSendOtp
                ? "border-[#cdb8f3] bg-white text-[#8E5EB5] shadow-[0_12px_28px_rgba(142,94,181,0.08)]"
                : "cursor-not-allowed border-[#eadff8] bg-[#faf7fe] text-[#c2b2dc]"
            }`}
          >
            <Send className="h-4.5 w-4.5" />
            {sendLabel}
          </button>

          <div className="mt-6">
            <p className="text-[15px] font-black text-[#1f1630]">Enter OTP</p>
            <OtpInputSlots value={otp} onChange={setOtp} />

            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center gap-2 text-[#6f6681]">
                <MessageCircleMore className="h-4 w-4 text-[#8E5EB5]" />
                <span>{screenNotice || idleMessage}</span>
              </div>
              <div className="flex items-center gap-2 text-[#6f6681]">
                <Clock3 className="h-4 w-4 text-[#8E5EB5]" />
                <span>
                  Resend code in{" "}
                  <strong className="font-black text-[#8E5EB5]">
                    00:{String(countdown).padStart(2, "0")}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Your security matters</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">{securityMessage}</p>
            </div>
          </div>
        </section>

        <button
          type="button"
          disabled={!canVerify}
          onClick={() => {
            if (!canVerify) {
              return;
            }

            state.setNotice(successMessage);
            router.push(backHref);
          }}
          className={`mt-2 inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-black transition ${
            canVerify
              ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
              : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
          }`}
        >
          {verifyLabel}
        </button>
      </section>
    </MobilePage>
  );
}

function DetailMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#eee5f7] bg-white p-4 shadow-[0_8px_18px_rgba(86,38,135,0.04)]">
      <div className="text-[#8E5EB5]">{icon}</div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a90ac]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#1f1630]">{value}</p>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#eee5f7] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(86,38,135,0.04)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a90ac]">
            {label}
          </p>
          <p className="mt-1 text-[13px] leading-6 text-[#1f1630]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TaskPath({
  steps,
}: {
  steps: Array<{ label: string; status: "done" | "current" | "pending" }>;
}) {
  return (
    <div className="rounded-[16px] border border-[#f0e6fb] bg-white px-3 py-3">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
        Task Path
      </p>
      <div className="mt-3 space-y-4">
        {steps.map((step, index, stepsList) => (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  step.status === "done"
                    ? "border-[#8E5EB5] bg-[#8E5EB5] text-white"
                    : step.status === "current"
                      ? "border-[#8E5EB5] bg-white text-[#8E5EB5]"
                      : "border-[#d9e2dd] bg-white text-[#98a2b3]"
                }`}
              >
                {step.status === "done" ? (
                  <span className="text-[11px] font-bold">✓</span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </span>
              {index < stepsList.length - 1 ? (
                <span
                  className={`mt-1 h-8 w-[2px] ${
                    step.status === "done" ? "bg-[#8E5EB5]" : "bg-[#e5e7eb]"
                  }`}
                />
              ) : null}
            </div>
            <div className="pt-0.5">
              <p
                className={`text-[14px] font-semibold ${
                  step.status === "pending" ? "text-[#98a2b3]" : "text-[#1f1630]"
                }`}
              >
                {step.label}
              </p>
              <p className="mt-1 text-[12px] text-[#7b728a]">
                {step.status === "done"
                  ? "Finished"
                  : step.status === "current"
                    ? "Current step"
                    : "Waiting"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingActionBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-[5.5rem] z-20 mt-5 rounded-[22px] border border-[#ebe3f5] bg-white/95 p-3 shadow-[0_18px_44px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="flex gap-3">{children}</div>
    </div>
  );
}

function getBookingTab(
  booking: ProviderBookingItem,
): "ongoing" | "upcoming" | "pending" | "canceled" | "completes" {
  const todayKey = getTodayKey();

  if (booking.bucket === "requests" || booking.bookingStatus === "pending") {
    return "pending";
  }

  if (booking.bookingStatus === "declined" || booking.bookingStatus === "cancelled") {
    return "canceled";
  }

  if (["completed", "paid", "review_requested", "reviewed"].includes(booking.bookingStatus)) {
    return "completes";
  }

  if (
    booking.bookingStatus === "on_the_way" ||
    booking.bookingStatus === "arrived" ||
    (booking.bookingStatus === "accepted" && booking.scheduledDate <= todayKey)
  ) {
    return "ongoing";
  }

  return "upcoming";
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#e7eee8] bg-[#fbfffc] px-4 py-3">
      <div className="flex items-center gap-3 text-[14px] text-[#0f172a]">
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-right text-[13px] font-bold text-[#16a34a]">{value}</span>
        {href ? <ChevronRight className="h-4 w-4 text-[#94a3b8]" /> : null}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function ServiceCard({
  name,
  hourly,
  daily,
  experience,
}: {
  name: string;
  hourly: number;
  daily: number;
  experience: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#e7eee8] bg-[#fbfffc] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-black text-[#0f172a]">{name}</p>
          <p className="mt-1 text-[12px] text-[#64748b]">
            {`RM${hourly}/hr • RM${daily}/day`}
          </p>
        </div>
        <span className="rounded-full bg-[#eef9f1] px-3 py-1 text-[11px] font-bold text-[#16a34a]">
          {experience || "Experience not set"}
        </span>
      </div>
    </div>
  );
}

function ProviderPushNotificationsCard() {
  const [pushState, setPushState] = useState<PushSetupState>({
    permission: "default",
    hasSavedToken: false,
  });
  const [diagnostics, setDiagnostics] = useState<PushSupportDiagnostics | null>(null);
  const [clientDebug, setClientDebug] = useState<{
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    href: string;
    origin: string;
    isStandalone: boolean;
    userAgent: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    if (typeof window !== "undefined") {
      const media = window.matchMedia("(display-mode: standalone)");
      const isStandalone =
        media.matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

      setClientDebug({
        ...getFirebaseClientConfig(),
        href: window.location.href,
        origin: window.location.origin,
        isStandalone,
        userAgent: window.navigator.userAgent,
      });
    }

    void Promise.all([getPushSetupState(), getPushSupportDiagnostics()]).then(
      ([state, support]) => {
        if (!active) {
          return;
        }

        setPushState(state);
        setDiagnostics(support);
      }
    );

    return () => {
      active = false;
    };
  }, []);

  async function onEnable() {
    setBusy(true);
    setNotice("");

    try {
      const token = await requestNotificationPermission();
      const support = await getPushSupportDiagnostics();
      setDiagnostics(support);

        if (!token) {
          const state = await getPushSetupState();
          setPushState(state);
          setNotice(
            support.permission === "unsupported"
              ? "Push is not supported on this device/browser for the current web environment."
              : support.permission === "denied"
                ? "Push is blocked in this browser. Please allow notifications in browser settings."
                : support.permission === "granted"
                  ? getLastPushError()
                    ? `Browser permission is granted, but Firebase could not create a push token. ${getLastPushError()}`
                    : "Browser permission is granted, but Firebase could not create a push token. Please check the Device Check values below."
                  : "Push permission was dismissed or not granted yet."
          );
          return;
        }

      const result = await saveFCMToken(token);

      if (!result.success) {
        setNotice(result.error || "Unable to save this device for push notifications.");
        return;
      }

      setPushState({
        permission: "granted",
        hasSavedToken: true,
      });
      setNotice("Push notifications enabled on this device.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to enable push notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    setBusy(true);
    setNotice("");

    try {
      const result = await disablePushNotifications();

      if (!result.success) {
        setNotice(result.error || "Unable to disable push notifications.");
        return;
      }

      const [state, support] = await Promise.all([
        getPushSetupState(),
        getPushSupportDiagnostics(),
      ]);
      setPushState(state);
      setDiagnostics(support);
      setNotice("Push notifications disabled for this device.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to disable push notifications.");
    } finally {
      setBusy(false);
    }
  }

  const enabled = pushState.permission === "granted" && pushState.hasSavedToken;

  return (
    <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.1rem] font-black tracking-[-0.04em] text-[#0f172a]">
            Push Notifications
          </h3>
          <p className="mt-1 text-[12px] text-[#64748b]">
            Enable browser alerts for new bookings, payments, and customer updates.
          </p>
        </div>
        <Bell className="h-5 w-5 text-[#16a34a]" />
      </div>

        <div className="mt-4 rounded-[18px] border border-[#e7eee8] bg-[#fbfffc] p-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">
          Status
        </p>
        <p className="mt-2 text-[14px] font-semibold text-[#0f172a]">
          {enabled ? "Enabled on this device" : "Not enabled on this device"}
        </p>
        <p className="mt-1 text-[12px] text-[#64748b]">
          Browser permission: {pushState.permission}
        </p>
        </div>

        {diagnostics ? (
        <div className="mt-4 rounded-[18px] border border-[#e7eee8] bg-white p-4 text-[12px] text-[#475569]">
          <p className="font-bold uppercase tracking-[0.12em] text-[#94a3b8]">
            Device Check
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <p>Window: {diagnostics.hasWindow ? "yes" : "no"}</p>
            <p>Notification API: {diagnostics.hasNotificationApi ? "yes" : "no"}</p>
            <p>Service Worker: {diagnostics.hasServiceWorkerApi ? "yes" : "no"}</p>
            <p>Push Manager: {diagnostics.hasPushManagerApi ? "yes" : "no"}</p>
            <p>IndexedDB: {diagnostics.hasIndexedDb ? "yes" : "no"}</p>
            <p>Permission: {diagnostics.permission}</p>
          </div>
          </div>
        ) : null}

        {clientDebug ? (
          <div className="mt-4 rounded-[18px] border border-[#e7eee8] bg-[#fffdf7] p-4 text-[12px] text-[#475569]">
            <p className="font-bold uppercase tracking-[0.12em] text-[#b08900]">
              Firebase Debug
            </p>
            <div className="mt-2 space-y-1 break-all">
              <p>projectId: {clientDebug.projectId || "(empty)"}</p>
              <p>authDomain: {clientDebug.authDomain || "(empty)"}</p>
              <p>storageBucket: {clientDebug.storageBucket || "(empty)"}</p>
              <p>messagingSenderId: {clientDebug.messagingSenderId || "(empty)"}</p>
              <p>appId: {clientDebug.appId || "(empty)"}</p>
              <p>apiKey: {clientDebug.apiKey ? `${clientDebug.apiKey.slice(0, 10)}...` : "(empty)"}</p>
              <p>origin: {clientDebug.origin}</p>
              <p>href: {clientDebug.href}</p>
              <p>standalone: {clientDebug.isStandalone ? "yes" : "no"}</p>
              <p>userAgent: {clientDebug.userAgent}</p>
            </div>
          </div>
        ) : null}

        {notice ? (
        <p className="mt-4 rounded-[16px] border border-[#d8ebdf] bg-[#f6fcf7] px-4 py-3 text-[13px] font-semibold text-[#166534]">
          {notice}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onEnable()}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-[14px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "Updating..." : enabled ? "Enable Again" : "Enable Push"}
        </button>
        <button
          type="button"
          disabled={busy || !enabled}
          onClick={() => void onDisable()}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-[14px] border border-[#d8ebdf] bg-white px-4 text-[13px] font-extrabold text-[#166534] disabled:opacity-60"
        >
          Disable Push
        </button>
      </div>
    </section>
  );
}

export function DashboardScreen() {
  const state = useProviderAppData();
  const [taskCalendarMonth, setTaskCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [taskCalendarDate, setTaskCalendarDate] = useState(getTodayKey());
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  async function handleSendFinalAmount(booking: ProviderBookingItem) {
    const input = window.prompt(
      "Enter final amount (RM) to send to the customer.",
      String(booking.quotedAmount || booking.baseAmount || 0),
    );

    if (input === null) {
      return;
    }

    const finalAmount = Number(input);

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      state.setError("Final amount must be a valid number.");
      return;
    }

    const note = window.prompt(
      "Optional payment note for customer",
      booking.providerResponseNote || "Please review and confirm the final cash amount.",
    );

    if (note === null) {
      return;
    }

    state.handleBookingAction(
      booking.id,
      "completed",
      note.trim(),
      { finalAmount },
    );
  }

  const data = state.data!;
  const pendingRequest = state.bookings.find((booking) => booking.bucket === "requests") ?? null;
  const newTasks = state.bookings.filter(
    (booking) => booking.bucket === "requests" || booking.bookingStatus === "pending",
  );
  const acceptedBookings = state.bookings.filter((booking) => booking.bookingStatus === "accepted");
  const ongoingBookings = state.bookings.filter((booking) => isActiveTaskStatus(booking.bookingStatus));
  const todayKey = getTodayKey();
  const todayBookings = state.bookings
    .filter(
      (booking) =>
        booking.scheduledDate === todayKey &&
        booking.bookingStatus !== "declined" &&
        booking.bookingStatus !== "cancelled",
    )
    .sort((left, right) =>
      `${left.scheduledDate}T${left.scheduledStartTime}`.localeCompare(
      `${right.scheduledDate}T${right.scheduledStartTime}`,
      ),
    );
  const pendingTodayTasks = state.bookings.filter(
    (booking) =>
      booking.scheduledDate === todayKey &&
      (booking.bucket === "requests" || booking.bookingStatus === "pending"),
  );
  const completedBookings = state.bookings.filter((booking) =>
    ["completed", "paid", "review_requested", "reviewed"].includes(booking.bookingStatus),
  );
  const canceledBookings = state.bookings.filter(
    (booking) => booking.bookingStatus === "declined" || booking.bookingStatus === "cancelled",
  );
  const collectedBookings = state.bookings.filter(
    (booking) =>
      booking.paymentStatus === "paid" ||
      [
        "cash_paid_by_user",
        "payment_received_by_provider",
        "completed",
        "paid",
        "review_requested",
        "reviewed",
      ].includes(booking.bookingStatus),
  );
  const walletBalance = collectedBookings.reduce((sum, booking) => sum + booking.quotedAmount, 0);
  const companyPayable = collectedBookings
    .filter((booking) => booking.companyPaymentStatus !== "paid")
    .reduce((sum, booking) => sum + booking.companyCommissionAmount, 0);
  const todayEarnings = todayBookings
    .filter((booking) =>
      ["completed", "paid", "review_requested", "reviewed"].includes(booking.bookingStatus),
    )
    .reduce((sum, booking) => sum + booking.quotedAmount, 0);
  const taskCalendarMonthLabel = new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
  }).format(taskCalendarMonth);
  const taskCalendarMonthStart = new Date(taskCalendarMonth.getFullYear(), taskCalendarMonth.getMonth(), 1);
  const taskCalendarMonthEnd = new Date(taskCalendarMonth.getFullYear(), taskCalendarMonth.getMonth() + 1, 0);
  const taskCalendarFirstWeekday = taskCalendarMonthStart.getDay();
  const taskCalendarDaysInMonth = taskCalendarMonthEnd.getDate();
  const taskCalendarCells: Array<{ label: number | null; key: string | null }> = [];

  for (let index = 0; index < taskCalendarFirstWeekday; index += 1) {
    taskCalendarCells.push({ label: null, key: null });
  }

  for (let day = 1; day <= taskCalendarDaysInMonth; day += 1) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(taskCalendarMonth.getFullYear(), taskCalendarMonth.getMonth(), day));
    taskCalendarCells.push({ label: day, key });
  }

  const taskCalendarBookingCount = (dateKey: string) =>
    state.bookings.filter((booking) => booking.scheduledDate === dateKey).length;

  const selectedDateTaskTime = new Date(`${taskCalendarDate}T00:00:00`).getTime();
  const todayTime = new Date(`${todayKey}T00:00:00`).getTime();
  const selectedDateTaskLabel =
    selectedDateTaskTime < todayTime
      ? "Completed tasks"
      : selectedDateTaskTime > todayTime
        ? "Upcoming tasks"
        : "Tasks for today";
  const selectedDateTasks = state.bookings
    .filter((booking) => {
      if (booking.scheduledDate !== taskCalendarDate) {
        return false;
      }

      if (selectedDateTaskTime < todayTime) {
        return ["completed", "paid", "review_requested", "reviewed"].includes(booking.bookingStatus);
      }

      if (selectedDateTaskTime > todayTime) {
        return booking.bookingStatus === "accepted";
      }

      return booking.bookingStatus !== "declined" && booking.bookingStatus !== "cancelled";
    })
    .sort((left, right) =>
      `${left.scheduledDate}T${left.scheduledStartTime}`.localeCompare(
        `${right.scheduledDate}T${right.scheduledStartTime}`,
      ),
    );
  const unreadCount = state.notifications.filter((item) => !item.isRead).length;
  const displayName = data.marketingName || data.fullName || "Provider";

  return (
    <MobilePage className="pb-28">
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <Link
            href="/provider/more"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f4faf5] text-[#334155]"
          >
            <Menu className="h-5 w-5" />
          </Link>
          <div className="text-[2rem] font-black tracking-[-0.08em] text-[#16a34a]">
            della
          </div>
          <Link
            href="/provider/messages"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f4faf5] text-[#334155]"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#16a34a] px-1 text-[10px] font-extrabold text-white">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        </header>

        <section className="rounded-[30px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#ebf7ef] ring-4 ring-white shadow-[0_16px_30px_rgba(22,163,74,0.18)]">
                {data.avatarUrl ? (
                  <Image
                    src={data.avatarUrl}
                    alt={displayName}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-[1.4rem] font-black text-[#16a34a]">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
              <span className="absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#16a34a] shadow-[0_10px_24px_rgba(22,163,74,0.15)] ring-1 ring-[#e3eee6]">
                <span className={`h-2.5 w-2.5 rounded-full ${data.isVisible ? "bg-[#16a34a]" : "bg-[#f59e0b]"}`} />
                {data.isVisible ? "Available" : "Pending"}
              </span>
            </div>

            <p className="mt-6 text-[14px] text-[#64748b]">{getGreeting()}</p>
            <h1 className="mt-1 text-[2rem] font-black tracking-[-0.06em] text-[#0f172a]">
              {displayName}
            </h1>
            <div className="mt-2 flex items-center gap-1 text-[13px] text-[#475569]">
              <Star className="h-4 w-4 fill-[#f5b301] text-[#f5b301]" />
              <span className="font-bold">
                {data.averageRating > 0 ? data.averageRating.toFixed(1) : "0.0"}
              </span>
              <span>({data.totalReviews} reviews)</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[#64748b]">
              <MapPin className="h-4 w-4 text-[#16a34a]" />
              <span>{data.serviceLocation || "Location not set yet"}</span>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[22px] border border-[#e7def4] bg-[linear-gradient(135deg,#ffffff_0%,#f8f3fd_100%)] p-4 shadow-[0_16px_36px_rgba(104,63,155,0.1)]">
            <div className="space-y-4">
              <div className="rounded-[18px] border border-[#ede4f8] bg-white/90 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#8E5EB5]">
                      Wallet Balance
                    </p>
                    <p className="mt-2 text-[1.85rem] font-black tracking-[-0.06em] text-[#1f1630]">
                      {formatCurrency(walletBalance)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#7c728f]">
                      Full amount collected from customers
                    </p>
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#edf7ee] text-[#22c55e]">
                    <Wallet className="h-5 w-5" />
                  </span>
                </div>
                <Link
                  href="/provider/payments"
                  aria-disabled={walletBalance <= 0}
                  className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] px-4 text-[14px] font-extrabold transition ${
                    walletBalance <= 0
                      ? "pointer-events-none bg-[#d8cde6] text-white shadow-none"
                      : "bg-[#8E5EB5] text-white shadow-[0_12px_24px_rgba(142,94,181,0.18)]"
                  }`}
                >
                  Withdraw
                </Link>
              </div>

              <div className="rounded-[18px] border border-[#ede4f8] bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8E5EB5]">
                      Payable to Company
                    </p>
                    <p className="mt-1 text-[1.3rem] font-black tracking-[-0.05em] text-[#1f1630]">
                      {formatCurrency(companyPayable)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#7c728f]">
                      Amount due to DELLA from recent customer payments
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5f1fa] px-3 py-1 text-[11px] font-bold text-[#8E5EB5]">
                    DELLA
                  </span>
                </div>
                <Link
                  href="/provider/payments"
                  aria-disabled={companyPayable <= 0}
                  className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] border px-4 text-[14px] font-extrabold transition ${
                    companyPayable <= 0
                      ? "pointer-events-none border-[#e6def0] bg-[#f3eef8] text-[#b49bcf]"
                      : "border-[#d9c8ee] bg-white text-[#8E5EB5]"
                  }`}
                >
                  Pay to Company
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <MetricCard label="Bookings" value={String(todayBookings.length)} meta="Today" />
            <MetricCard label="Earnings" value={formatCompactCurrency(todayEarnings)} meta="Today" />
            <MetricCard
              label="Rating"
              value={data.averageRating > 0 ? data.averageRating.toFixed(1) : "0.0"}
              meta={`From ${data.totalReviews}`}
            />
          </div>
        </section>

        {state.error ? (
          <p className="rounded-[18px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {state.error}
          </p>
        ) : null}

        {state.notice ? (
          <p className="rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
            {state.notice}
          </p>
        ) : null}

        <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1.5 rounded-full bg-[#645394]" />
            <div>
              <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#0f172a]">
                Today&apos;s Task
              </h2>
              <p className="mt-1 text-[12px] text-[#7b728a]">Total task of the day</p>
            </div>
          </div>

          <Link
            href={
              pendingRequest
                ? `/provider/bookings?tab=pending&booking=${pendingRequest.id}`
                : "/provider/bookings?tab=pending"
            }
            className="relative mt-5 block overflow-hidden rounded-[22px] border border-[#ddd5ec] bg-[linear-gradient(135deg,#faf8ff_0%,#f4f0fb_70%,#ede6f8_100%)] p-4 shadow-[0_12px_28px_rgba(100,83,148,0.12)]"
          >
            <div className="absolute -bottom-10 -right-6 h-28 w-36 rounded-full bg-[radial-gradient(circle,rgba(100,83,148,0.16)_0%,rgba(100,83,148,0)_72%)]" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white text-[#645394] shadow-[0_10px_24px_rgba(100,83,148,0.14)]">
                  <BriefcaseBusiness className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[2rem] font-black leading-none tracking-[-0.07em] text-[#645394]">
                      {newTasks.length}
                    </p>
                    <p className="text-[14px] font-black text-[#1f1630]">New Task</p>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-[#7b728a]">
                    Reviewing and accepting new requests
                  </p>
                </div>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#645394] shadow-[0_8px_18px_rgba(100,83,148,0.12)]">
                <ChevronRight className="h-5 w-5" />
              </span>
            </div>
          </Link>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/provider/bookings?tab=ongoing"
              className="relative overflow-hidden rounded-[20px] border border-[#ddd5ec] bg-[linear-gradient(135deg,#faf8ff_0%,#f4f0fb_70%,#ede6f8_100%)] p-3.5 shadow-[0_10px_20px_rgba(100,83,148,0.08)]"
            >
              <div className="absolute -bottom-8 -right-4 h-20 w-24 rounded-full bg-[radial-gradient(circle,rgba(100,83,148,0.14)_0%,rgba(100,83,148,0)_72%)]" />
              <div className="relative flex items-center gap-2.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#645394] shadow-[0_8px_18px_rgba(100,83,148,0.12)]">
                  <Clock3 className="h-5 w-5" />
                </span>
                <p className="text-[1.45rem] font-black leading-none tracking-[-0.06em] text-[#645394]">{ongoingBookings.length}</p>
              </div>
              <p className="relative mt-3 text-[14px] font-black text-[#1f1630]">On Going</p>
              <p className="relative mt-1 text-[11px] leading-5 text-[#7b728a]">Take live task actions</p>
            </Link>
            <Link
              href="/provider/bookings?tab=pending"
              className="relative overflow-hidden rounded-[20px] border border-[#ddd5ec] bg-[linear-gradient(135deg,#faf8ff_0%,#f4f0fb_70%,#ede6f8_100%)] p-3.5 shadow-[0_10px_20px_rgba(100,83,148,0.08)]"
            >
              <div className="absolute -bottom-8 -right-4 h-20 w-24 rounded-full bg-[radial-gradient(circle,rgba(100,83,148,0.14)_0%,rgba(100,83,148,0)_72%)]" />
              <div className="relative flex items-center gap-2.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#645394] shadow-[0_8px_18px_rgba(100,83,148,0.12)]">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-[1.45rem] font-black leading-none tracking-[-0.06em] text-[#645394]">{pendingTodayTasks.length}</p>
              </div>
              <p className="relative mt-3 text-[14px] font-black text-[#1f1630]">Pending Task</p>
              <p className="relative mt-1 text-[11px] leading-5 text-[#7b728a]">Pending for today</p>
            </Link>
            <Link
              href="/provider/bookings?tab=completes"
              className="relative overflow-hidden rounded-[20px] border border-[#ddd5ec] bg-[linear-gradient(135deg,#faf8ff_0%,#f4f0fb_70%,#ede6f8_100%)] p-3.5 shadow-[0_10px_20px_rgba(100,83,148,0.08)]"
            >
              <div className="absolute -bottom-8 -right-4 h-20 w-24 rounded-full bg-[radial-gradient(circle,rgba(100,83,148,0.14)_0%,rgba(100,83,148,0)_72%)]" />
              <div className="relative flex items-center gap-2.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#645394] shadow-[0_8px_18px_rgba(100,83,148,0.12)]">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <p className="text-[1.45rem] font-black leading-none tracking-[-0.06em] text-[#645394]">{completedBookings.length}</p>
              </div>
              <p className="relative mt-3 text-[14px] font-black text-[#1f1630]">Completed</p>
              <p className="relative mt-1 text-[11px] leading-5 text-[#7b728a]">Open finished task details</p>
            </Link>
            <Link
              href="/provider/bookings?tab=canceled"
              className="relative overflow-hidden rounded-[20px] border border-[#ddd5ec] bg-[linear-gradient(135deg,#faf8ff_0%,#f4f0fb_70%,#ede6f8_100%)] p-3.5 shadow-[0_10px_20px_rgba(100,83,148,0.08)]"
            >
              <div className="absolute -bottom-8 -right-4 h-20 w-24 rounded-full bg-[radial-gradient(circle,rgba(100,83,148,0.14)_0%,rgba(100,83,148,0)_72%)]" />
              <div className="relative flex items-center gap-2.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#645394] shadow-[0_8px_18px_rgba(100,83,148,0.12)]">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-[1.45rem] font-black leading-none tracking-[-0.06em] text-[#645394]">{canceledBookings.length}</p>
              </div>
              <p className="relative mt-3 text-[14px] font-black text-[#1f1630]">Cancelled</p>
              <p className="relative mt-1 text-[11px] leading-5 text-[#7b728a]">View cancelled tasks</p>
            </Link>
          </div>

          <div className="mt-4 rounded-[20px] border border-[#eee5f7] bg-[#fcfaff] p-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setTaskCalendarMonth(new Date(taskCalendarMonth.getFullYear(), taskCalendarMonth.getMonth() - 1, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#8E5EB5]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-[15px] font-black text-[#1f1630]">{taskCalendarMonthLabel}</p>
                <p className="mt-1 text-[12px] text-[#7b728a]">
                  Select a date to view past or upcoming tasks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaskCalendarMonth(new Date(taskCalendarMonth.getFullYear(), taskCalendarMonth.getMonth() + 1, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#8E5EB5]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-[#94a3b8]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2">
              {taskCalendarCells.map((cell, index) => {
                const count = cell.key ? taskCalendarBookingCount(cell.key) : 0;
                const isActive = cell.key === taskCalendarDate;

                return (
                  <button
                    key={cell.key ?? `task-calendar-${index}`}
                    type="button"
                    disabled={!cell.key}
                    onClick={() => cell.key && setTaskCalendarDate(cell.key)}
                    className={`flex h-14 flex-col items-center justify-center rounded-[14px] text-[12px] font-bold ${
                      isActive
                        ? "bg-[#8E5EB5] text-white"
                        : "bg-white text-[#1f1630] disabled:bg-transparent disabled:text-transparent"
                    }`}
                  >
                    <span>{cell.label}</span>
                    {cell.key ? (
                      <span className={`mt-1 text-[10px] ${isActive ? "text-white/85" : count > 0 ? "text-[#8E5EB5]" : "text-[#c4b7d8]"}`}>
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[18px] border border-[#e7eee8] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-black text-[#0f172a]">{formatDateLabel(taskCalendarDate)}</h3>
                  <p className="mt-1 text-[12px] text-[#64748b]">{selectedDateTaskLabel}</p>
                </div>
                <span className="rounded-full bg-[#f5f1fa] px-3 py-1 text-[11px] font-bold text-[#8E5EB5]">
                  {selectedDateTasks.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {selectedDateTasks.length === 0 ? (
                  <EmptyState
                    title="No tasks on this date"
                    description="Choose another date to view completed or upcoming tasks."
                    icon={<Calendar className="h-6 w-6" />}
                  />
                ) : (
                  selectedDateTasks.slice(0, 3).map((booking) => (
                    <Link
                      key={booking.id}
                      href={`/provider/bookings/${booking.id}`}
                      className="block rounded-[18px] border border-[#e7eee8] bg-[#fbfffc] p-3 transition hover:border-[#d9c8ee] hover:shadow-[0_10px_24px_rgba(142,94,181,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black text-[#0f172a]">{booking.serviceLabel}</p>
                          <p className="mt-1 truncate text-[12px] text-[#64748b]">{booking.customerName}</p>
                        </div>
                        <StatusBadge label={booking.statusLabel} tone={providerStatusTone(booking.bookingStatus)} />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[12px] text-[#475569]">
                        <Clock3 className="h-4 w-4 text-[#8E5EB5]" />
                        <span>{formatTimeLabel(booking.scheduledDate, booking.scheduledStartTime)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#0f172a]">
                Ongoing Tasks
              </h2>
              <p className="mt-1 text-[13px] text-[#64748b]">
                Active jobs already in progress.
              </p>
            </div>
            <span className="rounded-full bg-[#eef9f1] px-3 py-1 text-[12px] font-bold text-[#16a34a]">
              {ongoingBookings.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {ongoingBookings.length === 0 ? (
              <EmptyState
                title="No ongoing tasks"
                description="Jobs that are on the way or already arrived will show here."
                icon={<Clock3 className="h-6 w-6" />}
              />
            ) : (
              ongoingBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="rounded-[20px] border border-[#e7eee8] bg-[#fbfffc] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-black text-[#0f172a]">{booking.customerName}</p>
                      <p className="mt-1 text-[12px] text-[#64748b]">{booking.schedule}</p>
                    </div>
                    <StatusBadge label={booking.statusLabel} tone={providerStatusTone(booking.bookingStatus)} />
                  </div>

                  <div className="mt-3 space-y-2 text-[13px] text-[#475569]">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#16a34a]" />
                      <span>{booking.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#16a34a]" />
                      <span>{booking.serviceLabel}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <DashboardTaskPath steps={buildDashboardTaskPath(booking)} />
                  </div>

                  <div className="mt-4">
                    <AppButton className="w-full" href={`/provider/bookings/${booking.id}`}>
                      View Details
                    </AppButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#0f172a]">
                Recent Reviews
              </h2>
              <p className="mt-1 text-[13px] text-[#64748b]">
                Latest customer feedback from your completed jobs.
              </p>
            </div>
            <Link href="/provider/reviews" className="text-[13px] font-bold text-[#16a34a]">
              View all
            </Link>
          </div>
          <div className="mt-4">
            {state.reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Customer feedback will appear here once completed bookings are reviewed."
                icon={<Star className="h-6 w-6" />}
              />
            ) : (
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                {state.reviews.slice(0, 8).map((review) => (
                  <div
                    key={review.id}
                    className="min-w-[17rem] snap-start rounded-[22px] border border-[#eee5f7] bg-[linear-gradient(135deg,#ffffff_0%,#fcfaff_72%,#f3eafd_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-black text-[#0f172a]">{review.customerName}</p>
                        <p className="mt-1 text-[12px] text-[#64748b]">{review.createdLabel}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[#8E5EB5]">
                        {Array.from({ length: review.rating }).map((_, index) => (
                          <Star key={`${review.id}-${index}`} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-4 text-[13px] leading-6 text-[#475569]">
                      {review.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </section>
      <ProviderBottomNav />
    </MobilePage>
  );
}

export function BookingsScreen({
  initialBookingId = "",
}: {
  initialBookingId?: string;
}) {
  const router = useRouter();
  const state = useProviderAppData();
  const bookings = state.bookings;
  const reviews = state.reviews;
  const isLoading = state.loading;
  const setAppError = state.setError;
  const [tab, setTab] = useState<"all" | "ongoing" | "upcoming" | "pending" | "canceled" | "completes">("all");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarDate, setCalendarDate] = useState(getTodayKey());
  const [selectedBookingId, setSelectedBookingId] = useState(initialBookingId);
  const [commissionProofDataUrl, setCommissionProofDataUrl] = useState("");
  const [commissionProofFileName, setCommissionProofFileName] = useState("");
  const [commissionProofMimeType, setCommissionProofMimeType] = useState("");
  const [pendingInitialSelection, setPendingInitialSelection] = useState(Boolean(initialBookingId));

  useEffect(() => {
    setSelectedBookingId(initialBookingId);
    setPendingInitialSelection(Boolean(initialBookingId));
  }, [initialBookingId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryTab = params.get("tab");
    const queryBookingId = params.get("booking");

    if (
      queryTab === "all" ||
      queryTab === "ongoing" ||
      queryTab === "upcoming" ||
      queryTab === "pending" ||
      queryTab === "canceled" ||
      queryTab === "completes"
    ) {
      setTab(queryTab);
    }

    if (queryBookingId) {
      setSelectedBookingId(queryBookingId);
    }
  }, []);

  const selectedBooking =
    bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedBookingReview = selectedBooking
    ? reviews.find((review) => review.customerName === selectedBooking.customerName) ?? null
    : null;

  useEffect(() => {
    if (!pendingInitialSelection || !selectedBookingId) {
      return;
    }

    if (isLoading) {
      return;
    }

    const matchedBooking = bookings.find((booking) => booking.id === selectedBookingId);

    if (matchedBooking) {
      setPendingInitialSelection(false);
      return;
    }

    if (bookings.length > 0) {
      setPendingInitialSelection(false);
      setAppError("This booking could not be found for your provider account.");
    }
  }, [bookings, isLoading, pendingInitialSelection, selectedBookingId, setAppError]);

  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  function openBooking(bookingId: string) {
    setSelectedBookingId(bookingId);
    router.push(`/provider/bookings/${bookingId}`, { scroll: false });
  }

  function closeBookingDetails() {
    setSelectedBookingId("");
    router.push("/provider/bookings", { scroll: false });
  }

  async function handleSendFinalAmount(booking: ProviderBookingItem) {
    const input = window.prompt(
      "Enter final amount (RM) to send to the customer.",
      String(booking.quotedAmount || booking.baseAmount || 0),
    );

    if (input === null) {
      return;
    }

    const finalAmount = Number(input);

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      state.setError("Final amount must be a valid number.");
      return;
    }

    const note = window.prompt(
      "Optional payment note for customer",
      booking.providerResponseNote || "Please review and confirm the final cash amount.",
    );

    if (note === null) {
      return;
    }

    state.handleBookingAction(
      booking.id,
      "completed",
      note.trim(),
      { finalAmount },
    );
  }

  async function handleCommissionProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      state.setError("Commission proof must be 5MB or smaller.");
      return;
    }

    if (!isPaymentProofMimeType(file.type)) {
      state.setError("Commission proof must be JPG, PNG, GIF, WebP, or PDF.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCommissionProofDataUrl(dataUrl);
      setCommissionProofFileName(file.name);
      setCommissionProofMimeType(file.type);
      state.setError("");
    } catch {
      state.setError("Unable to read the commission proof file.");
    }
  }

  async function handleShareBooking(booking: ProviderBookingItem) {
    if (typeof window === "undefined") {
      return;
    }

    const shareLink = `${window.location.origin}/provider/bookings/${booking.id}`;
    const shareText = [
      `Task: ${booking.serviceLabel}`,
      `Date: ${formatDateLabel(booking.scheduledDate)}`,
      `Time: ${formatTimeLabel(booking.scheduledDate, booking.scheduledStartTime)} - ${formatTimeLabel(booking.scheduledDate, booking.scheduledEndTime)}`,
      `Address: ${booking.location}`,
      `Current Status: ${booking.statusLabel}`,
      `Share Link: ${shareLink}`,
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${booking.serviceLabel} Task`,
          text: shareText,
          url: shareLink,
        });
        state.setNotice("Task details shared.");
        state.setError("");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        state.setNotice("Task details copied to clipboard.");
        state.setError("");
        return;
      }

      state.setError("Sharing is not supported on this device.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      state.setError("Unable to share task details right now.");
    }
  }

  const todayKey = getTodayKey();
  const calendarMonthLabel = new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const calendarCells: Array<{ label: number | null; key: string | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    calendarCells.push({ label: null, key: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    calendarCells.push({ label: day, key });
  }

  const bookingCountForDate = (dateKey: string) =>
    bookings.filter((booking) => booking.scheduledDate === dateKey).length;

  const pendingBookings = bookings.filter(
    (booking) => booking.bucket === "requests" || booking.bookingStatus === "pending",
  );

  const activeDateContext =
    calendarDate < todayKey
      ? "past"
      : calendarDate > todayKey
        ? "future"
        : "current";

  const tabOptions = useMemo(
    () =>
      activeDateContext === "past"
        ? [
            ["all", "All"],
            ["completes", "Completed"],
            ["canceled", "Canceled"],
          ]
        : activeDateContext === "future"
          ? [
              ["all", "All"],
              ["pending", "Pending"],
              ["canceled", "Canceled"],
            ]
          : [
              ["ongoing", "On Going"],
              ["pending", "Pending"],
              ["canceled", "Canceled"],
              ["completes", "Completed"],
            ],
    [activeDateContext],
  );

  useEffect(() => {
    if (!tabOptions.some(([value]) => value === tab)) {
      setTab(tabOptions[0][0] as typeof tab);
    }
  }, [tab, tabOptions]);

  useEffect(() => {
    if (!selectedBooking) {
      return;
    }

    const bookingTab = getBookingTab(selectedBooking);
    const validTabs = new Set(tabOptions.map(([value]) => value));

    if (validTabs.has(bookingTab)) {
      if (tab !== bookingTab) {
        setTab(bookingTab);
      }
      return;
    }

    if (!validTabs.has(tab) && tabOptions[0]?.[0] && tab !== tabOptions[0][0]) {
      setTab(tabOptions[0][0] as typeof tab);
    }
  }, [selectedBooking, tab, tabOptions]);

  const items = bookings.filter((booking) => {
    if (tab === "pending") {
      if (!(booking.bucket === "requests" || booking.bookingStatus === "pending")) {
        return false;
      }
    } else if (tab === "upcoming") {
      if (!(booking.bookingStatus === "accepted" && booking.scheduledDate >= todayKey)) {
        return false;
      }
    } else if (tab === "ongoing") {
      if (!["accepted", "on_the_way", "arrived"].includes(booking.bookingStatus)) {
        return false;
      }
    } else if (tab === "canceled") {
      if (!(booking.bookingStatus === "declined" || booking.bookingStatus === "cancelled")) {
        return false;
      }
    } else if (tab === "completes" && !["completed", "paid", "review_requested", "reviewed"].includes(booking.bookingStatus)) {
      return false;
    }

    return booking.scheduledDate === calendarDate;
  });

  return (
    <PageShell
      title="Bookings"
      subtitle="Manage upcoming, canceled, and completed provider work."
    >
      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <button
          type="button"
          onClick={() => {
            if (pendingBookings[0]) {
              setSelectedBookingId(pendingBookings[0].id);
              setTab("pending");
              router.push(`/provider/bookings?tab=pending&booking=${pendingBookings[0].id}`);
              return;
            }

            setTab("pending");
            router.push("/provider/bookings?tab=pending");
          }}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#8E5EB5]">
              Provider Flow
            </p>
            <h2 className="mt-2 text-[1.35rem] font-black tracking-[-0.05em] text-[#1f1630]">
              Incoming Requests
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-[#7b728a]">
              Open the task panel to accept requests and manage the live task process.
            </p>
          </div>
          <div className="rounded-[18px] bg-[#f7f1fc] px-4 py-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8E5EB5]">New Request</p>
            <p className="mt-1 text-[1.5rem] font-black text-[#1f1630]">
              {bookings.filter((booking) => booking.bookingStatus === "pending").length}
            </p>
          </div>
        </button>
      </section>

      {state.error ? (
        <p className="rounded-[18px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
          {state.notice}
        </p>
      ) : null}

      {selectedBooking ? (
        <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#8E5EB5]">
                {selectedBooking.bookingStatus === "pending" ? "Booking Request" : "Task Details"}
              </p>
              <h2 className="mt-2 text-[1.45rem] font-black tracking-[-0.05em] text-[#0f172a]">
                {selectedBooking.serviceLabel}
              </h2>
              <p className="mt-1 text-[13px] text-[#64748b]">
                {selectedBooking.bookingStatus === "pending"
                  ? "Review the full request before you accept or decline it."
                  : "See full task details, path, payment proofs, images, review, and completion status."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleShareBooking(selectedBooking)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5d5fa] bg-[#fbf8ff] text-[#8E5EB5]"
                aria-label="Share task details"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeBookingDetails}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f7f6] text-[#64748b]"
                aria-label="Close booking details"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[20px] border border-[#eee5f7] bg-[#fcfaff] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-black text-[#0f172a]">{selectedBooking.customerName}</p>
                <p className="mt-1 text-[12px] text-[#64748b]">
                  Booking ID: {selectedBooking.id}
                </p>
              </div>
              <StatusBadge
                label={selectedBooking.statusLabel}
                tone={providerStatusTone(selectedBooking.bookingStatus)}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailMetric
                label="Date"
                value={formatDateLabel(selectedBooking.scheduledDate)}
                icon={<CalendarDays className="h-4 w-4 text-[#8E5EB5]" />}
              />
              <DetailMetric
                label="Time"
                value={`${formatTimeLabel(selectedBooking.scheduledDate, selectedBooking.scheduledStartTime)} - ${formatTimeLabel(selectedBooking.scheduledDate, selectedBooking.scheduledEndTime)}`}
                icon={<Clock3 className="h-4 w-4 text-[#8E5EB5]" />}
              />
              <DetailMetric
                label="Service"
                value={selectedBooking.bookingMode === "daily" ? "Daily" : "Hourly"}
                icon={<BriefcaseBusiness className="h-4 w-4 text-[#8E5EB5]" />}
              />
              <DetailMetric
                label="Rate"
                value={formatCurrency(selectedBooking.quotedAmount)}
                icon={<Wallet className="h-4 w-4 text-[#8E5EB5]" />}
              />
            </div>

            <div className="mt-3 space-y-3">
              <DetailRow
                icon={<MapPin className="h-4 w-4 text-[#8E5EB5]" />}
                label="Location"
                value={selectedBooking.location}
              />
              <DetailRow
                icon={<MessageCircleMore className="h-4 w-4 text-[#8E5EB5]" />}
                label="Customer Details"
                value={selectedBooking.customerNote || "No extra details from the customer."}
              />
            </div>

            {selectedBooking.declineReason ? (
              <p className="mt-4 rounded-[16px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#be123c]">
                Decline reason: {selectedBooking.declineReason}
              </p>
            ) : null}

            {selectedBooking.providerResponseNote ? (
              <p className="mt-4 rounded-[16px] border border-[#dbeee2] bg-[#f6fff8] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
                Provider note: {selectedBooking.providerResponseNote}
              </p>
            ) : null}

            {selectedBooking.bookingStatus !== "declined" &&
            selectedBooking.bookingStatus !== "cancelled" ? (
              <div className="mt-4 rounded-[18px] border border-[#ebe3f5] bg-white px-4 py-4">
                <p className="text-[14px] font-extrabold text-[#0f172a]">Task Progress</p>
                <div className="mt-4">
                  <TaskPath steps={getProviderTaskSteps(selectedBooking.bookingStatus)} />
                </div>
              </div>
            ) : null}

            {selectedBooking.bookingStatus === "pending" ? (
              <BookingActionBar>
                <AppButton
                  className="flex-1"
                  tone="danger"
                  disabled={state.actionBookingId === selectedBooking.id}
                  onClick={() =>
                    state.handleBookingAction(
                      selectedBooking.id,
                      "declined",
                      "Provider declined booking",
                    )
                  }
                >
                  Decline Request
                </AppButton>
                <AppButton
                  className="flex-1"
                  disabled={state.actionBookingId === selectedBooking.id}
                  onClick={() =>
                    state.handleBookingAction(
                      selectedBooking.id,
                      "accepted",
                      "Provider accepted booking",
                    )
                  }
                >
                  Accept Request
                </AppButton>
              </BookingActionBar>
            ) : null}

            {selectedBooking.bookingStatus === "accepted" ? (
              <BookingActionBar>
                <AppButton
                  className="flex-1"
                  disabled={state.actionBookingId === selectedBooking.id}
                  onClick={() =>
                    state.handleBookingAction(
                      selectedBooking.id,
                      "on_the_way",
                      "Provider started travel to customer",
                    )
                  }
                >
                  Update On The Way
                </AppButton>
              </BookingActionBar>
            ) : null}

            {selectedBooking.bookingStatus === "on_the_way" ? (
              <BookingActionBar>
                <AppButton
                  className="flex-1"
                  disabled={state.actionBookingId === selectedBooking.id}
                  onClick={() =>
                    state.handleBookingAction(
                      selectedBooking.id,
                      "arrived",
                      "Provider arrived at customer location",
                    )
                  }
                >
                  Update Arrived
                </AppButton>
              </BookingActionBar>
            ) : null}

            {selectedBooking.bookingStatus === "arrived" ? (
              <BookingActionBar>
                <AppButton
                  className="flex-1"
                  disabled={state.actionBookingId === selectedBooking.id}
                  onClick={() => void handleSendFinalAmount(selectedBooking)}
                >
                  Send Final Amount
                </AppButton>
              </BookingActionBar>
            ) : null}

            {selectedBooking.bookingStatus === "completed" ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-[16px] border border-[#d8f0dc] bg-[#f3fff6] px-4 py-3 text-[13px] font-semibold text-[#166534]">
                  Final cash amount sent to the customer. Waiting for customer cash confirmation.
                </p>
                <div className="rounded-[18px] border border-[#fde7d3] bg-[#fff7ed] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#ea580c]">Commission After Payment</p>
                    <p className="text-[20px] font-black text-[#c2410c]">{formatCurrency(selectedBooking.companyCommissionAmount)}</p>
                  </div>
                  <p className="mt-2 text-[13px] text-[#9a3412]">
                    This 5% becomes payable only after the customer confirms the cash payment.
                  </p>
                </div>
              </div>
            ) : null}

            {["paid", "review_requested", "reviewed"].includes(selectedBooking.bookingStatus) ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-[16px] border border-[#d8f0dc] bg-[#f3fff6] px-4 py-3 text-[13px] font-semibold text-[#166534]">
                  {selectedBooking.bookingStatus === "reviewed"
                    ? "Cash payment received and the customer review is completed."
                    : selectedBooking.bookingStatus === "review_requested"
                      ? "Cash payment received. The customer can leave a review now."
                      : "Cash payment received. The customer can now leave a review."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[#d8f0dc] bg-[#f3fff6] p-4">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#15803d]">Cash Collected</p>
                    <p className="mt-2 text-[22px] font-black text-[#166534]">{formatCurrency(selectedBooking.quotedAmount)}</p>
                  </div>
                  <div className="rounded-[18px] border border-[#fde7d3] bg-[#fff7ed] p-4">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#ea580c]">Pending to Company</p>
                    <p className="mt-2 text-[22px] font-black text-[#c2410c]">{formatCurrency(selectedBooking.companyCommissionAmount)}</p>
                    <p className="mt-1 text-[12px] text-[#9a3412]">
                      {selectedBooking.companyPaymentStatus === "paid" ? "Commission paid" : "Commission unpaid"}
                    </p>
                  </div>
                </div>
                <ProofPreviewCard
                  title="Customer Payment Proof"
                  dataUrl={selectedBooking.customerPaymentProofDataUrl}
                  fileName={selectedBooking.customerPaymentProofFileName}
                  mimeType={selectedBooking.customerPaymentProofMimeType}
                />
                <ProofPreviewCard
                  title="Company Payment Proof"
                  dataUrl={selectedBooking.providerCompanyPaymentProofDataUrl || commissionProofDataUrl}
                  fileName={selectedBooking.providerCompanyPaymentProofFileName || commissionProofFileName}
                  mimeType={selectedBooking.providerCompanyPaymentProofMimeType || commissionProofMimeType}
                />
                {selectedBooking.companyPaymentStatus !== "paid" ? (
                  <div className="space-y-3">
                    <BookingActionBar>
                      <AppButton
                        className="flex-1"
                        onClick={() => router.push("/provider/payments")}
                      >
                        Open Provider Payments
                      </AppButton>
                    </BookingActionBar>
                  </div>
                ) : null}
              </div>
            ) : null}

            {(selectedBooking.paymentStatus || selectedBooking.paymentOption) &&
            !["paid", "review_requested", "reviewed"].includes(selectedBooking.bookingStatus) ? (
              <div className="mt-4 rounded-[18px] border border-[#ebe3f5] bg-white px-4 py-4">
                <p className="text-[14px] font-extrabold text-[#0f172a]">Payment Details</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <DetailMetric
                    label="Payment Status"
                    value={selectedBooking.paymentStatus || "Pending"}
                    icon={<Wallet className="h-4 w-4 text-[#8E5EB5]" />}
                  />
                  <DetailMetric
                    label="Payment Method"
                    value={selectedBooking.paymentOption === "cash" ? "Cash" : selectedBooking.paymentOption === "online" ? "Online" : "Not set"}
                    icon={<CreditCard className="h-4 w-4 text-[#8E5EB5]" />}
                  />
                  <DetailMetric
                    label="Base Amount"
                    value={formatCurrency(selectedBooking.baseAmount || selectedBooking.quotedAmount)}
                    icon={<Wallet className="h-4 w-4 text-[#8E5EB5]" />}
                  />
                  <DetailMetric
                    label="Final Amount"
                    value={formatCurrency(selectedBooking.quotedAmount)}
                    icon={<Wallet className="h-4 w-4 text-[#8E5EB5]" />}
                  />
                </div>
              </div>
            ) : null}

            {selectedBookingReview ? (
              <div className="mt-4 rounded-[18px] border border-[#ebe3f5] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-extrabold text-[#0f172a]">Customer Review</p>
                    <p className="mt-1 text-[12px] text-[#64748b]">{selectedBookingReview.createdLabel}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[#8E5EB5]">
                    {Array.from({ length: selectedBookingReview.rating }).map((_, index) => (
                      <Star key={`${selectedBookingReview.id}-${index}`} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[#475569]">
                  {selectedBookingReview.comment}
                </p>
              </div>
            ) : selectedBooking.bookingStatus === "review_requested" || selectedBooking.bookingStatus === "reviewed" ? (
              <div className="mt-4 rounded-[18px] border border-[#ebe3f5] bg-white px-4 py-4">
                <p className="text-[14px] font-extrabold text-[#0f172a]">Customer Review</p>
                <p className="mt-2 text-[13px] text-[#64748b]">
                  {selectedBooking.bookingStatus === "reviewed"
                    ? "Review status is completed, but the review text is not linked in this task feed yet."
                    : "Waiting for the customer to submit a review for this task."}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <div className="mt-4 rounded-[20px] border border-[#eee5f7] bg-[#fcfaff] p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#8E5EB5]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-[15px] font-black text-[#1f1630]">{calendarMonthLabel}</p>
              <p className="mt-1 text-[12px] text-[#7b728a]">Select a date to load booking cards below.</p>
            </div>
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#8E5EB5]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-[#94a3b8]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarCells.map((cell, index) => {
              const count = cell.key ? bookingCountForDate(cell.key) : 0;
              const isActive = cell.key === calendarDate;

              return (
                <button
                  key={cell.key ?? `bookings-calendar-${index}`}
                  type="button"
                  disabled={!cell.key}
                  onClick={() => cell.key && setCalendarDate(cell.key)}
                  className={`flex h-14 flex-col items-center justify-center rounded-[14px] text-[12px] font-bold ${
                    isActive ? "bg-[#8E5EB5] text-white" : "bg-white text-[#1f1630] disabled:bg-transparent disabled:text-transparent"
                  }`}
                >
                  <span>{cell.label}</span>
                  {cell.key ? (
                    <span className={`mt-1 text-[10px] ${isActive ? "text-white/85" : count > 0 ? "text-[#8E5EB5]" : "text-[#c4b7d8]"}`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as typeof tab)}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-[14px] px-5 py-2.5 text-[13px] font-medium transition ${
                tab === value ? "border border-[#e8d9fb] bg-white text-[#8E5EB5] shadow-[0_10px_20px_rgba(142,94,181,0.10)]" : "bg-[#f7f1fc] text-[#746b88]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <EmptyState
              title={
                tab === "pending"
                  ? "No pending requests"
                  : tab === "upcoming"
                  ? "No upcoming bookings"
                  : tab === "ongoing"
                    ? "No ongoing bookings"
                  : tab === "canceled"
                    ? "No canceled bookings"
                    : tab === "all"
                      ? "No bookings found"
                      : "No completed bookings"
              }
              description={
                "No bookings found for the selected calendar date in this section."
              }
              icon={<CalendarDays className="h-6 w-6" />}
            />
          ) : (
            items.map((booking) => (
              <div
                key={booking.id}
                className="rounded-[22px] border border-[#eee5f7] bg-[#fcfaff] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.05)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-black text-[#0f172a]">{booking.serviceLabel}</p>
                    <p className="mt-1 text-[13px] text-[#475569]">{booking.customerName}</p>
                  </div>
                  <StatusBadge label={booking.statusLabel} tone={providerStatusTone(booking.bookingStatus)} />
                </div>
                <div className="mt-3 space-y-2 text-[13px] text-[#475569]">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#8E5EB5]" />
                    <span>{booking.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#8E5EB5]" />
                    <span>{booking.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-[#8E5EB5]" />
                    <span>{formatCurrency(booking.quotedAmount)}</span>
                  </div>
                  {booking.additionalCharge > 0 ? (
                    <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-[#8E5EB5]" />
                      <span>
                        Additional charge: {formatCurrency(booking.additionalCharge)}
                        {booking.additionalChargeDescription
                          ? ` (${booking.additionalChargeDescription})`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
                {tab === "ongoing" ? (
                  <div className="mt-4 rounded-[18px] border border-[#ebe3f5] bg-white px-4 py-4">
                    <p className="text-[14px] font-extrabold text-[#0f172a]">Task Progress</p>
                    <div className="mt-4 space-y-4">
                      {getProviderTaskSteps(booking.bookingStatus).map((step, index, steps) => (
                        <div key={step.label} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                step.status === "done"
                                  ? "border-[#8E5EB5] bg-[#8E5EB5] text-white"
                                  : step.status === "current"
                                    ? "border-[#8E5EB5] bg-white text-[#8E5EB5]"
                                    : "border-[#d9e2dd] bg-white text-[#98a2b3]"
                              }`}
                            >
                              {step.status === "done" ? (
                                <span className="text-[11px] font-bold">✓</span>
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-current" />
                              )}
                            </span>
                            {index < steps.length - 1 ? (
                              <span
                                className={`mt-1 h-8 w-[2px] ${
                                  step.status === "done" ? "bg-[#8E5EB5]" : "bg-[#e5e7eb]"
                                }`}
                              />
                            ) : null}
                          </div>
                          <div className="pt-0.5">
                            <p
                              className={`text-[14px] font-semibold ${
                                step.status === "pending" ? "text-[#98a2b3]" : "text-[#111827]"
                              }`}
                            >
                              {step.label}
                            </p>
                            <p className="mt-1 text-[12px] text-[#6b7280]">
                              {step.status === "done"
                                ? "Finished"
                                : step.status === "current"
                                  ? "Current step"
                                  : "Waiting"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {booking.bucket === "requests" ? (
                  <div className="mt-4 flex gap-3">
                    <AppButton
                      className="flex-1"
                      tone="secondary"
                      onClick={() => openBooking(booking.id)}
                    >
                      View Details
                    </AppButton>
                    <AppButton
                      className="flex-1"
                      tone="danger"
                      disabled={state.actionBookingId === booking.id}
                      onClick={() =>
                        state.handleBookingAction(booking.id, "declined", "Provider declined booking")
                      }
                    >
                      Decline
                    </AppButton>
                    <AppButton
                      className="flex-1"
                      disabled={state.actionBookingId === booking.id}
                      onClick={() =>
                        state.handleBookingAction(booking.id, "accepted", "Provider accepted booking")
                      }
                    >
                      Accept
                    </AppButton>
                  </div>
                ) : null}
                {tab === "upcoming" ? (
                  <div className="mt-4 flex gap-3">
                      <AppButton
                        className="flex-1"
                        onClick={() => router.push("/provider/bookings?tab=ongoing")}
                      >
                        Manage In Task Panel
                      </AppButton>
                    <AppButton
                      tone="secondary"
                      className="flex-1"
                      onClick={() => openBooking(booking.id)}
                    >
                      Open Booking
                    </AppButton>
                  </div>
                ) : null}
                {tab === "ongoing" ? (
                  <div className="mt-4 flex gap-3">
                    {booking.bookingStatus === "accepted" ? (
                      <AppButton
                        className="flex-1"
                        disabled={state.actionBookingId === booking.id}
                        onClick={() =>
                          state.handleBookingAction(
                            booking.id,
                            "on_the_way",
                            "Provider started travel to customer",
                          )
                        }
                      >
                        Mark On the Way
                      </AppButton>
                    ) : null}
                    {booking.bookingStatus === "on_the_way" ? (
                      <AppButton
                        className="flex-1"
                        disabled={state.actionBookingId === booking.id}
                        onClick={() =>
                          state.handleBookingAction(
                            booking.id,
                            "arrived",
                            "Provider arrived at customer location",
                          )
                        }
                      >
                        Mark Arrived
                      </AppButton>
                    ) : null}
                    {booking.bookingStatus === "arrived" ? (
                      <AppButton
                        className="flex-1"
                        disabled={state.actionBookingId === booking.id}
                        onClick={() => void handleSendFinalAmount(booking)}
                      >
                        Send Final Amount
                      </AppButton>
                    ) : null}
                    <AppButton
                      tone="secondary"
                      className="flex-1"
                      onClick={() => openBooking(booking.id)}
                    >
                      Open Booking
                    </AppButton>
                  </div>
                ) : null}
                {tab === "completes" && booking.bookingStatus === "completed" ? (
                  <div className="mt-4 flex gap-3">
                    <p className="flex-1 rounded-[14px] border border-[#d8f0dc] bg-[#f3fff6] px-4 py-3 text-[13px] font-semibold leading-5 text-[#166534]">
                      Waiting for customer cash confirmation.
                    </p>
                    <AppButton
                      tone="secondary"
                      className="flex-1"
                      onClick={() => openBooking(booking.id)}
                    >
                      Open Booking
                    </AppButton>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}

function getProviderTaskSteps(status: ProviderBookingItem["bookingStatus"]) {
  const labels = [
    "Booking accepted",
    "On the way",
    "Arrived at location",
    "Task completed",
    "Payment confirmed",
    "Review",
  ];

  const currentIndex =
    status === "accepted"
      ? 0
      : status === "on_the_way"
        ? 1
        : status === "arrived"
          ? 2
          : status === "completed"
            ? 3
            : status === "paid"
              ? 4
              : status === "review_requested" || status === "reviewed"
                ? 5
                : -1;

  return labels.map((label, index) => {
    if (currentIndex === -1) {
      return { label, status: "pending" as const };
    }

    if (
      index < currentIndex ||
      (index === currentIndex &&
        (status === "completed" || status === "paid" || status === "reviewed"))
    ) {
      return { label, status: "done" as const };
    }

    if (index === currentIndex) {
      return { label, status: "current" as const };
    }

    return { label, status: "pending" as const };
  });
}

export function CalendarScreen() {
  const state = useProviderAppData();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  const monthLabel = new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
  }).format(month);
  const startDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const firstWeekday = startDay.getDay();
  const daysInMonth = endDay.getDate();
  const cells: Array<{ label: number | null; key: string | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ label: null, key: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(month.getFullYear(), month.getMonth(), day));
    cells.push({ label: day, key });
  }

  const selectedBookings = state.bookings.filter((booking) => booking.scheduledDate === selectedDate);

  return (
    <PageShell
      title="Calendar"
      subtitle="See provider bookings by date and keep your schedule organised."
    >
      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4faf5]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-[18px] font-black text-[#0f172a]">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4faf5]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[12px] font-bold text-[#94a3b8]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2">
          {cells.map((cell, index) => {
            const totalBookings = cell.key
              ? state.bookings.filter((booking) => booking.scheduledDate === cell.key).length
              : 0;
            const isActive = cell.key === selectedDate;

            return (
              <button
                key={cell.key ?? `empty-${index}`}
                type="button"
                disabled={!cell.key}
                onClick={() => cell.key && setSelectedDate(cell.key)}
                className={`flex h-14 flex-col items-center justify-center rounded-[14px] text-[12px] font-bold ${
                  isActive
                    ? "bg-[#16a34a] text-white"
                    : "bg-[#f8fbf9] text-[#0f172a] disabled:bg-transparent"
                }`}
              >
                <span>{cell.label}</span>
                {cell.key ? (
                  <span className={`mt-1 text-[10px] ${isActive ? "text-white/85" : totalBookings > 0 ? "text-[#16a34a]" : "text-[#cbd5e1]"}`}>
                    {totalBookings}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-black text-[#0f172a]">{formatDateLabel(selectedDate)}</h2>
            <p className="mt-1 text-[13px] text-[#64748b]">Jobs scheduled for the selected day.</p>
          </div>
          <Link href="/provider/availability" className="text-[13px] font-bold text-[#16a34a]">
            Availability
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {selectedBookings.length === 0 ? (
            <EmptyState
              title="No bookings on this day"
              description="Pick another date to see scheduled jobs."
              icon={<Calendar className="h-6 w-6" />}
            />
          ) : (
            selectedBookings.map((booking) => (
              <div key={booking.id} className="rounded-[20px] border border-[#e7eee8] bg-[#fbfffc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-black text-[#0f172a]">{booking.serviceLabel}</p>
                    <p className="mt-1 text-[12px] text-[#64748b]">{booking.customerName}</p>
                  </div>
                  <StatusBadge label={booking.statusLabel} tone={providerStatusTone(booking.bookingStatus)} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-[13px] text-[#475569]">
                  <Clock3 className="h-4 w-4 text-[#16a34a]" />
                  <span>{formatTimeLabel(booking.scheduledDate, booking.scheduledStartTime)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}

export function MessagesScreen() {
  return (
    <PageShell
      title="Messages"
      subtitle="Live booking updates and provider alerts appear here."
      action={
        <Link
          href="/provider/more"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f4faf5] text-[#334155]"
        >
          <Settings className="h-5 w-5" />
        </Link>
      }
    >
      <BookingMessagesPanel
        role="provider"
        basePath="/provider/messages"
        emptyTitle="No messages yet"
        emptyDescription="Customer notes and booking conversations will appear here once someone books your service."
        emptyActionHref="/provider/bookings"
        emptyActionLabel="Open Bookings"
        theme={{
          accentText: "text-[#16a34a]",
          accentBg: "bg-[#16a34a]",
          accentSoftBg: "bg-[#f6fff8]",
          accentBorder: "border-[#bbf7d0]",
          badgeBg: "bg-[#eef9f1]",
          badgeText: "text-[#16a34a]",
          ownBubble: "bg-[#16a34a]",
          ownBubbleText: "text-white",
          otherBubble: "bg-[#f8fcf9]",
          otherBubbleText: "text-[#0f172a]",
          threadUnreadBorder: "border-[#bbf7d0]",
          threadUnreadBg: "bg-[#f6fff8]",
          composerButton: "bg-[#16a34a]",
        }}
      />
    </PageShell>
  );
}

export function EarningsScreen() {
  const state = useProviderAppData();
  const [paymentFilter, setPaymentFilter] = useState<"date" | "week" | "month" | "range" | "all">("week");
  const [selectedPaymentDate, setSelectedPaymentDate] = useState(getTodayKey());
  const [rangeStartDate, setRangeStartDate] = useState(getTodayKey());
  const [rangeEndDate, setRangeEndDate] = useState(getTodayKey());
  const [dailyAction, setDailyAction] = useState<"" | "withdraw" | "pay-company">("");
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  const today = new Date(`${getTodayKey()}T00:00:00`);
  const startOfWeek = new Date(today);
  const currentDay = startOfWeek.getDay();
  const weekOffset = currentDay === 0 ? 6 : currentDay - 1;
  startOfWeek.setDate(startOfWeek.getDate() - weekOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const isCollectedPayment = (booking: ProviderBookingItem) =>
    booking.paymentStatus === "paid" ||
    [
      "cash_paid_by_user",
      "payment_received_by_provider",
      "completed",
      "paid",
      "review_requested",
      "reviewed",
    ].includes(booking.bookingStatus);

  const paymentBookings = [...state.bookings]
    .filter(isCollectedPayment)
    .sort(
      (left, right) =>
        new Date(`${right.scheduledDate}T${right.scheduledStartTime}`).getTime() -
        new Date(`${left.scheduledDate}T${left.scheduledStartTime}`).getTime(),
    );

  const filteredPayments = paymentBookings.filter((booking) => {
    const bookingDate = new Date(`${booking.scheduledDate}T00:00:00`);

    if (paymentFilter === "date") {
      return booking.scheduledDate === selectedPaymentDate;
    }

    if (paymentFilter === "week") {
      return bookingDate >= startOfWeek && bookingDate <= endOfWeek;
    }

    if (paymentFilter === "month") {
      return (
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getFullYear() === today.getFullYear()
      );
    }

    if (paymentFilter === "range") {
      const startDate = new Date(`${rangeStartDate}T00:00:00`);
      const endDate = new Date(`${rangeEndDate}T00:00:00`);
      return bookingDate >= startDate && bookingDate <= endDate;
    }

    return true;
  });

  const totalCollected = filteredPayments
    .filter(isCollectedPayment)
    .reduce((sum, booking) => sum + booking.quotedAmount, 0);
  const totalPendingCompany = filteredPayments
    .filter(
      (booking) =>
        isCollectedPayment(booking) &&
        booking.companyPaymentStatus !== "paid" &&
        booking.companyCommissionAmount > 0,
    )
    .reduce((sum, booking) => sum + booking.companyCommissionAmount, 0);
  const totalNetEarnings = filteredPayments
    .filter(isCollectedPayment)
    .reduce((sum, booking) => sum + booking.providerNetAmount, 0);
  const totalCashCollected = filteredPayments
    .filter((booking) => isCollectedPayment(booking) && (booking.paymentOption ?? "cash") === "cash")
    .reduce((sum, booking) => sum + booking.quotedAmount, 0);
  const totalOnlineCollected = filteredPayments
    .filter((booking) => isCollectedPayment(booking) && booking.paymentOption === "online")
    .reduce((sum, booking) => sum + booking.quotedAmount, 0);
  const leadPayment = filteredPayments[0] ?? null;
  const payableBookings = filteredPayments.filter(
    (booking) =>
      isCollectedPayment(booking) &&
      booking.companyPaymentStatus !== "paid" &&
      booking.companyCommissionAmount > 0,
  );
  const filterSummary =
    paymentFilter === "date"
      ? `Showing payments for ${formatDateLabel(selectedPaymentDate)}`
      : paymentFilter === "week"
        ? "Showing payments for this week"
        : paymentFilter === "month"
        ? "Showing payments for this month"
        : paymentFilter === "range"
          ? `Showing payments from ${formatDateLabel(rangeStartDate)} to ${formatDateLabel(rangeEndDate)}`
          : "Showing all payment records";

  async function handleDailyCompanyPayment() {
    if (payableBookings.length === 0) {
      state.setNotice("No company payment is due for the selected total.");
      return;
    }

    const accessToken = await getProviderAccessToken();

    if (!accessToken) {
      state.setError("Your session expired. Please log in again.");
      return;
    }

    setDailyAction("pay-company");
    state.setError("");
    state.setNotice("");

    try {
      const response = await fetch("/api/provider/company-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          proofDataUrl: "daily-company-payment-placeholder",
          proofFileName: "daily-company-payment.txt",
          proofMimeType: "text/plain",
          depositedAmount: payableBookings.reduce(
            (sum, booking) => sum + Number(booking.companyCommissionAmount ?? 0),
            0,
          ),
        }),
      });

      const result = (await response.json().catch(() => ({}))) as { success?: true; error?: string };

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to submit company payment.");
      }

      await state.reloadWorkspace();
      state.setNotice("Daily company payment submitted for admin approval.");
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Unable to settle daily company payment.");
    } finally {
      setDailyAction("");
    }
  }

  function handleDailyWithdraw() {
    if (totalNetEarnings <= 0) {
      state.setNotice("No withdrawal amount is available for the selected total.");
      return;
    }

    setDailyAction("withdraw");
    state.setError("");
    state.setNotice("Daily withdrawal is routed through admin during testing.");
    window.setTimeout(() => setDailyAction(""), 600);
  }

  return (
    <PageShell
      title="Payments"
      subtitle="See cash, online, 5% DELLA commission, provider balance, and booking-linked payment details."
    >
      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <div className="flex items-start gap-3">
          <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[16px] bg-[linear-gradient(180deg,#8E5EB5_0%,#6F3EA1_100%)] text-white shadow-[0_10px_20px_rgba(142,94,181,0.24)]">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black text-[#1f1630]">
              {leadPayment?.customerName ?? "Provider Payments"}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-[#7b728a]">
              {leadPayment?.serviceLabel ?? "Full payment summary"}
            </p>
            <p className="mt-1 text-[11px] text-[#8f86a2]">
              {leadPayment
                ? `Booking ID ${leadPayment.id} • ${leadPayment.schedule}`
                : "No payment records found for the selected filter"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Total Earning"
          value={formatCurrency(totalCollected)}
          meta="Full amount collected"
          accent="text-[#166534]"
        />
        <MetricCard
          label="Pending Company"
          value={formatCurrency(totalPendingCompany)}
          meta="5% commission to DELLA"
          accent="text-[#ea580c]"
        />
        <MetricCard
          label="Withdrawal"
          value={formatCurrency(totalNetEarnings)}
          meta="Keep after commission"
          accent="text-[#6F3EA1]"
        />
        <MetricCard
          label="Booking IDs"
          value={String(filteredPayments.length)}
          meta="Payment rows in view"
          accent="text-[#0f172a]"
        />
      </section>

      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-black text-[#0f172a]">Filter Payments</h2>
            <p className="mt-1 text-[13px] text-[#64748b]">{filterSummary}</p>
          </div>
          <span className="rounded-full bg-[#f5f1fa] px-3 py-1 text-[11px] font-bold text-[#8E5EB5]">
            {filteredPayments.length}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["date", "Date"],
            ["week", "Week"],
            ["month", "Month"],
            ["range", "Range"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPaymentFilter(value as "date" | "week" | "month" | "range" | "all")}
              className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
                paymentFilter === value
                  ? "bg-[#8E5EB5] text-white shadow-[0_10px_20px_rgba(142,94,181,0.22)]"
                  : "bg-[#f6f1fb] text-[#6c5d83]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {paymentFilter === "date" ? (
          <label className="mt-4 block">
            <span className="text-[12px] font-semibold text-[#6c5d83]">Select booking date</span>
            <input
              type="date"
              value={selectedPaymentDate}
              onChange={(event) => setSelectedPaymentDate(event.target.value || getTodayKey())}
              className="mt-2 h-11 w-full rounded-[14px] border border-[#ded5eb] bg-white px-4 text-[14px] text-[#1f1630] outline-none"
            />
          </label>
        ) : null}
        {paymentFilter === "range" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-semibold text-[#6c5d83]">Start date</span>
              <input
                type="date"
                value={rangeStartDate}
                onChange={(event) => setRangeStartDate(event.target.value || getTodayKey())}
                className="mt-2 h-11 w-full rounded-[14px] border border-[#ded5eb] bg-white px-4 text-[14px] text-[#1f1630] outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-[#6c5d83]">End date</span>
              <input
                type="date"
                value={rangeEndDate}
                min={rangeStartDate}
                onChange={(event) => setRangeEndDate(event.target.value || rangeStartDate)}
                className="mt-2 h-11 w-full rounded-[14px] border border-[#ded5eb] bg-white px-4 text-[14px] text-[#1f1630] outline-none"
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-black text-[#0f172a]">Daily Total</h2>
            <p className="mt-1 text-[13px] text-[#64748b]">
              Only this total can be used for withdraw and pay to company.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-[13px] text-[#544b66]">
          <SummaryLine label="Cash Payments" value={formatCurrency(totalCashCollected)} />
          <SummaryLine label="Online Payments" value={formatCurrency(totalOnlineCollected)} />
          <SummaryLine label="Total Pending to Company" value={formatCurrency(totalPendingCompany)} />
          <div className="border-t border-[#f0e8f8] pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-black text-[#1f1630]">Estimated Withdrawal</p>
              <p className="text-[22px] font-black text-[#6F3EA1]">{formatCurrency(totalNetEarnings)}</p>
            </div>
            <p className="mt-1 text-[11px] text-[#8f86a2]">
              Cash jobs: provider collects the full amount and later pays DELLA 5%. Online jobs: DELLA deducts 5% first and pays the balance to the provider.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <AppButton
            className="w-full px-3 text-[13px] sm:text-[14px]"
            disabled={dailyAction !== "" || totalNetEarnings <= 0}
            onClick={handleDailyWithdraw}
          >
            {dailyAction === "withdraw" ? "Processing..." : `Withdraw ${formatCurrency(totalNetEarnings)}`}
          </AppButton>
          <AppButton
            className="w-full px-3 text-[13px] sm:text-[14px]"
            tone="secondary"
            disabled={dailyAction !== "" || totalPendingCompany <= 0}
            onClick={() => void handleDailyCompanyPayment()}
          >
            {dailyAction === "pay-company" ? "Paying..." : `Pay ${formatCurrency(totalPendingCompany)}`}
          </AppButton>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-black text-[#0f172a]">Payment Details</h2>
            <p className="mt-1 text-[13px] text-[#64748b]">
              Each row includes booking ID, date, mode, totals, commission, proof, and link to full detail.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredPayments.length === 0 ? (
            <EmptyState
              title="No payment records"
              description="Change the filter to see other booking payments, commission, and withdrawal data."
              icon={<CreditCard className="h-6 w-6" />}
            />
          ) : (
            filteredPayments.map((booking) => {
              const collected = isCollectedPayment(booking);
              const paymentMode = booking.paymentOption === "online" ? "Online" : "Cash";
              const isCashPayment = (booking.paymentOption ?? "cash") !== "online";
              const companyStatusLabel =
                booking.companyCommissionAmount <= 0
                  ? "Not due"
                  : booking.companyPaymentStatus === "paid"
                    ? "Paid"
                    : "Pending";
              const paymentStatusLabel = collected
                ? "Paid"
                : booking.paymentStatus
                  ? booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)
                  : "Pending";
              const settlementNote = isCashPayment
                ? `Cash collected by provider. DELLA commission to pay: ${formatCurrency(booking.companyCommissionAmount)}.`
                : `Online payment handled by DELLA. 5% commission is deducted first, and ${formatCurrency(booking.providerNetAmount)} is payable to the provider.`;

              return (
                <div
                  key={booking.id}
                  className="rounded-[22px] border border-[#eee5f7] bg-[#fcfaff] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-[#0f172a]">{booking.serviceLabel}</p>
                      <p className="mt-1 text-[12px] font-semibold text-[#6F3EA1]">Booking ID: {booking.id}</p>
                      <p className="mt-1 truncate text-[13px] text-[#475569]">{booking.customerName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge label={paymentMode} tone={booking.paymentOption === "online" ? "info" : "accepted"} />
                      <StatusBadge label={paymentStatusLabel} tone={collected ? "completed" : "pending"} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-[12px] text-[#475569] sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-[#8E5EB5]" />
                      <span>{formatDateLabel(booking.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[#8E5EB5]" />
                      <span>{formatTimeLabel(booking.scheduledDate, booking.scheduledStartTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#8E5EB5]" />
                      <span className="truncate">{booking.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#8E5EB5]" />
                      <span>{collected ? "Collected" : "Awaiting payment confirmation"}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-[16px] border border-[#d8f0dc] bg-[#f3fff6] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#15803d]">Amount</p>
                      <p className="mt-1 text-[16px] font-black text-[#166534]">{formatCurrency(booking.quotedAmount)}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[#15803d]">
                        {isCashPayment ? "Collected by provider" : "Handled by DELLA"}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-[#fde7d3] bg-[#fff7ed] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ea580c]">Commission</p>
                      <p className="mt-1 text-[16px] font-black text-[#c2410c]">{formatCurrency(booking.companyCommissionAmount)}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[#c2410c]">5% DELLA fee</p>
                    </div>
                    <div className="rounded-[16px] border border-[#e9def8] bg-[#f8f3fd] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
                        {isCashPayment ? "Provider Keeps" : "Provider Payout"}
                      </p>
                      <p className="mt-1 text-[16px] font-black text-[#6F3EA1]">{formatCurrency(booking.providerNetAmount)}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[#7c3aed]">
                        {isCashPayment ? "After 5% company due" : "After commission deduction"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-[12px] text-[#5b536d] sm:grid-cols-2">
                    <p>Company Status: <span className="font-bold text-[#1f1630]">{companyStatusLabel}</span></p>
                    <p>Customer Proof: <span className="font-bold text-[#1f1630]">{booking.customerPaymentProofDataUrl ? "Attached" : "No proof"}</span></p>
                    <p>Company Slip: <span className="font-bold text-[#1f1630]">{booking.providerCompanyPaymentProofDataUrl ? "Attached" : "No slip"}</span></p>
                    <p>Review Status: <span className="font-bold text-[#1f1630]">{booking.customerStatusLabel}</span></p>
                  </div>

                  <p className="mt-3 rounded-[16px] border border-[#eee5f7] bg-white px-4 py-3 text-[12px] font-semibold text-[#6c5d83]">
                    {settlementNote}
                  </p>

                  <div className="mt-4 flex gap-3">
                    <AppButton href={`/provider/bookings/${booking.id}`} tone="secondary" className="flex-1">
                      Open Full Details
                    </AppButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </PageShell>
  );
}

type ProviderPaymentTab = "overview" | "payments" | "withdrawals";
type ProviderPaymentRange = "today" | "week" | "month" | "custom";
type ProviderPaymentModal = "withdraw" | "company" | null;
type ProviderPaymentTransactionKind = "payment" | "commission" | "withdrawal";
type ProviderPaymentStatus = "Completed" | "Pending" | "Paid";
type ProviderPaymentMethodSection = "cash" | "others";

type ProviderPaymentTransaction = {
  id: string;
  kind: ProviderPaymentTransactionKind;
  title: string;
  bookingLabel?: string;
  date: string;
  timeLabel: string;
  amount: number;
  direction: "in" | "out";
  status: ProviderPaymentStatus;
  paymentMethod?: ProviderLedgerMethod;
};

type ProviderLedgerMethod = "Cash" | "Card" | "Online" | "Wallet";

type ProviderLedgerRow = {
  id: string;
  date: string;
  bookingId: string;
  paymentMethod: ProviderLedgerMethod;
  earned: number;
  toCompany: number;
  netEarned: number;
};

const PROVIDER_PAYMENT_TRANSACTIONS: ProviderPaymentTransaction[] = [
  {
    id: "payment-bk-10021",
    kind: "payment",
    title: "Payment Received",
    bookingLabel: "Booking #BK-10021",
    date: "2026-07-01",
    timeLabel: "01 Jul 2026, 6:30 PM",
    amount: 80,
    direction: "in",
    status: "Completed",
    paymentMethod: "Cash",
  },
  {
    id: "commission-bk-10021",
    kind: "commission",
    title: "Commission to Company",
    bookingLabel: "Booking #BK-10021",
    date: "2026-07-01",
    timeLabel: "01 Jul 2026, 6:30 PM",
    amount: 15,
    direction: "out",
    status: "Pending",
    paymentMethod: "Cash",
  },
  {
    id: "withdrawal-bank-10001",
    kind: "withdrawal",
    title: "Withdrawal to Bank",
    date: "2026-07-01",
    timeLabel: "01 Jul 2026, 2:15 PM",
    amount: 200,
    direction: "out",
    status: "Completed",
  },
  {
    id: "payment-bk-10020",
    kind: "payment",
    title: "Payment Received",
    bookingLabel: "Booking #BK-10020",
    date: "2026-06-30",
    timeLabel: "30 Jun 2026, 5:00 PM",
    amount: 60,
    direction: "in",
    status: "Completed",
    paymentMethod: "Card",
  },
  {
    id: "commission-bk-10020",
    kind: "commission",
    title: "Commission to Company",
    bookingLabel: "Booking #BK-10020",
    date: "2026-06-30",
    timeLabel: "30 Jun 2026, 5:00 PM",
    amount: 12,
    direction: "out",
    status: "Paid",
    paymentMethod: "Card",
  },
];

const PROVIDER_LEDGER_ROWS: ProviderLedgerRow[] = [
  {
    id: "ledger-10021",
    date: "01 Jul 2026",
    bookingId: "BK-10021",
    paymentMethod: "Cash",
    earned: 80,
    toCompany: 15,
    netEarned: 65,
  },
  {
    id: "ledger-10020",
    date: "01 Jul 2026",
    bookingId: "BK-10020",
    paymentMethod: "Card",
    earned: 60,
    toCompany: 0,
    netEarned: 60,
  },
  {
    id: "ledger-10018",
    date: "30 Jun 2026",
    bookingId: "BK-10018",
    paymentMethod: "Online",
    earned: 120,
    toCompany: 0,
    netEarned: 120,
  },
  {
    id: "ledger-10017",
    date: "30 Jun 2026",
    bookingId: "BK-10017",
    paymentMethod: "Wallet",
    earned: 45,
    toCompany: 0,
    netEarned: 45,
  },
  {
    id: "ledger-10015",
    date: "29 Jun 2026",
    bookingId: "BK-10015",
    paymentMethod: "Cash",
    earned: 100,
    toCompany: 30,
    netEarned: 70,
  },
];

function getLedgerMethodClasses(method: ProviderLedgerMethod) {
  if (method === "Cash") {
    return "bg-[#fff1e8] text-[#ea580c]";
  }

  if (method === "Card") {
    return "bg-[#eaf1ff] text-[#3157c9]";
  }

  if (method === "Online") {
    return "bg-[#e5f8f1] text-[#0f766e]";
  }

  return "bg-[#f3ebff] text-[#7c3aed]";
}

function getProviderPaymentStatusClasses(status: ProviderPaymentStatus) {
  if (status === "Pending") {
    return "bg-[#fff1f2] text-[#dc2626]";
  }

  if (status === "Paid") {
    return "bg-[#edf9f0] text-[#16a34a]";
  }

  return "bg-[#f2ebfd] text-[#7c3aed]";
}

function getProviderPaymentIcon(
  kind: ProviderPaymentTransactionKind,
  direction: ProviderPaymentTransaction["direction"],
) {
  if (kind === "commission") {
    return {
      wrapperClassName: "bg-[#fff3ea] text-[#f97316]",
      icon: <Landmark className="h-5 w-5" />,
    };
  }

  if (kind === "withdrawal") {
    return {
      wrapperClassName: "bg-[#f3ebff] text-[#8E5EB5]",
      icon: <Wallet className="h-5 w-5" />,
    };
  }

  return {
    wrapperClassName:
      direction === "in" ? "bg-[#edf9f0] text-[#16a34a]" : "bg-[#f3ebff] text-[#8E5EB5]",
    icon: <CreditCard className="h-5 w-5" />,
  };
}

function getProviderLedgerMethodFromBooking(
  booking: ProviderBookingItem,
): ProviderLedgerMethod {
  return booking.paymentOption === "online" ? "Online" : "Cash";
}

function getProviderBookingEventDate(booking: ProviderBookingItem) {
  return (
    booking.paidAt ||
    booking.paymentReceivedByProviderAt ||
    booking.cashPaidByUserAt ||
    booking.paymentSentAt ||
    booking.completedAt ||
    booking.scheduledDate ||
    booking.createdAt
  );
}

function getProviderBookingEventDateOnly(booking: ProviderBookingItem) {
  const rawValue = getProviderBookingEventDate(booking);
  return rawValue ? rawValue.slice(0, 10) : booking.scheduledDate;
}

function formatProviderBookingDateLabel(booking: ProviderBookingItem) {
  const rawValue = getProviderBookingEventDate(booking);

  if (!rawValue) {
    return booking.schedule;
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    return booking.schedule;
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

function formatProviderLedgerDate(booking: ProviderBookingItem) {
  const rawValue = getProviderBookingEventDate(booking);

  if (!rawValue) {
    return booking.scheduledDate;
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    return booking.scheduledDate;
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function getTodayIsoDate() {
  return toIsoDate(new Date());
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function getWeekStartIsoDate() {
  const today = new Date();
  const start = addDays(today, -today.getDay());
  return toIsoDate(start);
}

function getWeekEndIsoDate() {
  const today = new Date();
  const end = addDays(today, 6 - today.getDay());
  return toIsoDate(end);
}

function getMonthStartIsoDate() {
  const today = new Date();
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

function getMonthEndIsoDate() {
  const today = new Date();
  return toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

function formatIsoDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function ProviderPaymentModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#170d28]/45 px-4 pb-4 pt-10 backdrop-blur-[2px]">
      <div className="w-full max-w-[430px] rounded-[30px] bg-white p-5 shadow-[0_28px_80px_rgba(20,12,34,0.3)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[1.15rem] font-black tracking-[-0.04em] text-[#1c1530]">
              {title}
            </h3>
            <p className="mt-1 text-[13px] leading-5 text-[#7b748f]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f0fb] text-[#8E5EB5]"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function PaymentsScreen() {
  const state = useProviderAppData();
  const router = useRouter();
  const companyProofInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderPaymentTab>("overview");
  const [activeRange, setActiveRange] = useState<ProviderPaymentRange>("custom");
  const [modal, setModal] = useState<ProviderPaymentModal>(null);
  const [customStartDate, setCustomStartDate] = useState(getTodayIsoDate);
  const [customEndDate, setCustomEndDate] = useState(getTodayIsoDate);
  const [showLedger, setShowLedger] = useState(false);
  const [paymentHistorySection, setPaymentHistorySection] =
    useState<ProviderPaymentMethodSection>("cash");
  const [ledgerSection, setLedgerSection] = useState<ProviderPaymentMethodSection>("cash");
  const [companyPayableSummary, setCompanyPayableSummary] = useState<{
    payableAmount: number;
    processingAmount: number;
    latestSubmission: null | {
      id: string;
      payableAmountSnapshot: number;
      submittedAmount: number;
      adminReceivedAmount: number;
      status: string;
      proofFileName: string;
      submittedAt: string;
      reviewedAt: string;
    };
  }>({
    payableAmount: 0,
    processingAmount: 0,
    latestSubmission: null,
  });
  const [companyPayableSummaryLoaded, setCompanyPayableSummaryLoaded] = useState(false);
  const [companyProofName, setCompanyProofName] = useState("");
  const [companyProofError, setCompanyProofError] = useState("");
  const [companyProofDataUrl, setCompanyProofDataUrl] = useState("");
  const [companyProofMimeType, setCompanyProofMimeType] = useState("");
  const [companyDepositAmount, setCompanyDepositAmount] = useState("");

  const fallback = LoadingOrError(state);

  const allPaymentTransactions = useMemo<ProviderPaymentTransaction[]>(() => {
    return state.bookings
      .flatMap((booking) => {
        const transactions: ProviderPaymentTransaction[] = [];
        const date = getProviderBookingEventDateOnly(booking);
        const timeLabel = formatProviderBookingDateLabel(booking);
        const paymentMethod = getProviderLedgerMethodFromBooking(booking);
        const bookingLabel = `Booking #${booking.id.slice(0, 8).toUpperCase()}`;
        const paymentCompleted =
          booking.paymentStatus === "paid" ||
          Boolean(booking.paidAt || booking.paymentReceivedByProviderAt || booking.cashPaidByUserAt);

        if (paymentCompleted && booking.quotedAmount > 0) {
          transactions.push({
            id: `payment-${booking.id}`,
            kind: "payment",
            title: "Payment Received",
            bookingLabel,
            date,
            timeLabel,
            amount: booking.quotedAmount,
            direction: "in",
            status: "Completed",
            paymentMethod,
          });
        }

        if (booking.companyCommissionAmount > 0) {
          transactions.push({
            id: `commission-${booking.id}`,
            kind: "commission",
            title: "Commission to Company",
            bookingLabel,
            date,
            timeLabel,
            amount: booking.companyCommissionAmount,
            direction: "out",
            status:
              booking.companyPaymentStatus === "paid"
                ? "Paid"
                : booking.companyPaymentStatus === "payment_process"
                  ? "Pending"
                  : "Pending",
            paymentMethod,
          });
        }

        return transactions;
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [state.bookings]);
  const ledgerSourceRows = useMemo<ProviderLedgerRow[]>(() => {
    return state.bookings
      .filter((booking) => booking.quotedAmount > 0)
      .map((booking) => ({
        id: `ledger-${booking.id}`,
        date: formatProviderLedgerDate(booking),
        bookingId: booking.id.slice(0, 8).toUpperCase(),
        paymentMethod: getProviderLedgerMethodFromBooking(booking),
        earned: booking.quotedAmount,
        toCompany: booking.companyCommissionAmount,
        netEarned:
          booking.providerNetAmount > 0
            ? booking.providerNetAmount
            : Math.max(0, booking.quotedAmount - booking.companyCommissionAmount),
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [state.bookings]);
  const activeStartDate = useMemo(() => {
    if (activeRange === "today") {
      return getTodayIsoDate();
    }

    if (activeRange === "week") {
      return getWeekStartIsoDate();
    }

    if (activeRange === "month") {
      return getMonthStartIsoDate();
    }

    return customStartDate;
  }, [activeRange, customStartDate]);
  const activeEndDate = useMemo(() => {
    if (activeRange === "today") {
      return getTodayIsoDate();
    }

    if (activeRange === "week") {
      return getWeekEndIsoDate();
    }

    if (activeRange === "month") {
      return getMonthEndIsoDate();
    }

    return customEndDate;
  }, [activeRange, customEndDate]);
  const filteredTransactions = useMemo(() => {
    const visibleKinds =
      activeTab === "payments"
        ? (["payment"] satisfies ProviderPaymentTransactionKind[])
        : activeTab === "withdrawals"
          ? (["withdrawal"] satisfies ProviderPaymentTransactionKind[])
          : (["payment", "commission", "withdrawal"] satisfies ProviderPaymentTransactionKind[]);

    return allPaymentTransactions.filter(
      (transaction) =>
        visibleKinds.includes(transaction.kind) &&
        transaction.date >= activeStartDate &&
        transaction.date <= activeEndDate,
    );
  }, [activeEndDate, activeStartDate, activeTab, allPaymentTransactions]);

  const summaryDateIso = filteredTransactions[0]?.date || activeEndDate;
  const summaryTransactions = useMemo(
    () => allPaymentTransactions.filter((transaction) => transaction.date === summaryDateIso),
    [allPaymentTransactions, summaryDateIso],
  );
  const overviewTransactions = allPaymentTransactions;
  const paymentHistoryTransactions = useMemo(() => {
    if (activeTab !== "payments") {
      return filteredTransactions;
    }

    return filteredTransactions.filter((transaction) =>
      paymentHistorySection === "cash"
        ? transaction.paymentMethod === "Cash"
        : transaction.paymentMethod !== "Cash",
    );
  }, [activeTab, filteredTransactions, paymentHistorySection]);
  const ledgerRows = useMemo(
    () =>
      ledgerSourceRows.filter((row) =>
        ledgerSection === "cash" ? row.paymentMethod === "Cash" : row.paymentMethod !== "Cash",
      ),
    [ledgerSection, ledgerSourceRows],
  );
  const ledgerTotals = useMemo(
    () => ({
      earned: ledgerRows.reduce((total, row) => total + row.earned, 0),
      toCompany: ledgerRows.reduce((total, row) => total + row.toCompany, 0),
      netEarned: ledgerRows.reduce((total, row) => total + row.netEarned, 0),
      bookingCount: ledgerRows.length,
      cashCount: ledgerRows.filter((row) => row.paymentMethod === "Cash").length,
      otherCount: ledgerRows.filter((row) => row.paymentMethod !== "Cash").length,
    }),
    [ledgerRows],
  );
  const earningsToday = summaryTransactions
    .filter((transaction) => transaction.kind === "payment")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const withdrawnToday = summaryTransactions
    .filter((transaction) => transaction.kind === "withdrawal")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const toCompanyToday = summaryTransactions
    .filter((transaction) => transaction.kind === "commission")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const ledgerSummary = {
    totalEarned: ledgerSourceRows.reduce((total, row) => total + row.earned, 0),
    toCompany: ledgerSourceRows.reduce((total, row) => total + row.toCompany, 0),
    netEarned: ledgerSourceRows.reduce((total, row) => total + row.netEarned, 0),
    cashJobs: ledgerSourceRows.filter((row) => row.paymentMethod === "Cash").length,
    otherPayments: ledgerSourceRows.filter((row) => row.paymentMethod !== "Cash").length,
  };
  const walletBalance = state.bookings
    .filter(
      (booking) =>
        booking.paymentOption === "online" &&
        (booking.paymentStatus === "paid" || Boolean(booking.paidAt)),
    )
    .reduce(
      (sum, booking) =>
        sum +
        (booking.providerNetAmount > 0
          ? booking.providerNetAmount
          : Math.max(0, booking.quotedAmount - booking.companyCommissionAmount)),
      0,
    );
  const derivedPendingCompanyAmount = state.bookings
    .filter(
      (booking) =>
        booking.companyCommissionAmount > 0 &&
        booking.companyPaymentStatus !== "paid" &&
        booking.companyPaymentStatus !== "payment_process",
    )
    .reduce((sum, booking) => sum + Number(booking.companyCommissionAmount ?? 0), 0);
  const derivedProcessingCompanyAmount = state.bookings
    .filter(
      (booking) =>
        booking.companyCommissionAmount > 0 &&
        booking.companyPaymentStatus === "payment_process",
    )
    .reduce((sum, booking) => sum + Number(booking.companyCommissionAmount ?? 0), 0);
  const pendingCompanyAmount =
    companyPayableSummaryLoaded ? companyPayableSummary.payableAmount : derivedPendingCompanyAmount;
  const processingCompanyAmount =
    companyPayableSummaryLoaded
      ? companyPayableSummary.processingAmount
      : derivedProcessingCompanyAmount;
  const isCompanyPaymentProcessing = processingCompanyAmount > 0;
  const isSubmittingCompanyPayment = state.actionBookingId === "provider-company-payment";
  const companyDepositAmountValue = Number(companyDepositAmount);
  const companyDepositMatchesPending =
    Number.isFinite(companyDepositAmountValue) &&
    Math.round((companyDepositAmountValue + Number.EPSILON) * 100) / 100 ===
      Math.round((pendingCompanyAmount + Number.EPSILON) * 100) / 100;
  const canSubmitCompanyPayment =
    Boolean(companyProofName) &&
    Boolean(companyProofDataUrl) &&
    companyDepositAmount.trim().length > 0 &&
    Number.isFinite(companyDepositAmountValue) &&
    companyDepositAmountValue > 0 &&
    companyDepositMatchesPending &&
    pendingCompanyAmount > 0;

  function resetCompanyProofState() {
    setCompanyProofName("");
    setCompanyProofError("");
    setCompanyProofDataUrl("");
    setCompanyProofMimeType("");
    setCompanyDepositAmount("");
    if (companyProofInputRef.current) {
      companyProofInputRef.current.value = "";
    }
  }

  async function handleCompanyProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setCompanyProofName("");
      setCompanyProofError("");
      setCompanyProofDataUrl("");
      setCompanyProofMimeType("");
      return;
    }

    if (!isPaymentProofMimeType(file.type)) {
      setCompanyProofName("");
      setCompanyProofDataUrl("");
      setCompanyProofMimeType("");
      setCompanyProofError("Upload JPG, JPEG, or PDF only.");
      event.target.value = "";
      return;
    }

    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      setCompanyProofName("");
      setCompanyProofDataUrl("");
      setCompanyProofMimeType("");
      setCompanyProofError("File must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    const dataUrl = await readFileAsDataUrl(file).catch(() => "");

    if (!dataUrl) {
      setCompanyProofName("");
      setCompanyProofDataUrl("");
      setCompanyProofMimeType("");
      setCompanyProofError("Unable to read the payment slip file.");
      event.target.value = "";
      return;
    }

    setCompanyProofName(file.name);
    setCompanyProofDataUrl(dataUrl);
    setCompanyProofMimeType(file.type);
    setCompanyProofError("");
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncLedgerView = () => {
      const params = new URLSearchParams(window.location.search);
      setShowLedger(params.get("view") === "ledger");
    };

    syncLedgerView();
    window.addEventListener("popstate", syncLedgerView);

    return () => {
      window.removeEventListener("popstate", syncLedgerView);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCompanyPayableSummary() {
      const accessToken = await getProviderAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch("/api/provider/company-payments", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null);

      const result = response
        ? ((await response.json().catch(() => ({}))) as {
            payableAmount?: number;
            processingAmount?: number;
            latestSubmission?: {
              id: string;
              payableAmountSnapshot: number;
              submittedAmount: number;
              adminReceivedAmount: number;
              status: string;
              proofFileName: string;
              submittedAt: string;
              reviewedAt: string;
            } | null;
          })
        : null;

      if (!active || !response?.ok || !result) {
        return;
      }

      setCompanyPayableSummary({
        payableAmount: Number(result.payableAmount ?? 0),
        processingAmount: Number(result.processingAmount ?? 0),
        latestSubmission: result.latestSubmission ?? null,
      });
      setCompanyPayableSummaryLoaded(true);
    }

    void loadCompanyPayableSummary();

    return () => {
      active = false;
    };
  }, [state.bookings, state.notice]);

  const paymentTabs: Array<{ key: ProviderPaymentTab; label: string; icon: React.ReactNode }> = [
    {
      key: "overview",
      label: "Overview",
      icon: <Wallet className="h-4.5 w-4.5" />,
    },
    {
      key: "payments",
      label: "Payment History",
      icon: <CreditCard className="h-4.5 w-4.5" />,
    },
    {
      key: "withdrawals",
      label: "Withdrawal History",
      icon: <Wallet className="h-4.5 w-4.5" />,
    },
  ];
  const rangeTabs: Array<{ key: ProviderPaymentRange; label: string }> = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom Range" },
  ];
  const methodSections: Array<{
    key: ProviderPaymentMethodSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "cash",
      label: "Cash",
      icon: <Wallet className="h-4.5 w-4.5" />,
    },
    {
      key: "others",
      label: "Others",
      icon: <CreditCard className="h-4.5 w-4.5" />,
    },
  ];

  if (fallback) {
    return fallback;
  }

  if (showLedger) {
    return (
      <MobilePage className="pb-36" fullWidth>
        <section className="space-y-5">
          <header className="rounded-[28px] bg-white px-4 py-5 shadow-[0_20px_44px_rgba(91,45,144,0.1)] ring-1 ring-[#efe7f8]">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLedger(false);
                  router.push("/provider/payments");
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f8f2ff] text-[#8E5EB5]"
                aria-label="Back to Payments"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div className="pt-1 text-center">
                <h1 className="text-[1.95rem] font-black tracking-[-0.06em] text-[#17153b]">
                  Transaction Ledger
                </h1>
                <p className="mt-2 text-[14px] leading-6 text-[#6f748b]">
                  Booking-wise earnings with company payable details
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f8f2ff] text-[#8E5EB5]"
                aria-label="Filter ledger dates"
              >
                <CalendarDays className="h-6 w-6" />
              </button>
            </div>
          </header>

          <section className="rounded-[28px] bg-white px-4 py-4 shadow-[0_20px_44px_rgba(91,45,144,0.08)] ring-1 ring-[#efe7f8]">
            <div className="grid grid-cols-4 overflow-hidden rounded-[18px] border border-[#ede4f7] bg-[#fffefe]">
              {rangeTabs.map((range, index) => (
                <button
                  key={`ledger-${range.key}`}
                  type="button"
                  onClick={() => setActiveRange(range.key)}
                  className={`relative min-h-[3.7rem] px-2 text-[13px] font-semibold transition ${
                    activeRange === range.key ? "bg-[#8E5EB5] text-white" : "bg-white text-[#585d7b]"
                  } ${index < rangeTabs.length - 1 ? "border-r border-[#ede4f7]" : ""}`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="rounded-[18px] border border-[#ece4f7] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(91,45,144,0.04)]">
                <span className="text-[13px] font-semibold text-[#6f748b]">Start Date</span>
                <span className="mt-3 flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[#7d84a0]" />
                  <input
                    type="text"
                    value={formatIsoDateLabel(activeStartDate)}
                    readOnly
                    className="w-full bg-transparent text-[15px] font-semibold text-[#1c1530] outline-none"
                  />
                </span>
              </label>
              <label className="rounded-[18px] border border-[#ece4f7] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(91,45,144,0.04)]">
                <span className="text-[13px] font-semibold text-[#6f748b]">End Date</span>
                <span className="mt-3 flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[#7d84a0]" />
                  <input
                    type="text"
                    value={formatIsoDateLabel(activeEndDate)}
                    readOnly
                    className="w-full bg-transparent text-[15px] font-semibold text-[#1c1530] outline-none"
                  />
                </span>
              </label>
            </div>
          </section>

          <section className="overflow-x-auto rounded-[28px] bg-white px-3 py-4 shadow-[0_20px_44px_rgba(91,45,144,0.08)] ring-1 ring-[#efe7f8]">
            <div className="grid min-w-[780px] grid-cols-5 divide-x divide-[#efe7f8]">
              <div className="px-3 py-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f3ebff] text-[#8E5EB5]">
                  <Wallet className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[12px] text-[#5f6480]">Total Earned</p>
                <p className="mt-2 whitespace-nowrap text-[1rem] font-black text-[#8E5EB5]">
                  {formatCurrency(ledgerSummary.totalEarned)}
                </p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1e8] text-[#f97316]">
                  <Landmark className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[12px] text-[#5f6480]">To Company</p>
                <p className="mt-2 whitespace-nowrap text-[1rem] font-black text-[#f97316]">
                  {formatCurrency(ledgerSummary.toCompany)}
                </p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e9f7ea] text-[#16a34a]">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[12px] text-[#5f6480]">Net Earned</p>
                <p className="mt-2 whitespace-nowrap text-[1rem] font-black text-[#16a34a]">
                  {formatCurrency(ledgerSummary.netEarned)}
                </p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#edf1ff] text-[#3157c9]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[12px] text-[#5f6480]">Cash Jobs</p>
                <p className="mt-2 whitespace-nowrap text-[1rem] font-black text-[#3157c9]">
                  {ledgerSummary.cashJobs}
                </p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f3ebff] text-[#8E5EB5]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[12px] text-[#5f6480]">Other Payments</p>
                <p className="mt-2 whitespace-nowrap text-[1rem] font-black text-[#7c3aed]">
                  {ledgerSummary.otherPayments}
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_20px_44px_rgba(91,45,144,0.08)] ring-1 ring-[#efe7f8]">
            <div className="border-b border-[#f0e9f8] px-4 py-4">
              <div className="grid grid-cols-2 overflow-hidden rounded-[18px] border border-[#ede4f7] bg-[#fffefe]">
                {methodSections.map((section, index) => (
                  <button
                    key={`ledger-section-${section.key}`}
                    type="button"
                    onClick={() => setLedgerSection(section.key)}
                    className={`flex min-h-[3.2rem] items-center justify-center gap-2 px-3 text-[14px] font-semibold transition ${
                      ledgerSection === section.key
                        ? "bg-[#8E5EB5] text-white"
                        : "bg-white text-[#666b86]"
                    } ${index === 0 ? "border-r border-[#ede4f7]" : ""}`}
                  >
                    {section.icon}
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[790px]">
                <div className="grid grid-cols-[110px_120px_130px_120px_130px_130px] border-b-2 border-[#8E5EB5] px-3 py-4 text-[13px] font-semibold text-[#5f5d87]">
                  <p className="px-2">Date</p>
                  <p className="px-2">Booking ID</p>
                  <p className="px-2">Payment Method</p>
                  <p className="px-2">Earned</p>
                  <p className="px-2">To Company</p>
                  <p className="px-2">Net Earned</p>
                </div>

                {ledgerRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[110px_120px_130px_120px_130px_130px] border-b border-[#f0ebf8] px-3 py-5 text-[14px] text-[#17153b]"
                  >
                    <p className="px-2">{row.date}</p>
                    <p className="px-2">{row.bookingId}</p>
                    <div className="px-2">
                      <span
                        className={`inline-flex min-w-[84px] items-center justify-center rounded-[12px] px-3 py-2 text-[13px] font-bold ${getLedgerMethodClasses(row.paymentMethod)}`}
                      >
                        {row.paymentMethod}
                      </span>
                    </div>
                    <p className="px-2 whitespace-nowrap font-semibold text-[#16a34a]">
                      {formatCurrency(row.earned)}
                    </p>
                    <p className="px-2 whitespace-nowrap font-semibold text-[#f97316]">
                      {formatCurrency(row.toCompany)}
                    </p>
                    <p className="px-2 whitespace-nowrap font-semibold text-[#16a34a]">
                      {formatCurrency(row.netEarned)}
                    </p>
                  </div>
                ))}

                <div className="grid grid-cols-[110px_120px_130px_120px_130px_130px] bg-[linear-gradient(180deg,#fffefe_0%,#faf7ff_100%)] px-3 py-5 text-[#17153b]">
                  <div className="px-2">
                    <p className="text-[14px] font-black text-[#6d3bb5]">Total for Selected Range</p>
                  </div>
                  <div className="col-span-2 px-2">
                    <p className="text-[14px] font-black">{ledgerTotals.bookingCount} bookings</p>
                    <p className="mt-1 text-[13px] text-[#4f4c75]">
                      {ledgerTotals.cashCount} Cash / {ledgerTotals.otherCount} Other
                    </p>
                  </div>
                  <p className="px-2 whitespace-nowrap text-[15px] font-black text-[#16a34a]">
                    {formatCurrency(ledgerTotals.earned)}
                  </p>
                  <p className="px-2 whitespace-nowrap text-[15px] font-black text-[#f97316]">
                    {formatCurrency(ledgerTotals.toCompany)}
                  </p>
                  <p className="px-2 whitespace-nowrap text-[15px] font-black text-[#16a34a]">
                    {formatCurrency(ledgerTotals.netEarned)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#ede4f7] bg-[linear-gradient(180deg,#fffefe_0%,#faf7ff_100%)] px-5 py-4 shadow-[0_18px_32px_rgba(91,45,144,0.05)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3ebff] text-[#8E5EB5]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-[14px] leading-7 text-[#54557b]">
                Cash jobs create company payable. Other payment methods already have commission deducted before payout.
              </p>
            </div>
          </section>
        </section>

        <ProviderBottomNav />
      </MobilePage>
    );
  }

  return (
    <MobilePage className="pb-36" fullWidth>
      <section className="space-y-5">
        <header className="flex items-start justify-between gap-4 px-1 pt-2">
          <div>
            <h1 className="text-[2.2rem] font-black tracking-[-0.07em] text-[#17153b]">
              Payments
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-[#6f748b]">
              Manage your earnings and payments
            </p>
          </div>
          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#1c1635] shadow-[0_16px_30px_rgba(86,38,135,0.1)] ring-1 ring-[#efe6fa]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#c084fc] ring-2 ring-white" />
          </button>
        </header>

        <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#8e5eb5_0%,#7b46a8_52%,#925ec8_100%)] px-5 py-5 text-white shadow-[0_28px_50px_rgba(122,71,175,0.28)]">
          <div className="absolute right-[7.5rem] top-5 bottom-5 hidden w-px bg-white/16 sm:block" />
          <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_38%)]" />
          <div className="relative grid grid-cols-[minmax(0,1fr)_7rem] gap-x-3 gap-y-5 sm:grid-cols-[minmax(0,1fr)_7.25rem_7.25rem] sm:items-center">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-white/90">Wallet Balance</p>
              <p className="mt-4 text-[14px] leading-6 text-white/88">
                Coming soon: online transfer / card payment earnings minus commission.
              </p>
              <div className="mt-5 inline-flex min-h-[3.35rem] items-center gap-3 rounded-[18px] bg-white/96 px-4 py-3 text-[15px] font-extrabold text-[#8E5EB5] shadow-[0_14px_28px_rgba(255,255,255,0.2)] opacity-85">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#f4ecfd]">
                  <Wallet className="h-4.5 w-4.5" />
                </span>
                Coming Soon
              </div>
            </div>

            <div className="pointer-events-none relative ml-auto hidden sm:block">
              <div className="relative h-[9.2rem] w-[7rem]">
                <div className="absolute left-5 top-0 h-12 w-16 rotate-[-12deg] rounded-[10px] border border-[#d9f2d6] bg-[linear-gradient(180deg,#f1fff2_0%,#c9ebc5_100%)] shadow-[0_12px_20px_rgba(26,94,38,0.18)]" />
                <div className="absolute left-7 top-2 h-12 w-16 rotate-[-7deg] rounded-[10px] border border-[#d9f2d6] bg-[linear-gradient(180deg,#f6fff6_0%,#daf4d7_100%)]" />
                <div className="absolute inset-x-0 bottom-3 h-[5.4rem] rounded-[24px] bg-[linear-gradient(180deg,#7e4aad_0%,#5d2f88_100%)] shadow-[0_22px_34px_rgba(36,13,66,0.4)]" />
                <div className="absolute inset-x-2 bottom-0 h-[6.1rem] rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,#6e3e9f_0%,#562980_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
                <div className="absolute right-1 top-[3.4rem] h-11 w-11 rounded-[15px] bg-[linear-gradient(180deg,#7e4aad_0%,#643493_100%)] shadow-[0_12px_24px_rgba(36,13,66,0.28)]" />
                <div className="absolute right-3 top-[4.6rem] h-2.5 w-2.5 rounded-full bg-[#ffbc5e]" />
                <div className="absolute bottom-1 right-[-0.35rem] flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#f5b557] bg-[linear-gradient(180deg,#ffd77a_0%,#f5a93d_100%)] text-[16px] font-black text-white shadow-[0_12px_18px_rgba(245,169,61,0.35)]">
                  RM
                </div>
                <span className="absolute left-[-0.6rem] top-8 h-1.5 w-1.5 rounded-full bg-white/65" />
                <span className="absolute left-1 top-16 h-1 w-1 rounded-full bg-[#d191ff]" />
                <span className="absolute right-8 top-4 h-1.5 w-1.5 rounded-full bg-[#ffe27d]" />
                <span className="absolute right-16 top-0 h-1 w-1 rounded-full bg-white/65" />
              </div>
            </div>

          </div>
        </section>

        {state.notice ? (
          <section className="rounded-[20px] border border-[#d8f0de] bg-[#f3fff6] px-4 py-3 text-[14px] font-semibold text-[#18794e] shadow-[0_10px_22px_rgba(24,121,78,0.08)]">
            {state.notice}
          </section>
        ) : null}

        {state.error ? (
          <section className="rounded-[20px] border border-[#ffd7d7] bg-[#fff6f6] px-4 py-3 text-[14px] font-semibold text-[#dc2626] shadow-[0_10px_22px_rgba(220,38,38,0.08)]">
            {state.error}
          </section>
        ) : null}

        <section className="rounded-[28px] border border-[#ffd9d5] bg-[linear-gradient(180deg,#fffefe_0%,#fff8f8_100%)] px-5 py-5 shadow-[0_18px_36px_rgba(255,89,89,0.08)]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#fff1f3_0%,#ffe6eb_100%)] text-[#d61f45]">
              <Landmark className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="max-w-[14rem] text-[1.05rem] font-black leading-6 tracking-[-0.04em] text-[#d62839] sm:max-w-none">
                {isCompanyPaymentProcessing ? "Company Payment In Process" : "Amount to Pay Company"}
              </h2>
              <p className="mt-1 max-w-[15rem] text-[14px] leading-6 text-[#5d6278] sm:max-w-none">
                {isCompanyPaymentProcessing
                  ? "Your uploaded payment slip is under admin review."
                  : pendingCompanyAmount > 0
                    ? "You have pending amount to pay as company commission."
                    : "No payable amount to company right now."}
              </p>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:block sm:text-right">
              <p className="whitespace-nowrap text-[1.15rem] font-black tracking-[-0.04em] text-[#d62839]">
                {formatCurrency(isCompanyPaymentProcessing ? processingCompanyAmount : pendingCompanyAmount)}
              </p>
              {isCompanyPaymentProcessing ? (
                <span className="inline-flex min-h-[2.95rem] items-center rounded-[16px] bg-[#f8e9ea] px-4 py-2 text-[14px] font-extrabold text-[#d62839] sm:mt-3">
                  Payment Process
                </span>
              ) : pendingCompanyAmount > 0 ? (
                <button
                  type="button"
                  onClick={() => setModal("company")}
                  className="inline-flex min-h-[2.95rem] items-center gap-2 rounded-[16px] bg-[linear-gradient(180deg,#ec3349_0%,#d81d35_100%)] px-4 py-2 text-[14px] font-extrabold text-white sm:mt-3"
                >
                  Pay Now
                  <ChevronRight className="h-4.5 w-4.5" />
                </button>
              ) : (
                <span className="inline-flex min-h-[2.95rem] items-center rounded-[16px] bg-[#f8e9ea] px-4 py-2 text-[14px] font-extrabold text-[#d62839] sm:mt-3">
                  No Payable
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] bg-white shadow-[0_24px_54px_rgba(91,45,144,0.1)] ring-1 ring-[#efe7f8]">
          <div className="overflow-x-auto border-b border-[#efe7f8]">
            <div className="grid min-w-full grid-cols-3">
            {paymentTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-4 text-[11px] leading-4 font-semibold transition sm:flex-row sm:gap-2 sm:px-2 sm:text-[13px] ${
                  activeTab === tab.key ? "text-[#8E5EB5]" : "text-[#717791]"
                }`}
              >
                {tab.icon}
                <span className="text-center whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
            </div>
          </div>
          <div className="grid grid-cols-3">
            {paymentTabs.map((tab) => (
              <span
                key={`${tab.key}-indicator`}
                className={`h-[3px] transition ${
                  activeTab === tab.key ? "bg-[#8E5EB5]" : "bg-transparent"
                }`}
              />
            ))}
          </div>

          <div className="space-y-5 px-4 py-5">
            <div className="mt-1 grid grid-cols-2 gap-3">
              {rangeTabs.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setActiveRange(range.key)}
                  className={`inline-flex min-h-[2.95rem] items-center justify-center rounded-[18px] border px-3 text-[14px] font-semibold transition ${
                    activeRange === range.key
                      ? "border-[#8E5EB5] bg-[#fbf7ff] text-[#8E5EB5] shadow-[0_8px_18px_rgba(142,94,181,0.08)]"
                      : "border-[#ece6f5] bg-[#faf7fd] text-[#747b91]"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {activeRange === "custom" ? (
              <div className="grid gap-3 rounded-[22px] border border-[#eee7f7] bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <label className="flex items-center gap-3 rounded-[16px] border border-[#ede5f7] bg-[#fffefe] px-4 py-3">
                  <Calendar className="h-4.5 w-4.5 text-[#7d84a0]" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    className="w-full bg-transparent text-[14px] font-semibold text-[#1c1530] outline-none"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-[16px] border border-[#ede5f7] bg-[#fffefe] px-4 py-3">
                  <Calendar className="h-4.5 w-4.5 text-[#7d84a0]" />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    className="w-full bg-transparent text-[14px] font-semibold text-[#1c1530] outline-none"
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "overview" ? (
              <>
                <section className="overflow-hidden rounded-[24px] border border-[#efe7f8] bg-white shadow-[0_18px_40px_rgba(91,45,144,0.07)]">
                  <div className="flex items-center gap-3 border-b border-[#f2ebfa] px-4 py-4">
                    <h2 className="text-[1.05rem] font-black tracking-[-0.04em] text-[#1d1633]">
                      Daily Summary
                    </h2>
                    <span className="text-[0.98rem] font-medium text-[#6f748b]">
                      ({formatIsoDateLabel(summaryDateIso)})
                    </span>
                    <Calendar className="ml-auto h-4.5 w-4.5 text-[#7c819d]" />
                  </div>
                  <div className="grid grid-cols-2 divide-x-0 divide-y divide-[#f0e9f8] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                    <div className="px-2 py-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#edf9f0] text-[#16a34a]">
                        <Wallet className="h-4.5 w-4.5" />
                      </div>
                      <p className="mt-3 text-[12px] text-[#676f86]">Earnings</p>
                      <p className="mt-1 whitespace-nowrap text-[0.98rem] font-black text-[#1d1633]">
                        {formatCurrency(earningsToday)}
                      </p>
                    </div>
                    <div className="px-2 py-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#f3ebff] text-[#8E5EB5]">
                        <Wallet className="h-4.5 w-4.5" />
                      </div>
                      <p className="mt-3 text-[12px] text-[#676f86]">Withdrawn</p>
                      <p className="mt-1 whitespace-nowrap text-[0.98rem] font-black text-[#1d1633]">
                        {formatCurrency(withdrawnToday)}
                      </p>
                    </div>
                    <div className="px-2 py-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#fff3ea] text-[#f97316]">
                        <Landmark className="h-4.5 w-4.5" />
                      </div>
                      <p className="mt-3 text-[12px] text-[#676f86]">To Company</p>
                      <p className="mt-1 whitespace-nowrap text-[0.98rem] font-black text-[#1d1633]">
                        {formatCurrency(toCompanyToday)}
                      </p>
                    </div>
                    <div className="px-2 py-4 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#edf1ff] text-[#2563eb]">
                        <Wallet className="h-4.5 w-4.5" />
                      </div>
                      <p className="mt-3 text-[12px] text-[#676f86]">Balance</p>
                      <p className="mt-1 whitespace-nowrap text-[0.98rem] font-black text-[#1d1633]">
                        {formatCurrency(walletBalance)}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between gap-3 px-1">
                    <h2 className="text-[1.3rem] font-black tracking-[-0.05em] text-[#1d1633]">
                      Recent Transactions
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLedger(true);
                        router.push("https://app.dellaapp.com/provider/payments?view=ledger");
                      }}
                      className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#8E5EB5]"
                    >
                      View All
                      <ChevronRight className="h-4.5 w-4.5" />
                    </button>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[24px] border border-[#efe7f8] bg-white shadow-[0_18px_40px_rgba(91,45,144,0.07)]">
                    {overviewTransactions.length === 0 ? (
                      <div className="px-5 py-8 text-center text-[14px] text-[#7b748f]">
                        No transactions found for this date range.
                      </div>
                    ) : (
                      overviewTransactions.map((transaction, index) => {
                        const iconData = getProviderPaymentIcon(
                          transaction.kind,
                          transaction.direction,
                        );

                        return (
                          <div
                            key={transaction.id}
                            className={`flex items-center gap-3 px-4 py-4 ${
                              index < overviewTransactions.length - 1
                                ? "border-b border-[#f3edf9]"
                                : ""
                            }`}
                          >
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconData.wrapperClassName}`}
                            >
                              {iconData.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold text-[#1d1633]">
                                {transaction.title}
                              </p>
                              <p className="mt-1 text-[13px] leading-5 text-[#7a8096]">
                                {transaction.bookingLabel
                                  ? `${transaction.bookingLabel} • ${transaction.timeLabel}`
                                  : transaction.timeLabel}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p
                                className={`whitespace-nowrap text-[1rem] font-black tracking-[-0.03em] ${
                                  transaction.direction === "in"
                                    ? "text-[#16a34a]"
                                    : transaction.kind === "commission"
                                      ? "text-[#dc2626]"
                                      : "text-[#1d1633]"
                                }`}
                              >
                                {transaction.direction === "in" ? "+ " : "- "}
                                {formatCurrency(transaction.amount)}
                              </p>
                              <span
                                className={`mt-2 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${getProviderPaymentStatusClasses(transaction.status)}`}
                              >
                                {transaction.status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="overflow-hidden rounded-[24px] border border-[#efe7f8] bg-white shadow-[0_18px_40px_rgba(91,45,144,0.07)]">
                <div className="border-b border-[#f3edf9] px-4 py-4">
                  <h2 className="text-[1.05rem] font-black tracking-[-0.04em] text-[#1d1633]">
                    {activeTab === "payments" ? "Payment History" : "Withdrawal History"}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#7b748f]">
                    {activeTab === "payments"
                      ? "Showing payment received transactions only."
                      : "Showing withdrawal transactions only."}
                  </p>
                </div>
                {activeTab === "payments" ? (
                  <div className="border-b border-[#f3edf9] px-4 py-4">
                    <div className="grid grid-cols-2 overflow-hidden rounded-[18px] border border-[#ede4f7] bg-[#fffefe]">
                      {methodSections.map((section, index) => (
                        <button
                          key={`payment-section-${section.key}`}
                          type="button"
                          onClick={() => setPaymentHistorySection(section.key)}
                          className={`flex min-h-[3rem] items-center justify-center gap-2 px-3 text-[14px] font-semibold transition ${
                            paymentHistorySection === section.key
                              ? "bg-[#8E5EB5] text-white"
                              : "bg-white text-[#666b86]"
                          } ${index === 0 ? "border-r border-[#ede4f7]" : ""}`}
                        >
                          {section.icon}
                          {section.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[13px] font-semibold text-[#1d1633]">
                      {paymentHistorySection === "cash"
                        ? "Cash Payment History"
                        : "Other Payment History"}
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[#7b748f]">
                      {paymentHistorySection === "cash"
                        ? "Cash bookings create company payable after collection."
                        : "Card, online transfer, and wallet payouts are grouped here."}
                    </p>
                  </div>
                ) : null}
                {(activeTab === "payments" ? paymentHistoryTransactions : filteredTransactions)
                  .length === 0 ? (
                  <div className="px-5 py-8 text-center text-[14px] text-[#7b748f]">
                    No transactions found for this date range.
                  </div>
                ) : (
                  (activeTab === "payments" ? paymentHistoryTransactions : filteredTransactions).map(
                    (transaction, index, list) => {
                    const iconData = getProviderPaymentIcon(
                      transaction.kind,
                      transaction.direction,
                    );

                    return (
                      <div
                        key={transaction.id}
                        className={`flex items-center gap-3 px-4 py-4 ${
                          index < list.length - 1
                            ? "border-b border-[#f3edf9]"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconData.wrapperClassName}`}
                        >
                          {iconData.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-[#1d1633]">
                            {transaction.title}
                          </p>
                          <p className="mt-1 text-[13px] leading-5 text-[#7a8096]">
                            {transaction.bookingLabel
                              ? `${transaction.bookingLabel} • ${transaction.timeLabel}`
                              : transaction.timeLabel}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`whitespace-nowrap text-[1rem] font-black tracking-[-0.03em] ${
                              transaction.direction === "in" ? "text-[#16a34a]" : "text-[#1d1633]"
                            }`}
                          >
                            {transaction.direction === "in" ? "+ " : "- "}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${getProviderPaymentStatusClasses(transaction.status)}`}
                          >
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            )}
          </div>
        </section>
      </section>

      <ProviderBottomNav />

      {modal === "withdraw" ? (
        <ProviderPaymentModalShell
          title="Withdraw Funds"
          subtitle="Clean placeholder for the withdrawal flow. No payment logic is connected yet."
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-[#ece3f7] bg-[#faf7fe] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#8E5EB5]">
                Available balance
              </p>
              <p className="mt-2 text-[2rem] font-black tracking-[-0.05em] text-[#1d1633]">
                {formatCurrency(walletBalance)}
              </p>
            </div>
            <label className="block rounded-[20px] border border-[#ece3f7] bg-white p-4">
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7d84a0]">
                Amount
              </span>
              <input
                type="text"
                placeholder="Enter withdrawal amount"
                className="mt-3 block w-full bg-transparent text-[15px] font-semibold text-[#1d1633] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="inline-flex min-h-[3.2rem] w-full items-center justify-center rounded-[18px] bg-[#8E5EB5] px-4 text-[15px] font-extrabold text-white shadow-[0_18px_32px_rgba(142,94,181,0.24)]"
            >
              Withdraw button
            </button>
          </div>
        </ProviderPaymentModalShell>
      ) : null}

      {modal === "company" ? (
        <ProviderPaymentModalShell
          title="Pay Company Commission"
          subtitle="Upload payment slip first, then mark it as payment in process for admin approval."
          onClose={() => {
            setModal(null);
            resetCompanyProofState();
          }}
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-[#ffd8d8] bg-[#fff7f7] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#dc2626]">
                Pending company amount
              </p>
              <p className="mt-2 text-[2rem] font-black tracking-[-0.05em] text-[#1d1633]">
                {formatCurrency(pendingCompanyAmount)}
              </p>
            </div>
            <div className="rounded-[20px] border border-dashed border-[#e3d5f4] bg-[#fbf8ff] p-4">
              <p className="text-[13px] font-semibold text-[#1d1633]">
                Upload payment slip
              </p>
              <p className="mt-1 text-[13px] leading-6 text-[#7b748f]">
                Select from gallery or camera. Accepted: JPG, JPEG, PDF up to 2MB.
              </p>
              <input
                ref={companyProofInputRef}
                type="file"
                accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
                onChange={handleCompanyProofChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => companyProofInputRef.current?.click()}
                className="mt-4 inline-flex min-h-[3rem] w-full items-center justify-center rounded-[16px] bg-[#f4ecfd] px-4 text-[14px] font-bold text-[#8E5EB5]"
              >
                Upload Payment Slip
              </button>
              {companyProofName ? (
                <p className="mt-3 rounded-[14px] border border-[#ddd1f1] bg-white px-3 py-2 text-[13px] font-semibold text-[#1d1633]">
                  Selected: {companyProofName}
                </p>
              ) : null}
              {companyProofError ? (
                <p className="mt-3 text-[12px] font-semibold text-[#dc2626]">
                  {companyProofError}
                </p>
              ) : null}
              {state.error ? (
                <p className="mt-3 text-[12px] font-semibold text-[#dc2626]">
                  {state.error}
                </p>
              ) : null}
            </div>
            <label className="block rounded-[20px] border border-[#ece3f7] bg-white p-4">
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7d84a0]">
                Deposited Amount
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={companyDepositAmount}
                onChange={(event) => {
                  const rawValue = event.target.value.replace(/[^\d.]/g, "");
                  const decimalIndex = rawValue.indexOf(".");
                  const normalizedValue =
                    decimalIndex === -1
                      ? rawValue
                      : `${rawValue.slice(0, decimalIndex)}.${rawValue
                          .slice(decimalIndex + 1)
                          .replace(/\./g, "")
                          .slice(0, 2)}`;
                  setCompanyDepositAmount(normalizedValue);
                }}
                onBlur={() => {
                  if (!companyDepositAmount.trim().length) {
                    return;
                  }

                  if (Number.isFinite(companyDepositAmountValue) && companyDepositAmountValue > 0) {
                    setCompanyDepositAmount(companyDepositAmountValue.toFixed(2));
                  }
                }}
                placeholder="Enter deposited amount"
                className="mt-3 block w-full bg-transparent text-[15px] font-semibold text-[#1d1633] outline-none"
              />
            </label>
            <p className="text-[12px] font-semibold text-[#7b748f]">
              Enter the exact payable amount: {formatCurrency(pendingCompanyAmount)}
            </p>
            {companyDepositAmount.trim().length > 0 && !companyDepositMatchesPending ? (
              <p className="text-[12px] font-semibold text-[#dc2626]">
                Deposited amount must be exactly {formatCurrency(pendingCompanyAmount)}.
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                disabled={!canSubmitCompanyPayment || isSubmittingCompanyPayment}
                onClick={async () => {
                  if (!Number.isFinite(companyDepositAmountValue) || companyDepositAmountValue <= 0) {
                    state.setError("Enter a valid deposited amount.");
                    return;
                  }

                  if (!companyDepositMatchesPending) {
                    state.setError(
                      `Deposited amount must be exactly ${formatCurrency(pendingCompanyAmount)}.`,
                    );
                    return;
                  }

                  const success = await state.handleCommissionSettlement({
                    proofDataUrl: companyProofDataUrl,
                    proofFileName: companyProofName,
                    proofMimeType: companyProofMimeType,
                    depositedAmount: companyDepositAmountValue,
                  });

                  if (success) {
                    setModal(null);
                    resetCompanyProofState();
                  }
                }}
                className={`inline-flex min-h-[3rem] items-center justify-center rounded-[16px] px-4 text-[14px] font-bold ${
                  canSubmitCompanyPayment && !isSubmittingCompanyPayment
                    ? "bg-[#8E5EB5] text-white"
                    : "bg-[#efe7f8] text-[#b8a9cf]"
                }`}
              >
                {isSubmittingCompanyPayment ? "Submitting..." : "Mark as Payment Process"}
              </button>
            </div>
            <p className="text-[12px] leading-5 text-[#7b748f]">
              After admin approval, this company payment will move to paid status.
            </p>
          </div>
        </ProviderPaymentModalShell>
      ) : null}
    </MobilePage>
  );
}

export function TasksScreen() {
  return <BookingsScreen />;
}

export function ServicesScreen() {
  const state = useProviderAppData();
  const [editingServiceId, setEditingServiceId] = useState("");
  const [form, setForm] = useState({
    serviceType: "",
    yearsExperience: "",
    hourlyRate: "",
    dailyRate: "",
    specialties: "",
  });
  const [serviceImageDataUrls, setServiceImageDataUrls] = useState<string[]>([]);
  const [serviceImageCaptions, setServiceImageCaptions] = useState<string[]>([]);
  const [serviceImageFileName, setServiceImageFileName] = useState("");
  const [serviceImageSourceTarget, setServiceImageSourceTarget] = useState<"service" | null>(null);
  const [serviceImageCropState, setServiceImageCropState] = useState<{
    fileName: string;
    sourceDataUrl: string;
  } | null>(null);
  const serviceGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const serviceCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  const data = state.data!;

  async function saveService() {
    const accessToken = await getProviderAccessToken();

    if (!accessToken) {
      state.setError("Your session expired. Please log in again.");
      return;
    }

    if (!form.serviceType.trim() && !editingServiceId) {
      setMessage("Service type is required.");
      return;
    }

    setSaving(true);
    setMessage("");
    state.setError("");

    const endpoint = editingServiceId
      ? `/api/provider/services/${editingServiceId}`
      : "/api/provider/services";
    const method = editingServiceId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        serviceType: form.serviceType,
        yearsExperience: form.yearsExperience,
        hourlyRate: Number(form.hourlyRate || 0),
        dailyRate: Number(form.dailyRate || 0),
        specialties: form.specialties
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        imageDataUrls: serviceImageDataUrls,
        imageCaptions: serviceImageCaptions,
      }),
    });

    const result = (await response.json()) as { success?: true; error?: string };

    if (!response.ok || !result.success) {
      setMessage(result.error || "Unable to save service.");
      setSaving(false);
      return;
    }

    await state.reloadWorkspace();
    setSaving(false);
    setEditingServiceId("");
    setForm({
      serviceType: "",
      yearsExperience: "",
      hourlyRate: "",
      dailyRate: "",
      specialties: "",
    });
    setServiceImageDataUrls([]);
    setServiceImageCaptions([]);
    setServiceImageFileName("");
    setMessage(editingServiceId ? "Service updated." : "New service added.");
  }

  const handleServiceImageChange =
    (source: "gallery" | "camera") => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setMessage(source === "camera" ? "Camera upload must be an image." : "Gallery upload must be an image.");
        return;
      }

      if (file.size > PAYMENT_PROOF_MAX_BYTES) {
        setMessage("Service image must be 5MB or smaller.");
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      setServiceImageSourceTarget(null);
      setServiceImageCropState({
        fileName: file.name,
        sourceDataUrl: dataUrl,
      });
      setMessage("");
    };

  const handleServiceImageCropApply = async (selection: { x: number; y: number; width: number; height: number }) => {
    if (!serviceImageCropState) {
      return;
    }

    try {
      const croppedImage = await cropImageFromSelection(serviceImageCropState.sourceDataUrl, selection);
      const nextImages = serviceImageDataUrls.length > 0 ? [...serviceImageDataUrls] : [""];
      nextImages[0] = croppedImage;
      setServiceImageDataUrls(nextImages.filter(Boolean));

      const nextCaptions =
        serviceImageCaptions.length > 0
          ? [...serviceImageCaptions]
          : new Array(Math.max(nextImages.filter(Boolean).length, 1)).fill("");
      nextCaptions[0] = nextCaptions[0] || "Cover image";
      setServiceImageCaptions(nextCaptions.slice(0, nextImages.filter(Boolean).length));
      setServiceImageFileName(serviceImageCropState.fileName);
      setServiceImageCropState(null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to crop service image.");
    }
  };

  return (
    <PageShell title="My Services" subtitle="Manage the services and pricing visible to customers.">
      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="mb-5 rounded-[20px] border border-[#dbeee2] bg-[#f6fff8] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black text-[#0f172a]">Need to edit days and time?</h2>
              <p className="mt-1 text-[12px] leading-5 text-[#64748b]">
                Booking days and working hours are managed in your availability settings.
              </p>
            </div>
            <Link
              href="/provider/availability"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-[12px] bg-[#16a34a] px-4 text-[12px] font-extrabold text-white"
            >
              Edit Availability
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {data.services.length === 0 ? (
            <EmptyState
              title="No services added yet"
              description="Your registered provider services will appear here."
              icon={<BriefcaseBusiness className="h-6 w-6" />}
            />
          ) : (
            data.services.map((service) => (
              <div key={service.id} className="rounded-[20px] border border-[#e7eee8] bg-[#fbfffc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-black text-[#0f172a]">
                      {formatServiceLabel(service.serviceType)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#64748b]">
                      {`RM${service.hourlyRate}/hr • RM${service.dailyRate}/day`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingServiceId(service.id);
                      setForm({
                        serviceType: service.serviceType,
                        yearsExperience: service.yearsExperience,
                        hourlyRate: String(service.hourlyRate),
                        dailyRate: String(service.dailyRate),
                        specialties: service.specialties.join(", "),
                      });
                      setServiceImageDataUrls(service.imageDataUrls);
                      setServiceImageCaptions(service.imageCaptions);
                      setServiceImageFileName("");
                      setMessage("");
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef9f1] text-[#16a34a]"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 text-[12px] text-[#475569]">
                  {service.yearsExperience || "Experience not set"}
                </p>
                <p className="mt-2 text-[12px] text-[#94a3b8]">
                  {service.specialties.length > 0
                    ? service.specialties.join(", ")
                    : "No specialties added yet."}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="mt-5 rounded-[22px] border border-[#e7eee8] bg-[#fbfffc] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-black text-[#0f172a]">
                {editingServiceId ? "Edit Service" : "Add New Service"}
              </h2>
              <p className="mt-1 text-[12px] text-[#64748b]">
                Save pricing and specialties directly to your provider listing.
              </p>
            </div>
            {editingServiceId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingServiceId("");
                  setForm({
                    serviceType: "",
                    yearsExperience: "",
                    hourlyRate: "",
                    dailyRate: "",
                    specialties: "",
                  });
                  setServiceImageDataUrls([]);
                  setServiceImageCaptions([]);
                  setServiceImageFileName("");
                  setServiceImageSourceTarget(null);
                  setServiceImageCropState(null);
                  setMessage("");
                }}
                className="text-[12px] font-bold text-[#16a34a]"
              >
                Cancel
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="rounded-[18px] border border-[#e7eee8] bg-white p-4">
              <span className="text-[12px] font-bold text-[#64748b]">Service Type</span>
              {editingServiceId ? (
                <input
                  value={formatServiceLabel(form.serviceType)}
                  readOnly
                  className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none read-only:text-[#94a3b8]"
                />
              ) : (
                <select
                  value={form.serviceType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceType: normalizeServiceFormValue(event.target.value),
                    }))
                  }
                  className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                >
                  <option value="">Select service type</option>
                  {PROVIDER_SERVICE_OPTIONS.map((option) => (
                    <option key={option} value={normalizeServiceFormValue(option)}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="rounded-[18px] border border-[#e7eee8] bg-white p-4">
                <span className="text-[12px] font-bold text-[#64748b]">Hourly Rate</span>
                <input
                  value={form.hourlyRate}
                  onChange={(event) => setForm((current) => ({ ...current, hourlyRate: event.target.value }))}
                  className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                  placeholder="40"
                />
              </label>
              <label className="rounded-[18px] border border-[#e7eee8] bg-white p-4">
                <span className="text-[12px] font-bold text-[#64748b]">Daily Rate</span>
                <input
                  value={form.dailyRate}
                  onChange={(event) => setForm((current) => ({ ...current, dailyRate: event.target.value }))}
                  className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                  placeholder="250"
                />
              </label>
            </div>
            <label className="rounded-[18px] border border-[#e7eee8] bg-white p-4">
              <span className="text-[12px] font-bold text-[#64748b]">Experience</span>
              <input
                value={form.yearsExperience}
                onChange={(event) => setForm((current) => ({ ...current, yearsExperience: event.target.value }))}
                className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                placeholder="5 Years"
              />
            </label>
            <label className="rounded-[18px] border border-[#e7eee8] bg-white p-4">
              <span className="text-[12px] font-bold text-[#64748b]">Specialties</span>
              <input
                value={form.specialties}
                onChange={(event) => setForm((current) => ({ ...current, specialties: event.target.value }))}
                className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                placeholder="Malay, Arabic, Event catering"
              />
            </label>
            {editingServiceId ? (
              <div className="rounded-[18px] border border-[#e7eee8] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[12px] font-bold text-[#64748b]">Current Service Image</span>
                    <p className="mt-1 text-[12px] text-[#94a3b8]">
                      Update the main image using gallery or camera, then crop before saving.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 rounded-[18px] border border-dashed border-[#dccff3] bg-[#fdfbff] p-4">
                  <div className="relative h-24 w-28 overflow-hidden rounded-[14px] border border-[#ece3f8] bg-[linear-gradient(135deg,#f8f4ff_0%,#eef2ff_100%)]">
                    {serviceImageDataUrls[0] ? (
                      <Image
                        src={serviceImageDataUrls[0]}
                        alt={serviceImageFileName || `${formatServiceLabel(form.serviceType)} service image`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#8E5EB5]">
                        <BriefcaseBusiness className="h-9 w-9" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-[#6f6681]">
                      Replace the current service cover image.
                    </p>
                    {serviceImageFileName ? (
                      <p className="mt-2 truncate text-[12px] font-semibold text-[#8E5EB5]">{serviceImageFileName}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setServiceImageSourceTarget("service");
                        setMessage("");
                      }}
                      className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#ceb9f2] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]"
                    >
                      <Upload className="h-4 w-4" />
                      Change Service Image
                    </button>
                    <input
                      ref={serviceGalleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleServiceImageChange("gallery")}
                      className="hidden"
                    />
                    <input
                      ref={serviceCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleServiceImageChange("camera")}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {message ? (
            <p className="mt-4 rounded-[16px] border border-[#dbeee2] bg-[#f6fff8] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
              {message}
            </p>
          ) : null}
          <div className="mt-5">
            <AppButton className="w-full" disabled={saving} onClick={() => void saveService()}>
              {saving ? "Saving..." : editingServiceId ? "Save Changes" : "Add New Service"}
            </AppButton>
          </div>
        </div>
      </section>

      {serviceImageSourceTarget ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#111827]/45 px-4 pb-6">
          <div className="w-full max-w-[430px] rounded-[24px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <p className="text-[16px] font-black text-[#1f1630]">Update service image</p>
            <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
              Choose a source, then crop the image before saving.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => serviceGalleryInputRef.current?.click()}
                className="inline-flex h-12 items-center justify-center rounded-[14px] border border-[#d9c8ee] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]"
              >
                Choose from Gallery
              </button>
              <button
                type="button"
                onClick={() => serviceCameraInputRef.current?.click()}
                className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[14px] font-bold text-white"
              >
                Open Camera
              </button>
            </div>
            <button
              type="button"
              onClick={() => setServiceImageSourceTarget(null)}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[#eee5f7] bg-[#faf7fe] text-[14px] font-bold text-[#6f6681]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {serviceImageCropState ? (
        <ImageCropModal
          imageDataUrl={serviceImageCropState.sourceDataUrl}
          tone="service"
          onClose={() => setServiceImageCropState(null)}
          onApply={(selection) => {
            void handleServiceImageCropApply(selection);
          }}
        />
      ) : null}
    </PageShell>
  );
}

export function AvailabilityScreen() {
  const state = useProviderAppData();
  const [enabled, setEnabled] = useState(true);
  const [daySettings, setDaySettings] = useState<Record<string, { selected: boolean; startTime: string; endTime: string }>>(
    Object.fromEntries(
      ALL_DAYS.map((day) => [day, { selected: false, startTime: "08:00", endTime: "20:00" }]),
    ) as Record<string, { selected: boolean; startTime: string; endTime: string }>,
  );
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextDaySettings = Object.fromEntries(
      ALL_DAYS.map((day) => [day, { selected: false, startTime: "08:00", endTime: "20:00" }]),
    ) as Record<string, { selected: boolean; startTime: string; endTime: string }>;

    state.availability.forEach((entry) => {
      nextDaySettings[entry.day] = {
        selected: true,
        startTime: entry.startTime,
        endTime: entry.endTime,
      };
    });

    setDaySettings(nextDaySettings);
    setEnabled(state.availabilityEnabled);
  }, [state.availability, state.availabilityEnabled]);

  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  async function saveAvailability() {
    const accessToken = await getProviderAccessToken();

    if (!accessToken) {
      state.setError("Your session expired. Please log in again.");
      return;
    }

    setSaving(true);
    setSaved("");
    state.setError("");

    const response = await fetch("/api/provider/availability", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        enabled,
        entries: ALL_DAYS.filter((day) => daySettings[day]?.selected).map((day) => ({
          day,
          startTime: daySettings[day].startTime,
          endTime: daySettings[day].endTime,
          timeMode: "custom",
        })),
      }),
    });

    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      state.setError(result.error || "Unable to save availability.");
      setSaving(false);
      return;
    }

    await state.reloadWorkspace();
    setSaved(enabled ? "Availability saved to your live provider profile." : "Provider visibility is now paused.");
    setSaving(false);
  }

  return (
    <PageShell
      title="Availability"
      subtitle="Set the days and hours when customers can book your services."
    >
      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="rounded-[20px] border border-[#dbeee2] bg-[#f6fff8] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[16px] font-black text-[#0f172a]">
                You are <span className="text-[#16a34a]">{enabled ? "Available" : "Offline"}</span>
              </p>
              <p className="mt-1 text-[12px] text-[#64748b]">
                Customers can book you only when availability is enabled.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((current) => !current)}
              className={`relative h-8 w-14 rounded-full ${enabled ? "bg-[#16a34a]" : "bg-[#cbd5e1]"}`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                  enabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-black text-[#0f172a]">Select Days</h2>
            <button
              type="button"
              onClick={() =>
                setDaySettings((current) =>
                  Object.fromEntries(
                    ALL_DAYS.map((day) => [
                      day,
                      {
                        ...current[day],
                        selected: true,
                      },
                    ]),
                  ) as Record<string, { selected: boolean; startTime: string; endTime: string }>,
                )
              }
              className="text-[12px] font-bold text-[#16a34a]"
            >
              Select all
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {ALL_DAYS.map((day) => (
              <div
                key={day}
                className={`rounded-[18px] border px-4 py-3 ${
                  daySettings[day]?.selected
                    ? "border-[#b7e4c4] bg-[#f6fff8]"
                    : "border-[#e7eee8] bg-[#fbfffc]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold text-[#0f172a]">{day}</span>
                  <input
                    type="checkbox"
                    checked={daySettings[day]?.selected ?? false}
                    onChange={(event) =>
                      setDaySettings((current) => ({
                        ...current,
                        [day]: {
                          ...current[day],
                          selected: event.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 accent-[#16a34a]"
                  />
                </div>
                {daySettings[day]?.selected ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="rounded-[16px] border border-[#dbeee2] bg-white p-3">
                      <span className="text-[11px] font-bold text-[#64748b]">Start</span>
                      <input
                        type="time"
                        value={daySettings[day].startTime}
                        onChange={(event) =>
                          setDaySettings((current) => ({
                            ...current,
                            [day]: {
                              ...current[day],
                              startTime: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                      />
                    </label>
                    <label className="rounded-[16px] border border-[#dbeee2] bg-white p-3">
                      <span className="text-[11px] font-bold text-[#64748b]">End</span>
                      <input
                        type="time"
                        value={daySettings[day].endTime}
                        onChange={(event) =>
                          setDaySettings((current) => ({
                            ...current,
                            [day]: {
                              ...current[day],
                              endTime: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 block w-full bg-transparent text-[14px] font-semibold text-[#0f172a] outline-none"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {saved ? (
          <p className="mt-4 rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] font-semibold text-[#15803d]">
            {saved}
          </p>
        ) : null}

        <div className="mt-5">
          <AppButton
            className="w-full"
            disabled={saving}
            onClick={() => void saveAvailability()}
          >
            {saving ? "Saving..." : "Save Availability"}
          </AppButton>
        </div>
      </section>
    </PageShell>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p>{label}</p>
      <p className="font-semibold text-[#24193a]">{value}</p>
    </div>
  );
}

export function ReviewsScreen() {
  const state = useProviderAppData();
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  const data = state.data!;
  const completedJobs = state.bookings.filter((booking) =>
    ["completed", "paid", "review_requested", "reviewed"].includes(booking.bookingStatus),
  );

  return (
    <PageShell title="Reviews" subtitle="Customer ratings, review feed, and overall provider score.">
      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 text-center shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <p className="text-[2.5rem] font-black tracking-[-0.06em] text-[#0f172a]">
          {data.averageRating > 0 ? data.averageRating.toFixed(1) : "0.0"}
        </p>
        <div className="mt-2 flex items-center justify-center gap-1 text-[#8E5EB5]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className="h-5 w-5 fill-current" />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-[#64748b]">({data.totalReviews} reviews)</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <MetricCard label="Completed Jobs" value={String(completedJobs.length)} meta="Provider history" accent="text-[#0f172a]" />
          <MetricCard label="Profile Status" value={data.approvalStatus} meta="Current listing state" accent="text-[#0f172a]" />
        </div>
      </section>

      <section className="rounded-[24px] border border-[#eee5f7] bg-white p-5 shadow-[0_14px_32px_rgba(86,38,135,0.08)]">
        <h2 className="text-[17px] font-black text-[#0f172a]">Customer Reviews</h2>
        <p className="mt-1 text-[13px] text-[#64748b]">
          Live customer feedback from your Supabase review records.
        </p>
        <div className="mt-4">
          {state.reviews.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="Completed bookings will show up here once customers start leaving feedback."
              icon={<Star className="h-6 w-6" />}
            />
          ) : (
            <div className="space-y-3">
              {state.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[20px] border border-[#eee5f7] bg-[#fcfaff] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-black text-[#0f172a]">{review.customerName}</p>
                      <p className="mt-1 text-[12px] text-[#64748b]">{review.createdLabel}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#8E5EB5]">
                      {Array.from({ length: review.rating }).map((_, index) => (
                        <Star key={`${review.id}-${index}`} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-[#475569]">{review.comment}</p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => state.setNotice("Provider replies to reviews are not wired yet, but the review feed is live.")}
                      className="rounded-[10px] border border-[#e5d5fa] bg-white px-3 py-1.5 text-[12px] font-bold text-[#8E5EB5]"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

export function ProfileScreen() {
  const state = useProviderAppData();
  const [draftEmergencyContactNumber, setDraftEmergencyContactNumber] = useState<string | null>(null);
  const [draftCountry, setDraftCountry] = useState<string | null>(null);
  const [isSavingContact, startSavingContact] = useTransition();
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  const data = state.data!;
  const emergencyContactNumber = draftEmergencyContactNumber ?? data.emergencyContactNumber ?? "";
  const country = draftCountry ?? data.country ?? "Malaysia";
  const displayName = data.marketingName || data.fullName || "Provider";
  const verificationCount = [
    data.emailVerified,
    data.phoneVerified,
    data.identityVerified,
    data.kycVerified,
    data.backgroundCheckVerified,
  ].filter(Boolean).length;
  const providerBadgeLabel =
    verificationCount >= 3 ? "Verified Provider" : `${data.approvalStatus} Provider`;

  return (
    <PageShell
      title="Profile"
      subtitle="Your provider identity, verification, and public listing information."
      action={
        <button
          type="button"
          onClick={() => void state.handleSignOut()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1f2] text-[#dc2626]"
        >
          <LogOut className="h-4.5 w-4.5" />
        </button>
      }
    >
      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#ebf7ef]">
            {data.avatarUrl ? (
              <Image
                src={data.avatarUrl}
                alt={displayName}
                width={96}
                height={96}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[1.4rem] font-black text-[#16a34a]">{getInitials(displayName)}</span>
            )}
          </div>
          <h2 className="mt-4 text-[1.7rem] font-black tracking-[-0.05em] text-[#0f172a]">
            {displayName}
          </h2>
          <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#eef9f1] px-4 py-2 text-[12px] font-bold text-[#16a34a]">
            <ShieldCheck className="h-4 w-4" />
            {providerBadgeLabel}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <InfoRow icon={<UserRound className="h-4.5 w-4.5 text-[#16a34a]" />} label="Full Name" value={data.fullName} />
          <InfoRow icon={<MessageCircleMore className="h-4.5 w-4.5 text-[#16a34a]" />} label="Email" value={data.email} />
          <InfoRow icon={<CreditCard className="h-4.5 w-4.5 text-[#16a34a]" />} label="Phone" value={data.phone || "Not set"} />
          <InfoRow icon={<Phone className="h-4.5 w-4.5 text-[#16a34a]" />} label="Emergency Contact" value={data.emergencyContactNumber || "Not set"} />
          <InfoRow icon={<Globe className="h-4.5 w-4.5 text-[#16a34a]" />} label="Country" value={data.country || "Malaysia"} />
          <InfoRow icon={<MapPin className="h-4.5 w-4.5 text-[#16a34a]" />} label="Service Radius" value={`${data.serviceRadiusKm} KM`} />
          <InfoRow icon={<Globe className="h-4.5 w-4.5 text-[#16a34a]" />} label="Location" value={data.serviceLocation || "Not set"} />
          <InfoRow icon={<Star className="h-4.5 w-4.5 text-[#16a34a]" />} label="Rating" value={`${data.averageRating.toFixed(1)} (${data.totalReviews})`} />
        </div>
        <div className="mt-5 rounded-[18px] border border-[#e7eee8] bg-[#fbfffc] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-black text-[#0f172a]">Emergency Contact</p>
              <p className="mt-1 text-[12px] text-[#64748b]">
                Update the number we should use if we cannot reach you directly.
              </p>
            </div>
            <span className="rounded-full bg-[#eef9f1] px-3 py-1 text-[11px] font-bold text-[#16a34a]">
              Editable
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#0f172a]">Country</span>
              <input
                value={country}
                onChange={(event) => setDraftCountry(event.target.value)}
                className="h-11 w-full rounded-[12px] border border-[#d8ebdf] bg-white px-4 text-[14px] text-[#0f172a] outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#0f172a]">Emergency Contact Number</span>
              <input
                type="tel"
                value={emergencyContactNumber}
                onChange={(event) => setDraftEmergencyContactNumber(event.target.value)}
                placeholder="Enter emergency contact number"
                className="h-11 w-full rounded-[12px] border border-[#d8ebdf] bg-white px-4 text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={isSavingContact || !emergencyContactNumber.trim()}
            onClick={() => {
              startSavingContact(async () => {
                state.setError("");
                state.setNotice("");

                const client = getSupabaseClient();

                if (!client) {
                  state.setError("Supabase is not configured yet.");
                  return;
                }

                const {
                  data: { session },
                } = await client.auth.getSession();

                if (!session) {
                  state.setError("Your session expired. Please log in again.");
                  return;
                }

                const response = await fetch("/api/provider/me", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    country,
                    emergencyContactNumber,
                  }),
                });

                const result = (await response.json().catch(() => ({}))) as { error?: string };

                if (!response.ok) {
                  state.setError(result.error || "Unable to update emergency contact.");
                  return;
                }

                await state.reloadWorkspace();
                setDraftCountry(null);
                setDraftEmergencyContactNumber(null);
                state.setNotice("Emergency contact updated.");
              });
            }}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[13px] font-extrabold text-white disabled:opacity-60"
          >
            {isSavingContact ? "Saving..." : "Save Emergency Contact"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/provider/services"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#8E5EB5] px-4 text-[13px] font-extrabold text-white"
          >
            <PencilLine className="h-4 w-4" />
            Edit Services
          </Link>
          <Link
            href="/provider/availability"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d8ebdf] bg-white px-4 text-[13px] font-extrabold text-[#16a34a]"
          >
            <CalendarDays className="h-4 w-4" />
            Edit Availability
          </Link>
        </div>
      </section>

      <ProviderPushNotificationsCard />

      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[1.1rem] font-black tracking-[-0.04em] text-[#0f172a]">
              Listing Details
            </h3>
            <p className="mt-1 text-[12px] text-[#64748b]">
              Review your public provider details and uploaded work.
            </p>
          </div>
          <Link
            href="/provider/services"
            className="rounded-[12px] border border-[#e5d5fa] bg-[#fbf8ff] px-3 py-2 text-[12px] font-bold text-[#8E5EB5]"
          >
            Edit
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          <DetailRow icon={<MapPin className="h-4.5 w-4.5 text-[#8E5EB5]" />} label="Coverage" value={`${data.serviceRadiusKm} KM from current location`} />
          <DetailRow icon={<BriefcaseBusiness className="h-4.5 w-4.5 text-[#8E5EB5]" />} label="Bio" value={data.bio || "No bio added yet."} />
        </div>
      </section>

      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#c18eff_0%,#8E5EB5_100%)] text-white shadow-[0_16px_36px_rgba(142,94,181,0.22)]">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <div>
              <h3 className="text-[1.5rem] font-black tracking-[-0.05em] text-[#1f1630]">
                Verification
              </h3>
              <p className="mt-1 text-[13px] text-[#7b728a]">
                Verification status for your provider account
              </p>
            </div>
          </div>
          <Link
            href="/provider/more"
            className="rounded-[12px] border border-[#e5d5fa] bg-[#fbf8ff] px-3 py-2 text-[12px] font-bold text-[#8E5EB5]"
          >
            Verify / Help
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          <VerificationStatusCard
            href="/provider/profile/email-verification"
            icon={<Mail className="h-6 w-6" />}
            title="Email"
            subtitle="Email status"
            verified={data.emailVerified}
          />
          <VerificationStatusCard
            href="/provider/profile/phone-verification"
            icon={<Phone className="h-6 w-6" />}
            title="Phone"
            subtitle="Phone status"
            verified={data.phoneVerified}
          />
          <VerificationStatusCard
            href="/provider/profile/identity-verification"
            icon={<IdCard className="h-6 w-6" />}
            title="Identity"
            subtitle="ID check"
            verified={data.identityVerified}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-[22px] border border-[#e7dcf8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f4edff_100%)] p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#7c3aed] shadow-[0_10px_24px_rgba(124,58,237,0.12)]">
              <HelpCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Need help?</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Learn more about verification or contact support for assistance.
              </p>
            </div>
          </div>
          <Link
            href="/provider/more"
            className="shrink-0 rounded-[14px] border border-[#decdf7] bg-white px-4 py-3 text-[13px] font-bold text-[#8E5EB5]"
          >
            Verify / Help
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        {data.services.map((service) => (
          <div
            key={service.id}
            className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[1.1rem] font-black tracking-[-0.04em] text-[#0f172a]">
                  {formatServiceLabel(service.serviceType)}
                </h3>
                <p className="mt-1 text-[12px] text-[#64748b]">
                  {service.yearsExperience || "Experience not added yet"}
                </p>
              </div>
              <Link
                href="/provider/services"
                className="rounded-[12px] border border-[#e5d5fa] bg-[#fbf8ff] px-3 py-2 text-[12px] font-bold text-[#8E5EB5]"
              >
                Edit
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricCard label="Hourly" value={formatCompactCurrency(service.hourlyRate)} meta="per hour" />
              <MetricCard label="Daily" value={formatCompactCurrency(service.dailyRate)} meta="per day" />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#9a90ac]">
                Service Types
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {service.specialties.length > 0 ? (
                  service.specialties.map((specialty) => (
                    <span
                      key={`${service.id}-${specialty}`}
                      className="rounded-full bg-[#f5f1fa] px-3 py-1.5 text-[12px] font-semibold text-[#8E5EB5]"
                    >
                      {specialty}
                    </span>
                  ))
                ) : (
                  <p className="text-[13px] text-[#64748b]">No service tags added yet.</p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#9a90ac]">
                Service Images
              </p>
              {service.imageDataUrls.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {service.imageDataUrls.map((image, index) => (
                    <div key={`${service.id}-image-${index}`} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-[16px] border border-[#e7eee8] bg-[#f8faf9]">
                        <Image
                          src={image}
                          alt={service.imageCaptions[index] || `${service.serviceType} work ${index + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <p className="text-[11px] leading-4 text-[#64748b]">
                        {service.imageCaptions[index] || `Work ${index + 1}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[#64748b]">No service images uploaded yet.</p>
              )}
            </div>

            <div className="mt-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#9a90ac]">
                Certificates
              </p>
              {service.certificateDataUrls.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {service.certificateDataUrls.map((file, index) => (
                    <a
                      key={`${service.id}-certificate-${index}`}
                      href={file}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-[16px] border border-[#e7eee8] bg-[#fbfffc] px-4 py-3"
                    >
                      <span className="text-[13px] font-semibold text-[#0f172a]">
                        {service.certificateCaptions[index] || `Certificate ${index + 1}`}
                      </span>
                      <span className="text-[12px] font-bold text-[#8E5EB5]">View</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[#64748b]">No certificates uploaded yet.</p>
              )}
            </div>
          </div>
        ))}
      </section>
    </PageShell>
  );
}

export function PhoneVerificationScreen() {
  const state = useProviderAppData();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [screenNotice, setScreenNotice] = useState("");
  const [draftPhoneNumber, setDraftPhoneNumber] = useState<string | null>(null);
  const fallback = LoadingOrError(state);
  const derivedPhoneNumber = state.data?.phone.replace(/^\+?60\s?/, "").trim() ?? "";
  const phoneNumber = draftPhoneNumber ?? derivedPhoneNumber;

  useEffect(() => {
    if (!otpSent || countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, countdown]);

  if (fallback) {
    return fallback;
  }

  const data = state.data!;

  const phoneValue = phoneNumber.trim();
  const canSendOtp = phoneValue.length >= 7;
  const canVerify = phoneValue.length >= 7 && otp.length === 6;

  return (
    <MobilePage className="pb-40">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/provider/profile"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#eee5f7] bg-white text-[#8E5EB5] shadow-[0_10px_24px_rgba(86,38,135,0.06)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <VerificationStatusPill verified={data.phoneVerified} />
        </div>

        <header className="pt-2">
          <h1 className="text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">
            Phone Verification
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#7b728a]">
            Add your phone number and verify it with a one-time code.
          </p>
        </header>

        <section className="rounded-[26px] border border-[#eee5f7] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)]">
          <div>
            <p className="text-[15px] font-black text-[#1f1630]">Phone Number</p>
            <div className="mt-4 overflow-hidden rounded-[16px] border border-[#e7def4]">
              <div className="flex items-stretch">
                <div className="flex w-[96px] items-center gap-2 border-r border-[#e7def4] bg-white px-3">
                  <span className="text-[1.35rem]">🇲🇾</span>
                  <span className="text-[16px] font-semibold text-[#1f1630]">+60</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(event) => setDraftPhoneNumber(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Enter phone number"
                  className="h-[52px] flex-1 bg-white px-4 text-[15px] text-[#1f1630] outline-none placeholder:text-[#b3a9c7]"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!canSendOtp) {
                return;
              }

              setOtp("");
              setOtpSent(true);
              setCountdown(30);
              setScreenNotice("We sent a 6-digit code by SMS to your phone.");
            }}
            disabled={!canSendOtp}
            className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border text-[15px] font-black transition ${
              canSendOtp
                ? "border-[#cdb8f3] bg-white text-[#8E5EB5] shadow-[0_12px_28px_rgba(142,94,181,0.08)]"
                : "cursor-not-allowed border-[#eadff8] bg-[#faf7fe] text-[#c2b2dc]"
            }`}
          >
            <Send className="h-4.5 w-4.5" />
            Send OTP
          </button>

          <div className="mt-6">
            <p className="text-[15px] font-black text-[#1f1630]">Enter OTP</p>
            <OtpInputSlots value={otp} onChange={setOtp} />

            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center gap-2 text-[#6f6681]">
                <MessageCircleMore className="h-4 w-4 text-[#8E5EB5]" />
                <span>{screenNotice || "We sent a 6-digit code by SMS"}</span>
              </div>
              <div className="flex items-center gap-2 text-[#6f6681]">
                <Clock3 className="h-4 w-4 text-[#8E5EB5]" />
                <span>
                  Resend code in{" "}
                  <strong className="font-black text-[#8E5EB5]">
                    00:{String(countdown).padStart(2, "0")}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Your security matters</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Your phone number will be used for account verification and important security alerts.
              </p>
            </div>
          </div>
        </section>

        <button
          type="button"
          disabled={!canVerify}
          onClick={() => {
            if (!canVerify) {
              return;
            }

            state.setNotice("Phone verification submitted successfully.");
            router.push("/provider/profile");
          }}
          className={`mt-2 inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-black transition ${
            canVerify
              ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
              : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
          }`}
        >
          Verify Number
        </button>
      </section>
    </MobilePage>
  );
}

export function EmailVerificationScreen() {
  const state = useProviderAppData();
  const fallback = LoadingOrError(state);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const emailValue = draftEmail ?? state.data?.email ?? "";

  if (fallback) {
    return fallback;
  }

  const data = state.data!;

  return (
    <VerificationFlowScreen
      backHref="/provider/profile"
      title="Email Verification"
      description="Add your email address and verify it with a one-time code."
      statusVerified={data.emailVerified}
      fieldLabel="Email Address"
      fieldType="email"
      fieldValue={emailValue}
      onFieldValueChange={(value) => setDraftEmail(value.trimStart())}
      fieldPlaceholder="Enter email address"
      sendLabel="Send Code"
      sentMessage="We sent a 6-digit code to your email."
      idleMessage="We sent a 6-digit code to your email"
      securityMessage="Your email address will be used for account verification and important updates."
      verifyLabel="Verify Email"
      successMessage="Email verification submitted successfully."
    />
  );
}

export function IdentityVerificationScreen() {
  const state = useProviderAppData();
  const router = useRouter();
  const [frontFileName, setFrontFileName] = useState("");
  const [backFileName, setBackFileName] = useState("");
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<"ic" | "passport">("ic");
  const [identityUploadTarget, setIdentityUploadTarget] = useState<"front" | "back" | null>(null);
  const [identityCropState, setIdentityCropState] = useState<{
    side: "front" | "back";
    fileName: string;
    sourceDataUrl: string;
    tone: CropTone;
  } | null>(null);
  const frontGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const backGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const frontCameraInputRef = useRef<HTMLInputElement | null>(null);
  const backCameraInputRef = useRef<HTMLInputElement | null>(null);
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  const data = state.data!;
  const canSubmit = Boolean(frontPreview && backPreview);

  const handleFileChange = (side: "front" | "back", source: "gallery" | "camera") =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (source === "camera" && !file.type.startsWith("image/")) {
        state.setError("Camera upload must be an image.");
        return;
      }

      if (source === "gallery" && !file.type.startsWith("image/")) {
        state.setError("Gallery upload must be an image for document cropping.");
        return;
      }

      if (file.size > PAYMENT_PROOF_MAX_BYTES) {
        state.setError("Each document image must be 5MB or smaller.");
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      setIdentityUploadTarget(null);
      setIdentityCropState({
        side,
        fileName: file.name,
        sourceDataUrl: dataUrl,
        tone: "document",
      });
      state.setError("");
    };

  const handleIdentityCropApply = async (selection: { x: number; y: number; width: number; height: number }) => {
    if (!identityCropState) {
      return;
    }

    try {
      const croppedImage = await cropImageFromSelection(identityCropState.sourceDataUrl, selection);
      if (identityCropState.side === "front") {
        setFrontFileName(identityCropState.fileName);
        setFrontPreview(croppedImage);
      } else {
        setBackFileName(identityCropState.fileName);
        setBackPreview(croppedImage);
      }
      setIdentityCropState(null);
      state.setError("");
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Unable to crop this document image.");
    }
  };

  const openSourcePicker = (side: "front" | "back") => {
    setIdentityUploadTarget(side);
    state.setError("");
  };

  const activeInputs =
    identityUploadTarget === "front"
      ? { gallery: frontGalleryInputRef, camera: frontCameraInputRef }
      : { gallery: backGalleryInputRef, camera: backCameraInputRef };

  return (
    <MobilePage className="pb-40">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/provider/profile"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#eee5f7] bg-white text-[#8E5EB5] shadow-[0_10px_24px_rgba(86,38,135,0.06)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <VerificationStatusPill verified={data.identityVerified} />
        </div>

        <header className="pt-2">
          <h1 className="text-[2rem] font-black tracking-[-0.06em] text-[#1f1630]">
            Identity Verification
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#7b728a]">
            Upload your IC or passport images for identity verification.
          </p>
        </header>

        <section className="rounded-[22px] border border-[#eadff8] bg-white p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <p className="text-[14px] font-black text-[#1f1630]">Document Type</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedDocumentType("ic")}
              className={`rounded-[14px] border px-4 py-3 text-[14px] font-bold transition ${
                selectedDocumentType === "ic"
                  ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]"
                  : "border-[#e7def4] bg-white text-[#6f6681]"
              }`}
            >
              IC
            </button>
            <button
              type="button"
              onClick={() => setSelectedDocumentType("passport")}
              className={`rounded-[14px] border px-4 py-3 text-[14px] font-bold transition ${
                selectedDocumentType === "passport"
                  ? "border-[#8E5EB5] bg-[#f7f1fc] text-[#8E5EB5]"
                  : "border-[#e7def4] bg-white text-[#6f6681]"
              }`}
            >
              Passport
            </button>
          </div>
        </section>

        <section className="rounded-[26px] border border-[#eee5f7] bg-white p-5 shadow-[0_18px_44px_rgba(86,38,135,0.08)]">
          <div className="space-y-5">
            <div>
              <p className="text-[15px] font-black text-[#1f1630]">
                {selectedDocumentType === "passport" ? "Passport Main Page" : "IC Front"}
              </p>
              <div className="mt-3 rounded-[18px] border border-dashed border-[#dccff3] bg-[#fdfbff] p-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-32 overflow-hidden rounded-[14px] border border-[#ece3f8] bg-[linear-gradient(135deg,#f8f4ff_0%,#eef2ff_100%)]">
                    {frontPreview ? (
                      <Image src={frontPreview} alt={frontFileName || "IC front"} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#8E5EB5]">
                        <IdCard className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-[#6f6681]">
                      Upload clear image of {selectedDocumentType === "passport" ? "passport page" : "front side"}
                    </p>
                    {frontFileName ? (
                      <p className="mt-2 truncate text-[12px] font-semibold text-[#8E5EB5]">{frontFileName}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openSourcePicker("front")}
                      className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#ceb9f2] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]"
                    >
                      <Upload className="h-4 w-4" />
                      {selectedDocumentType === "passport" ? "Upload Passport" : "Upload Front"}
                    </button>
                    <input
                      ref={frontGalleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange("front", "gallery")}
                      className="hidden"
                    />
                    <input
                      ref={frontCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange("front", "camera")}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[15px] font-black text-[#1f1630]">
                {selectedDocumentType === "passport" ? "Passport Supporting Page" : "IC Back"}
              </p>
              <div className="mt-3 rounded-[18px] border border-dashed border-[#dccff3] bg-[#fdfbff] p-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-32 overflow-hidden rounded-[14px] border border-[#ece3f8] bg-[linear-gradient(135deg,#f8f4ff_0%,#eef2ff_100%)]">
                    {backPreview ? (
                      <Image src={backPreview} alt={backFileName || "IC back"} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#8E5EB5]">
                        <IdCard className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-5 text-[#6f6681]">
                      Upload clear image of {selectedDocumentType === "passport" ? "supporting page" : "back side"}
                    </p>
                    {backFileName ? (
                      <p className="mt-2 truncate text-[12px] font-semibold text-[#8E5EB5]">{backFileName}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openSourcePicker("back")}
                      className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#ceb9f2] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]"
                    >
                      <Upload className="h-4 w-4" />
                      {selectedDocumentType === "passport" ? "Upload Page" : "Upload Back"}
                    </button>
                    <input
                      ref={backGalleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange("back", "gallery")}
                      className="hidden"
                    />
                    <input
                      ref={backCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange("back", "camera")}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <IdCard className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Image Requirements</p>
              <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[#6f6681]">
                <li>Ensure the full IC or passport page is visible within the frame</li>
                <li>All text must be clear and readable</li>
                <li>Image must be in focus and not blurry</li>
                <li>No glare or reflections on the card</li>
                <li>Crop the image before saving to keep only the document area</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eadff8] bg-[linear-gradient(135deg,#fbf8ff_0%,#f5efff_100%)] p-4 shadow-[0_10px_24px_rgba(86,38,135,0.06)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#8E5EB5]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-black text-[#1f1630]">Your information is safe</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Your IC or passport images are encrypted and used only for identity verification. We do not store your documents beyond the verification process.
              </p>
            </div>
          </div>
        </section>

        {state.error ? (
          <p className="rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
            {state.error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit) {
              return;
            }

            state.setNotice("Identity verification submitted successfully.");
            router.push("/provider/profile");
          }}
          className={`mt-2 inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-black transition ${
            canSubmit
              ? "bg-[linear-gradient(135deg,#8E5EB5_0%,#6f43b6_100%)] text-white shadow-[0_18px_34px_rgba(111,67,182,0.28)]"
              : "cursor-not-allowed bg-[#ddd2ef] text-white shadow-none"
          }`}
        >
          Submit for Verification
        </button>

        {identityUploadTarget ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#111827]/45 px-4 pb-6">
            <div className="w-full max-w-[430px] rounded-[24px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
              <p className="text-[16px] font-black text-[#1f1630]">
                {identityUploadTarget === "front" ? "Front document image" : "Back document image"}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-[#6f6681]">
                Choose a source, then crop the document before saving.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => activeInputs.gallery.current?.click()}
                  className="inline-flex h-12 items-center justify-center rounded-[14px] border border-[#d9c8ee] bg-white px-4 text-[14px] font-bold text-[#8E5EB5]"
                >
                  Choose from Gallery
                </button>
                <button
                  type="button"
                  onClick={() => activeInputs.camera.current?.click()}
                  className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#8E5EB5] px-4 text-[14px] font-bold text-white"
                >
                  Open Camera
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIdentityUploadTarget(null)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[#eee5f7] bg-[#faf7fe] text-[14px] font-bold text-[#6f6681]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {identityCropState ? (
        <ImageCropModal
          imageDataUrl={identityCropState.sourceDataUrl}
          tone={identityCropState.tone}
          onClose={() => setIdentityCropState(null)}
          onApply={(selection) => {
            void handleIdentityCropApply(selection);
          }}
        />
      ) : null}
    </MobilePage>
  );
}

export function MoreScreen() {
  const state = useProviderAppData();
  const fallback = LoadingOrError(state);

  if (fallback) {
    return fallback;
  }

  return (
    <PageShell title="More" subtitle="Provider settings, support, and quick links to the rest of the app.">
      <section className="rounded-[26px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#e6eee8]">
        <div className="space-y-3">
          <InfoRow icon={<UserRound className="h-4.5 w-4.5 text-[#16a34a]" />} label="Personal Information" value="Open" href="/provider/profile" />
          <InfoRow icon={<Landmark className="h-4.5 w-4.5 text-[#16a34a]" />} label="Bank Details" value="Wallet" href="/provider/payments" />
          <InfoRow icon={<BriefcaseBusiness className="h-4.5 w-4.5 text-[#16a34a]" />} label="My Services" value="Manage" href="/provider/services" />
          <InfoRow icon={<CalendarDays className="h-4.5 w-4.5 text-[#16a34a]" />} label="Availability" value="Edit" href="/provider/availability" />
          <InfoRow icon={<Star className="h-4.5 w-4.5 text-[#16a34a]" />} label="Reviews" value="View" href="/provider/reviews" />
          <InfoRow icon={<HelpCircle className="h-4.5 w-4.5 text-[#16a34a]" />} label="Help & Support" value="Soon" />
        </div>
        <div className="mt-5">
          <AppButton className="w-full" tone="danger" onClick={() => void state.handleSignOut()}>
            Log Out
          </AppButton>
        </div>
      </section>
    </PageShell>
  );
}
