begin;

alter table public.payments
  add column if not exists provider_company_payment_amount numeric(10,2) null,
  add column if not exists admin_company_received_amount numeric(10,2) null,
  add column if not exists company_payment_requested_at timestamptz null;

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'notification_type'
  ) then
    begin
      alter type public.notification_type add value if not exists 'company_payment_submitted';
    exception
      when duplicate_object then null;
    end;

    begin
      alter type public.notification_type add value if not exists 'company_payment_received';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

drop policy if exists "payments_select_admin_roles" on public.payments;
create policy "payments_select_admin_roles"
on public.payments
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

drop policy if exists "payments_update_admin_roles" on public.payments;
create policy "payments_update_admin_roles"
on public.payments
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

drop policy if exists "notifications_insert_admin_roles" on public.notifications;
create policy "notifications_insert_admin_roles"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin', 'manager', 'customer_care')
  )
);

commit;
