-- Backs real server-side OTP verification for customer phone/email checks
-- (Phase A security fix — replaces client-asserted `emailVerified`/
-- `phoneVerified` flags). Only ever read/written by backend API routes via
-- the service-role client — never queried directly from Flutter, so RLS is
-- enabled with zero grantable policies (default-deny for anon/authenticated,
-- same posture as the insert/update side of public.payments).
create table if not exists public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('phone', 'email')),
  target text not null,
  code_hash text not null,
  user_id uuid references auth.users(id) on delete cascade,
  attempts int not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists otp_challenges_target_purpose_idx
  on public.otp_challenges (target, purpose, created_at desc);

alter table public.otp_challenges enable row level security;
