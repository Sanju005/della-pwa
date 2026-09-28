begin;

-- The reviews table only ever granted select access to the customer/provider
-- who are actually part of each review (see 20260626_create_reviews_table.sql).
-- The admin dashboard reads this table with the signed-in admin's own anon-key
-- session, so with no admin policy every admin query returned zero rows and
-- silently fell back to mock review data. This mirrors the existing
-- "<table>_select_admin_roles" pattern already used for
-- provider_company_payment_submissions.
drop policy if exists "reviews_select_admin_roles" on public.reviews;
create policy "reviews_select_admin_roles"
on public.reviews
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

commit;
