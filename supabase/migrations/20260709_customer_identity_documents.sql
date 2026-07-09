alter table public.customer_profiles
  add column if not exists identity_document_type text null,
  add column if not exists identity_front_image_url text null,
  add column if not exists identity_back_image_url text null;
