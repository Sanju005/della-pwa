# SWIPER CRITICAL SECURITY REMEDIATION

**Status: IN PROGRESS — Phases 0-9 complete and DEPLOYED to production as of 2026-09-08 08:50 UTC. All four pending migrations were applied by you before this deploy. A small set of automated post-deploy checks passed (see Phase 10). Every named CRITICAL finding except SWP-003 (blocked on Twilio) is FIXED or PARTIALLY FIXED at the code+deploy level; only the items explicitly marked LIVE VERIFIED below have been confirmed against production traffic. Everything else still needs your own device/browser testing before you rely on it.**
This document is updated as each subsequent phase completes, per the explicit "controlled phases, not one giant refactor" instruction. Do not treat anything as done until its own section says so. **"FIXED" means the code is correct and deployed. "LIVE VERIFIED" means it was additionally observed working against production — do not conflate the two.**

---

## Phase 0 — Verification of current state

### Confirmed facts (re-inspected against current code, not assumed from the original audit)

- **`profiles` self-update RLS** — per your own live check, the policy is `UPDATE ... USING (id = auth.uid()) WITH CHECK (id = auth.uid())`, with no column restriction, and the only UPDATE trigger (`trg_profiles_updated_at → set_updated_at()`) does not touch `role`. **SWP-007(a) is CONFIRMED, not yet fixed** — this is scoped into Phase 4, not fixed in this pass.
- **`app/api/provider/login/phone/route.ts` and `app/api/customer/login/phone/route.ts`** — confirmed, before this pass, both took only `{phoneCountryCode, phoneNumber}`, looked up the profile, generated a brand-new password via `auth.admin.updateUserById`, and returned that password in the JSON response — zero OTP check, not gated by `OTP_DEV_MODE` or anything else. Both files even had a code comment explicitly acknowledging this as a "known limitation."
- **`app/api/provider/register/route.ts:674`** — confirmed, before this pass, `phoneVerified` was computed as `payload.verification.phoneOtp.join("") === "123456"`, a literal string comparison with no server-side challenge redemption and no `OTP_DEV_MODE` gate at all.
- **`flutter_app/lib/features/auth/presentation/provider_register_screen.dart`, `login_screen.dart`** — confirmed, before this pass, both wired `const DevelopmentOtpService()` (local-only, `code == '123456'`, zero network call) unconditionally, with no debug/flavor guard.
- **`flutter_app/lib/features/provider_app/presentation/provider_more_screens.dart:1996`** (`ProviderEmailVerificationScreen`, post-registration email verification) — same mock service, newly confirmed during this pass, not explicitly named in the original audit's SWP-002 but the identical vulnerability class. Folded into Phase 2 below since it's the same one-line fix.
- **`lib/otp-verification.ts`** — confirmed to already be a real, well-built, hash-based, single-use, expiring (5 min), attempt-limited (5 attempts) OTP challenge system, with a genuine (if currently unconfigured) Twilio SMS send path. This module was **not rewritten** — Phases 1 and 2 below simply route the two broken flows through it instead of bypassing it.
- **`wrangler.jsonc:20`** — confirmed `"OTP_DEV_MODE": "true"` is still present for the production deploy. Not changed in this pass (that's Phase 3, which requires Twilio configuration first — see below).

### Role-cleanup audit (requested deliverable — no files changed yet)

Every reference to `admin`, `manager`, or `customer_care` as a role string, repo-wide:

| File | Old role(s) | How it is used | Safe to remove? | Required migration? |
|---|---|---|---|---|
| `admin-dashboard/src/auth/auth-provider.tsx` (`ALLOWED_ADMIN_ROLES`) | `admin`, `manager`, `customer_care` | Read-only allowlist check for admin-dashboard login access | Yes — no live user has these roles (per `SUPABASE_AUDIT.md`'s live reconciliation: only `customer`/`service_provider`/`super_admin` exist today) | No DB migration; just tighten the Set to `["super_admin"]` |
| `admin-dashboard/src/types.ts` | same | Type union for the role field | Yes, alongside the above | No |
| `app/api/admin/provider-identity-documents/[id]/route.ts` | same | `ALLOWED_ADMIN_ROLES` allowlist for this route's own auth check | Yes | No |
| `app/api/admin/provider-availability/[id]/route.ts` | same | same pattern | Yes | No |
| `app/api/admin/customer-status/[id]/route.ts` | same | same pattern | Yes | No |
| `app/api/admin/media-sign/route.ts` | same | same pattern | Yes | No |
| `app/api/admin/provider-media/[id]/route.ts` | same | same pattern | Yes | No |
| `app/api/admin/provider-registration-debug/[id]/route.ts` | same | same pattern | Yes | No |
| `app/api/profile/me/route.ts` | same | same pattern (used to decide whether a caller may view/edit another profile) | Yes | No |
| `app/api/provider/bookings/[id]/route.ts` | same | same pattern | Yes | No |
| `app/api/provider/me/route.ts` | same | same pattern | Yes | No |
| `app/api/provider/company-payments/route.ts` | same | same pattern | Yes | No |
| `app/api/provider/bookings/[id]/settle-commission/route.ts` | same | same pattern | Yes | No |
| `app/_components/booking-messages-panel.tsx` | `"admin"` | **Not a profile role at all** — this is the `sender_role` value on a chat message (matches the DB's separate `booking_actor_role` enum: `customer`/`provider`/`admin`/`system`, used to label who sent a message, e.g. a system/support message in a booking thread) | **Do not touch** — unrelated to the profile-role system this audit is about | No |

**Every one of these (except the last, which is a different concept entirely) is a pure read-only authorization allowlist — none of them assign, create, or grant these roles to anyone.**

**Update — this has now been done.** All 14 real allowlists above (13 backend files + `admin-dashboard/src/auth/auth-provider.tsx`) were simplified from `["super_admin", "admin", "manager", "customer_care"]` to `["super_admin"]` only, plus `admin-dashboard/src/types.ts`'s `AdminRole` type union trimmed to match (that one was a dead/unused type with no runtime effect — updated anyway for accuracy). `app/_components/booking-messages-panel.tsx` and `app/provider/_components/provider-app.tsx`'s `lastSenderRole`/`senderRole` were correctly left untouched — confirmed by a full repo re-grep after the edit that the only remaining `"admin"` string literals anywhere are those two unrelated chat-actor-label types. `tsc --noEmit` (root), `tsc -b` (admin-dashboard), both clean; both apps redeployed.

One correction during this pass: `app/api/provider/company-payments/route.ts` had **three** occurrences of the old allowlist, not two as first scanned (two shared identical 6-space indentation and were caught by one `replace_all`, a third had 4-space indentation and was missed on the first pass — caught by a follow-up full-repo re-grep before declaring this done, which is why that verification step matters).

---

## Phase 1 — SWP-001, phone-login takeover: **FIXED**

### What changed

**Backend** — both `app/api/provider/login/phone/route.ts` and `app/api/customer/login/phone/route.ts`:
- Added a required `challengeId` field to the request body.
- Before doing anything else, the route now calls `isChallengeRecentlyVerified(adminClient, { challengeId, purpose: "phone", target: normalizedPhone })` (the same hardened function `lib/otp-verification.ts` already exposed and customer registration already used). If it doesn't return true, the route returns `401` and never touches the profile or password.
- Only after that succeeds does the route look up the profile and reset/return a fresh password, exactly as before.
- No new database table or column was needed — `otp_challenges` and its expiry/single-use/attempt-limit logic already existed and already does everything Phase 1 needed.

**Flutter**:
- `login_screen.dart`: swapped `const DevelopmentOtpService()` for `RealOtpService(purpose: 'phone')`. `_handleOtpVerified` now reads `_otpService.lastChallengeId` and passes it through to both `signInProviderWithVerifiedPhone`/`signInCustomerWithVerifiedPhone`; if the challenge ID is somehow missing, it bounces the user back to the phone step with an error instead of proceeding.
- `auth_service.dart`: both methods now take a required `challengeId` parameter and send it in the request body. Also removed `signInWithDemoPhone` — a second, entirely separate hardcoded-`123456` login path that was already dead code (zero callers found anywhere in the app) but sat in the same file as an obvious future landmine.
- The shared `OtpStepView` widget (used by both the login screen and provider registration) needed **zero changes** — it was already a clean abstraction over whichever `OtpService` implementation is injected.

### Proof that a phone number alone is now insufficient

Before this fix, `POST /api/customer/login/phone` (or the provider equivalent) with just `{phoneCountryCode, phoneNumber}` for any registered phone would return `{success: true, phone, password}` — a working password, unconditionally. After this fix, the same request (with no `challengeId`, or an invalid/expired/already-used one) returns:

```json
{ "error": "Phone verification is required or has expired. Please request a new code." }
```
with HTTP 401 — confirmed by code inspection of the new guard clause, which runs before any profile lookup or password generation. **[CODE — the exact behavior change was verified by reading the modified route; a live curl-based confirmation against the deployed production endpoint was not performed as part of this pass, since it would require sending a real request to production — recommended as a manual post-deploy smoke test, see Testing section below.]**

### Tests run
- `npx tsc --noEmit -p .` (Next.js root) — **PASS**, exit code 0.
- `flutter analyze` on all 4 touched files — **PASS**, "No issues found!", exit code 0.
- Deployed to production (`app.myswiper.my`) — see deploy log.

---

## Phase 2 — SWP-002, provider registration mock OTP: **FIXED**

### What changed

**Backend** — `app/api/provider/register/route.ts`:
- Replaced `const phoneVerified = payload.verification.phoneOtp.join("") === "123456";` with a call to `isChallengeRecentlyVerified`, redeeming a real `phoneVerificationChallengeId` against the normalized phone — the exact same pattern `app/api/auth/register/customer/route.ts` already used for customer registration (confirmed by direct comparison, not assumed).
- Added `phoneVerificationChallengeId?: string` to the shared `ProviderRegistrationData['verification']` type in `lib/provider-registration-types.ts`. The old `phoneOtp: string[]` field is left in place (still sent by the client, no longer checked by the server) rather than removed, to keep this diff minimal and avoid touching the Review step's display logic, which was confirmed to only use it for the outgoing payload, never for on-screen display.
- **Behavior parity confirmed**: like the customer registration route, this does not hard-block account creation on an unverified phone — it records whatever `phoneVerified` value it computed (true/false) into the account's metadata and proceeds either way. This matches the existing, already-shipped customer registration behavior exactly; it does not introduce a new stricter rule beyond what customers already experience.

**Flutter** — `provider_register_screen.dart`:
- Swapped `const DevelopmentOtpService()` for `RealOtpService(purpose: 'phone')`.
- Added a `_phoneVerificationChallengeId` field, captured in `_onPhoneVerified` from `_otpService.lastChallengeId`.
- The submit payload now includes `'phoneVerificationChallengeId': _phoneVerificationChallengeId ?? ''` alongside the existing (now-ignored-by-the-server) `phoneOtp` array.

**Bonus fix, same vulnerability class, discovered during this pass** — `flutter_app/lib/features/provider_app/presentation/provider_more_screens.dart`'s `ProviderEmailVerificationScreen` (post-registration email verification, not the registration wizard itself) also unconditionally used `DevelopmentOtpService`. Swapped to `RealOtpService(purpose: 'email')`. Because `/api/auth/otp/verify` already flips `email_verified`/`phone_verified` in the caller's own auth metadata server-side as a trusted side effect whenever a Bearer token is present (see `markOwnProfileVerified` in that route — this was already correct, pre-existing code), this screen is now genuinely OTP-verified end to end, not just a cosmetic swap.

**A related, NOT-yet-fixed finding surfaced by this same investigation**: this same screen, after a successful verify, also calls `_service.updateProfile(email: email, emailVerified: true)` — and `app/api/provider/me/route.ts:782` (`email_confirm: payload.emailVerified === true`) **independently trusts that client-sent boolean on its own**, separately from the real OTP side-effect above. This means the provider-profile PATCH endpoint itself still has a client-asserted-verification gap, structurally identical to SWP-012 but on the provider side rather than the customer side, and not the exact file SWP-012 originally named. **This is explicitly NOT fixed in this pass** — it needs the same careful treatment `/api/profile/me` already received for customers (audit every other legitimate caller of that field before changing what the route trusts), which belongs in Phase 10, not bundled into this OTP-focused phase. Flagging it now so it isn't lost.

### Tests run
Same batch as Phase 1 (`tsc --noEmit`, `flutter analyze` including `provider_more_screens.dart`) — both clean, see above.

---

## Role-authorization cleanup ("Next Task 3"): **DONE**

See the updated Phase 0 role-cleanup table above. `admin`, `manager`, `customer_care` no longer grant admin-panel or admin-notification access anywhere in the codebase — only `role === 'super_admin'` does. `service_provider`/`provider` compatibility was **not** touched, per your explicit instruction not to rename that yet — both strings are still checked wherever they already were (`isProviderRole()`-style helpers throughout the backend already check both `"provider"` and `"service_provider"`, confirmed untouched by this pass). A future normalization migration (picking one canonical string and updating both the enum and every call site) is possible later but not recommended as part of this security pass — it's a naming cleanup, not a vulnerability.

## Twilio configuration check ("Task 4", partial): confirmed NOT configured

Checked two places, no values printed:
- `.env.local` — no `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_MESSAGING_SERVICE_SID` keys present at all.
- `npx wrangler secret list` (lists secret **names** only, never values) against the live `della-pwa` Worker — confirmed only `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`, `RESEND_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` exist as secrets. **No Twilio secret exists in production either.**

**Conclusion: Phase 3 (disabling `OTP_DEV_MODE` in production) cannot proceed yet** — doing so today would lock every real user out of login, registration, and verification, since there is no working SMS delivery path at all. This is now confirmed by direct inspection, not inferred. **MANUAL ACTION REQUIRED**: provision a Twilio account (or another SMS provider) and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` as Worker secrets (`wrangler secret put <NAME>`) before Phase 3 can run.

**Unrelated discovery, worth knowing about**: a `RESEND_API_KEY` secret exists in production, but zero lines of code anywhere in `app/`, `lib/`, or `flutter_app/` reference `RESEND_API_KEY` or a Resend SDK — confirmed by a full-repo grep. This is a configured-but-entirely-unused secret. It doesn't change anything in this remediation (the Email Audit in the original report already correctly found no real email sending exists), but it suggests either an abandoned integration attempt or a resource you already have available if/when real transactional email becomes a priority. Not touched, not acted on — flagging only.

## Phase 4 — Tasks 1-2, finishing SWP-007: **DONE**

You retrieved the live `pg_get_functiondef()` output for all three functions. Using that as authoritative evidence:

### 1. Trigger logic, verified against the codebase

- **`prevent_profile_role_escalation()`** (`BEFORE UPDATE ON public.profiles`) — raises `42501` whenever `new.role is distinct from old.role` **and** `auth.role() in ('anon', 'authenticated')`. `auth.role()` reads the calling session's JWT role claim; it is `'service_role'` for any request made with the Supabase service-role key, and is not affected by a function's own `SECURITY DEFINER`/execution-context. So this trigger only ever fires for a normal user's own session (PostgREST/RLS-authenticated), never for backend service-role writes.
- **`prevent_public_super_admin_profile()`** (`BEFORE INSERT ON public.profiles`) — raises `42501` whenever `new.role::text = 'super_admin'` **and** `auth.role() in ('anon', 'authenticated')`. Same scoping as above.
- **`handle_new_user()`** — hardcodes `role = 'customer'` on every insert and does not read `raw_user_meta_data ->> 'role'` at all. The originally-suspected SWP-007(b) path (public signup → client-supplied role → `super_admin`) does not exist in the live function. Confirmed by direct inspection of the function body, not inferred. **Not rewritten**, per your instruction — its current behavior (including `status = 'pending'`) is unchanged.

### 2. Normal profile updates never need to change `role`

Grepped every `.from("profiles")` / `.from('profiles')` call site across `app/`, `admin-dashboard/src/`, and `flutter_app/lib/`. Every direct `.update(...)` on `profiles` writes a fixed, non-`role` field set:
- `app/api/profile/me/route.ts:738-741` — `profilePayload` is built from a hardcoded whitelist (`full_name`, `email`, `phone`, `avatar_url` only, via `Object.fromEntries(...).filter(...)`); `role` is not and cannot be one of its keys.
- `app/api/admin/provider-media/[id]/route.ts:176-178, 203-205` — `{ avatar_url: ... }` only.
- `app/api/admin/provider-identity-documents/[id]/route.ts:267-269` — `{ status: "active" }` only.
- `flutter_app/lib/services/auth_service.dart`, `customer_address_service.dart` — direct Supabase-SDK `.update()` calls target `provider_profiles` and `addresses`, never `profiles`.

No code path anywhere in the repo issues a client-session `UPDATE` on `profiles.role`. The trigger has nothing legitimate to block.

### 3. Provider registration assigns the role through a trusted, service-role path

`app/api/provider/register/route.ts` sets `role` in two places, both through `adminClient` (the service-role Supabase client, `getAdminSupabaseClient()` / `getSupabaseServiceKey()`, never the user's own session):
- Line 591 — `role: PROVIDER_ROLE` inside `auth.admin.createUser({ user_metadata: {...} })`. This metadata is never consumed by `handle_new_user()` (see point 1), so it has no effect on the inserted row's role either way.
- Line 713-714 — the `profiles` upsert (`profileWithEmergencyPayload`, `{ onConflict: "id" }`) that actually sets `role: PROVIDER_ROLE` on the row, overwriting the `'customer'` default `handle_new_user()` created. This call runs on `adminClient`, so `auth.role()` evaluates to `'service_role'` for it — the trigger's `in ('anon', 'authenticated')` guard does not match, and the write proceeds normally. `app/api/auth/register/customer/route.ts:288-294` follows the identical pattern for `role: "customer"`.

### 4. Manual/service-role promotion to `super_admin` remains possible

Neither the Supabase Dashboard SQL editor (runs as the `postgres` superuser role) nor any service-role API call (`auth.role() = 'service_role'`) matches either trigger's `in ('anon', 'authenticated')` condition. The documented Super Admin creation procedure below is unaffected by either trigger.

### 5-8. Migration, no `handle_new_user()` rewrite, comments, old migrations untouched

Added `supabase/migrations/20260908_prevent_profile_role_escalation.sql` — a new forward migration reproducing both live trigger functions and their `BEFORE UPDATE`/`BEFORE INSERT` triggers verbatim, with explanatory comments on why each exists. `handle_new_user()` was **not** touched. No existing migration file was modified.

### 9. Tests run

`npx tsc --noEmit -p .` — clean. No Flutter files were touched (this was a pure DB/migration task); `flutter analyze` was not needed and nothing was changed on the Flutter side.

### 10. SWP-007 status — updated per your required wording

**SWP-007(a): FIXED** — The former self-update policy allowed authenticated users to change their own `role`; the new BEFORE UPDATE database trigger prevents `anon` and `authenticated` sessions from changing `profiles.role`.

**SWP-007(b): NOT VULNERABLE / CLOSED** — The live `handle_new_user()` hardcodes the initial role to `customer` and does not consume a client-supplied role from `raw_user_meta_data`.

The BEFORE INSERT super-admin protection (`prevent_public_super_admin_profile`) is retained as defense-in-depth, now tracked in the new migration alongside the UPDATE trigger.

Booking/payment flows (Tasks 6-7) were not touched in this pass, per your explicit instruction.

## Phase 5 — Task 5, SWP-004 (public identity/payment-proof storage buckets): **FIXED**

### Audit of every read/write consumer

Grepped every reference to the `identity-documents` and `payment-proofs` buckets across the Flutter customer app, Flutter provider app, the Next.js backend, the web provider-registration wizard, and the admin dashboard. Findings:

**Flutter (both customer and provider apps): zero direct consumers.** A full-repo grep of `flutter_app/lib` for these bucket names, and for `identity`/`kyc`/`ic_front`/`ic_back`/`passport`/`payment_proof`, returned no matches. Neither Flutter app ever talks to Supabase Storage directly for these two buckets — every upload and every read goes through backend JSON APIs (`/api/provider/register`, `/api/provider/me`, `/api/profile/me`, `/api/bookings`, `/api/provider/bookings`, `/api/bookings/[id]/cash-pay`, `/api/provider/company-payments`, `/api/provider/bookings/[id]/settle-commission`).

**Backend (Next.js API routes): already using signed private access, ahead of the bucket-level flag.** Every one of those routes already calls `lib/server-media-storage.ts`'s `uploadStoredMedia`/`resolveStoredMediaUrl` with `visibility: "private"` for both buckets — uploads store a bare storage path (not a public URL), and reads generate a fresh 1-hour signed URL via the service-role client. This was true before this pass (an earlier phase of this same remediation already set `visibility: "private"` on every one of these call sites) — the only thing not yet private was the **bucket itself**, at the Supabase Storage config level, which still had `public = true`.

**Web provider-registration wizard** (`app/provider/register/wizard.tsx`) — uploads identity documents via `POST /api/provider/register/upload`, a backend route using the service-role client with `visibility: "private"`. No direct browser-to-storage calls. Already safe.

**Admin dashboard — the one real gap.** Two of three payment-proof consumers, and all identity-document consumers, were already correctly routed through the backend's service-role `/api/admin/media-sign` endpoint (`admin-dashboard/src/lib/admin-providers.ts`, via `resolveAdminMediaUrl`). But **three separate, duplicated `payment-proofs` signing functions** — `admin-payments.ts`'s `resolvePaymentProofUrl`, `admin-bookings.ts`'s `resolvePaymentProofUrl`, and `admin-providers.ts`'s now-removed `resolveAdminPaymentProofUrl` — called `supabase.storage.from("payment-proofs").createSignedUrl(...)` **directly, using the admin's own anon-key browser session**, not the service-role backend. This only ever worked reliably because the bucket was public; it had no guaranteed path to keep working once flipped private, since it depends on undocumented/unverified `storage.objects` RLS state rather than the deliberate service-role trust boundary the rest of the app already uses for these buckets.

### Code changes made

- `app/api/admin/media-sign/route.ts` — added `"payment-proofs"` to `ALLOWED_BUCKETS`/`AdminMediaBucket`, so the existing super_admin-gated, service-role signing endpoint now also covers payment proofs (it already covered `identity-documents`/`certificates`).
- `admin-dashboard/src/lib/admin-providers.ts` — removed the duplicate `resolveAdminPaymentProofUrl` (direct anon-key signing); its two call sites (`buildCommissionRows`, the settle-commission proof row) now call the existing, already-correct `resolveAdminMediaUrl("payment-proofs", value, "private")`, which goes through `/api/admin/media-sign`.
- `admin-dashboard/src/lib/admin-payments.ts` — rewrote `resolvePaymentProofUrl` to call `/api/admin/media-sign` with the admin's session bearer token, instead of signing directly against Supabase Storage.
- `admin-dashboard/src/lib/admin-bookings.ts` — same rewrite, scoped to only the `payment-proofs` case. `job-completion-images` and `review-images` (same file's `resolveStorageUrl` helper) were **not touched** — those buckets aren't part of SWP-004 and weren't flagged critical; changing their access pattern was out of scope for this task.

No changes were made to `identity-documents` consumers — every one of them (Flutter, web wizard, backend routes, admin dashboard) was already correctly wired to service-role signed access before this pass.

### Bucket-privacy migration

Added `supabase/migrations/20260908_private_identity_and_payment_buckets.sql`:

```sql
update storage.buckets
set public = false
where id in ('identity-documents', 'payment-proofs');
```

`storage.buckets.public` is a plain table column, so this is safe to track as a forward migration like any other DDL/DML in this repo. **This has NOT been applied yet** — same as every other Supabase-side change in this remediation, I have no live SQL execution path from this environment. Run this migration (via the Supabase SQL editor, or your usual migration flow) to actually flip the buckets. No existing migration file was touched.

No new storage RLS policy was added or is needed: after this pass, every legitimate consumer of both buckets goes through a service-role client (either a backend API route directly, or the `/api/admin/media-sign` endpoint), and service-role unconditionally bypasses `storage.objects` RLS regardless of what policies do or don't exist. Making the buckets private only removes the anonymous, zero-auth `/object/public/<bucket>/<path>` endpoint — it does not change behavior for any signed or service-role access path.

### Preserving admin KYC/payment-proof viewing

Confirmed via the code changes above: admin viewing of identity documents (`admin-providers.ts`, provider profile page) and payment proofs (`admin-payments.ts`, `admin-bookings.ts`, `admin-providers.ts` commission rows) all now resolve through the same `super_admin`-gated `/api/admin/media-sign` endpoint used successfully today for `identity-documents`/`certificates`. This is **[CODE]**-verified (the request path is unchanged in kind, just extended to cover the third bucket) but not **[EXEC]**-verified — I cannot log into the admin dashboard myself. Please spot-check after deploying: open a provider's identity documents and a payment's proof-of-payment image in the admin dashboard and confirm both still render.

### Confirming anonymous direct access fails — action needed from you

I cannot flip the bucket or make live HTTP requests to your Supabase project from this environment. After you apply the migration above, please verify directly:

1. Pick any existing object path in either bucket (e.g. from a `identity_front_image_url` or `provider_company_payment_proof_data_url` column value — these are now bare storage paths, not URLs).
2. Request `https://<your-project-ref>.supabase.co/storage/v1/object/public/identity-documents/<that-path>` (and the same for `payment-proofs`) with no auth header — e.g. `curl -I "<url>"`.
3. **Before the migration**: this returns `200` with the file. **After**: it should return a `400`/`404`-class error (Supabase returns something like `{"statusCode":"404","error":"Bucket not found"}` or `403` for a private bucket's public-object path) — confirming anonymous direct access is closed.
4. Separately, confirm the admin dashboard's identity-document and payment-proof previews still load (they go through `/api/admin/media-sign`, unaffected by the bucket flip).

I'll mark this **[EXEC]**-verified in this document once you confirm the result; until then it's **[CODE]**-verified only (I've verified no code path can reach the public endpoint's success case any more, but haven't observed the live HTTP response myself).

### Tests run

`npx tsc --noEmit -p .` (Next.js root) — clean. `npx tsc -b` (admin-dashboard, the real check for that project — `tsc --noEmit -p .` is a no-op there, see earlier note in this document) — clean. No Flutter files were touched (confirmed zero Flutter consumers of either bucket); `flutter analyze` was not needed.

Booking RLS, pricing, and verification flags (Tasks 6, 7, 8) were not touched, per your explicit instruction. *(Superseded — all three are now addressed below.)*

## Phase 6 — SWP-012, client-asserted verification flags: **FIXED**

### Audit: `/api/profile/me` and `/api/provider/me`

**Customer (`/api/profile/me`)** — mostly already correct from an earlier phase (`emailVerified`/`phoneVerified` were already hardcoded from stored metadata, never from the client), but two client-trusted fields remained:
- `payload.verified` (boolean) was written directly to `customer_profiles.verified` with no server check at all.
- `payload.identityVerificationStatus` (string) was written directly to Auth `user_metadata.identity_verification_status`, including `"verified"`/`"rejected"` — a client could self-report `"verified"` and it would be trusted verbatim.

**Provider (`/api/provider/me`) — the more serious gap**, not touched by earlier phases:
- `email_confirm: payload.emailVerified === true` — a client could PATCH `{ email: "x@y.com", emailVerified: true }` and instantly get a **real, Supabase Auth-native confirmed email**, with no OTP ever redeemed. This is the same vulnerability class as SWP-001/SWP-002 (phone), just on the email/provider side, and was explicitly flagged as an unfixed gap in Phase 2 of this document.
- `provider_verifications.phone_verified: payload.phoneVerified`, `identity_verified: payload.identityVerified`, `kyc_verified: payload.identityVerified` — all three written directly from client-sent booleans, with no gating at all.
- Auth `user_metadata.identity_verification_status` — same direct-trust bug as the customer route, plus a second branch that additionally derived `"verified"` from `payload.identityVerified === true`.

A provider could PATCH `{ phoneVerified: true, identityVerified: true, emailVerified: true }` in one request and become fully "verified" across every flag the app tracks, with zero real OTP redemption and zero admin review — confirmed via direct code read, not inferred.

### What's actually trusted now

- **Email**: added `emailVerificationChallengeId` to the PATCH payload. The route now calls `isChallengeRecentlyVerified(adminClient, { challengeId, purpose: "email", target: payload.email })` — the exact same real-OTP-redemption pattern already used for SWP-001 (phone login) and SWP-002 (provider registration). `email_confirm` and `provider_verifications.email_verified` are now driven by that check's result, never by `payload.emailVerified`.
- **Phone** (`provider_verifications.phone_verified`): no current screen ever legitimately sets this true (confirmed via a full grep of every `.updateProfile(` call site in Flutter), so it's simply no longer accepted from the client at all — the column is left untouched by this route, preserving whatever is already stored.
- **Identity/KYC** (`provider_verifications.identity_verified`/`kyc_verified`, and Auth `identity_verification_status` for both customer and provider): these can now only ever move to `"verified"`/`true` through the existing, already-admin-gated `/api/admin/provider-identity-documents/[id]` route (`action: "verify"`, `super_admin`-only, service-role) — this route was not touched, it was already correct. The client-facing routes now accept only `identityVerificationStatus: "processing"` (self-report: "I submitted documents, please review") and otherwise always preserve the current stored value; `identityVerified`/`kyc_verified` booleans are no longer written by these routes at all.
- **`customer_profiles.verified`**: never accepted from the client; always preserved from the current stored value.

### A genuine pre-existing gap this surfaced (not fixed, out of scope for this pass)

There is currently **no admin-side approval flow for customer identity verification at all** — `/api/admin/customer-status/[id]` is read-only, and no RPC or route anywhere sets a customer's `identity_verification_status` to `"verified"`. Before this fix, that gap was invisible because customers could just self-report "verified." After this fix, that self-report path is closed (correctly), which means **no customer can currently become identity-verified through any flow** — submission ("processing") works, approval doesn't exist yet. This is a real product gap, not a security hole, and needs a dedicated follow-up (an admin customer-KYC review screen, mirroring the existing provider one) before customer identity verification is usable end-to-end. Flagging this explicitly rather than silently building a new admin feature as a side effect of a security fix.

### Files changed

- `app/api/provider/me/route.ts` — added `isChallengeRecentlyVerified` import and `emailVerificationChallengeId` field; replaced every `payload.emailVerified`/`payload.identityVerified`/`payload.phoneVerified` trust point (5 locations) as described above.
- `app/api/profile/me/route.ts` — `verifiedFlag` no longer reads `payload.verified`; `identity_verification_status` (both the write and the response-building echo) now only honors `"processing"` from the client.
- `flutter_app/lib/services/provider_workspace_service.dart` — `updateProfile()` gained an `emailVerificationChallengeId` parameter, forwarded into the request body when present.
- `flutter_app/lib/features/provider_app/presentation/provider_more_screens.dart` — `ProviderEmailVerificationScreen`'s post-OTP-verify call now passes `emailVerificationChallengeId: _otpService.lastChallengeId`.

No migration needed — this phase is pure application code.

### Tests run

`npx tsc --noEmit -p .` — clean. `flutter analyze` on both changed Dart files — clean (one pre-existing, unrelated `info`-level style lint on a line this pass didn't touch).

**Manual verification recommended** (I cannot exercise Flutter/live OTP from this environment): send a real email OTP as a provider and confirm the email still shows verified afterward (the legitimate path); then, separately, send `PATCH /api/provider/me` with `{ "identityVerified": true }` or `{ "phoneVerified": true }` and no valid challenge, and confirm the provider's verification status does **not** change.

## Phase 7 — SWP-006, server-side booking price: **FIXED (already implemented — verified, not newly written)**

### Finding

The original audit's SWP-006 entry was explicitly marked `[CODE — per customer-app-audit.txt §8/§11]`, i.e. based on an older sub-document, not a fresh read of the live route. A direct read of `app/api/bookings/route.ts`'s `POST` handler (the **only** booking-creation code path in the entire repo — confirmed by grepping every `.insert()` into `bookings`) shows the server-side fix already exists:

- The provider's actual `provider_services.hourly_rate`/`daily_rate` is looked up fresh for the exact `(providerId, serviceKey)` pair.
- A service not offered by that provider is rejected outright.
- Duration is bounds-checked (1–24 hours).
- `authoritativeAmount` is computed server-side (`hourlyRate × durationHours`, or the flat `dailyRate`) — this, and only this, is what gets written to `quoted_amount`/`booking_price`/`final_amount` at creation.
- `payload.totalAmount`/`hourlyRate`/`dailyRate` (the client-computed values) are read from the request but **never** persisted — an explicit code comment confirms this is intentional: *"The client-computed hourlyRate/dailyRate/totalAmount in payload are display-only from here on — they are NEVER written to the booking."*

Commission (`COMPANY_COMMISSION_RATE = 0.05` in `lib/payments.ts`) is a hardcoded server constant, not client-influenced at all.

### One related item inspected, found to be intentional (not a bug)

After a job is done, the **provider** (not the customer) can adjust the final amount via `PATCH /api/provider/bookings/[id]` (`finalAmount`/`paymentBreakdown` in the payload, on the transition to `final_payment_sent`) — this becomes the new `booking_price`/`final_amount`/`quoted_amount`, and commission is recalculated from it. This is real, working business logic (providers legitimately quote a final price reflecting actual work/materials, which can differ from the initial estimate) — it is **not** the customer-side price-manipulation vulnerability SWP-006 describes, and changing it would alter live commission/payment behavior, which you explicitly said not to do without a required reason. No upper-bound sanity check exists on this provider-supplied final amount today; noted as a possible future fraud-prevention item, not touched this pass.

### Files changed

None — this phase was verification only. No code, no migration.

### Tests run

N/A (no changes). Confirmed via direct code read + a full-repo grep of every `.insert()` into `bookings`.

## Phase 8 — SWP-005, booking RLS / state security: **PARTIALLY FIXED**

This is the highest-regression-risk item, so per your explicit instruction I mapped every real mutation before touching any SQL, and only applied the part of the fix I have high confidence in.

### Mutation map (route/function → caller → status change → columns changed)

| Route | Caller | Old status | New status | Columns touched |
|---|---|---|---|---|
| `POST /api/bookings` | customer | (none) | `pending_provider_response` (or `pending`, schema-fallback) | Insert only — `quoted_amount`/`booking_price`/`final_amount`/`hourly_rate`/`daily_rate` all server-computed (Phase 7) |
| `PATCH /api/provider/bookings/[id]` | provider | per `allowedTransitions` map in that file (pending→accepted/declined/cancelled; accepted→on_the_way/cancelled; on_the_way→arrived/cancelled; arrived→work_finished_by_provider/final_payment_sent/cancelled; work_finished_by_provider→final_payment_sent; work_confirmed_by_user→final_payment_sent; cash_paid_by_user→payment_received_by_provider/completed; payment_received_by_provider→completed) | as above, enforced in application code | `booking_status`, plus (on `final_payment_sent`) `booking_price`/`final_amount`/`quoted_amount`/`additional_charges`/`discount_amount` from provider-supplied `finalAmount` (see Phase 7) |
| `POST /api/bookings/[id]/complete` | customer | `work_finished_by_provider` (exact match required) | `work_confirmed_by_user` | `booking_status`, `work_confirmed_by_user_at` |
| `POST /api/bookings/[id]/cash-pay` | customer | `final_payment_sent` (exact match required) | `cash_paid_by_user` | `booking_status`, `cash_paid_by_user_at`, `cash_payment_proof_images`, creates/updates a `payments` row |
| `POST /api/provider/bookings/[id]/settle-commission` | provider | (booking status untouched) | — | `payments` columns only: `provider_company_payment_amount`, `provider_company_payment_proof_*`, `company_payment_status` |
| `POST /api/bookings/[id]/review`, `POST /api/provider/bookings/[id]/review` | customer / provider | `completed`/`review_requested`/`reviewed` (precondition) | `reviewed` | `booking_status`, `user_review_status`/`provider_review_status`, `reviewed_at` |
| `POST /api/bookings/[id]/checkout`, `POST /api/payments/verify` | customer | pre-`paid` states | `paid` | `booking_status`, `paid_at` — **confirmed dead code**: zero UI callers anywhere in Flutter or the web app (consistent with the original audit's SWP-017 finding); a real, live route, but unreachable from any current screen |
| Admin dashboard | super_admin | — | — | Zero direct `bookings`/`payments` writes found anywhere — all admin actions are read-only queries or named RPCs (`admin_suspend_customer`, `admin_reactivate_customer`, `admin_reject_company_payment`, etc.) |
| Flutter (customer + provider), web app | any authenticated user | — | — | Zero direct `.insert()`/`.update()` calls on `bookings` or `payments` anywhere — confirmed by grepping every `.from("bookings")`/`.from("payments")` call site in both Flutter apps and the Next.js web app. Every mutation goes through the routes above. |

Real status vocabulary confirmed in use (some only defensively, per the dead-code note above): `pending`, `pending_provider_response`, `accepted`, `on_the_way`, `arrived`, `work_finished_by_provider`, `work_confirmed_by_user`, `final_payment_sent`, `cash_paid_by_user`, `payment_received_by_provider`, `completed`, `declined_by_provider`, `cancelled`, `paid`, `review_requested`, `reviewed`.

### What this confirms

Since **zero legitimate direct-client writes exist anywhere** in the current codebase — every real mutation on `bookings`/`payments` goes through a Next.js API route using the service-role client — the actual exposure is narrower than the original audit framed it: it's not that a real feature depends on broad client RLS access, it's that nothing currently *prevents* a modified client from bypassing the Next.js app entirely and writing directly to these tables via its own Supabase session, since the live RLS policy text was reported (by the original `SUPABASE_AUDIT.md`) as column-unrestricted.

### Fix applied: access lockdown (high confidence, zero identified regression risk)

Added `supabase/migrations/20260908_lock_down_bookings_payments_direct_writes.sql`:

```sql
revoke insert, update, delete on public.bookings from authenticated;
revoke insert, update, delete on public.bookings from anon;
revoke insert, update, delete on public.payments from authenticated;
revoke insert, update, delete on public.payments from anon;
```

This is deliberately **not** a `DROP POLICY`/`CREATE POLICY` change — I don't have live confirmation of the current policies' exact names, and guessing wrong on a `DROP POLICY IF EXISTS <wrong-name>` would silently leave the dangerous policy in place. A table-level `REVOKE` from the `anon`/`authenticated` PostgREST roles is name-independent: it makes any existing INSERT/UPDATE/DELETE policy on these tables moot for those roles, regardless of what it's called or exactly how it's written. `service_role` (used by every Next.js API route) is a separate role that bypasses RLS entirely and is unaffected by this `REVOKE` — nothing in the mutation map above changes behavior. `SELECT` is untouched, so list views and any realtime subscription keep working.

**This has NOT been applied yet** — same as the other pending migrations, run it via the Supabase SQL editor.

### Not applied this pass: database-level status-transition trigger

You asked for one "if practical." While mapping, I found the real status vocabulary is larger than the primary `allowedTransitions` table (which only lives in `app/api/provider/bookings/[id]/route.ts`) — `review_requested` and `paid` are checked defensively in over a dozen places but I could not find where `review_requested` is ever actually written, and `paid` is only written by the confirmed-dead checkout/Stripe-verify routes. Writing a trigger now would mean either guessing at those gaps (risking a false rejection that breaks the live review or payment-history screens — exactly the regression you told me to avoid) or omitting them (leaving the trigger provably incomplete). Given the `REVOKE` above already closes the actual exploit path (direct client bypass), I'm treating the transition-guard trigger as a separate, lower-urgency defense-in-depth item for a dedicated follow-up once `review_requested`'s origin is traced (it may simply be dead code too, in which case the trigger becomes straightforward).

### Tests run

No application code changed in this phase — migration only, not yet applied. `tsc`/`flutter analyze` not applicable.

### Manual Supabase action required

Run `supabase/migrations/20260908_lock_down_bookings_payments_direct_writes.sql`, then verify: a direct PostgREST call to `PATCH https://<project>.supabase.co/rest/v1/bookings?id=eq.<some-id>` using a real customer's own access token (not service-role) should now fail with a permission error, while every normal in-app booking action (create, accept, on-the-way, arrived, work finished, cash pay, settle commission, review) continues to work exactly as before, since none of them use that direct path.

## Phase 9 — HIGH priority: customer identity-verification admin-approval flow: **FIXED (new feature)**

Phase 6 (SWP-012) closed the self-verification bug but surfaced a real gap: nothing could ever legitimately move a customer's identity status to `"verified"`. This phase builds that missing admin review flow.

### Audit of the existing pieces before building anything

- **Customer upload flow**: `/api/profile/me` PATCH already stores `identity_front_image_url`/`identity_back_image_url`/`identity_document_type` on `customer_profiles` (private `identity-documents` bucket, signed URLs — see SWP-004), and only ever accepts `identityVerificationStatus: "processing"` from the client (Phase 6). Not touched further, except the one line described below.
- **Tables**: customers do **not** have a dedicated `*_verifications` table the way providers do (`provider_verifications`) — the equivalent state lives split across `customer_profiles` (`verified` boolean, `identity_front_image_url`, `identity_back_image_url`, `identity_document_type`) and Auth `user_metadata.identity_verification_status` (the display string). Both were already read by `/api/profile/me`; neither had a trusted write path.
- **Existing admin screens**: `admin-dashboard`'s customer detail page (`user-profile-page.tsx`) already fetched and displayed `identityVerificationStatus`/`kycVerifiedAt` in its "Verification & Security" card, but never fetched the actual document images and had no approve/reject action anywhere — confirmed by grep, zero write calls to any customer-identity endpoint existed.
- **Existing backend route**: `/api/admin/customer-status/[id]` was GET-only — read status, no way to change it.
- **Provider KYC reference implementation**: `/api/admin/provider-identity-documents/[id]` (`action: "verify"`, `super_admin`-only, service-role) — sets `provider_verifications.identity_verified`/`kyc_verified`/`reviewed_at`/`last_reviewed_at`, syncs `user_metadata.identity_verification_status`, notifies + pushes the provider. This is the architecture reused below.

### What was built

**Reused directly** (no changes): the `super_admin`-only auth gate pattern, the service-role Supabase client pattern, the "sync Auth metadata alongside the real record" pattern, the notification + push pattern, the `identity-documents` bucket + signed-URL resolution.

**Adapted, not duplicated**, for the customer schema shape:
- No new `customer_verifications` table was created — the existing `customer_profiles.verified` boolean fills the role `provider_verifications.identity_verified` plays for providers (one verification-state column, not two, since customers have no separate `kyc_verified` concept to date).
- Two new columns only: `customer_profiles.reviewed_at`, `customer_profiles.last_reviewed_at` — audit timestamps, mirroring `provider_verifications.reviewed_at`/`last_reviewed_at` exactly.
- The customer flow is a genuine **approve/reject** (not provider's approve/"back to pending"): rejecting sets `identity_verification_status = "rejected"` (not `"pending"`), giving the customer a clear, actionable rejected state — the existing Flutter screen already renders `"rejected"` correctly and allows resubmission (confirmed by reading `customer_profile_subpages.dart`, no changes needed there).
- No "upload"/"delete" admin actions were built for customers (providers have these; customers don't need admin-side document management — only approve/reject was requested).

### Files changed

- **`app/api/admin/customer-status/[id]/route.ts`** — GET extended to also fetch and return signed `identityFrontImageUrl`/`identityBackImageUrl`/`identityDocumentType`/`identityReviewNote`/`identityLastReviewedAt` (resolved server-side via `resolveStoredMediaUrl`, `visibility: "private"` — no separate client-side signing round-trip needed, unlike the provider dashboard's pattern). New `POST` handler, `action: "verify"`, `super_admin`-gated: updates `customer_profiles` (`verified`, `reviewed_at`, `last_reviewed_at`) and Auth `user_metadata` (`identity_verification_status`, `admin_approval_note`, `admin_approval_note_updated_at`) together, then sends an in-app notification and a push notification to the customer. CORS methods extended from `GET, OPTIONS` to `GET, POST, OPTIONS`.
- **`app/api/profile/me/route.ts`** — `identityVerificationStatus` in the GET/PATCH response now also forces `"verified"` when `customer_profiles.verified` is true, mirroring the provider route's `normalizeIdentityVerificationStatus` defensively — the two fields are always written together by the new admin route, so this is a belt-and-suspenders guard against future drift, not a fix for an observed bug.
- **`admin-dashboard/src/lib/admin-users.ts`** — `AdminCustomerStatusPayload` and `fetchAdminCustomerStatus` extended for the new fields; the customer-detail-building function now populates `identityDocuments` (reusing the existing `ProviderIdentityDocument` shape) and `identityReviewNote`; new `setCustomerIdentityVerified(customerId, verified, note?)` calling the new POST action.
- **`admin-dashboard/src/types.ts`** — `UserDetailRecord` gained `identityDocumentType`, `identityReviewNote`, `identityDocuments?: ProviderIdentityDocument[]`.
- **`admin-dashboard/src/pages/user-profile-page.tsx`** — "Verification & Security" card now shows a third row for Identity/KYC (previously only Email/Phone). New "Identity Documents (KYC Review)" card (customers only, hidden for provider records) showing front/back previews, the last admin note, a reason textarea, and Approve/Reject buttons — Reject requires a note, matching the backend's expectation that a rejection should carry a reason; Approve/Reject each disable once already in that state.

### DB changes

New migration `supabase/migrations/20260908_customer_identity_review_audit_columns.sql`:
```sql
alter table public.customer_profiles
  add column if not exists reviewed_at timestamptz,
  add column if not exists last_reviewed_at timestamptz;
```
No existing migration or table was modified. **Not yet applied** — same as the other pending migrations.

### Access control

Still `super_admin`-only — the new route reuses the exact same `ALLOWED_ADMIN_ROLES = new Set(["super_admin"])` gate pattern already used everywhere else in this remediation. No new role was introduced.

### Tests run

`npx tsc --noEmit -p .` (Next.js root) — clean. `npx tsc -b` (admin-dashboard) — clean. No Flutter files were changed — the customer app's existing identity-verification screen already correctly displays every status value (`pending`/`processing`/`verified`/`rejected`) and already only ever sends `"processing"` (locked down in Phase 6), so it works against the new backend with zero client changes.

### Manual verification steps

1. Run the new migration.
2. As a test customer, submit IC/passport photos from the app (Profile → Identity Verification) — confirm the status shows "Processing".
3. In the admin dashboard, open that customer's profile — confirm the front/back images now render in the new "Identity Documents (KYC Review)" card, and the Identity/KYC row in "Verification & Security" shows "Pending"/"Processing" appropriately.
4. Click **Reject** without a note — confirm it's blocked ("Please add a reason..."). Add a note, click Reject — confirm the customer's app now shows "Rejected", they receive a notification/push, and the admin note is visible on reload.
5. Resubmit as the customer, then click **Approve** in the admin dashboard — confirm the customer's app now shows "Verified", `kycVerifiedAt` populates, and the customer receives a notification/push.
6. Confirm a plain `PATCH /api/profile/me` from the customer with `{ "verified": true }` or `{ "identityVerificationStatus": "verified" }` still has **no effect** (Phase 6 lockdown, unaffected by this phase).

## Phase 10 — Production deployment + post-deploy verification

### Migrations

You confirmed all four migrations were applied via the Supabase SQL editor before this deploy:
1. `20260908_prevent_profile_role_escalation.sql` (SWP-007)
2. `20260908_private_identity_and_payment_buckets.sql` (SWP-004)
3. `20260908_lock_down_bookings_payments_direct_writes.sql` (SWP-005)
4. `20260908_customer_identity_review_audit_columns.sql` (Phase 9)

### Deployment

No new feature changes were made as part of this deploy — everything shipped was already documented in Phases 4-9 above.

| App | Command | Result | URL | Version ID |
|---|---|---|---|---|
| Backend (Next.js/OpenNext) | `npm run deploy` | Build + deploy succeeded, `tsc` clean | `app.myswiper.my` | `96f1af9b-e49a-45d6-8c49-03a73c6fcc27` |
| Admin dashboard (Vite) | `npm run deploy` | `tsc -b` + build + deploy succeeded | `admin.myswiper.my` | `6e48ca2d-5974-46ea-a9b5-a4a0b1a2387d` |

Deployed 2026-09-08, ~08:47-08:49 UTC. **Flutter: no files changed as part of this deploy** — Phase 6 (SWP-012) is the only phase in this arc that touched Flutter (`provider_workspace_service.dart`, `provider_more_screens.dart`), and those changes are already in the repo from that phase; Flutter has no `npm run deploy`-equivalent build/release step in this project, so there is nothing further to "deploy" for it here — the next real app-store/build cycle will pick those changes up.

### Automated post-deploy checks — [EXEC], run against production this session

I do not have a browser/device session, so I could not exercise Flutter/OTP/admin-dashboard UI flows directly (see the "no device connection" constraint that's applied throughout this engagement). I did run a small set of safe, credential-scoped, zero-data-risk checks directly against the production Supabase project using a disposable read-only-in-effect script (anon key + service-role key from `.env.local`, matching the same pattern used earlier in this engagement for live RLS re-verification; no data was created, modified, or deleted — the two write attempts below both targeted a nonexistent row ID specifically so a permission failure is the only possible successful outcome, and a real one would still have written nothing since no row matches):

| Check | Method | Result |
|---|---|---|
| SWP-004: anonymous public fetch of a real `identity-documents` object | Unauthenticated `GET` to the object's old `/storage/v1/object/public/identity-documents/<real-path>` URL | **400** (was `200` with the file before the bucket was flipped private) — **LIVE VERIFIED** |
| SWP-005: anon-key direct `UPDATE` on `bookings` | Supabase JS client, anon key, `.from("bookings").update({booking_price: 1}).eq("id", "<nonexistent-uuid>")` | **401, `permission denied for table bookings` (Postgres code 42501)** — **LIVE VERIFIED** |
| SWP-005: anon-key direct `UPDATE` on `payments` | Same pattern against `payments` | **401, `permission denied for table payments` (42501)** — **LIVE VERIFIED** |

These three are the only checklist items I can mark **LIVE VERIFIED** — they're the ones that don't require a real user session, a phone, or a browser to exercise meaningfully.

### The rest of your checklist — needs your own device/browser (not run by me)

I have not executed these, and I'm not marking any of them LIVE VERIFIED. Each maps to manual verification steps already written in earlier phases of this document — collected here as one pass/fail list:

| Checklist item | Where the detailed steps live | Status |
|---|---|---|
| Customer login/OTP path | Phase 1 (SWP-001) | Not run — needs a real device |
| Provider login/OTP path | Phase 1 (SWP-001) | Not run — needs a real device |
| Customer profile update | Phase 6 (SWP-012) manual steps | Not run |
| Provider profile update | Phase 6 (SWP-012) manual steps | Not run |
| Customer identity upload → admin approve/reject → customer sees correct status | Phase 9, 6-step checklist | Not run |
| Provider KYC review | Pre-existing flow, untouched this arc | Not run |
| Private identity/payment-proof access (authorized viewing, not just anonymous denial) | Phase 5 | Anonymous-denial half is LIVE VERIFIED above; authorized admin viewing is not run |
| Booking creation | Phase 7 (SWP-006) | Not run |
| Provider accept/on-the-way/arrived/work-finished | Phase 8 (SWP-005) mutation map | Not run |
| Payment proof | Phase 5 / Phase 8 | Not run |
| Completion | Phase 8 mutation map | Not run |
| Review | Phase 8 mutation map | Not run |
| Role-escalation protections (a real logged-in user attempting to PATCH their own `role`) | Phase 4 (SWP-007) | Not run — requires a real authenticated session; the trigger only fires for `auth.role() in ('anon','authenticated')`, which needs a genuine logged-in JWT, not just the anon key, to test meaningfully |
| Manipulated booking-price rejection | Phase 7 (SWP-006) | Not run — requires creating a real booking through the app to submit a tampered price against |

I deliberately did not simulate these by scripting fake accounts/bookings directly against production — creating synthetic customers, providers, or bookings would leave real data behind and could trigger real notifications to your actual admin account. If you'd like me to run a scripted end-to-end pass like that instead of (or in addition to) your own manual testing, say so explicitly and I'll scope it as its own controlled step, with cleanup.

### What "safe to release" means right now

Every CRITICAL code fix is deployed and the two checks that could be verified without a live session confirm the two riskiest holes (public document/payment leakage, direct-database bypass) are actually closed in production, not just in code. But **do not treat the rest of this checklist as passing** until you've run it — a deploy succeeding and a `tsc` pass are necessary, not sufficient, evidence that the booking lifecycle, OTP flows, and KYC review actually work end to end for a real user.

## Status of every SWP finding named in your instructions

| Finding | Status | Notes |
|---|---|---|
| SWP-001 (phone login takeover) | **FIXED** | Deployed. See Phase 1. |
| SWP-002 (provider registration mock OTP) | **FIXED** | Deployed. See Phase 2. Includes the bonus email-verification fix. |
| SWP-003 (`OTP_DEV_MODE=true` in production) | **NOT FIXED — MANUAL ACTION REQUIRED** | Now CONFIRMED (not just unconfirmed) that no Twilio secret exists in production. Flipping the flag off today would lock out every real user. Provision Twilio (or another SMS provider) and set the three env vars named above as Worker secrets before this can proceed. |
| SWP-004 (public storage buckets) | **FIXED — LIVE VERIFIED (anonymous-denial half)** | Migration applied, both apps deployed. Confirmed in production: an unauthenticated fetch of a real `identity-documents` object's old public URL now returns 400. Authorized viewing (admin dashboard, in-app previews) is deployed and code-correct but not yet exercised live — see Phase 10. |
| SWP-005 (`bookings`/`payments` unrestricted column updates) | **PARTIALLY FIXED — LIVE VERIFIED (direct-write lockdown)** | Migration applied, deployed. Confirmed in production: an anon-key direct `UPDATE` to both `bookings` and `payments` is rejected with `permission denied` (42501). The full booking lifecycle through the app has not yet been re-tested live — see Phase 10. The optional DB-level status-transition trigger was deliberately **not** written — see Phase 8 for why (incompletely-traced `review_requested`/`paid` dead-code states, risk of a false-rejection regression). |
| SWP-006 (client-computed booking price) | **FIXED — already implemented, newly verified** | Direct code read of the sole booking-creation route confirms the server already recomputes price from the provider's stored rate and never persists the client-sent amount. See Phase 7. |
| SWP-007(a) (profile self-role-escalation) | **FIXED** | `trg_prevent_profile_role_escalation` (BEFORE UPDATE) blocks `anon`/`authenticated` sessions from changing `profiles.role`. Verified against live function body + full-repo grep of every `profiles` update site. See Phase 4. |
| SWP-007(b) (public signup → super_admin via client role metadata) | **NOT VULNERABLE / CLOSED** | Live `handle_new_user()` hardcodes `role = 'customer'`, never reads `raw_user_meta_data->>'role'`. `trg_prevent_public_super_admin_profile` (BEFORE INSERT) retained as defense-in-depth. See Phase 4. |
| SWP-012 (client-asserted verification flags) | **FIXED** | Provider email verification now requires a real redeemed OTP challenge (mirrors SWP-001/002); provider phone/identity/KYC booleans are no longer accepted from the client at all; customer `verified`/`identityVerificationStatus` are locked to "processing" self-report only. See Phase 6 — including a surfaced pre-existing gap (no customer KYC admin-approval flow exists yet). |

---

## Environment changes required (manual action, not yet done)

Before Phase 3 can safely proceed, please confirm/provide (do not paste actual secret values back to me — just confirm these are set in the Cloudflare Worker's environment):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`

Once confirmed, Phase 3 will disable `OTP_DEV_MODE` for the production environment specifically, while leaving a safe opt-in available for local/dev use.

## Anything requiring manual Supabase action

**All four tracked migrations have been applied** (you ran them via the Supabase SQL editor on 2026-09-08, before the Phase 10 deploy):
- `supabase/migrations/20260908_prevent_profile_role_escalation.sql` (Phase 4 / SWP-007) — **applied**.
- `supabase/migrations/20260908_private_identity_and_payment_buckets.sql` (Phase 5 / SWP-004) — **applied**, LIVE VERIFIED (Phase 10).
- `supabase/migrations/20260908_lock_down_bookings_payments_direct_writes.sql` (Phase 8 / SWP-005) — **applied**, LIVE VERIFIED (Phase 10).
- `supabase/migrations/20260908_customer_identity_review_audit_columns.sql` (Phase 9) — **applied**, not yet live-tested (needs a real customer submission + admin review — see Phase 10's manual checklist).

No further Supabase action is currently pending except what Phases 7/8's follow-up items note (the deferred status-transition trigger) and SWP-003 (Twilio provisioning, not a database change).

## Super Admin creation procedure (documented now, Phase 6, no code required)

1. In the Supabase Dashboard, create a new user under Authentication → Users (email/password), or have them sign up normally as a `customer` first.
2. Copy that user's UUID from the Auth Users list.
3. Run in the SQL Editor:
```sql
update public.profiles
set role = 'super_admin', status = 'active'
where id = 'AUTH_USER_UUID';
```
4. If no `profiles` row exists yet for that UUID (shouldn't normally happen, since `handle_new_user()` creates one on every signup), create it first:
```sql
insert into public.profiles (id, email, full_name, role, status)
values ('AUTH_USER_UUID', 'the-persons-email@example.com', 'Their Name', 'super_admin', 'active')
on conflict (id) do update set role = 'super_admin', status = 'active';
```
There is no public Super Admin signup page, and none will be built. A future `super_admin`-only Admin Management page that provisions other admins through a server-side endpoint is possible later but explicitly out of scope unless you ask for it.

## Remaining risks

- **`OTP_DEV_MODE=true` is still live in production** (SWP-003) — blocked on Twilio provisioning, no code action possible. This is now the only unresolved CRITICAL finding.
- ~~Migrations written but not applied~~ — **all four applied 2026-09-08**; two are LIVE VERIFIED (Phase 10), two are deployed/applied but not yet exercised against a real user flow.
- **A database-level booking-status-transition trigger was deliberately not written** (see Phase 8) — the access-lockdown migration closes the actual exploit path, but there's no DB-level guard yet against an *application-layer* bug producing an invalid status jump (e.g. a future bug in the Next.js code itself). Recommended as a dedicated follow-up once `review_requested`'s origin is traced.
- ~~No customer identity-verification admin-approval flow exists~~ — **built in Phase 9**, deployed, migration applied, not yet live-tested.
- **The full booking lifecycle, OTP flows, and KYC review have not been re-tested against production since this deploy** — see Phase 10's checklist. This is the main open item before calling anything beyond the two LIVE VERIFIED items production-safe.

**Do not consider Swiper safe to release until SWP-003 is unblocked and Phase 10's remaining manual checklist has actually been run.**

## Production deployment checklist (for what's shipped so far)

- [x] `tsc --noEmit` clean (Next.js root, all phases)
- [x] `tsc -b` clean (admin-dashboard, Phases 5 and 9)
- [x] `flutter analyze` clean on all touched files
- [x] All four migrations applied to production Supabase (2026-09-08)
- [x] Backend deployed to `app.myswiper.my` (Phase 10, version `96f1af9b-e49a-45d6-8c49-03a73c6fcc27`)
- [x] Admin dashboard deployed to `admin.myswiper.my` (Phase 10, version `6e48ca2d-5974-46ea-a9b5-a4a0b1a2387d`)
- [x] SWP-004 anonymous-denial check — LIVE VERIFIED (Phase 10)
- [x] SWP-005 direct-write-rejection check — LIVE VERIFIED (Phase 10)
- [ ] Manual smoke test: attempt the old phone-login request shape (no `challengeId`) against production and confirm it now returns 401.
- [ ] Manual smoke test: complete a full provider registration through the phone-OTP step using the real `123456` dev-bypass code (still active, since `OTP_DEV_MODE` hasn't been turned off yet) and confirm registration still succeeds end to end.
- [ ] Manual smoke test: complete provider email verification from the Profile screen and confirm it still works (now requires a real redeemed OTP challenge — see Phase 6).
- [ ] Confirm admin identity/payment-proof previews still load for a `super_admin` session (the authorized half of Phase 5, not yet tested).
- [ ] Confirm the full booking lifecycle (create → accept → on-the-way → arrived → work finished → cash pay → settle commission → review) still works end to end through the app (Phase 8).
- [ ] Complete the Phase 9 6-step manual verification (submit → admin sees documents → reject requires a note → resubmit → approve → confirm the client still can't self-verify).
- [ ] Confirm a real logged-in customer/provider attempting to change their own `role` via a direct PostgREST call is rejected by the trigger (Phase 4) — the automated checks in Phase 10 used the anon key only and can't exercise this.
- [ ] Confirm a tampered/lowballed price submitted through the real booking-creation screen is ignored server-side (Phase 7) — needs a real booking, not just a code read.

---

*Next: every named CRITICAL finding is FIXED or PARTIALLY FIXED except SWP-003 (blocked on Twilio), and Phase 9 (the first HIGH-priority item) is built. All four migrations are applied and both apps are deployed as of 2026-09-08. Two of the riskiest items (public document/payment leakage, direct-database write bypass) are LIVE VERIFIED against production. Everything else in the checklist above still needs your own device/browser pass before you rely on it — I did not simulate it with scripted fake accounts against production, since that would leave real data behind and could page your real admin account; say so explicitly if you'd rather I run a scripted end-to-end pass instead. Remaining HIGH-priority backlog: SWP-008, 010, 011, 013-021, and the deferred booking-status-transition trigger noted in Phase 8.*
