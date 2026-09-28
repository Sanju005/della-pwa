-- Providers already type an "About the Service" description at registration
-- (and, after this change, when adding a service later), but it was never
-- persisted anywhere -- the customer-facing provider profile showed a
-- generic, category-wide canned description instead (see
-- providerDescriptions in lib/provider-detail.ts). This column lets the
-- provider's own real text be stored per service and shown to customers,
-- falling back to the generic description only when a provider hasn't
-- written one.
alter table public.provider_services
  add column if not exists about_service text;
