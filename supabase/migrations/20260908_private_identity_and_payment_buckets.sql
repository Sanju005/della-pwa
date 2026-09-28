begin;

-- SWP-004: identity-documents and payment-proofs were PUBLIC storage
-- buckets, meaning government ID photos and payment receipts were fetchable
-- by anyone with the object path and zero authentication, forever.
--
-- Every consumer of these two buckets (Flutter customer/provider apps via
-- the backend JSON APIs, the admin dashboard, and the backend routes
-- themselves) has already been converted to store bare storage paths and
-- resolve them to short-lived (1 hour) signed URLs through service-role
-- clients — see lib/server-media-storage.ts (resolveStoredMediaUrl,
-- visibility: "private") and app/api/admin/media-sign/route.ts for the
-- admin-dashboard path. No code path depends on the public-URL form of
-- these two buckets any more, so flipping them private has no functional
-- impact on legitimate access, only on the anonymous public endpoint.
update storage.buckets
set public = false
where id in ('identity-documents', 'payment-proofs');

commit;
