create table if not exists public.provider_registration_submissions (
  id uuid primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  status text not null default 'pending_admin_approval',
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  identity_verified boolean not null default false,
  data jsonb not null default '{}'::jsonb
);

create index if not exists provider_registration_submissions_created_at_idx
  on public.provider_registration_submissions (created_at desc);

create or replace function public.set_provider_registration_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists provider_registration_submissions_set_updated_at
  on public.provider_registration_submissions;

create trigger provider_registration_submissions_set_updated_at
before update on public.provider_registration_submissions
for each row
execute function public.set_provider_registration_submissions_updated_at();
