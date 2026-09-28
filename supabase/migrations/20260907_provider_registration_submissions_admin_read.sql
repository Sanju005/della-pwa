begin;

-- provider_registration_submissions has row level security enabled but has
-- never had a single policy defined on it — with RLS on and zero policies,
-- Postgres denies every row to everyone (including admins) by default. The
-- admin dashboard reads this table as a fallback data source for a
-- provider's registration snapshot (address/work-image fallbacks), so it has
-- been silently returning nothing this whole time. This only adds the admin
-- read policy the dashboard actually needs — it does not touch write access
-- or add a policy for the submitting provider, since there's no evidence the
-- main app currently depends on reading this table for anyone else.
drop policy if exists "provider_registration_submissions_select_admin_roles" on public.provider_registration_submissions;
create policy "provider_registration_submissions_select_admin_roles"
on public.provider_registration_submissions
for select
to authenticated
using (is_admin_role());

commit;
