begin;

-- provider_customer_reviews only granted select to the two participants
-- (the provider and the customer being reviewed) — the admin dashboard reads
-- this table with the signed-in admin's own anon-key session, so with no
-- admin policy every admin query returned zero rows. Same bug class as the
-- reviews table fixed in 20260907_reviews_admin_read_access.sql.
drop policy if exists "provider_customer_reviews_select_admin_roles" on public.provider_customer_reviews;
create policy "provider_customer_reviews_select_admin_roles"
on public.provider_customer_reviews
for select
to authenticated
using (is_admin_role());

commit;
