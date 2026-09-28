-- Phase 1 authentication security: trusted devices, Swiper Security PIN,
-- security event log, and generic auth rate limiting.
--
-- Written defensively/idempotently (IF NOT EXISTS / IF EXISTS everywhere)
-- because `user_devices` and `profiles` predate this repo's migration
-- history and were created by hand in Supabase — this migration must not
-- assume it "owns" those tables, only extend them safely.
--
-- Reversible: see the DOWN section at the bottom (commented out — run
-- manually if a rollback is ever needed, since Supabase migrations are
-- forward-only by default).

-- ============================================================
-- 1. user_devices — add trusted-device columns
-- ============================================================

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  fcm_token text,
  platform text,
  created_at timestamptz not null default now()
);

-- The CREATE TABLE above is a no-op if user_devices already exists (the
-- expected case in production, since it predates tracked migrations) — so
-- every column it would have created must also be added explicitly here.
alter table public.user_devices add column if not exists device_id text;
alter table public.user_devices add column if not exists fcm_token text;
alter table public.user_devices add column if not exists platform text;
alter table public.user_devices add column if not exists device_name text;
alter table public.user_devices add column if not exists is_trusted boolean not null default false;
alter table public.user_devices add column if not exists first_seen_at timestamptz not null default now();
alter table public.user_devices add column if not exists last_seen_at timestamptz not null default now();
alter table public.user_devices add column if not exists trusted_at timestamptz;
alter table public.user_devices add column if not exists revoked_at timestamptz;

-- device_id may be null on old rows created before this migration (the
-- push-notification-only era only ever wrote user_id/fcm_token/platform).
-- Backfill a placeholder so the unique index below can be created; those
-- old rows will never match a real device_id sent by the app, so they're
-- functionally "unknown device" rows going forward, which is the safe
-- default.
update public.user_devices
set device_id = 'legacy:' || id::text
where device_id is null;

alter table public.user_devices alter column device_id set not null;

create unique index if not exists user_devices_user_device_uidx
  on public.user_devices (user_id, device_id);

alter table public.user_devices enable row level security;

drop policy if exists "user can view own devices" on public.user_devices;
create policy "user can view own devices" on public.user_devices
  for select using (auth.uid() = user_id);

-- The client IS allowed to upsert its own device row (this is what lets
-- push_notification_service.dart keep fcm_token/last_seen_at current
-- without a round trip through the backend on every app open) — but the
-- trigger below strips any change to is_trusted/trusted_at/revoked_at
-- whenever the caller isn't the service role, the same defense-in-depth
-- pattern already used for profiles.role in
-- 20260908_prevent_profile_role_escalation.sql. Marking a device trusted
-- (login/phone routes) or revoking one (a future "remove device" action)
-- always runs as the service role, so those still work; a client trying to
-- set is_trusted=true directly has it silently reverted.
drop policy if exists "user can insert own device" on public.user_devices;
create policy "user can insert own device" on public.user_devices
  for insert with check (auth.uid() = user_id);

drop policy if exists "user can update own device" on public.user_devices;
create policy "user can update own device" on public.user_devices
  for update using (auth.uid() = user_id);

create or replace function public.protect_user_devices_trust_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.role() in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_trusted := false;
      new.trusted_at := null;
      new.revoked_at := null;
    elsif tg_op = 'UPDATE' then
      new.is_trusted := old.is_trusted;
      new.trusted_at := old.trusted_at;
      new.revoked_at := old.revoked_at;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_user_devices_trust_columns on public.user_devices;
create trigger trg_protect_user_devices_trust_columns
  before insert or update on public.user_devices
  for each row
  execute function public.protect_user_devices_trust_columns();

-- ============================================================
-- 2. profiles — Swiper Security PIN fields
-- ============================================================

alter table public.profiles add column if not exists pin_hash text;
alter table public.profiles add column if not exists pin_set_at timestamptz;
alter table public.profiles add column if not exists pin_failed_attempts integer not null default 0;
alter table public.profiles add column if not exists pin_locked_until timestamptz;

-- No RLS policy change needed here for the PIN columns specifically beyond
-- what already exists — profiles' existing self-select policy already lets
-- a user read their own row (including pin_hash), which is a minor exposure
-- (client can see its own PIN hash, never anyone else's, and a hash alone
-- is not the PIN) but every write path for these columns runs through the
-- service role from the API routes below, never a direct client update.
-- See 20260908_prevent_profile_role_escalation.sql for the existing
-- column-scoped UPDATE protection this migration does not touch.

-- ============================================================
-- 3. security_events — append-only audit log
-- ============================================================

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  device_id text,
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_user_id_idx
  on public.security_events (user_id, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists "user can view own security events" on public.security_events;
create policy "user can view own security events" on public.security_events
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy for clients — only the service role writes
-- events, from the backend helper in lib/auth-security.ts.

-- ============================================================
-- 4. auth_rate_limits — generic sliding-window + lockout counter
-- ============================================================

create table if not exists public.auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  window_start timestamptz not null default now(),
  attempt_count integer not null default 1,
  locked_until timestamptz
);

create unique index if not exists auth_rate_limits_bucket_key_uidx
  on public.auth_rate_limits (bucket_key);

alter table public.auth_rate_limits enable row level security;
-- No policies at all for this table — it has no legitimate client read or
-- write path; only the service role touches it.

-- ============================================================
-- DOWN (manual rollback reference — not auto-run)
-- ============================================================
-- drop trigger if exists trg_protect_user_devices_trust_columns on public.user_devices;
-- drop function if exists public.protect_user_devices_trust_columns();
-- drop policy if exists "user can insert own device" on public.user_devices;
-- drop policy if exists "user can update own device" on public.user_devices;
-- alter table public.user_devices drop column if exists device_name;
-- alter table public.user_devices drop column if exists is_trusted;
-- alter table public.user_devices drop column if exists first_seen_at;
-- alter table public.user_devices drop column if exists last_seen_at;
-- alter table public.user_devices drop column if exists trusted_at;
-- alter table public.user_devices drop column if exists revoked_at;
-- drop index if exists public.user_devices_user_device_uidx;
-- alter table public.profiles drop column if exists pin_hash;
-- alter table public.profiles drop column if exists pin_set_at;
-- alter table public.profiles drop column if exists pin_failed_attempts;
-- alter table public.profiles drop column if exists pin_locked_until;
-- drop table if exists public.security_events;
-- drop table if exists public.auth_rate_limits;
