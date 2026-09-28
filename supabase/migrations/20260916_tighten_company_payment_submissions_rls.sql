begin;

-- The 20260702 migration that creates provider_company_payment_submissions
-- was never actually applied to the live database until now (discovered
-- 2026-09-16 — the table simply didn't exist, so the entire "provider
-- submits company payment proof / admin reviews" feature had never worked
-- in production). It was applied by hand alongside this migration, with the
-- select-admin-roles policy narrowed to match what's below rather than the
-- original file's broader 'admin'/'manager'/'customer_care' list.
--
-- The September 2026 remediation tightened every application-layer admin
-- check to super_admin-only (see SWIPER_CRITICAL_SECURITY_REMEDIATION.md).
-- None of 'admin'/'manager'/'customer_care' are assigned to any live account
-- today; matching that here for both the read and write policies so no
-- direct-client bypass of the app-layer restriction exists.
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
      and p.role = 'super_admin'
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
      and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

commit;
