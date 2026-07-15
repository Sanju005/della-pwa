create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  status text not null default 'new' check (status in ('new')),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  booking_title text not null default '',
  provider_name text not null default '',
  schedule text not null default '',
  location text not null default '',
  payment_amount numeric(10,2) not null default 0,
  payment_method text not null default '',
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text not null default '',
  reporter_name text not null default '',
  message text not null default ''
);

create index if not exists issue_reports_created_at_idx
  on public.issue_reports (created_at desc);

create index if not exists issue_reports_reporter_user_id_idx
  on public.issue_reports (reporter_user_id, created_at desc);

create index if not exists issue_reports_booking_id_idx
  on public.issue_reports (booking_id, created_at desc);
