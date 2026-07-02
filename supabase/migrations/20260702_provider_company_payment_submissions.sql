begin;

create table if not exists public.provider_company_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  payable_amount_snapshot numeric(10,2) not null default 0,
  submitted_amount numeric(10,2) not null default 0,
  admin_received_amount numeric(10,2) null,
  status text not null default 'processing' check (status in ('processing', 'paid')),
  proof_data_url text null,
  proof_file_name text null,
  proof_mime_type text null,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.payments
  add column if not exists company_payment_submission_id uuid null references public.provider_company_payment_submissions(id) on delete set null;

create index if not exists provider_company_payment_submissions_provider_idx
  on public.provider_company_payment_submissions (provider_id, submitted_at desc);

create index if not exists payments_company_payment_submission_idx
  on public.payments (company_payment_submission_id);

drop policy if exists "provider_company_payment_submissions_select_provider_self" on public.provider_company_payment_submissions;
create policy "provider_company_payment_submissions_select_provider_self"
on public.provider_company_payment_submissions
for select
to authenticated
using (provider_id = auth.uid());

drop policy if exists "provider_company_payment_submissions_select_admin_roles" on public.provider_company_payment_submissions;
create policy "provider_company_payment_submissions_select_admin_roles"
on public.provider_company_payment_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin', 'manager', 'customer_care')
  )
);

drop policy if exists "provider_company_payment_submissions_update_admin_roles" on public.provider_company_payment_submissions;
create policy "provider_company_payment_submissions_update_admin_roles"
on public.provider_company_payment_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin', 'manager', 'customer_care')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin', 'manager', 'customer_care')
  )
);

commit;
