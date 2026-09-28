begin;

-- SWP-005: `bookings` (and `payments`, same risk profile — company commission,
-- settlement, and payment-proof state live there) had no column-level
-- restriction on direct client writes via a customer's or provider's own
-- PostgREST session, independent of whatever the Next.js API layer enforces.
--
-- A full code audit (see SWIPER_CRITICAL_SECURITY_REMEDIATION.md, SWP-005
-- mapping) found zero legitimate direct-client writes to either table across
-- the Flutter customer app, the Flutter provider app, the Next.js web app,
-- and the admin dashboard -- every real insert/update on `bookings` or
-- `payments` goes through a Next.js API route using the service-role client.
-- Direct reads (select) by the owning customer/provider are still needed
-- (list views, realtime) and are untouched by this migration -- only the
-- write privileges for the anon/authenticated PostgREST roles are revoked.
-- service_role is unaffected: Supabase's service-role connection bypasses
-- RLS and is not subject to a table-level revoke against
-- authenticated/anon, so every existing Next.js API route continues to
-- work exactly as before.
--
-- This is a name-independent alternative to editing whatever RLS policies
-- currently exist on these tables (their exact current definitions were not
-- available to re-verify live from this environment) -- revoking the
-- table-level grant makes any existing insert/update policy on these tables
-- moot for anon/authenticated, without needing to know its name or
-- guess at replacing it incorrectly.
revoke insert, update, delete on public.bookings from authenticated;
revoke insert, update, delete on public.bookings from anon;

revoke insert, update, delete on public.payments from authenticated;
revoke insert, update, delete on public.payments from anon;

commit;
