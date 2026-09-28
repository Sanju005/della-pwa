-- Provider "Support Documents" (driving license, other certificates) — a
-- provider self-service upload list shown on their own Profile screen.
-- Deliberately separate from public.provider_verifications: uploading here
-- must never affect identity_verified/kyc_verified or any Verified/Pending
-- badge. Only ever read/written by backend API routes via the service-role
-- client (same posture as public.otp_challenges) — RLS is enabled with zero
-- grantable policies, default-deny for anon/authenticated.
create table if not exists public.provider_support_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  file_name text not null,
  mime_type text not null,
  stored_path text not null,
  uploaded_at timestamptz not null default timezone('utc', now())
);

create index if not exists provider_support_documents_provider_id_idx
  on public.provider_support_documents (provider_id, uploaded_at desc);

alter table public.provider_support_documents enable row level security;
