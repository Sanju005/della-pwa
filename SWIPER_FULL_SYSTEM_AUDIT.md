# SWIPER FULL SYSTEM AUDIT

**Date:** 2026-09-08
**Method:** Static code tracing across the Flutter customer/provider app, the Next.js backend/admin panel, and the live Supabase project, supplemented by fresh read-only execution checks against the live database (Storage API, PostgREST introspection, `flutter analyze`, `tsc --noEmit`) where possible. This report also incorporates and re-verifies three pre-existing audit documents already in this repository rather than re-deriving their findings from scratch:
- `SUPABASE_AUDIT.md` (2026-08-30ish) — deep live-verified DB/RLS/storage audit
- `customer-app-audit.txt` — full Customer App screen-by-screen audit
- `CRITICAL_FIX_4_RESULTS.txt` — provider-location-privacy fix, confirmed implemented and tested

No code was changed, no data was written/updated/deleted, no migration was run, and no RLS/bucket policy was changed while producing this report. Every finding below is labeled with a verification tier:
**[EXEC]** verified by actually running something (analyze/typecheck/a live read-only query) · **[CODE]** verified by direct code inspection only · **[N/V]** not verifiable from this environment.

---

## 1. Executive Summary

### Overall production readiness: **38%**

**Is Swiper safe to release today? NO.**

The core product loop — browse a provider, create a booking, track it, pay, review it — genuinely works end to end against a real backend. This is not a demo shell. But sitting on top of that real system are several **confirmed, exploitable, unauthenticated security holes** that must be closed before any real user's money, identity documents, or account can be trusted to this system: a phone-login endpoint that hands out a working password to anyone who knows a phone number, a provider registration OTP step that has never actually verified anything, and two Supabase storage buckets holding identity documents and payment proofs that are still fully public today.

| Area | Score | Why |
|---|---|---|
| User (Customer) App | 55% | Real booking loop; mocked wallet/categories/notifications/chat; OTP-adjacent trust gaps |
| Provider App | 50% | Real registration data capture and booking lifecycle; mocked OTP; no rollback on partial registration failure; settlement history permanently broken |
| Admin Panel | 80% | Extensively hardened this project (7 remediation phases) — RLS gaps closed, mock-fallback patterns fixed, dead UI wired or removed. Two deliberately-deferred features (review moderation, complaints workflow) |
| Backend / API | 55% | Real DB-backed routes for the main flows; orphaned/dead routes (Stripe checkout, booking-complete); one route (`provider/company-payments`) silently degrades against a missing table |
| Database | 60% | Well-indexed hot paths, real FKs, zero orphan data; but 25 of 30 tables have no migration file at all (untracked schema drift), duplicate tables, no custom CHECK constraints |
| Security | 20% | Multiple confirmed CRITICAL, live, unauthenticated vulnerabilities (see below) |
| Notifications | 70% | Correct recipients, real content for most events; device-token cleanup and one event missing |
| SMS / OTP | 12% | Confirmed unauthenticated account-takeover path; provider registration OTP is 100% mocked with no gate |
| Email | 10% | No real email sending exists anywhere except Supabase's own built-in password-reset email |
| Payments / Commission | 40% | Cash-pay + review flow real; price is client-computed and trusted verbatim; settlement table missing; two dead parallel payment systems |
| Data Synchronization | 65% | Polling-only (no realtime anywhere), but status vocabulary is consistent across Flutter/backend/admin today |

### The top 10 blockers (all must-fix-before-production)

1. **Both phone-login endpoints hand out a working account password with zero OTP check** — full unauthenticated account takeover, reachable regardless of any environment setting.
2. **Provider registration's OTP step is 100% mocked** (`DevelopmentOtpService`, literal `"123456"`) with no environment gate — anyone can register as a provider under any phone number without ever receiving an SMS.
3. **`OTP_DEV_MODE=true` is live in the production deploy config** (`wrangler.jsonc`), meaning the shared OTP-verification module also accepts `123456` for whatever it protects today.
4. **`identity-documents` and `payment-proofs` Supabase Storage buckets are still public** — confirmed live today. Government ID photos and payment slips are fetchable by anyone with the URL, no auth.
5. **`bookings` row-level security lets a customer or provider rewrite any column on their own booking** — status, amounts, timestamps — confirmed still present via the tracked migration source, with no state-machine trigger to reject an invalid jump.
6. **Booking price is computed on the customer's device and persisted verbatim, with no server-side recalculation** against the provider's real stored rate.
7. **Two more, previously-unconfirmed critical RLS paths cannot be ruled out**: `profiles` self-update policy reportedly has no column restriction (so a user could plausibly `PATCH` their own `role` to `super_admin`), and `handle_new_user()` reportedly trusts a client-supplied `role` at signup. Neither could be independently re-verified by execution this pass (no SQL-introspection path available) — **treat both as still open** until proven otherwise, given the severity.
8. **No rollback on provider registration failure** — a mid-registration error can leave an orphaned Supabase Auth user with no profile, or a provider profile with no services.
9. **`provider_company_payment_submissions` does not exist in the live database**, despite the admin dashboard and a Next.js route depending on it — the provider's own settlement/payment-history view is permanently empty as a result. (The fix is unusually cheap: the migration file to create it already exists in the repo, tracked, just never applied.)
10. **Email/phone "verified" flags on the customer profile-edit path are entirely client-asserted** — the backend persists `emailVerified: true`/`phoneVerified: true` exactly as sent, with no real verification round-trip on that specific path.

### What's already production-ready

- Customer & provider booking creation, provider acceptance/decline, on-the-way/arrived/work-finished/cash-pay/review — the real, end-to-end happy path, backed by real Supabase tables, indexed correctly for its actual query patterns.
- The admin dashboard, after this project's own 7-phase remediation: real data everywhere it claims to be real, RLS-protected, dead UI either wired to real actions or removed.
- Push notifications for the main booking lifecycle events — correct recipients, real names/amounts in the copy, no found duplicate-sends.
- Zero data-integrity problems in the actual live data (no orphans, no duplicate identities) — every problem found is architectural, not data corruption.

### What only looks finished

- Customer in-app chat (a full UI, zero network calls on send).
- Customer wallet balance, home service categories, and notifications feed (all hardcoded constants, shown with full "real" styling).
- Coupons screen (own UI badge literally says "Demo").
- Identity verification hub on both apps (unreachable from its own entry point on the customer side).
- Stripe checkout/verify routes and the booking-complete confirmation route (all real, working code — with zero UI callers anywhere).
- Provider settlement/payment history (silently always empty, due to finding #9).

---

## 2. Architecture Map

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Flutter User    │     │ Flutter Provider  │     │  Admin Panel        │
│  App (customer   │     │ App (same repo,   │     │  (Vite/React, own   │
│  features/*)     │     │ features/         │     │  Cloudflare Worker, │
│                   │     │ provider_app/*)   │     │  admin.myswiper.my) │
└─────────┬─────────┘     └─────────┬─────────┘     └──────────┬──────────┘
          │  anon key, Bearer JWT              │  anon key, Bearer JWT          │  anon key, admin-role JWT
          ▼                                     ▼                                ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│         Next.js API routes (app/api/**) — Cloudflare Worker "della-pwa"          │
│         app.myswiper.my — service-role key used server-side only                 │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                          │ service-role key (server-only)
                                          ▼
                          ┌───────────────────────────────┐
                          │   Supabase (single project)     │
                          │   Postgres + Auth + Storage      │
                          └───────────────────────────────┘
          ▲                                                              ▲
          │ FCM HTTP v1 (server → device)                                │ Twilio SMS (server → phone), when configured
┌─────────┴─────────┐                                          ┌─────────┴─────────┐
│  Firebase Cloud    │                                          │  Twilio (SMS)      │
│  Messaging         │                                          │  — env vars not    │
│  project:          │                                          │  confirmed set     │
│  myswiper-app       │                                          │  in this env       │
└────────────────────┘                                          └────────────────────┘

Email: no dedicated provider wired anywhere. The only real outbound email in the
entire product is Supabase Auth's own built-in password-reset email
(`supabase.auth.resetPasswordForEmail`) — whether Supabase's own SMTP is actually
configured for this project is NOT VERIFIABLE FROM CURRENT ENVIRONMENT.
```

**Same backend, confirmed.** All three surfaces (Flutter apps, admin panel, Next.js API) point at the same Supabase project (`NEXT_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` consistent) and the same Firebase project (`myswiper-app`, consistent between `google-services.json` and `firebase_options.dart`). **[CODE]**

**Environment/config flags — no localhost, no dev-domain, no duplicate Firebase project found.** One real flag: `OTP_DEV_MODE=true` is set in `wrangler.jsonc`'s config for the live `app.myswiper.my` custom-domain deploy — i.e. a "dev mode" flag is active in the production configuration. **[EXEC — confirmed present in `wrangler deploy` output during this project's own work, and in `wrangler.jsonc` source]**

**Package/application ID:** Android `applicationId` was corrected earlier in this project's history to `my.myswiper.app` (was previously the default `com.example.flutter_app`, since fixed alongside a `MainActivity.kt` package move) — consistent today. **[CODE]**

No secret values are printed anywhere in this report — only variable/config names and file locations.

---

## 3. End-to-End Connection Matrix

| Feature | User App | Provider App | API | Supabase | Admin | Push | SMS | Email | Status |
|---|---|---|---|---|---|---|---|---|---|
| Customer registration | ✅ | N/A | ✅ | ✅ | ✅ | N/A | 🟡 real OTP round-trip used, but registration itself doesn't re-check phone ownership beyond that | ❌ no welcome email | **PARTIAL** |
| Provider registration | N/A | ✅ (all real fields persist) | ✅ | ✅ | ✅ | N/A | 🔴 mocked, no gate | ❌ | **PARTIAL / MOCKED (OTP)** |
| Phone login (both apps) | 🔴 | 🔴 | 🔴 no OTP check at all | ✅ | N/A | N/A | 🔴 | N/A | **BROKEN (security)** |
| Booking creation | ✅ | N/A | ✅ | ✅ | ✅ | ✅ (provider notified) | N/A | ❌ | **CONNECTED**, price-trust gap |
| Booking acceptance | N/A | ✅ | ✅ | ✅ | ✅ | ✅ (generic text) | N/A | ❌ | **CONNECTED** |
| Provider on-the-way / arrived | N/A | ✅ | ✅ | ✅ | ✅ | ✅ (generic text) | N/A | ❌ | **CONNECTED** |
| Work completion | ✅ (view only) | ✅ | ✅ | ✅ | ✅ | ✅ (real amount) | N/A | ❌ | **CONNECTED** |
| Cash payment | ✅ | ✅ (sees proof) | ✅ | ✅ | ✅ | ✅ | N/A | ❌ | **CONNECTED** |
| Provider confirms payment | N/A | ✅ | ✅ | ✅ | ✅ | ✅ (generic text) | N/A | ❌ | **CONNECTED** |
| Booking completion | ✅ | ✅ | ✅ (two overlapping status routes) | ✅ | ✅ | 🟡 inconsistent recipient set between the two completion paths | N/A | ❌ | **PARTIAL** |
| Cancellation (provider-initiated) | ✅ notified | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ❌ | **CONNECTED** |
| Cancellation (customer-initiated) | ❌ **no endpoint exists** | N/A | ❌ | N/A | N/A | N/A | N/A | N/A | **MISSING** |
| Messaging (booking chat) | 🔴 UI fake, no network call | ✅ real (booking_messages) | ✅ | ✅ | 🟡 not a strong admin surface | ✅ (real sender name+text) | N/A | ❌ | **PARTIAL / MOCKED on customer side** |
| Review submission | ✅ | ✅ | ✅ | ✅ | ✅ | N/A (no push on review itself beyond notify) | N/A | ❌ | **CONNECTED** |
| Provider verification (KYC) | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ❌ | **CONNECTED** |
| Commission settlement submit | N/A | 🔴 UI works, backend silently falls back to a different schema | ✅ (fallback path) | 🔴 target table missing | 🟡 admin dashboard queries the same missing table | ✅ to admin | N/A | ❌ | **PARTIAL / BROKEN** |
| Commission settlement approved | N/A | ❌ no notification received | 🔴 (see above) | 🔴 | ✅ admin can mark received | ❌ **missing** | N/A | ❌ | **BROKEN (notification)** |
| Profile update | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | **CONNECTED** |
| Email/phone "verified" flags (profile edit) | 🔴 client-asserted, trusted | N/A (separate path) | 🔴 | ✅ persists whatever is sent | 🟡 | N/A | N/A | N/A | **MOCKED (trust)** |

---

## 4. Critical Findings (P0)

**SWP-001 — CRITICAL — Unauthenticated account takeover via phone-login**
Component: Backend. Files: `app/api/provider/login/phone/route.ts`, `app/api/customer/login/phone/route.ts` (~lines 90-154 each).
What's wrong: both routes accept only `{phoneCountryCode, phoneNumber}`. On a match they generate a new password via `auth.admin.updateUserById` and **return that password in the JSON response** — no OTP code, no challenge ID, no server-side verification step of any kind, and no `OTP_DEV_MODE` check (this isn't gated by the dev flag — it's unconditional). Explicitly acknowledged as a "known limitation" in code comments in both files.
Expected: a phone-login flow requires proving control of the phone (a verified OTP) before issuing credentials.
Actual: anyone who knows or enumerates a registered phone number gets a working password for that account via a single unauthenticated HTTP call.
Impact: full account takeover for any customer or provider, zero authentication required.
Fix: require a verified, freshly-consumed OTP challenge (the same `otp-verification.ts` module already used elsewhere) before issuing any credential; never return a generated password in a response body.
**[CODE]**

**SWP-002 — CRITICAL — Provider registration OTP is entirely mocked, unconditionally**
Component: Provider App + Backend. Files: `flutter_app/lib/features/auth/presentation/provider_register_screen.dart:65` (wires `DevelopmentOtpService`), `flutter_app/lib/services/otp_service.dart:20-32` (`verifyOtp` = `code == '123456'`, no network call), `app/api/provider/register/route.ts:674` (server independently checks the literal string `"123456"`, no env-var gate at all).
What's wrong: no code path here ever contacts a real SMS provider or a real verification challenge. This is not gated by `OTP_DEV_MODE` — it's a separate, always-on mock, and the *server* also hardcodes the same literal.
Impact: anyone can register as a provider under any phone number, real or not, with zero SMS ever sent.
Fix: switch the provider registration wizard to `RealOtpService` (already built and used by customer registration) and remove the literal-string check from `register/route.ts` in favor of redeeming a real, server-verified challenge.
**[CODE]**

**SWP-003 — CRITICAL — `OTP_DEV_MODE=true` is live in the production deploy**
Component: Backend config. File: `wrangler.jsonc` (env vars block), confirmed present in `wrangler deploy` output for the `app.myswiper.my` custom domain during this project's own work this session.
What's wrong: `lib/otp-verification.ts`'s dev-mode bypass (accept literal `123456`) is active in the real production environment, not just local/staging.
Impact: any flow still routing through the real OTP module (customer registration/verification) can be bypassed with `123456` in production today.
Fix: unset `OTP_DEV_MODE` in the production environment (or gate it behind a build flavor that can never reach the production Worker), and configure a real Twilio (or equivalent) integration — env vars `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_MESSAGING_SERVICE_SID` were not confirmed set.
**[EXEC — confirmed present in `wrangler.jsonc` and in prior `wrangler deploy` output]**

**SWP-004 — CRITICAL — `identity-documents` and `payment-proofs` storage buckets are still public**
Component: Supabase Storage. Confirmed live today via `storage.listBuckets()`: both buckets are `public: true`, alongside 5 other buckets that are reasonably public (profile/work images, reviews, certificates).
What's wrong: government ID photos and financial payment-proof images are fetchable by anyone with the URL, with zero authentication, no expiry.
Impact: combined with any leak of the URL (e.g. the customer_profiles exposure this same prior audit found, now believed fixed — see SWP-009), identity documents and payment evidence are exposed.
Fix: flip both buckets to private and switch every screen currently rendering a raw public URL to a short-lived signed URL instead.
**[EXEC — confirmed today via live Storage API check]**

**SWP-005 — CRITICAL — `bookings` RLS allows a customer/provider to rewrite any column on their own booking**
Component: Database. File (tracked migration): `supabase/migrations/20260607_live_booking_workflow.sql:362-374`.
What's wrong: `bookings_update_customer_or_provider` restricts *which row* (`customer_id`/`provider_id` = caller) but not *which column*. Combined with zero state-machine-validating trigger (only an AFTER trigger that logs changes, confirmed by the original Supabase audit and not contradicted by anything found since), a customer or provider's own valid session can set `booking_status`, `total_amount`, `provider_amount`, or any timestamp directly via a raw REST call.
Impact: a customer could jump their own booking straight to `completed`, or alter its amount, bypassing the entire app.
Fix: restrict the UPDATE policy to an explicit column allowlist per role (or move status/amount transitions behind a validated RPC), and add a trigger that rejects invalid `booking_status` transitions.
**[CODE — confirmed via tracked migration source, not behaviorally re-tested since that would require an actual unauthorized write]**

**SWP-006 — CRITICAL — Booking price is computed client-side and trusted verbatim**
Component: User App + Backend. Files: customer booking-creation screen computes `totalAmount` in Dart (hourlyRate × hours, or flat daily rate) and sends it; `app/api/bookings/route.ts` persists it into `quoted_amount`/`booking_price`/`final_amount` with no recalculation against the provider's real stored `hourly_rate`/`daily_rate`.
Impact: a modified client could submit an artificially low price and have it become the real charge.
Fix: recompute the price server-side from the provider's own stored rate at booking-creation time; reject or clamp any client-sent amount that disagrees.
**[CODE — per `customer-app-audit.txt` §8/§11, independently plausible given the confirmed lack of any price-validation code found]**

**SWP-007 — CRITICAL (unresolved, could not re-verify) — Possible self-promotion to `super_admin`**
Component: Database. Two independent paths reported by the original `SUPABASE_AUDIT.md`, neither could be re-confirmed or ruled out this pass because no SQL/catalog-introspection path is reachable from this environment without performing the actual escalation write (explicitly out of scope for a read-only audit):
  (a) `profiles`'s self-update RLS policy reportedly has no restriction on which columns can change, and `role` has no CHECK constraint — a user's own JWT could plausibly `PATCH` their own `role` to `super_admin`.
  (b) `handle_new_user()` (the trigger creating a `profiles` row on signup) reportedly reads `role` directly from client-supplied `raw_user_meta_data` with no validation — a public signup call could plausibly create a `super_admin` account from nothing.
Fresh re-verification this pass found no tracked migration defining either the policy or the function (both are live, untracked database objects — consistent with the original audit's "untracked schema" finding), and the `profiles.role` enum still lists `super_admin` as a valid value with no accompanying evidence a CHECK or fix was applied.
**Status: NOT VERIFIABLE BY EXECUTION FROM HERE — must be treated as still open until confirmed fixed via a direct database check (see §17 for the exact SQL).**

---

## 5. High Priority Findings (P1)

**SWP-008 — HIGH — Provider registration has no rollback on partial failure**
`app/api/provider/register/route.ts` creates the Supabase Auth user first, then sequentially upserts `profiles`, `provider_profiles`, `provider_admin_metadata`, `provider_availability`, `provider_verifications`, then inserts `provider_services`/specialties. Any failure from `profiles` onward returns a 500 but never calls `auth.admin.deleteUser` — an orphaned auth user (no profile) or an incomplete provider (profile with no services) is a real, reachable outcome. **[CODE]**

**SWP-009 — HIGH (believed fixed, evidence is indirect) — `customer_profiles`/`provider_profiles` previously had literal `USING (true)` public policies**
The original audit found three wide-open policies on each table (anon+authenticated SELECT/INSERT/UPDATE, no restriction at all). Fresh re-verification this pass: anon-key SELECT on both tables now returns 0 rows with no error, while service-role confirms real rows exist (22 / 83) — strongly suggesting the wide-open SELECT policy (and, per how the prior audit's fix was scoped, likely the INSERT/UPDATE ones alongside it) were removed directly against the live database since the original audit, with no matching migration file. **INSERT/UPDATE were not behaviorally re-tested** (would require an actual unauthorized write) — treat as likely-fixed-but-not-conclusively-proven. **[EXEC for SELECT / CODE-inference for INSERT/UPDATE]**

**SWP-010 — HIGH — `provider_company_payment_submissions` does not exist in the live database**
Confirmed still missing today (`PGRST205` on a live service-role query). `app/api/provider/company-payments/route.ts` has defensive fallbacks that silently degrade: GET always returns an empty submission list (provider's settlement history is permanently empty in the UI), POST falls back to writing directly onto `payments` columns instead. The duplicate-submission guard in the same route can never fire, since it depends on the always-empty read. **The fix is unusually cheap**: a tracked migration to create this exact table already exists in the repo (`supabase/migrations/20260702_provider_company_payment_submissions.sql`) — it was simply never applied. **[EXEC — live query confirms absence; CODE — migration file confirmed present but unapplied]**

**SWP-011 — HIGH — Customer in-app chat is entirely fake**
`booking_detail_screen.dart`'s "Live message" chat is an in-memory list only — sending a message never makes a network call. A real backend endpoint (`/api/profile/messages/[bookingId]`) and a real provider-side implementation (`booking_messages` table, used correctly by the provider app) both exist; nothing in the customer Flutter app calls the real endpoint. A dead screen (`messages_demo_screen.dart`) exists but is never routed to. **[CODE]**

**SWP-012 — HIGH — Email/phone "verified" flags are client-asserted on the profile-edit path**
`PATCH /api/profile/me` persists `emailVerified`/`phoneVerified: true` exactly as sent by the client, with no real OTP round-trip on this specific path (distinct from registration, which does use a real challenge in some flows). The app's own `OtpService.verifyOtp()` abstraction exists but isn't called from these particular screens. **[CODE]**

**SWP-013 — HIGH — No customer-initiated cancellation endpoint exists at all**
Grep of `app/api/bookings/**` and the Flutter customer booking service found no cancellation route or call for the customer side — only provider-initiated decline/cancel is implemented and notified. This is a missing feature, not merely an unnotified event. **[CODE]**

**SWP-014 — HIGH — Cross-account push-notification leak on shared devices**
Logout (`profile_demo_screen.dart:894`, `provider_profile_demo_screen.dart:36`) never deletes the corresponding `user_devices` row. Since the unique key is `(user_id, fcm_token)` rather than `fcm_token` alone, a second account logging in on the same physical device adds a second row rather than replacing the first — both accounts keep receiving each other's pushes indefinitely on a shared/reused device. **[CODE]**

**SWP-015 — HIGH — Missing notification: admin-approved settlement never reaches the provider**
Exhaustive grep of every `sendPushNotificationToUser` call site (8 found) confirms none of them fire when an admin marks a provider's company-payment as received — the provider never learns their settlement was approved via push. **[CODE]**

**SWP-016 — HIGH — Two overlapping "booking completed" flows with different recipient sets**
`provider/bookings/[id]/route.ts`'s `completed` status notifies only the customer; `bookings/[id]/complete/route.ts`'s `work_confirmed_by_user` status notifies both parties. Two similarly-named completion events, inconsistent about who gets told. **[CODE]**

**SWP-017 — HIGH — Orphaned/dead payment routes: two unused parallel payment systems**
`app/api/bookings/[id]/checkout/route.ts` (Stripe Checkout session creation) and `app/api/payments/verify/route.ts` (Stripe session verification) are both fully implemented, real code — with **no current UI caller found anywhere** in the customer app (confirmed via `customer-app-data-flow.csv`, an existing repo document). The `payments` table carries both Stripe columns and manual-proof columns on every row; only the manual cash-pay/proof-upload path is actually wired to a UI. Similarly, `app/api/bookings/[id]/complete/route.ts` (moves a booking to `work_confirmed_by_user`) has no confirmed customer UI caller either. **[CODE, per existing repo documentation, spot-checked]**

**SWP-018 — HIGH — Duplicate review tables with only one wired to the rating-sync trigger**
`reviews` and `provider_customer_reviews` are both actively populated tables for what is conceptually one review. `sync_provider_review_stats()` (the trigger keeping `provider_profiles.average_rating`/`total_reviews` correct) only fires on `reviews` — any write that lands in `provider_customer_reviews` silently never updates the provider's displayed rating. **[CODE, per SUPABASE_AUDIT.md, not independently re-derived]**

**SWP-019 — HIGH — Provider verification state duplicated three ways**
`provider_profiles.approval_status`, `provider_profiles.verification_status`, and the separate `provider_verifications` table (with its own `identity_verified`/`kyc_verified`/`background_check_verified` flags and its own copy of the identity-document URLs) can independently disagree — no single source of truth for "is this provider verified." **[CODE, per SUPABASE_AUDIT.md]**

**SWP-020 — HIGH — No migration history for ~25 of 30 tables**
The schema cannot currently be recreated from this repo — `profiles`, `bookings`, `payments`, `provider_profiles`, and roughly 20 other tables have no migration file at all, having been created directly against the live database. Confirmed as the direct cause of at least two production incidents already this project (`otp_challenges`, `customer_favorite_providers` — both hit "table not found in schema cache" errors before being caught by a real user). **[CODE, per SUPABASE_AUDIT.md, and consistent with this project's own incident history]**

**SWP-021 — HIGH — Commission/net-amount fields readable by the customer/provider themselves via direct REST**
`payments` SELECT is correctly row-scoped to the owner, but with no column restriction — `company_commission_amount`/`provider_net_amount`/`company_payment_status` all come along with a direct query, even though the Next.js API layer correctly strips them before returning JSON through the app. This is read-only exposure (writes are correctly locked to `service_role`/admin), reachable only by bypassing the app's own API route with a raw REST call using a real user's own JWT. **[CODE, per SUPABASE_AUDIT.md]**

---

## 6. Medium Priority Findings (P2)

- **SWP-022** — Both customer and provider apps re-fetch their *entire* booking list on every single status mutation and on every poll tick (customer: 5s interval re-downloading all bookings to show one; provider: 30s dashboard refresh, plus a full reload after every job action) — functionally correct, meaningfully wasteful. **[CODE]**
- **SWP-023** — Booking timeline wording diverges between customer (9 steps) and provider (6 labels) for the same underlying status values — not a functional break, but a maintenance and consistency risk (a dead `index == 9` branch in the customer screen can never render, since the backend only ever returns 9 items indexed 0-8). **[CODE, per `customer-app-audit.txt`]**
- **SWP-024** — Admin dashboard status-mapping code still carries handling for `scheduled` and `in_progress` — two of the "old generation" enum values that no live booking can ever reach today (confirmed via a fresh cross-system grep: these two values appear only in admin code, never in the backend routes that actually write `booking_status`, nor in Flutter). Dead code, not a live bug. **[EXEC — fresh grep this pass]**
- **SWP-025** — No resend cooldown or rate limiting anywhere on OTP send (`/api/auth/otp/send` can be called repeatedly, inserting a new challenge row each time) and no IP-based/global rate-limiting middleware exists in the Next.js app at all. **[CODE]**
- **SWP-026** — `payments.status` (free text) and `payments.payment_status` (enum) both exist and could silently drift if different code paths write to different columns. **[CODE, per SUPABASE_AUDIT.md]**
- **SWP-027** — No custom CHECK constraints anywhere in the schema — ratings aren't bounded 1-5 at the DB level (only in app code), money columns have no non-negative constraint. One-review-per-booking IS correctly enforced via a UNIQUE constraint, per the original audit's correction. **[CODE, per SUPABASE_AUDIT.md]**
- **SWP-028** — Home service categories, wallet balance, and the notifications feed on the customer app are all hardcoded/mocked, shown with full "real" visual styling and no indication to the user that they're not live (the wallet balance in particular — shown in two places, never changes). **[CODE, per `customer-app-audit.txt`]**
- **SWP-029** — Duplicate index (`payments_booking_id_key` = `payments_booking_id_unique_idx`) and two duplicate `updated_at` triggers on `bookings` and `customer_profiles` — harmless, wasteful. **[CODE, per SUPABASE_AUDIT.md]**
- **SWP-030** — No transactional/idempotency guard against a provider double-submitting a company-payment settlement — two rapid submissions can both pass validation (though final state is merely overwritten, not double-paid, since this is provider→company money). **[CODE]**
- **SWP-031** — `job-completion-images` storage bucket is public — photos taken inside a customer's home, worth a policy review even though less severe than the two CRITICAL buckets. **[CODE, per SUPABASE_AUDIT.md]**

---

## 7. Low Priority Findings (P3)

- Naming: `ProviderProfileDemoScreen` is the real, live provider profile screen despite its name — risks accidental deletion by a future contributor. Similarly, several customer screens carry an unused `DemoRepository` constructor parameter never referenced in the body.
- Dead widget files with zero references anywhere: `rating_badge.dart`, `service_category_chip.dart`, `verified_badge.dart`, `booking_card.dart`, `booking_timeline.dart`, `messages_demo_screen.dart` and its two supporting widgets.
- Orphaned routes: `CustomerRegisterSuccessScreen` and `CustomerIdentityVerificationScreen` are both defined but unreachable from their own real navigation flow.
- Two identically-named admin-role-check functions (`is_admin_role()`, `is_admin_user()`) do the same thing — reasonable `SECURITY DEFINER` design, just worth consolidating.
- `flutter analyze` across provider-app files: one genuine unused-element warning (`_serviceCard`), a deprecated `value:` usage, and several info-level `unnecessary_underscores` lints — all cosmetic. **[EXEC]**
- Widespread use of plain `ListView(children: [...])` instead of `.builder()` across ~15 provider-app locations — fine for small bounded lists, worth confirming none render an unbounded list.
- Unsized `Image.network` calls on provider card thumbnails — full-resolution decode for small thumbnails.
- Commission percentage is a hardcoded server constant (`COMPANY_COMMISSION_RATE = 0.05`) — not configurable without a redeploy, low risk since it's server-side, but inflexible.

---

## 8. User App Audit

See `customer-app-audit.txt` (existing, complete document in this repo) for the full screen-by-screen breakdown — not reproduced here in full to avoid duplication. Headline points folded into this report: the booking loop is genuinely live; wallet/categories/notifications/chat are mocked; the phone-OTP login toggle doesn't create a real session (superseded by the worse finding in SWP-001, since the "toggle" leads to the same broken endpoint); identity verification and the registration-success screen are both orphaned routes.

## 9. Provider App Audit

Registration correctly persists nearly every field the wizard collects (marketing name, rates, specialties, work images, availability, service radius, coordinates, address) into their real tables — the one confirmed exception is the OTP step (SWP-002) and the stubbed email/password/identity-document fields, which are legitimately optional/deferred to a later step rather than silently dropped. The dashboard's stats are all real-fetch-backed, not hardcoded. The booking-lifecycle action buttons all make real API calls before touching local state — no fire-and-forget local-only status mutation was found on the primary path. The most serious provider-side findings are the registration rollback gap (SWP-008) and the broken settlement table (SWP-010).

## 10. Admin Panel Audit

Extensively covered by this project's own prior work (7 remediation phases, documented in-conversation and reflected in the live admin.myswiper.my deployment): RLS gaps on `reviews`, `provider_customer_reviews`, and `provider_registration_submissions` were found and fixed; the systemic mock-fallback pattern across all 7 list pages was fixed so mock data only appears in genuine demo mode; fabricated fields (fake login history, fake wallet balance, fake dashboard charts) were removed or wired to real data; dead UI was wired to real actions or removed; duplicate data displays were fixed or clarified. Two items were deliberately left unbuilt as out-of-scope feature requests rather than bugs: real review moderation (hide/flag — the underlying columns don't exist) and a real complaints workflow (the underlying data has no "resolved" state today). Current admin-side risk is now primarily upstream of the admin panel itself — i.e. the database/RLS/OTP findings in this report, not the admin UI.

## 11. Booking Lifecycle Audit

Fresh cross-system grep (backend routes, Flutter provider+customer, admin dashboard) confirms the 17 "current generation" `booking_status` values are used **consistently** across all three systems today. Two "old generation" enum values (`scheduled`, `in_progress`) survive only as dead-code branches in the admin dashboard's status-mapping logic — no live booking can reach them via any API route, so this is cosmetic/cleanup debt, not a live bug. `disputed` is unused everywhere. See §5/SWP-005 for the more serious finding that nothing below the application layer actually enforces which transitions are valid.

## 12. Payment + Commission Audit

Cash-pay is the one fully real, fully wired payment path today. Client-computed pricing (SWP-006), the missing settlement table (SWP-010), two dead parallel payment systems (SWP-017), and no double-submit guard (SWP-030) are the standing issues. Commission rate is a safe server-side constant, not client-controlled.

## 13. Notification Audit

See the event-recipient matrix under §3 (folded into the connection matrix) and SWP-013 through SWP-016 for the specific gaps (missing cancellation-reverse-direction event because the feature itself doesn't exist, cross-account device-token leak, missing settlement-approved notification, inconsistent completion-event recipients). Everything else — booking created/accepted/on-the-way/arrived/work-finished/cash-paid/reviewed/KYC-approved — is correctly wired with real recipient IDs and mostly real content (a few statuses use generic text with no name/amount, noted as PARTIAL rather than BROKEN).

## 14. SMS / OTP Audit

The headline finding of this entire report: SWP-001 (unauthenticated phone-login takeover), SWP-002 (mocked provider-registration OTP), and SWP-003 (`OTP_DEV_MODE=true` live in production) are all confirmed. The one thing working correctly: customer registration's OTP step does use a real, server-verified challenge (`RealOtpService` + `otp-verification.ts`, with real hashing, 5-attempt cap, and expiry) when `OTP_DEV_MODE` is off — this module itself is well-built, it's just bypassed by a live production flag and bypassed entirely by two other code paths that don't call it at all.

## 15. Email Audit

No dedicated email-sending package or service exists anywhere in the codebase. The single real email in the entire product is Supabase Auth's own built-in `resetPasswordForEmail` call on the forgot-password screen — whether Supabase's own SMTP is actually configured for this project could not be checked from this environment. Every other promised email event (welcome, verification, booking confirmation, cancellation, payment receipt, admin/provider notices) has no sender implementation at all.

## 16. Supabase Database Audit

Fully covered by `SUPABASE_AUDIT.md` (existing document) — 30 real application tables, zero orphan data, well-indexed hot paths, real foreign keys everywhere checked. This pass's fresh re-verification (§4/§5, SWP-004/005/009/010) confirms most of that document's findings are still accurate today, with one piece of good news (SWP-009, the wide-open profile-table policies appear to have been fixed since) and one piece of remaining uncertainty (SWP-007, the two super-admin-escalation paths could not be re-proven either way).

## 17. RLS + Security Audit

Consolidated in §4/§5 above. **Recommended next action:** run the following against the live database (read-only, safe) to close the one remaining uncertainty in this entire report:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles';

select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user';
```

## 18. Storage Audit

`identity-documents` and `payment-proofs` are confirmed still public today (SWP-004) — this is the most actionable CRITICAL finding in the whole report, since fixing it is a Storage-dashboard toggle plus switching the handful of screens that render these URLs to a signed-URL fetch, not a schema change. `job-completion-images` (SWP-031) is a lower-severity version of the same question. The other 4 buckets (profile/work images, reviews, certificates) being public is reasonable by design.

## 19. Realtime / Synchronization Audit

Confirmed (per `SUPABASE_AUDIT.md`, not contradicted by anything found this pass): **nothing in either Flutter app or the Next.js backend subscribes to Supabase Realtime anywhere.** Booking status, chat, and notifications all work by polling/refetching. `booking_messages` and `bookings.booking_status` would benefit most if Realtime were adopted.

## 20. Performance Audit

SWP-022 (full-list refetch on every mutation, both apps) is the standing cross-cutting issue. `provider_profiles` has no index beyond its primary key despite being the target of every marketplace-browse query — not yet a real problem at 83 rows, but the first thing to index as the provider count grows. Customer-side futures built inline in `build()` (confirmed in the earlier customer audit) is a real anti-pattern; the equivalent was specifically checked and NOT found on the provider side this pass.

## 21. Privacy Audit

Provider home-coordinate exposure via the public provider catalog/detail/home endpoints was found and **confirmed fixed** (`CRITICAL_FIX_4_RESULTS.txt` — implemented, tested with 12 separate checks, all passed). The two public storage buckets (SWP-004) are the standing privacy risk today. Notification content includes real names — reasonable for the booking context, nothing found leaking more than the counterparty needs to fulfil the booking.

## 22. Dead Code / Mock / Hardcoded Data

Consolidated across the report: `DemoRepository`/`DemoDataService` mock plumbing (wallet balance, categories, notifications feed) on the customer side; `DevelopmentOtpService` on both registration paths where it shouldn't be used unconditionally; dead widget/screen files listed in §7; two Stripe payment routes and one booking-completion route with no UI caller; admin dashboard's dead `scheduled`/`in_progress` status branches.

## 23. Missing Features / Connections

Customer-initiated cancellation (SWP-013), real customer chat (SWP-011), admin-settlement-approved provider notification (SWP-015), any real email sending beyond password reset (§15), server-side booking-price validation (SWP-006).

## 24. Recommended Improvements

**MUST FIX BEFORE PRODUCTION**
1. Close SWP-001 (phone-login takeover) — the single most urgent fix in this report.
2. Close SWP-002/SWP-003 (mocked/bypassable OTP) — provider registration and the production `OTP_DEV_MODE` flag.
3. Make `identity-documents` and `payment-proofs` buckets private (SWP-004) and move their consuming screens to signed URLs.
4. Definitively resolve SWP-007 (the two possible super-admin escalation paths) via the SQL in §17 — fix if still open.
5. Restrict `bookings` UPDATE RLS to a real column allowlist and add a status-transition-validating trigger (SWP-005).
6. Add server-side price recalculation at booking creation (SWP-006).
7. Fix the client-asserted verification flags on the profile-edit path (SWP-012).
8. Apply the already-written, already-tracked migration for `provider_company_payment_submissions` (SWP-010) — this one is nearly free.

**SHOULD FIX**
- Registration rollback/cleanup on partial failure (SWP-008).
- Real customer chat, or remove the fake one (SWP-011).
- Customer-initiated cancellation endpoint (SWP-013).
- Device-token cleanup on logout (SWP-014).
- Admin-settlement-approved notification to the provider (SWP-015).
- Reconcile the two "booking completed" recipient sets (SWP-016).
- Remove or wire the two dead Stripe routes and the booking-complete route (SWP-017), or delete them if truly abandoned.
- Backfill migration files for the ~25 untracked tables (SWP-020).
- Pick one canonical review table and one canonical provider-verification source of truth (SWP-018/SWP-019).

**NICE TO HAVE**
- Fix the full-list-refetch performance pattern on both apps (SWP-022).
- Remove dead widget files and orphaned routes (§7).
- Add CHECK constraints for ratings/non-negative money columns (SWP-027).
- Replace mocked customer-app UI elements (wallet, categories, notifications, coupons) with real data or clearly-labeled placeholders (SWP-028).
- Consolidate duplicate indexes/triggers/admin-check functions (SWP-029, §7).
- Adopt Supabase Realtime for booking status and chat (§19).

## 25. Recommended Implementation Order

Sequenced to close the worst security exposure first, without breaking any currently-working flow:

1. **Storage bucket privacy** (SWP-004) — a Storage-dashboard flag flip plus a handful of screens moving to signed URLs. Self-contained, no other flow depends on the bucket being public.
2. **Phone-login takeover fix** (SWP-001) — rewrite both routes to require a real OTP challenge before issuing credentials. Test both apps' login flow immediately after.
3. **Provider registration OTP** (SWP-002) — swap to `RealOtpService`, remove the hardcoded server-side check. Test the full registration wizard end to end.
4. **`OTP_DEV_MODE` off in production** (SWP-003) — requires a real SMS provider to be configured first (Twilio env vars), or registration/verification break for everyone. Do this together with step 3, not before it.
5. **Confirm/fix SWP-007** — run the read-only SQL in §17 first; only write a fix if still needed.
6. **`bookings` column-restricted RLS + transition-validating trigger** (SWP-005) — design carefully against the real state machine (40+ columns, many legitimate transitions) before applying; test every booking-status action in both apps afterward.
7. **Apply the existing `provider_company_payment_submissions` migration** (SWP-010) — cheap, and unblocks the provider settlement UI immediately.
8. **Server-side price recalculation** (SWP-006) and **client-asserted verification flags** (SWP-012) — both touch trusted-client-input patterns; test booking creation and profile verification screens afterward.
9. Everything in "SHOULD FIX," each independently shippable.
10. "NICE TO HAVE" cleanup, whenever convenient.

## 26. Regression Test Checklist

Test the three surfaces together as one system, in this order, after each phase above:

**Registration & login**
1. Register a new customer with a real phone number — confirm a real OTP is required (not `123456`) once SWP-002/003 are fixed.
2. Register a new provider the same way — confirm the same.
3. Attempt phone login for an existing account — confirm it now requires a real OTP and no longer returns a password in the response.
4. Log in on Device A, then a different account on Device A — confirm (post SWP-014 fix) Device A stops receiving Account 1's notifications.

**Booking lifecycle — do all of this with two phones (customer + provider) and the admin panel open simultaneously**
5. Customer creates a booking → provider phone receives a push within seconds.
6. Provider opens the booking → admin panel shows it immediately (manual refresh, no realtime).
7. Provider accepts → customer phone receives a push; customer screen reflects "Accepted" on next refresh; admin timeline updates.
8. Provider marks on-the-way → arrived → work finished — confirm a push at each step, confirm the final-amount push includes the real amount.
9. Customer attaches payment proof and marks cash paid → provider phone receives a push; admin can see the proof image.
10. Provider marks payment received → customer phone receives a push (confirm content isn't blank/generic where it shouldn't be).
11. Confirm booking reaches `completed` — confirm both the customer and provider apps' timelines agree it's done, and check which recipients got notified (compare against SWP-016).
12. Customer submits a review → provider phone receives a push with the review; provider's average rating updates (confirm it does NOT silently fail per SWP-018 — check the specific table it landed in if possible).
13. Provider submits a review of the customer → customer phone receives a push.
14. Attempt a customer-side cancellation — confirm whether it now exists (SWP-013) or is still missing.
15. Provider submits a company-payment settlement slip → confirm it now appears in the provider's own settlement history (post SWP-010 fix) instead of permanently empty.
16. Admin marks the settlement received → confirm the provider now receives a push (post SWP-015 fix).
17. Admin approves a provider's KYC/identity documents → provider phone receives a push; provider app reflects verified status.
18. Admin disables/pauses a provider → provider app reflects the disabled state on next login (already fixed and confirmed earlier this project).

**Security spot-checks (do these against a disposable test account only)**
19. Attempt the old phone-login call directly (curl/Postman) post-fix — confirm it now fails without a valid OTP.
20. Fetch a known identity-document/payment-proof URL directly post-fix — confirm it's no longer publicly reachable.
21. Attempt a direct `PATCH` to `bookings` changing `booking_status` as a customer whose own booking it is, for a value outside the normal flow — confirm it's now rejected.

---

*This report was generated by tracing real code, running non-destructive checks (`flutter analyze`, `tsc --noEmit`, live read-only Supabase queries via a temporary, since-deleted script using existing anon/service-role keys), and incorporating three pre-existing audit documents already present in this repository. No fixes were applied. No data was changed. No migration was run. No RLS or storage policy was altered.*
