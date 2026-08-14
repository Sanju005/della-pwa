create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null,
  first_name text not null default '',
  last_name text not null default '',
  date_of_birth text not null default '',
  sex text not null default '',
  email text not null default '',
  phone_number text not null,
  emergency_contact_number text not null default '',
  address_label text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  postcode text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'Malaysia',
  role text not null default 'customer',
  source text not null default 'flutter_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number)
);

create table if not exists public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  marketing_name text not null default '',
  date_of_birth text not null default '',
  gender text not null default '',
  email text not null default '',
  phone_number text not null,
  emergency_contact_number text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  postcode text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'Malaysia',
  service_area text not null default '',
  service_radius_km double precision not null default 0,
  services text[] not null default '{}',
  specialties text[] not null default '{}',
  hourly_rate integer not null default 0,
  years_experience integer not null default 0,
  availability_days text[] not null default '{}',
  time_preset text not null default '',
  phone_verified boolean not null default false,
  identity_verified boolean not null default false,
  status text not null default 'pending',
  role text not null default 'provider',
  source text not null default 'flutter_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number)
);

alter table public.customer_profiles enable row level security;
alter table public.provider_profiles enable row level security;

drop policy if exists "customer_profiles_public_insert" on public.customer_profiles;
create policy "customer_profiles_public_insert"
on public.customer_profiles
for insert
to anon, authenticated
with check (true);

drop policy if exists "customer_profiles_public_update" on public.customer_profiles;
create policy "customer_profiles_public_update"
on public.customer_profiles
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "customer_profiles_public_select" on public.customer_profiles;
create policy "customer_profiles_public_select"
on public.customer_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "provider_profiles_public_insert" on public.provider_profiles;
create policy "provider_profiles_public_insert"
on public.provider_profiles
for insert
to anon, authenticated
with check (true);

drop policy if exists "provider_profiles_public_update" on public.provider_profiles;
create policy "provider_profiles_public_update"
on public.provider_profiles
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "provider_profiles_public_select" on public.provider_profiles;
create policy "provider_profiles_public_select"
on public.provider_profiles
for select
to anon, authenticated
using (true);
