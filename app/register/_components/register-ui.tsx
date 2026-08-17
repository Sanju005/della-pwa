"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type ShellProps = {
  children: ReactNode;
};

type HeaderProps = {
  showBack?: boolean;
  backHref?: string;
};

type TitleProps = {
  title: string;
  subtitle?: string;
};

type FieldProps = {
  label: string;
  placeholder: string;
  icon: ReactNode;
  rightIcon?: ReactNode;
  type?: string;
};

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
};

type OtpBoxProps = {
  value?: string;
};

export function RegisterShell({ children }: ShellProps) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(166,121,207,0.18),transparent_28%),linear-gradient(180deg,#fcfbff_0%,#f6f1fb_100%)]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-white px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="min-h-[100dvh] bg-white py-4">
          {children}
        </div>
      </div>
    </main>
  );
}

export function RegisterHeader({
  showBack = false,
  backHref = "/login",
}: HeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex min-h-[56px] items-center justify-between">
        {showBack ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="mobile-pressable inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#ece4f6] bg-[#faf7fd] text-[#8E5EB5]"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

export function RegisterTitle({ title, subtitle }: TitleProps) {
  return (
    <div className="mt-2 text-center">
      <h1 className="text-[24px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#111827]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mx-auto mt-2 max-w-[16.5rem] text-[14px] leading-6 text-[#4b5563]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function CircleHero({ children }: ShellProps) {
  return (
    <div className="mx-auto mb-4 mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f5f1fa_0%,#eadcf6_100%)]">
      {children}
    </div>
  );
}

export function Field({
  label,
  placeholder,
  icon,
  rightIcon,
  type = "text",
}: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password";

  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className="flex h-13 items-center rounded-[14px] border border-[#d9e2dd] bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <span className="mr-3 text-[#8E5EB5]">{icon}</span>
        <input
          type={isPasswordField && showPassword ? "text" : type}
          placeholder={placeholder}
          className="h-full flex-1 border-0 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
        />
        {rightIcon ? (
          <button
            type="button"
            aria-label={isPasswordField && showPassword ? "Hide password" : "Show password"}
            onClick={() => {
              if (isPasswordField) {
                setShowPassword((current) => !current);
              }
            }}
            className="ml-3 text-[#6b7280]"
          >
            {rightIcon}
          </button>
        ) : null}
      </div>
    </label>
  );
}

export function DateField() {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        Date of Birth
      </span>
      <div className="flex h-13 items-center rounded-[14px] border border-[#d9e2dd] bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <span className="mr-3 text-[#8E5EB5]">
          <CalendarIcon className="h-5 w-5" />
        </span>
        <input
          type="text"
          placeholder="Select date of birth"
          className="h-full flex-1 border-0 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
        />
        <span className="ml-3 text-[#8E5EB5]">
          <CalendarIcon className="h-5 w-5" />
        </span>
      </div>
    </label>
  );
}

export function PhoneField() {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        Phone Number
      </span>
      <div className="flex gap-2.5">
        <div className="flex h-13 w-[8.25rem] items-center rounded-[14px] border border-[#d9e2dd] bg-white px-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
          <span className="mr-2">
            <MalaysiaFlagIcon className="h-5 w-7 rounded-[4px]" />
          </span>
          <span className="text-[15px] font-medium text-[#111827]">+60</span>
          <ChevronDownIcon className="ml-auto h-4 w-4 text-[#6b7280]" />
        </div>
        <div className="flex h-13 flex-1 items-center rounded-[14px] border border-[#d9e2dd] bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
          <PhoneIcon className="mr-3 h-5 w-5 text-[#8E5EB5]" />
          <input
            type="tel"
            placeholder="Enter phone number"
            className="h-full flex-1 border-0 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
          />
        </div>
      </div>
    </label>
  );
}

export function PrimaryLinkButton({ href, children }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className="mobile-pressable inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] px-5 text-[15px] font-medium text-white shadow-[0_10px_24px_rgba(142,94,181,0.18)] transition hover:bg-[#7B4EA1]"
    >
      {children}
    </Link>
  );
}

export function BottomAuthText() {
  return (
    <p className="mt-4 text-center text-[15px] text-[#4b5563]">
      Already have an account?{" "}
      <Link href="/login" className="font-semibold text-[#8E5EB5]">
        Log in
      </Link>
    </p>
  );
}

export function VerifyPhoneCard() {
  return (
    <div className="flex h-13 items-center rounded-[14px] border border-[#d9e2dd] bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <PhoneIcon className="mr-3 h-5 w-5 text-[#8E5EB5]" />
      <span className="text-[15px] font-medium text-[#111827]">
        +60 12-345 6789
      </span>
    </div>
  );
}

export function OtpRow() {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <OtpBox key={index} />
      ))}
    </div>
  );
}

export function OtpBox({ value = "" }: OtpBoxProps) {
  return (
    <input
      aria-label="OTP digit"
      inputMode="numeric"
      maxLength={1}
      defaultValue={value}
      className="h-16 w-12 rounded-[12px] border border-[#d9e2dd] bg-white text-center text-[28px] font-semibold text-[#111827] shadow-[0_8px_20px_rgba(15,23,42,0.03)] outline-none"
    />
  );
}

export function ResendRow() {
  return (
    <p className="mt-9 flex items-center gap-2 text-[14px] font-semibold text-[#8E5EB5]">
      <RefreshIcon className="h-4 w-4" />
      Resend OTP (00:30)
    </p>
  );
}

export function SuccessCard() {
  const items = [
    {
      icon: <SearchIcon className="h-6 w-6 text-[#8E5EB5]" />,
      title: "Find nearby service providers",
      text: "Browse and discover trusted professionals near you.",
    },
    {
      icon: <ChatIcon className="h-6 w-6 text-[#8E5EB5]" />,
      title: "Chat directly with providers",
      text: "Ask questions and confirm details before booking.",
    },
    {
      icon: <BoltIcon className="h-6 w-6 text-[#8E5EB5]" />,
      title: "Book instantly",
      text: "Reserve services quickly with fewer steps.",
    },
    {
      icon: <CalendarIcon className="h-6 w-6 text-[#8E5EB5]" />,
      title: "Track your bookings",
      text: "Stay updated on schedules and upcoming jobs.",
    },
  ];

  return (
    <div className="rounded-[22px] border border-[#e6daf1] bg-[linear-gradient(180deg,#ffffff_0%,#faf7fd_100%)] p-5 shadow-[0_16px_36px_rgba(142,94,181,0.08)]">
      {items.map((item, index) => (
        <div
          key={item.title}
          className={
            index === 0
              ? "flex gap-4"
              : "mt-4 flex gap-4 border-t border-[#eee5f6] pt-4"
          }
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#dac7ec] bg-[#f5f1fa]">
            {item.icon}
          </div>
          <div>
            <h3 className="text-[16px] font-extrabold text-[#111827]">
              {item.title}
            </h3>
            <p className="mt-1 text-[14px] leading-6 text-[#4b5563]">
              {item.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SuccessHero() {
  return (
    <div className="relative mx-auto mb-6 mt-3 flex h-36 w-36 items-center justify-center">
      <span className="absolute left-1 top-11 h-2.5 w-2.5 rounded-full bg-[#8E5EB5]" />
      <span className="absolute right-2 top-12 h-2 w-2 rounded-full bg-[#facc15]" />
      <span className="absolute left-7 top-3 h-1.5 w-1.5 rounded-full bg-[#A679CF]" />
      <span className="absolute right-11 top-2 h-1.5 w-1.5 rounded-full bg-[#A679CF]" />
      <span className="absolute right-4 top-8 h-2 w-2 rounded-full bg-[#fb7185]" />
      <SparkleIcon className="absolute left-4 top-7 h-4 w-4 text-[#facc15]" />
      <SparkleIcon className="absolute right-9 bottom-8 h-3.5 w-3.5 rotate-45 text-[#A679CF]" />
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#8E5EB5] shadow-[0_18px_30px_rgba(142,94,181,0.22)]">
        <CheckIcon className="h-12 w-12 text-white" />
      </div>
    </div>
  );
}

export function VerifyHero() {
  return (
    <div className="relative mx-auto mb-5 mt-3 flex h-32 w-32 items-center justify-center rounded-full bg-[radial-gradient(circle,#f5f1fa_0%,#eadcf6_100%)]">
      <span className="absolute left-1 top-12 h-2.5 w-2.5 rounded-full bg-[#d7c1eb]" />
      <span className="absolute right-0 top-10 h-2.5 w-2.5 rounded-full bg-[#8E5EB5]" />
      <span className="absolute left-10 top-1 h-2.5 w-2.5 rounded-full bg-[#8E5EB5]" />
      <PhoneShieldIcon className="h-20 w-20 text-[#8E5EB5]" />
    </div>
  );
}

export function SignupHero() {
  return (
    <CircleHero>
      <UserPlusIcon className="h-9 w-9 text-[#8E5EB5]" />
    </CircleHero>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className={className}
    >
      <path
        d="M15 18 9 12l6-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className={className}
    >
      <path d="M15 19c0-2.21-2.69-4-6-4s-6 1.79-6 4" />
      <circle cx="9" cy="8" r="4" />
      <path
        d="M19 8v6M16 11h6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path
        d="M4 20c1.7-3 4.4-4.5 8-4.5s6.3 1.5 8 4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        d="M6.6 3h3.1l1.2 4.6-1.8 1.8a15 15 0 0 0 5.4 5.4l1.8-1.8L21 14.3v3.1c0 .9-.7 1.6-1.6 1.6C10.8 19 5 13.2 5 6.6 5 5.7 5.7 5 6.6 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M3 3 21 21" strokeLinecap="round" />
      <path
        d="M10.6 10.6a2 2 0 1 0 2.8 2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.2A11.4 11.4 0 0 0 2.5 12c-.2.6-.2 1.4 0 2C3.7 17.6 7 21 12 21c1.2 0 2.3-.2 3.3-.5"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.1A10.9 10.9 0 0 1 12 5c5 0 8.3 3.4 9.5 7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M20 11a8 8 0 0 0-14.8-4M4 13a8 8 0 0 0 14.8 4" strokeLinecap="round" />
      <path
        d="M4 4v4h4M20 20v-4h-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M7 17.5 3 21V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7Z" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      className={className}
    >
      <path
        d="m5 13 4 4L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={className}
    >
      <rect x="26" y="12" width="34" height="58" rx="8" />
      <path d="M39 20h8" strokeLinecap="round" />
      <circle cx="43" cy="61" r="2" fill="currentColor" stroke="none" />
      <rect x="48" y="28" width="26" height="26" rx="6" fill="white" />
      <path d="M56 40v-4a5 5 0 1 1 10 0v4" />
      <rect x="54" y="40" width="14" height="12" rx="2" />
    </svg>
  );
}


function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
    </svg>
  );
}

function MalaysiaFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className}>
      <rect width="28" height="20" rx="3" fill="#ffffff" />
      <path d="M0 0h14v10H0z" fill="#1d4ed8" />
      <path d="M0 0h28v2H0zm0 4h28v2H0zm0 8h28v2H0zm0 12h28v2H0z" fill="#ef4444" />
      <path d="M0 8h28v2H0zm0 8h28v2H0z" fill="#ef4444" />
      <circle cx="7" cy="5" r="3.3" fill="#facc15" />
      <circle cx="8.1" cy="5" r="2.6" fill="#1d4ed8" />
      <path
        d="m10.2 2.4.6 1.5 1.6.1-1.2 1 .4 1.5-1.4-.8-1.4.8.4-1.5-1.2-1 1.6-.1.6-1.5Z"
        fill="#facc15"
      />
    </svg>
  );
}

export const Icons = {
  User: UserIcon,
  Mail: MailIcon,
  Lock: LockIcon,
  EyeOff: EyeOffIcon,
};
