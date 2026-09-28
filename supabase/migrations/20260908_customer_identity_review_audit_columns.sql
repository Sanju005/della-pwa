-- SWP-012 follow-up: adds audit timestamps for the new admin-only customer
-- identity/KYC review flow (app/api/admin/customer-status/[id]/route.ts,
-- POST action "verify"), mirroring provider_verifications.reviewed_at /
-- last_reviewed_at. reviewed_at/last_reviewed_at are both set together on
-- every admin approve/reject action -- there is no separate "delete"
-- action for customers (unlike providers), so reviewed_at is never nulled
-- back out here.
alter table public.customer_profiles
  add column if not exists reviewed_at timestamptz,
  add column if not exists last_reviewed_at timestamptz;
