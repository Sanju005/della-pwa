-- The original otp_challenges table (20260828_create_otp_challenges.sql) only
-- allowed purpose in ('phone', 'email'). The Phase 1 gap-closure work
-- extended the application-level OtpPurpose type to also include
-- 'phone_change_current' / 'phone_change_new' (purpose-bound OTPs for the
-- secure phone-number-change flow) but never updated this database
-- constraint to match — so every phone-change OTP send has been rejected at
-- the database level ever since, for both customer and provider accounts.
-- Safe to widen: existing rows only ever used 'phone'/'email', so they all
-- already satisfy the new constraint.
alter table public.otp_challenges
  drop constraint if exists otp_challenges_purpose_check;

alter table public.otp_challenges
  add constraint otp_challenges_purpose_check
  check (purpose in ('phone', 'email', 'phone_change_current', 'phone_change_new'));
