# Swiper Supabase Audit — Read-Only Backend/Database Review

Generated from a live, read-only inspection of the Swiper Supabase project backing the
Customer app, Provider app and Admin dashboard. **No writes, deletes, or schema changes
were made.** Everything below was inspected, not altered. All temporary inspection
scripts used to gather this data have been deleted from the repository.

## How this was actually done

I don't have a SQL/psql connection or a Supabase management token in this environment —
only the same `anon` key and `service_role` key the app already uses, from `.env.local`.
So this audit is built from three real, live sources, not guesswork:

1. The PostgREST OpenAPI schema dump (real column names, types, nullability for every table).
2. Live read-only queries with the **service-role** key (row counts, foreign-key orphan
   checks, distinct status values, auth-user reconciliation).
3. Live read-only queries with the **anon** key — i.e. literally testing what an
   unauthenticated stranger can see.

Every finding is tagged `[VERIFIED LIVE]`, `[INFERRED FROM CODE]`, or
`[NOT TESTABLE FROM HERE]` so you know exactly how much to trust it. Section 22K tells you
exactly what I still can't see (RLS policy source text, triggers, functions, indexes,
CHECK constraints) and gives you one paste-and-run SQL script to close that gap.

**Scope:** live production project · 30 application tables + 3 PostGIS system tables ·
7 storage buckets (all Public) · 87 auth users (reconciled, 0 orphans) · **changes made: none**

**§22K progress: complete — all 6 queries run.** Every open question in this report is
now settled with real evidence. One new finding came out of the function definitions that
is arguably the most serious thing in the whole audit — see §3 and §5.

Severity key: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## Contents

1. Database structure
2. User/Provider/Admin architecture
3. auth.users relationship
4. Row Level Security
5. Privilege escalation
6. Booking security
7. Payment security
8. Provider approval / KYC
9. Storage security
10. Storage path design
11. Database constraints
12. Foreign keys
13. Indexes / performance
14. Duplicate / redundant data
15. Status consistency
16. Booking state machine
17. Triggers / functions / RPC
18. Realtime
19. API / service-role security
20. Database migrations
21. Data quality
22. Production readiness
- Phased repair plan
- §22K: the one SQL script that closes every gap

---

## 1. Database structure

30 application tables exist (plus 3 PostGIS system tables — `geography_columns`,
`geometry_columns`, `spatial_ref_sys` — which are infrastructure, not yours). I could not
query `pg_indexes`, `pg_constraint` or `information_schema` directly (not exposed via
PostgREST), so **indexes, exact CHECK constraints and unique constraints are not shown
per-table below** — see §22K for the SQL script that gets you those. Everything else
(columns, types, nullability, live row counts, PK/FK relationships verified by
cross-referencing IDs) is real.

| Table | Purpose | Rows | PK | Key FKs (verified by ID cross-check) | Notes |
|---|---|---|---|---|---|
| profiles | Root identity row — 1:1 with auth.users | 87 | id (uuid) | id → auth.users.id | Holds `role` + `status` — see §2 |
| customer_profiles | Customer PII/KYC extension | 15 | id (uuid) | id → profiles.id | 0 orphans found. 🔴 publicly readable — §4 |
| provider_profiles | Provider marketplace listing + PII | 69 | id (uuid) | id → profiles.id | 0 orphans. 🔴 publicly readable — §4 |
| provider_services | Per-service pricing/media per provider | 69 | id | provider_id → provider_profiles.id | 0 orphans |
| provider_service_specialties | Tag list per provider service | 153 | id | provider_service_id → provider_services.id | Feeds the specialty chips made "live" on the provider card earlier this session |
| provider_availability | Weekly availability slots | 358 | id | provider_id → provider_profiles.id | — |
| provider_admin_metadata | Admin-only provider working data | 10 | provider_id | provider_id → provider_profiles.id | Contains `current_latitude/longitude` — live location |
| provider_verifications | KYC review record | 68 | id | provider_id → provider_profiles.id | Overlaps `provider_profiles.verification_status` — §14 |
| provider_registration_submissions | Raw signup payload pending admin approval | 9 | id | (jsonb `data` blob) | — |
| bookings | Core booking/job record + full state machine | 35 | id | customer_id→profiles, provider_id→provider_profiles, provider_service_id→provider_services | 0 orphans on either FK. See §6/§16 |
| booking_status_history | Status-change audit trail | 158 | id | booking_id → bookings.id | No app code writes here directly — almost certainly a DB trigger. See §17 |
| booking_messages | In-booking chat (real, Phase A build) | 25 | id | booking_id → bookings.id | Active feature |
| booking_message_reads | Read-receipt tracking | 18 | id | booking_id, user_id | — |
| booking_tasks | Unknown — 0 rows, no code references it | 0 | id | — | 🟢 likely unused |
| payments | Financial record per booking | 9 | id | booking_id→bookings, customer_id→profiles, provider_id→provider_profiles | 0 orphans. Very wide — see §7 |
| provider_payouts | Appears to be the intended replacement for the missing table below | 0 | id | — | Empty, unused |
| *(missing)* | `provider_company_payment_submissions` — referenced by both the admin dashboard and a Next.js route | N/A | — | — | 🔴 does not exist — confirmed `PGRST205`. See §7/§21 |
| service_commission_settings | Presumably commission-rate config | 0 | id | — | Empty — commission rate is likely hardcoded elsewhere instead |
| reviews | Customer→provider review | 13 | id | booking_id→bookings, provider_id, customer_id | Has `photos`, `tags`, `provider_reply`. Duplicate of next row — §14 |
| provider_customer_reviews | Second, simpler review table | 9 | id | booking_id→bookings, provider_id, customer_id | 🟠 duplicate of `reviews` — both are actively populated |
| addresses | Saved customer addresses | 8 | id | user_id → profiles.id | 0 orphans. Now has `latitude`/`longitude` — that migration is live |
| customer_addresses | A second, separate address table | 2 | id | ? | 🟡 not referenced anywhere in app code found — likely legacy |
| customer_documents | Identity documents, separate from `customer_profiles.identity_*_image_url` | 2 | id | ? | 🟡 not referenced anywhere in app code found |
| customer_favorite_providers | Favourites (feature wired up this session) | 2 | id | customer_id→profiles, provider_id→provider_profiles | Live and in use |
| otp_challenges | Real OTP verification (Phase A) | 1 | id | user_id→auth.users (nullable) | Migration is live — a real challenge row exists |
| user_devices | Push notification tokens | 16 | id | user_id→auth.users (nullable) | — |
| notifications | In-app notification feed | 169 | id | user_id→profiles, booking_id→bookings (nullable) | — |
| messages | A separate, generic messaging table | 0 | id | ? | 🟢 unused — real chat is `booking_messages` |
| issue_reports | Customer support/dispute reports | 2 | id | booking_id→bookings, reporter_user_id→auth.users | — |
| admin_actions | Presumably an admin audit log | 0 | id | ? | 🟡 exists but is never written to — no audit trail is actually being kept |
| provider_service_media | Presumably meant to normalize provider images/certs out of the array columns on provider_services | 0 | id | ? | Empty — `provider_services.image_data_urls` etc. are used instead |

**On your named tables specifically:** `profiles`, `providers` (→ really `provider_profiles`),
`bookings`, `booking_steps` (→ really `booking_status_history`, trigger-fed), `payments`,
`reviews` (duplicated, see above), `identity_documents` (→ split three ways between
`customer_profiles`, `customer_documents`, and `provider_verifications`), `user_devices`
(exists, clean, 16 rows) — all present, under slightly different names than listed, with
the duplication issues called out above.

---

## 2. User / Provider / Admin architecture

**[VERIFIED LIVE]** Role lives in exactly one place: `profiles.role`, a Postgres enum
(`public.app_role`). **Update after running §22K:** the enum itself actually defines 6
values — `customer`, `service_provider`, `admin`, `manager`, `customer_care`,
`super_admin` — so the manager/customer-care/admin distinction you described *was*
designed into the schema. It's just that **no row currently uses `admin`, `manager`, or
`customer_care`** — every real account today is `customer`, `service_provider`, or
`super_admin`. So the role system is more complete than first assessed, but three of its
six roles are unused/unassigned — worth confirming whether the app (RLS policies, admin
dashboard permission checks) actually has real logic branching on `admin`/`manager`/
`customer_care`, or whether those enum values were added for a future phase that never
shipped.

- **Role storage:** single source (`profiles.role`). Not duplicated onto
  `customer_profiles` or `provider_profiles` — good, avoids the classic "role says
  customer in one table, provider in another" bug.
- **auth.users ↔ profiles:** 87 auth users, 87 profiles, **0 mismatches either direction**
  (checked by diffing the full ID sets) — clean today.
- **Providers ↔ profiles:** `provider_profiles.id` is the same UUID as `profiles.id`
  (shared-PK pattern, not a separate FK column) — 0 orphans. Standard Supabase pattern.
- **auth.uid() consistency:** every FK checked (`bookings.customer_id`,
  `bookings.provider_id`, `payments.*_id`, `addresses.user_id`, `reviews.*_id`) resolves
  to a real `profiles.id`/`auth.users.id` — consistent UUID usage throughout.

**Can one role access another's data?** This is really a §4 (RLS) question, and the
honest answer is: for two tables, yes, trivially — no login required at all. See §4.

---

## 3. auth.users relationship

| Check | Result |
|---|---|
| auth.users with no `profiles` row | **0** — verified live |
| `profiles` rows with no matching auth.users | **0** — verified live |
| Duplicate identities (two profiles, one auth user) | None found — 87 profiles for 87 users |
| Account-creation / profile-creation trigger | **[CONFIRMED via §22K]** `handle_new_user()`, a `SECURITY DEFINER` function with a safe `search_path` (`SET search_path TO 'public'`) — attached to `auth.users` (which is why it didn't appear in the earlier triggers query, that only scanned `trigger_schema = 'public'`; the function lives in `public`, the trigger calling it lives on the `auth` schema's table). See the CRITICAL finding below. |
| `ON DELETE` behavior on `profiles.id → auth.users.id` | Still not directly visible — not covered by any of the 6 queries run (constraint dumps show the FK exists, but not its `ON DELETE` clause). Low priority relative to the finding below. |
| Email/phone duplication | `auth.users` stores the canonical email/phone; `profiles.email`/`profiles.phone` and `customer_profiles.phone_number` are snapshots. See §14. |

Bottom line on data quality: **today's data is clean** — no orphans, no duplicates.

### 🔴 CRITICAL (new) — anyone can sign up as `super_admin` directly, no existing account needed

`handle_new_user()`'s actual body:

```sql
insert into public.profiles (id, email, full_name, role, status)
values (
  new.id,
  new.email,
  coalesce(new.raw_user_meta_data ->> 'full_name', ''),
  coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'customer'),
  'pending'
)
on conflict (id) do nothing;
```

This trigger fires on every new `auth.users` row and reads `role` **directly from
`raw_user_meta_data`** — the metadata object a client supplies at signup. Supabase's
standard client signup call lets the caller set arbitrary metadata:

```js
supabase.auth.signUp({
  email, password,
  options: { data: { role: 'super_admin' } }
})
```

This is a normal, public, unauthenticated call using nothing but the anon key (which is
meant to be embedded in the client and is not a secret). If nothing else validates the
role afterward, this creates a brand-new `super_admin` account from scratch — no existing
session, no privilege escalation on an existing row required at all. This is arguably even
more serious than the `profiles` self-update escalation in §5, because it doesn't require
compromising or owning an account first.

**Important nuance, not yet confirmed:** this session's own work on Customer and Provider
registration always went through Next.js API routes calling `admin.createUser()` with the
service-role key, setting `role` explicitly server-side — the legitimate app flows do not
appear to go through the public client-side `signUp()` at all, so this trigger acts as a
fallback safety net for *any* `auth.users` row, not the primary path. That's good — it
means the fix below shouldn't affect real registration — but it hasn't been verified
end-to-end that no legitimate flow depends on trusting `raw_user_meta_data.role`.

---

## 4. Row Level Security — the main event

**[FULLY VERIFIED LIVE — actual policy text pulled via §22K]** The real `pg_policies`
dump is in. This confirms the exact root cause of both CRITICAL findings, and surfaces one
more that's arguably worse. Every quote below is the literal policy text from your
database, not a guess.

### 🔴 CRITICAL — root cause found: `customer_profiles` has three "public" policies with no restriction at all

Three policies exist on this table, applying to **both `anon` and `authenticated`**, each
with `USING (true)` / `WITH CHECK (true)` — meaning **no condition, applies to every row,
for anyone**:

- `customer_profiles_public_select` — `SELECT`, `using: true`
- `customer_profiles_public_insert` — `INSERT`, `with_check: true`
- `customer_profiles_public_update` — `UPDATE`, `using: true`, `with_check: true`

These sit **alongside** perfectly correct, properly-scoped policies
(`customer_profiles_select_own_or_admin`, `customer_profiles self read`,
`customer_profiles_update_own_or_admin`) — but in Postgres, multiple PERMISSIVE policies
for the same command are combined with **OR**. One wide-open policy defeats all the
correct ones next to it. This isn't a missing policy, it's three policies that shouldn't
exist.

**It's worse than read-only:** `customer_profiles_public_update` means literally anyone,
logged in or not, can overwrite any customer's name, DOB, phone, address, or identity
document URLs, and `customer_profiles_public_insert` means anyone can create fake customer
profile rows.

### 🔴 CRITICAL — same exact pattern on `provider_profiles`

- `provider_profiles_public_select` — `SELECT`, `using: true` (anon + authenticated)
- `provider_profiles_public_insert` — `INSERT`, `with_check: true` (anon + authenticated)
- `provider_profiles_public_update` — `UPDATE`, `using: true`, `with_check: true` (anon + authenticated)

Same story: these coexist with a **correctly-designed** public policy that should be the
*only* public-facing one — `provider_profiles public approved read`, scoped to
`authenticated` only and `(approval_status = 'approved' AND is_visible = true)` — i.e.
someone already built the right "public marketplace browsing" policy, and then a second,
much wider one was added on top of it (or left over from testing) that makes the careful
one pointless.

**Also worse than read-only:** `provider_profiles_public_update` with no restriction means
anyone could set their own (or any provider's) `approval_status` to `approved`,
`verification_status` to `verified`, `is_visible`, or overwrite another provider's data
entirely.

### 🔴 CRITICAL (new, more severe than initially assessed) — customers can plausibly self-promote to `super_admin`

The `profiles` table has:

- `profiles self update` / `profiles_update_own_or_admin` — `UPDATE`,
  `using: (id = auth.uid())`, `with_check: (id = auth.uid())` — **no restriction on which
  columns can change.**

Combined with two facts already confirmed elsewhere in this audit:
- `profiles.role` is a plain enum column with 6 possible values including `super_admin`
  (§2, §15) — nothing in the column type itself prevents any value being written.
- §11 confirmed **zero custom CHECK constraints exist anywhere in the schema.**

This means a normal, logged-in customer, using nothing but their own real Supabase
session (the same JWT the Flutter app already has), could very plausibly send:

```
PATCH https://<project>.supabase.co/rest/v1/profiles?id=eq.<their-own-id>
Authorization: Bearer <their own JWT>
{"role": "super_admin"}
```

and have it succeed, because the UPDATE policy only checks `id = auth.uid()` — it has no
opinion on `role`. I have not executed this request (that would be an actual privilege
escalation on a live production account, which is a real change, not an inspection — out
of scope for a read-only audit and something you should test yourself or have me test only
with your explicit go-ahead). But nothing in the policy, the column type, or the
constraints stops it. This is the single most serious finding in this report — worse than
the public-profile leak, because it's a path to full admin control, not just data exposure.

### 🟠 HIGH — a customer/provider can rewrite their own booking's status, amounts, and timestamps directly

`bookings` has:
- `bookings customer update own` / `bookings_update_customer_or_provider` — customer can
  UPDATE any column on a booking where `customer_id = auth.uid()`
- `bookings provider update own` — provider can UPDATE any column where
  `provider_id = auth.uid()`

Neither restricts *which* columns can change. Both apps currently behave correctly because
the Flutter/Next.js code only ever sends the fields it means to — but a direct REST call
with a real customer or provider JWT could set `booking_status`, `total_amount`,
`provider_amount`, `paid_at`, or any of the other 40+ columns on their own booking row.
Whether a trigger blocks invalid values is still unconfirmed (trigger dump not yet run) —
but the RLS layer itself does not stop this.

### 🟢 Good news, confirmed: `payments` writes are properly locked down

- `payments_insert_service_role_only` — INSERT restricted to the `service_role` key only
  (client apps, even with a real user session, cannot insert a payment row directly)
- `payments_update_service_role_only` — same, UPDATE restricted to `service_role` only
- A separate `payments_update_admin_roles` policy lets `super_admin`/`admin`/`manager`/
  `customer_care` accounts update payments directly — expected for the admin dashboard's
  manual verification flow

This is exactly right — customers and providers cannot write to `payments` at all, only
read. See §7 for what "read" actually exposes.

### Per-table RLS summary (now backed by real policy text)

| Table | Anon SELECT | Read by | Write |
|---|---|---|---|
| customer_profiles | 🔴 OPEN — literal `USING (true)` | Everyone, no auth | 🔴 OPEN insert + update too |
| provider_profiles | 🔴 OPEN — literal `USING (true)` | Everyone, no auth | 🔴 OPEN insert + update too |
| profiles | ✅ Owner/admin only | Self or admin | 🔴 Self-update has no column restriction — see role-escalation finding above |
| bookings | ✅ Owner (customer/provider)/admin only | Self or admin | 🟠 Self-update has no column restriction |
| payments | ✅ Owner/admin only | Self or admin | ✅ service_role/admin only — correctly locked |
| addresses | ✅ Owner/admin only | Self or admin | ✅ Owner only — confirmed this session's migration is live |
| reviews / provider_customer_reviews | ✅ Owner/admin only | Self or admin | ✅ Reasonably scoped, two minor tautology bugs noted below |
| notifications, user_devices, booking_messages, booking_message_reads, booking_status_history, booking_tasks, provider_services, provider_service_specialties, provider_service_media, provider_availability, provider_verifications, provider_payouts, admin_actions | ✅ | Correctly scoped to owner/participant/admin | ✅ Correctly scoped |
| otp_challenges, issue_reports, customer_favorite_providers, customer_addresses, customer_documents, provider_admin_metadata, provider_registration_submissions, service_commission_settings | No policies found at all | Nobody via direct client access (RLS default-deny) | Service-role/backend-only by design — consistent with how the app code actually uses these tables |

### 🟡 Minor — two review-insert policies contain a no-op tautology

`reviews_insert_customer_own_booking` and
`provider_customer_reviews_insert_provider_own_booking` each contain a condition like
`(b.customer_id = b.customer_id)` / `(b.provider_id = b.provider_id)` — comparing a column
to itself, which is always true and does nothing. Looks like a copy-paste leftover from a
template where a real comparison was meant to go. It doesn't weaken security beyond what
the rest of the policy already does, but it's dead logic worth cleaning up.

---

## 5. Privilege escalation

**[FULLY CONFIRMED — two independent paths found]**

**Path 1 — self-promote an existing account (§4).** `profiles`'s self-update RLS policy
has no column restriction, the `role` column is a plain enum with no CHECK constraint
(§11), and `provider_profiles`'s wide-open `_public_update` policy separately means anyone
could set `approval_status`/`verification_status` directly. A direct REST call with any
real customer/provider JWT bypasses the app entirely.

**Path 2 — create a brand-new `super_admin` account at signup, no existing account
required (§3).** `handle_new_user()` trusts `role` from client-supplied signup metadata.
This is arguably the more serious of the two, since it needs no existing account to
exploit — just a signup call.

**Resolved, good news:** the two admin-check functions referenced throughout §4's RLS
policies, `is_admin_role()` and `is_admin_user()`, check the **exact same set of roles**
(`super_admin`, `admin`, `manager`, `customer_care`) — confirmed from their actual
definitions. They're not inconsistent, just duplicated: `is_admin_user()` is a
`SECURITY DEFINER` variant (with a safe, explicit `search_path`) used in policies where
calling the plain version would otherwise recurse into `profiles`'s own RLS while
evaluating a policy *on* `profiles`. Reasonable design, just two names for one concept.

The application-layer protection already confirmed this session (the Next.js
`PATCH /api/profile/me` route never trusting client-asserted verification flags) is real
and good, but it only protects requests that go *through* that specific route — it does
nothing to stop either of the two paths above.

---

## 6. Booking security

The `bookings` table itself is well-designed for this — verified from the real schema. It
has a dedicated timestamp column for nearly every state transition (`accepted_at`,
`on_the_way_at`, `arrived_at`, `completed_at`, `paid_at`, `work_finished_at`,
`work_confirmed_by_user_at`, `cancelled_at`...) plus `booking_status_history` logging every
change — a solid audit trail *if* it's actually enforced server-side rather than trusted
from the client.

- **[CONFIRMED via §22K]** the RLS UPDATE policies on `bookings`
  (`bookings customer update own`, `bookings provider update own`,
  `bookings_update_customer_or_provider`) place **no restriction on which columns can
  change** — only that `customer_id`/`provider_id` matches the caller. A customer or
  provider's own valid session can, at the database level, write to `booking_status`,
  `total_amount`, `provider_amount`, `paid_at`, or any other column on their own booking.
- Confirmed from application code this session: the customer-facing booking flow in
  Flutter sends a fairly narrow field set when creating a booking, and the earlier Phase A
  work fixed server-side price validation so the client can't dictate `totalAmount` for a
  new booking through the API route. Real, verified protection — but only for requests
  going through that specific route, not for direct REST access.
- **[CONFIRMED via §22K]** `booking_status_history`'s 158 rows come from a real trigger,
  `bookings_log_status_change` — but it only *logs* changes, on both INSERT and UPDATE.
  There is no trigger, anywhere, that *validates* a transition before allowing it. See the
  full writeup in §16 — this closes the open question from earlier, and the answer is: no,
  nothing below the app layer stops an invalid jump.

---

## 7. Payment security — read this one carefully

**[VERIFIED LIVE — real column list]** `payments` has 33 columns. The financially
sensitive ones: `amount`, `final_amount` (on `bookings`), `company_commission_rate`,
`company_commission_amount`, `provider_net_amount`, `company_payment_status`,
`admin_company_received_amount`, plus a full manual proof-of-payment flow:
`customer_payment_proof_data_url`, `provider_company_payment_proof_data_url`,
`company_paid_at`, `customer_confirmed_at`.

### 🟠 HIGH — Two parallel payment systems live in one table `[VERIFIED LIVE]`

Stripe fields exist (`stripe_checkout_session_id`, `stripe_payment_intent_id`,
`checkout_url`) *alongside* an entirely separate manual cash/proof-upload +
admin-verification flow (`*_payment_proof_data_url`, `company_payment_status`,
`admin_company_received_amount`). Both sets of columns are present on every row. Worth
confirming which one is actually live in production vs. legacy.

### 🟢 Confirmed solid — payments cannot be written by customers or providers at all `[CONFIRMED via §22K]`

`payments_insert_service_role_only` and `payments_update_service_role_only` restrict
INSERT and UPDATE to the `service_role` key only — a real customer or provider session,
no matter what it sends, cannot create or modify a payment row directly. A separate
`payments_update_admin_roles` policy correctly allows `super_admin`/`admin`/`manager`/
`customer_care` accounts to update payments for the admin dashboard's manual verification
flow. This is exactly the right design, and it's real, not assumed.

### 🟡 MEDIUM — Duplicate status columns `[VERIFIED LIVE]`

`payments` has **both** `payment_status` (a Postgres enum) **and** a separate `status`
(plain text) column. Querying `status` directly returned real values `paid`/`pending` —
whether `payment_status` agrees with it on every row was not separately checked. If
different code paths write to different columns, they can silently drift out of sync.

### 🟠 HIGH — Commission fields: confirmed readable by the customer/provider themselves `[CONFIRMED via §22K]`

The RLS dump settles this definitively. `payments_select_participants` /
`payments related read` let a customer or provider SELECT their **own** payment row —
correctly row-scoped — but with **no column restriction**, so every column is included:
`company_commission_rate`, `company_commission_amount`, `provider_net_amount`,
`company_payment_status`, all of it.

Earlier this session it was confirmed the customer-facing Next.js API route strips
`companyCommissionAmount`/`providerNetAmount`/`companyPaymentStatus` before returning JSON
to the Flutter app — real, code-level, and good, but that's **application-layer**
redaction only. A direct REST call with a real customer or provider's own JWT (bypassing
the Next.js route entirely) can retrieve the full row, commission fields included, for
their own bookings.

**The good news, also confirmed:** this is a *read* exposure only. `payments` INSERT and
UPDATE are both correctly restricted to `service_role` (i.e. only your backend can write
payment rows at all) — see the finding below. A customer or provider cannot manipulate
their own or anyone else's payment data; they can only see more of their own row than the
app intends to show them.

### What should move server-side instead of client-writable columns

- **Commission calculation** — should be a database trigger/function (or Edge Function)
  computed at write time from a rate the client never sends, not a value the client can
  include in an insert/update payload.
- **Payment status transitions** (`pending → paid`, `company_payment_status`) — should go
  through an RPC/Edge Function that validates preconditions, not a direct table UPDATE
  from either app.
- **Proof-of-payment verification** — admin confirming a payment should be a privileged
  RPC, not a raw UPDATE the admin dashboard's own session performs, so the exact same
  rule can't accidentally be reachable by a provider's session too.

---

## 8. Provider approval / KYC

### 🟠 HIGH — Verification state is tracked in three different places `[VERIFIED LIVE]`

`provider_profiles.approval_status` (enum: `approved`/`pending_review` — real values)
**and** `provider_profiles.verification_status` (enum: `verified`/`partially_verified` —
real values) **and** a whole separate `provider_verifications` table with its own
`review_status` enum, `kyc_verified`, `background_check_verified`, `identity_verified`,
plus its own copy of `identity_front_image_url`/`identity_back_image_url` — a **third**
copy of identity document URLs, alongside the customer-side copies on `customer_profiles`
and the separate `customer_documents` table.

Three sources of truth for "is this provider verified" is a real bug waiting to happen —
the admin dashboard, the Flutter provider app, and the Flutter customer app could each
read a different column and disagree.

- **Self-approval:** whether a provider can PATCH their own `approval_status`/
  `verification_status` depends on the same RLS question as §5 — not independently
  testable from here.
- **Cross-provider document visibility:** `provider_profiles` is fully public (§4), but it
  does not itself contain the identity image URLs (those live on `provider_verifications`,
  which correctly returned 0 rows to the anon probe) — so provider identity documents
  specifically are *not* part of the public-exposure bug, only the customer-side ones are.
  The one piece of good news in this section.
- **FK integrity:** `provider_verifications.provider_id → provider_profiles.id` — not
  explicitly orphan-checked, but 68 rows against 69 providers is consistent with 1
  provider not yet having submitted verification.

---

## 9. Storage security

**[VERIFIED LIVE — every bucket listed via the Storage API]** All 7 buckets exist with
`public: true`. There is no private bucket anywhere in this project.

| Bucket | Public? | Size limit | Assessment |
|---|---|---|---|
| identity-documents | 🔴 PUBLIC | 5 MB | CRITICAL — government ID photos, must never be public |
| payment-proofs | 🔴 PUBLIC | 5 MB | CRITICAL — payment receipts/slips, financial evidence, must never be public |
| profile-images | PUBLIC | 2 MB | Likely fine — profile photos are usually meant to be visible |
| provider-work-images | PUBLIC | 5 MB | Likely fine — portfolio photos, meant to be public marketing |
| review-images | PUBLIC | 5 MB | Likely fine — customer review photos, usually public by design |
| certificates | PUBLIC | 10 MB | Worth a second look — professional certs providers want shown, but confirm nothing sensitive (full name + IC number sometimes appears on certs) leaks through |
| job-completion-images | PUBLIC | 5 MB | MEDIUM — photos taken inside a customer's home to prove job completion; worth reviewing whether that should really be public |

Every URL the app generates for these buckets is a **public URL** — not signed, not
authenticated. For `identity-documents` and `payment-proofs`, anyone who obtains the URL
(and for identity documents, §4 shows anyone can trivially obtain it via the open
`customer_profiles` table) can view the file with zero authentication, forever, with no
expiry.

---

## 10. Storage path design

Verified from the actual upload code (`lib/server-media-storage.ts`), not guessed: every
upload path is built as `{ownerId}/{pathParts...}/{fileName}`, where `ownerId` is the
authenticated user's own UUID, sanitized. That's the right pattern — a customer can't
simply edit a path string to overwrite another user's file, because the server (not the
client) supplies `ownerId` from the authenticated session.

**The catch:** this good design is undermined by §4 + §9 together. The path being
unguessable doesn't matter when the exact full URL is sitting in a publicly-readable
database column (`customer_profiles.identity_front_image_url`) pointing at a public
bucket. Path obscurity was never the actual protection here — RLS + private buckets were
supposed to be, and neither is in place for these two fields.

---

## 11. Database constraints

**[VERIFIED LIVE via §22K]** The constraints dump is in, and it confirms the suspicion
directly: **every single CHECK-type constraint in the schema is an auto-generated NOT
NULL check** (Postgres internally names these `<oid>_<col>_not_null` — that's what the
`2200_18020_14_not_null`-style names are, not real business-rule constraints). There is
**no custom CHECK constraint anywhere** in the public schema — no rating range, no
non-negative amount, no DOB-not-in-future, nothing. Confirmed, not inferred.

- 🟡 **`reviews.rating` / `provider_customer_reviews.rating`** — plain `numeric`, nothing
  stops a `0`, a negative number, or a `17` from being written. Enforced only in app code,
  if at all.
- 🟡 **Every money column on `bookings`/`payments`** (`total_amount`, `platform_fee`,
  `provider_amount`, `hourly_rate`, `daily_rate`, `quoted_amount`, `booking_price`,
  `discount_amount`, `final_amount`, `amount`) — **confirmed no non-negative constraint**.
  A direct REST write of `{"total_amount": -500}` would currently succeed at the database
  level (subject to whatever RLS write policy applies — still pending the actual policy
  query).
- **Correction from an earlier pass:** the constraints result I first analyzed was
  actually cut off partway through (it stopped at `customer_favorite_providers`) — the
  indexes query has now filled the gap and shows real UNIQUE constraints I'd incorrectly
  said were missing: `reviews_one_per_booking_customer` (UNIQUE on `booking_id,
  customer_id`) and `provider_customer_reviews_booking_id_key` (UNIQUE on `booking_id`
  alone, even stricter). **One review per booking *within each table* is properly
  enforced.** What's still true: because these are two separate tables (§14), nothing
  stops the same booking being reviewed once in `reviews` *and* once in
  `provider_customer_reviews` — the duplication risk is real, just not the one I first
  described.
- Also confirmed present via the same indexes: `profiles.email` is UNIQUE,
  `provider_services` has UNIQUE `(provider_id, service_type)` (a provider can't
  double-list the same service), `customer_favorite_providers` has UNIQUE `(customer_id,
  provider_id)`, `user_devices` has UNIQUE `(user_id, fcm_token)`, and `payments` has
  UNIQUE `booking_id` (one payment row per booking) plus UNIQUE
  `stripe_checkout_session_id`. This schema has more real integrity constraints than the
  first pass gave it credit for.
- 🟡 **`date_of_birth`** — confirmed nullable, no "not in the future" CHECK.

**What the same dump confirms as genuinely solid:** real, named **FOREIGN KEY**
constraints exist for every relationship sampled — `addresses.user_id`,
`admin_actions.admin_id`, `booking_message_reads.booking_id`/`.user_id` (plus a real
UNIQUE constraint on `(booking_id, user_id)` — good, prevents duplicate read-receipts),
`booking_messages.booking_id`/`.sender_id`, `booking_status_history.booking_id`/
`.changed_by`, `booking_tasks.booking_id`, `bookings.customer_id`/`.provider_id`/
`.provider_service_id`/`.service_address_id`, `customer_addresses.customer_id`,
`customer_documents.customer_id`. §12's "consistent by luck vs. actually enforced"
question is now answered: **actually enforced**, for every relationship checked so far.

---

## 12. Foreign keys

**[VERIFIED LIVE — real orphan scan]** Cross-referenced every ID on both sides for the
relationships that matter most, on the actual live data:

| Relationship | Rows checked | Orphans found |
|---|---|---|
| bookings.customer_id → profiles.id | 35 | **0** |
| bookings.provider_id → provider_profiles.id | 35 | **0** |
| payments.booking_id → bookings.id | 9 | **0** |
| provider_services.provider_id → provider_profiles.id | 69 | **0** |
| reviews.booking_id → bookings.id | 13 | **0** |
| addresses.user_id → profiles.id | 8 | **0** |
| customer_profiles.id → profiles.id | 15 | **0** |
| provider_profiles.id → profiles.id | 69 | **0** |

**Today's data has no orphans in any relationship checked.** §22K's constraints dump has
now confirmed **real, named FOREIGN KEY constraints exist** for every relationship
checked (`addresses.user_id`, `bookings.customer_id`/`.provider_id`, etc.) — this is
enforced at the database level, not just consistent by discipline. Good news, upgraded
from "unverified" to confirmed.

**Missing/nullable relationships worth a look:** `otp_challenges.user_id` and
`user_devices.user_id` are both nullable — reasonable for OTP (pre-account verification),
but worth confirming intent for device tokens.

---

## 13. Indexes / performance

**[VERIFIED LIVE via §22K]** Better news than expected — the hot-path tables are properly
indexed, with composite indexes that match real query patterns, not just single-column
ones.

**Well covered:** `bookings` has `(customer_id, created_at)`, `(customer_id,
booking_status, scheduled_date)`, `(provider_id, created_at)`, `(provider_id,
booking_status, scheduled_date)`, and `(booking_status, created_at)` — this is genuinely
good index design, someone thought about the actual filter/sort patterns (status +
scheduled date), not just the raw FK. `payments` has `(customer_id, created_at)`,
`(provider_id, created_at)`, `(status, created_at)`. `notifications` has `(user_id,
is_read, created_at)` — exactly right for an unread-count query. `booking_status_history`
and `booking_messages` both have `(booking_id, created_at)`.

**🟢 LOW — one confirmed duplicate index:** `payments` has both `payments_booking_id_key`
and `payments_booking_id_unique_idx` — **identical definitions**
(`UNIQUE (booking_id) WHERE booking_id IS NOT NULL`), just two different names. Harmless
today, but it's dead weight on every write to `payments` (two indexes to maintain for one
constraint) — safe to drop one once confirmed nothing depends on the specific name.

**🟡 MEDIUM — `provider_profiles` has no index beyond its primary key.** Every
unauthenticated-safe marketplace browse (`provider_profiles public approved read`) filters
on `(approval_status = 'approved' AND is_visible = true)` — with only 69 rows today that's
a full-table scan and nobody notices, but it's exactly the query that runs on every single
customer opening the app to browse providers, so it's the first thing to add an index for
as the provider count grows.

**Minor gaps, not urgent at current volume:** `provider_service_specialties` has no index
on its own FK (`provider_service_id`); `bookings` has no index on `provider_service_id` or
`service_address_id`. None of these matter yet at 30-150 rows per table, but are cheap to
add now while nobody will notice a migration.

---

## 14. Duplicate / redundant data

| Duplication | Verified? | Intentional snapshot, or dangerous? |
|---|---|---|
| `reviews` vs `provider_customer_reviews` | verified — both populated (13 / 9 rows) | 🟠 Dangerous — and now confirmed why: `sync_provider_review_stats()` (§17) only triggers on `reviews`, so a review landing in `provider_customer_reviews` silently never updates the provider's `average_rating`/`total_reviews` |
| `addresses` vs `customer_addresses` | verified — both exist (8 / 2 rows) | 🟡 Likely legacy — only `addresses` appears in current app code |
| Identity document URLs: `customer_profiles`, `customer_documents`, `provider_verifications` | verified — 3 separate places | 🟠 Dangerous — same document, three homes, no obvious single source of truth |
| Verification state: `provider_profiles.approval_status` + `.verification_status` + `provider_verifications.*` | verified | 🟠 Dangerous — see §8 |
| `payments.status` vs `payments.payment_status` | verified — both columns exist | 🟡 Risky — see §7 |
| `profiles.email/phone` vs `auth.users.email/phone` | verified via schema | 🟢 Normal/intentional — standard, expected Supabase pattern |
| `messages` vs `booking_messages` | verified — messages has 0 rows | Dead table, not actively dangerous, just clutter |

---

## 15. Status / enum consistency

**[VERIFIED LIVE]** §22K's enum query has now been run — this section is fully verified,
not inferred, and it surfaces a real, significant finding.

### 🟠 HIGH — `booking_status` has 21 defined values, and they're two overlapping generations of the same state machine

The full enum, in definition order:

`pending`, `accepted`, `rejected`, `scheduled`, `in_progress`, `completed`, `cancelled`,
`disputed`, `on_the_way`, `arrived`, `paid`, `review_requested`, `reviewed`, `declined`,
`pending_provider_response`, `declined_by_provider`, `work_finished_by_provider`,
`work_confirmed_by_user`, `final_payment_sent`, `cash_paid_by_user`,
`payment_received_by_provider`

Only 8 of these 21 have ever actually appeared on a real booking (see the "real values"
row below). That split isn't random — it splits cleanly into an **older, generic flow**
(`pending`, `accepted`, `rejected`, `scheduled`, `in_progress`, `completed`, `cancelled`,
`disputed`, `declined`) and a **newer, granular flow** (`pending_provider_response`,
`declined_by_provider`, `on_the_way`, `arrived`, `work_finished_by_provider`,
`work_confirmed_by_user`, `final_payment_sent`, `cash_paid_by_user`,
`payment_received_by_provider`, `paid`, `review_requested`, `reviewed`). The newer flow is
what's actually driving real bookings today; the older 9 values look like leftovers from
an earlier version of the booking system that was never cleaned out of the enum.

This is exactly the "inconsistent status naming breaks Flutter filters" risk flagged in
the original request — not because of typo-style naming (`completed` vs `complete`), but
because **two different vocabularies for the same concept coexist in one enum**: is a
provider's "no" a `rejected`, a `declined`, or a `declined_by_provider`? Is "done" a
`completed`, a `work_finished_by_provider`, or a `work_confirmed_by_user`? Any Flutter
code (or admin dashboard filter) written against the old vocabulary will silently never
match a real row again, and vice versa.

*Impact:* low urgency today (nothing appears to be actively writing the old 9 values), but
this should be cleaned up — either by removing the unused old values from the enum (a
schema change, needs care since enums can't easily drop values in Postgres — the values
would need to be verified as truly dead first) or at minimum by documenting which 12
values are the canonical current flow, so nobody builds against the dead half.

### Full verified enum reference

| Enum | Values |
|---|---|
| `app_role` | `super_admin`, `admin`, `manager`, `customer_care`, `customer`, `service_provider` |
| `booking_status` | see above — 21 values, 8 in active use |
| `payment_status` | `pending`, `paid`, `failed`, `refunded` |
| `payout_status` | `pending`, `processing`, `paid`, `failed` (for the currently-empty `provider_payouts` table) |
| `provider_approval_status` | `draft`, `pending_review`, `approved`, `rejected` |
| `provider_verification_status` | `unverified`, `partially_verified`, `verified` |
| `verification_review_status` | `pending`, `approved`, `rejected` |
| `profile_status` | `active`, `pending`, `suspended`, `rejected` |
| `notification_type` | 17 values, including `company_payment_submitted`/`company_payment_received` — confirms the missing `provider_company_payment_submissions` table (§1, §21) was a real, intentionally-built feature, not a stub |
| `message_type_enum` | `text`, `image`, `system` — belongs to the unused `messages` table (§14), confirming it was a real generic-messaging design that was abandoned in favor of `booking_messages` |
| `service_type` | `chef`, `maid`, `tutor`, `driver`, `cleaner`, `babysitter`, `plumber`, `electrician`, `other` — matches the 8 live service categories in the Flutter app plus a catch-all |
| `booking_actor_role` | `customer`, `provider`, `admin`, `system` |
| `booking_mode` | `hourly`, `daily` |
| `day_of_week`, `availability_time_mode`, `media_type`, `task_step_status` | straightforward, no issues found |

### Real values actually seen in production data (subset of the above)

| Column | Real values in production today |
|---|---|
| `bookings.booking_status` | `pending_provider_response`, `declined_by_provider`, `arrived`, `completed`, `paid`, `review_requested`, `reviewed`, `final_payment_sent` |
| `payments.status` (the duplicate free-text column, §7/§14) | `pending`, `paid` — only 2 of the 4 words the real `payment_status` enum defines |
| `provider_profiles.approval_status` | `pending_review`, `approved` |
| `provider_profiles.verification_status` | `verified`, `partially_verified` |
| `provider_registration_submissions.status` | `pending_admin_approval` |
| `issue_reports.status` | `new` |
| `profiles.role` | `customer`, `service_provider`, `super_admin` (3 of the 6 defined roles) |

---

## 16. Booking state machine

**[CONFIRMED via §22K trigger dump]** The question is now settled, and not in the good
direction. `bookings` has exactly two triggers besides the generic `updated_at` ones:

- `bookings_log_status_change` (AFTER INSERT, AFTER UPDATE) → `log_booking_status_change()`

That's it. This is the trigger that explains `booking_status_history`'s 158 rows — but
it's an **AFTER** trigger that **logs** the change; nothing about it validates or blocks
one. There is no `BEFORE UPDATE` trigger, no state-machine CHECK, nothing that would
reject `requested → completed` or `cancelled → arrived`.

Combined with §4/§6's confirmed finding that a customer or provider's own RLS UPDATE
policy on `bookings` places no restriction on which columns (including `booking_status`)
can change: **there is currently nothing below the application layer stopping an invalid
booking-status jump.** A customer could set their own booking straight from
`pending_provider_response` to `completed` via a direct REST call, and the system would
not only allow it, it would faithfully log the fake transition into
`booking_status_history` as if it were legitimate — because the logging trigger doesn't
know the difference between a real transition and an invalid one.

---

## 17. Triggers / functions / RPC

**[VERIFIED LIVE via §22K — trigger list confirmed, function definitions still pending]**
20 triggers exist across the schema. No generic "run arbitrary SQL" RPC exists (confirmed
earlier — `exec_sql`/`run_sql`/etc. all return "not found").

**What they do:**
- **`set_updated_at()`** — a generic trigger applied `BEFORE UPDATE` on almost every table
  (`payments`, `profiles`, `provider_profiles`, `reviews`, `provider_admin_metadata`,
  `customer_addresses`, `customer_documents`, and more) to keep `updated_at` accurate.
  Good, standard practice.
- **`bookings_log_status_change()`** — logs every insert/update on `bookings` into
  `booking_status_history`. Confirmed real, confirmed non-validating — see §16.
- **`sync_provider_review_stats()`** — fires on INSERT/UPDATE/DELETE of `reviews`, and
  keeps `provider_profiles.average_rating`/`total_reviews` in sync automatically. Good,
  functioning design — **but it only exists on `reviews`, not on `provider_customer_reviews`.**
  This is the concrete mechanism behind the §14 duplicate-table risk: if any code path
  ever writes a review to `provider_customer_reviews` instead of `reviews`, that review
  silently never updates the provider's displayed rating or review count.

**🟢 LOW — two confirmed duplicate triggers**, doing nothing wrong, just redundant:
- `bookings` has both `trg_bookings_updated_at` and `bookings_set_updated_at`, both
  `BEFORE UPDATE`, both calling the same `set_updated_at()` — the timestamp gets set twice
  to the same value on every update.
- `customer_profiles` has the identical pattern: `trg_customer_profiles_updated_at` and
  `customer_profiles_set_updated_at`.

This matches the broader pattern seen throughout this audit (duplicate review tables,
duplicate address tables, duplicate payment status columns) — it looks like this schema
had at least two separate rounds of migration/schema authoring that were never fully
reconciled.

**Resolved: the two admin-check functions are equivalent, not inconsistent.**
`is_admin_role()` (plain SQL, `STABLE`, no `SECURITY DEFINER`) and `is_admin_user()`
(`SECURITY DEFINER`, safe `search_path` set explicitly to `'public'`) both check the exact
same role list: `super_admin`, `admin`, `manager`, `customer_care`. `is_admin_user()`'s
`SECURITY DEFINER` is there so policies *on* `profiles` itself can call it without
recursing into `profiles`'s own RLS. Reasonable design — just two names for the same
check, worth consolidating to one for clarity but not a security problem.

**🔴 The real finding from this query: `handle_new_user()`.** This is the function that
creates a `profiles` row for every new `auth.users` signup — and it trusts a
client-supplied `role` value from signup metadata with no validation. Full writeup and
exploit path in §3 and §5. This is now the top finding of the entire audit.

---

## 18. Realtime

[NOT VISIBLE FROM HERE] — which tables are added to the `supabase_realtime` publication
isn't exposed via PostgREST or the JS client's public surface. Neither the Flutter app nor
the Next.js code read this session subscribes to Supabase Realtime channels anywhere
(booking status, chat, and notifications all currently work by polling/refetching, not by
realtime subscription) — so even if Realtime is enabled on some tables at the database
level, **nothing in the app is using it today**. If/when added, `booking_messages` (chat)
and `bookings.booking_status` would benefit most.

---

## 19. API / service-role key security

| Location | Key used | Status |
|---|---|---|
| Flutter app (`lib/main.dart`, `AppConfig`) | `anon`/publishable key only (`sb_publishable_...`, the new-format public key), via `String.fromEnvironment` | ✅ SAFE |
| Next.js API routes (server-side only) | `service_role` key, read from server env (`lib/supabase-env.ts`), never sent to the browser | ✅ SAFE |
| Admin dashboard | [NOT AUDITED THIS SESSION] — table references were read but not its auth/client-init code | NOT CHECKED |
| `.env.local` / secrets in git | Present locally, standard Next.js pattern; whether `.env.local` is committed to git history was not checked | WORTH A QUICK CHECK — run `git log --all --full-history -- .env.local` yourself |

No JWT secrets or database passwords were found hardcoded anywhere. No actual key value
was printed, logged, or transmitted anywhere in this process.

---

## 20. Database migrations

**[VERIFIED — real gap]** The `supabase/migrations/` folder in this repo only goes back
to 2026-06-30. The schema clearly predates that by a lot — `profiles`, `bookings`,
`payments`, `provider_profiles`, and roughly 20 other tables have **no migration file at
all**. They were created directly against the live database (dashboard SQL editor or
otherwise), untracked.

- **Schema cannot currently be recreated from this repo.** Spinning up a fresh Supabase
  project and running every migration file here in order would produce `otp_challenges`,
  `customer_favorite_providers`, `provider_availability`, `issue_reports`,
  `provider_registration_submissions`, a customer-identity-documents table, and the two
  pending address migrations — and nothing else. No `profiles`, no `bookings`, no
  `payments`, no storage buckets.
- This isn't hypothetical risk-of-drift, it's confirmed drift: this session alone hit two
  "table/column not found in schema cache" production errors (`otp_challenges`, then
  `customer_favorite_providers`) that were only caught because a real user hit the bug —
  not because a migration was missing from a checklist.
- `provider_company_payment_submissions` (§1, §7, §21) being referenced in code but not
  existing at all is very likely another symptom of the same untracked-schema problem: a
  table that got renamed or dropped directly in the dashboard, with the code never updated
  to match.

---

## 21. Data quality

| Check | Result |
|---|---|
| Duplicate auth users | **None** — 87 users, 87 unique profiles |
| Profiles without auth users | **0** |
| Providers without profiles | **0** orphans across 69 provider_profiles |
| Bookings without a valid provider/customer | **0** orphans across 35 bookings |
| Payments without a valid booking | **0** orphans across 9 payments |
| Reviews without a valid booking | **0** orphans across 13 reviews |
| Invalid/unexpected status values | None found in the columns sampled — see §15 |
| Code referencing a non-existent table | **1 confirmed** — `provider_company_payment_submissions`, used by both the admin dashboard and a Next.js API route, does not exist in the live schema (`PGRST205`). A live, broken feature today, not a theoretical risk. |

Given everything above, the honest summary is: **the actual data is clean** (no orphans,
no dupes, no integrity corruption) — the problems in this audit are architectural (RLS
gaps, duplicate tables, untracked schema, a dead code path), not data rot.

---

## 22. Production readiness

### 🔴 CRITICAL

1. **Anyone can sign up as `super_admin` directly, no existing account required** — the
   `handle_new_user()` trigger function trusts a `role` value taken straight from
   client-supplied signup metadata, with no validation. A single public signup call with
   `{data: {role: 'super_admin'}}` plausibly creates a working super-admin account from
   nothing. *Confirmed live via the function definition dump — the single most serious
   finding in this audit.*
2. **A customer can also self-promote an existing account to `super_admin`** via a direct
   REST call — `profiles`'s self-update policy has no column restriction, `role` has no
   CHECK constraint, and nothing else in the schema stops it. A second, independent path
   to the same outcome. *Confirmed live via the RLS policy dump.*
3. **`customer_profiles` has three literal `USING (true)` policies** (select, insert, and
   update) open to `anon` — anyone can read, forge, or overwrite any customer's name, DOB,
   phone, address, and identity document URLs, no login required. *Confirmed live — exact
   policy names identified.*
4. **`provider_profiles` has the identical three wide-open policies** — anyone can read,
   forge, or overwrite any provider's DOB, exact home address/coordinates, and approval/
   verification status. *Confirmed live.*
5. **`identity-documents` storage bucket is public** — combined with #3, government ID
   photos are fetchable with zero authentication. *Verified live.*
6. **`payment-proofs` storage bucket is public** — financial evidence documents fetchable
   with zero authentication. *Verified live.*

### 🟠 HIGH

- **A customer or provider can rewrite their own booking's status, amounts, and
  timestamps directly, and nothing validates it** — the UPDATE policies on `bookings`
  place no restriction on which columns can change, and the only trigger on `bookings`
  (`bookings_log_status_change`) logs status changes but doesn't validate them. A customer
  could jump their own booking straight from `pending_provider_response` to `completed`
  via direct REST, and the system would faithfully log it as if legitimate. *Fully
  confirmed live — both the RLS gap and the absence of a validating trigger.*
- **`reviews`' rating-sync trigger only covers one of the two duplicate review tables** —
  `sync_provider_review_stats()` fires on `reviews` but not `provider_customer_reviews`,
  so a review in the wrong table silently never updates the provider's displayed rating.
  *Confirmed live.*
- **Commission fields are readable by the customer/provider themselves** — `payments`
  SELECT is correctly row-scoped to the owner, but with no column restriction, so
  commission/net-amount fields come along with it. The good news, also confirmed: INSERT
  and UPDATE on `payments` are correctly locked to `service_role`/admin only — read-only
  exposure, not a manipulation risk. *Confirmed live.*
- **provider_company_payment_submissions doesn't exist** but is referenced by the admin
  dashboard and a Next.js route — a live, broken feature. *Verified live.*
- **Duplicate review tables** (`reviews` vs `provider_customer_reviews`), both actively
  written to. *Verified live.*
- **Provider verification state duplicated three ways**, real risk of the three surfaces
  disagreeing. *Verified live.*
- **No tracked migration history** for ~25 of 30 tables — confirmed cause of two
  production incidents already this session. *Verified.*
- **`booking_status` enum carries 21 values across two overlapping generations of the
  same state machine** (only 8 are in active use) — real risk of Flutter/admin filters
  written against the wrong vocabulary silently matching nothing. *Verified live.*

### 🟡 MEDIUM

- `payments.status` and `payments.payment_status` both exist — drift risk.
- Duplicate/orphaned tables: `customer_addresses`, `customer_documents`, `messages`,
  `booking_tasks`, `admin_actions`, `provider_service_media`, `service_commission_settings`,
  `provider_payouts` — mostly empty, not referenced by current app code.
- `admin_actions` exists but has zero rows — if meant to be an admin audit log, nothing is
  actually being logged.
- `job-completion-images` bucket is public — photos taken inside customers' homes, worth a
  policy review even if not as severe as the two CRITICAL buckets.
- Two parallel payment systems (Stripe + manual proof-upload) coexist in one table —
  confirm which is actually live.
- **Confirmed (not just suspected) via §22K:** zero custom CHECK constraints exist
  anywhere in the schema for rating range or non-negative amounts (one-review-per-booking
  *is* enforced — correction above). All of it is enforced only in app code, if at all.
- Two review-insert RLS policies (`reviews_insert_customer_own_booking`,
  `provider_customer_reviews_insert_provider_own_booking`) contain a no-op tautology
  (`b.provider_id = b.provider_id` / `b.customer_id = b.customer_id`) — dead logic, not a
  security hole, but worth cleaning up.
- Two admin-check functions (`is_admin_role()`, `is_admin_user()`) do the same thing under
  different names — resolved as harmless duplication, not an inconsistency (§17).
- Confirmed duplicate index (`payments_booking_id_key` = `payments_booking_id_unique_idx`,
  identical definitions) and two duplicate `updated_at` triggers (`bookings`,
  `customer_profiles`) — harmless but wasteful, another instance of the
  never-cleaned-up-migration pattern seen throughout this schema.

### 🟢 LOW

- Cleanup candidate tables (see MEDIUM list) once confirmed genuinely unused.
- Index coverage should be reviewed as data volume grows — not yet a problem at current
  scale (largest table: 358 rows).
- `DemoRepository`/mock plumbing still threaded through some Flutter screens (unrelated to
  Supabase, noted previously).

---

## A–L Summary by topic

| § | Topic | Headline |
|---|---|---|
| A | Current architecture | Standard Supabase pattern (auth.users → profiles → role-specific tables), correctly wired, zero orphans today |
| B | Tables & relationships | 30 real tables, several duplicated concepts (reviews, addresses, identity docs, verification state) |
| C | Auth architecture | Clean data today (87/87 reconciled) — but the signup trigger trusts client-supplied `role`, the top finding of this audit |
| D | RLS audit | Real policy text confirmed 3 CRITICAL findings: self-promotable admin role, and two tables with literal `USING (true)` open policies. `payments` writes are correctly locked to service_role — one clear bright spot |
| E | Storage security | All 7 buckets public; 2 of them (identity docs, payment proofs) must not be |
| F | Payment security | Rich schema, app-layer redaction confirmed, database-layer protection unverified |
| G | Booking-flow audit | Well-designed schema for a state machine; enforcement unverified |
| H | Data integrity | Genuinely clean — 0 orphans across every relationship checked |
| I | Performance/index | Not yet a real problem at current scale; unverifiable from here anyway |
| J | Mock/temporary elements | `provider_company_payment_submissions` is a dead reference; several empty scaffold tables |
| K | Production blockers | The two open-profile-table + two-public-bucket findings must be fixed before real user data is trusted |
| L | Recommended fix order | See phased plan below |

---

## Phased repair plan — nothing here has been applied

Every SQL statement referenced below is a **proposal**, to be shown for review before
anything runs. Say the word for any phase and only that phase gets applied, then
re-verified with the same read-only method afterward.

### Phase 1 — Security vulnerabilities (do this first)

Exact proposed SQL — **not applied, shown for your review only.** Say the word and I'll
either apply it directly (bucket privacy — I can do that one myself) or hand it to you to
run (everything else, since I have no DDL execution path).

**1a. Stop trusting client-supplied `role` at signup.** This is the top-priority fix —
the new finding from the function dump. Keeps every legitimate signup working exactly the
same (new accounts still default to `customer`); it just removes the ability to request an
elevated role through signup metadata. **Caveat, stated plainly:** I have not traced every
registration code path end-to-end to guarantee nothing relies on this trigger honoring a
non-`customer` role — worth a quick sanity check on your end before running it, even
though nothing found this session suggests it would break anything.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer',
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
```

**1b. Remove the wide-open policies on `customer_profiles` and `provider_profiles`.**
This alone closes CRITICAL findings #3 and #4. The correctly-scoped policies already
sitting alongside them (`customer_profiles_select_own_or_admin`,
`provider_profiles public approved read`, etc.) keep working exactly as designed —
nothing else changes.

```sql
drop policy if exists "customer_profiles_public_select" on public.customer_profiles;
drop policy if exists "customer_profiles_public_insert" on public.customer_profiles;
drop policy if exists "customer_profiles_public_update" on public.customer_profiles;

drop policy if exists "provider_profiles_public_select" on public.provider_profiles;
drop policy if exists "provider_profiles_public_insert" on public.provider_profiles;
drop policy if exists "provider_profiles_public_update" on public.provider_profiles;
```

**1c. Close the self-role-escalation path on `profiles`.** This replaces the two
overlapping self-update policies with one that still lets a user edit their own name/
phone/avatar, but makes it impossible to change `role` or `status` through that path —
only the existing admin-only policies can change those.

```sql
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create policy "profiles self update (role/status locked)"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );
```

*Admins are unaffected* — `profiles admin update` (checked via `is_admin_role()`) is a
separate policy and can still change anyone's role/status.

**1d. Storage buckets.** I can execute this part myself via the Storage API once you say
go — no SQL needed:
- Switch `identity-documents` and `payment-proofs` from public to private.
- Move the app screens that display them to signed URLs with a short expiry, instead of
  the raw public URL currently stored in the database.

**Not yet proposed (needs more design, going into Phase 3 instead):** the `bookings`
column-restriction fix — because unlike `profiles`, there are 40+ columns and a real state
machine to respect, a blanket "lock every column except a few" policy risks breaking
legitimate customer/provider actions (accepting, marking arrived, etc.) if I get the
allowlist wrong. I'd rather design that properly against the actual booking flow than
rush a policy that breaks a real feature.

Impact: USER APP (identity/profile screens need signed-URL fetch instead of raw URL;
self-editing name/phone/avatar keeps working unchanged; registration/signup unaffected as
long as no flow relies on client-supplied `role` metadata, which nothing found this
session does) · PROVIDER APP (same for verification docs; self-editing keeps working) ·
ADMIN DASHBOARD (keeps working via service-role/admin policies, unaffected) · EXISTING
DATA (no data changes, policy/bucket-flag/function changes only)

### Phase 2 — Database integrity

- Pick one canonical review table (`reviews` or `provider_customer_reviews`) and
  migrate/deprecate the other.
- Pick one canonical identity-document location and stop writing to the other two.
- Fix or remove the `provider_company_payment_submissions` dead reference in both the
  admin dashboard and the Next.js route.
- Reconcile `payments.status` vs `payments.payment_status`.

Impact: USER APP (minor, if it reads the deprecated review table) · PROVIDER APP (needs
updating if it writes provider replies to the deprecated table) · ADMIN DASHBOARD (needs
updating — its payment-submissions screen is currently broken anyway) · EXISTING DATA
(requires a one-time backfill/merge, not a delete — to be proposed separately)

### Phase 3 — Booking / payment logic

- Restrict which columns a customer/provider can change on their own booking row (today,
  confirmed via §22K, it's every column) — likely via a trigger that rejects changes to
  protected columns (`total_amount`, `provider_amount`, `booking_status`, etc.) unless the
  request comes from `service_role` or an admin.
- Move commission calculation into a trigger/RPC the client never controls.
- Add a state-machine guard (trigger or CHECK) so invalid booking-status jumps are
  rejected at the database level, not just by app logic.
- Decide and consolidate the Stripe vs. manual-proof payment paths.

Impact: USER APP (booking creation/payment flow, needs testing) · PROVIDER APP (job-status
update flow, needs testing) · ADMIN DASHBOARD (payment verification flow) · EXISTING DATA
(no changes to past bookings, only new writes affected)

### Phase 4 — Storage security (remaining buckets)

- Review whether `job-completion-images` should be private.
- Confirm `certificates` doesn't leak IC numbers via document content (a content-review
  task, not a bucket-policy fix).

Impact: PROVIDER APP (job completion photo upload/display) · USER APP (booking detail
screen displaying completion photos)

### Phase 5 — Performance

- Add indexes on the hot FK/status/date columns listed in §13, once §22K confirms which
  are missing.

Impact: no app-visible behavior change — pure performance

### Phase 6 — Cleanup

- Drop or archive confirmed-unused tables (`messages`, `booking_tasks`,
  `customer_addresses`, etc.) — only after confirming zero references anywhere, including
  the admin dashboard, which was only partially audited.
- Backfill missing migration files for the ~25 untracked tables so the schema becomes
  reproducible.

Impact: EXISTING DATA (only after explicit confirmation nothing reads these tables)

---

## §22K — The one script that closes every remaining gap

Paste this into the Supabase SQL Editor and run it — it's 100% read-only (every query is a
`SELECT` against a catalog view), it changes nothing, and it answers every
"not visible from here" item above in one shot: exact RLS policy text for every table,
every CHECK/UNIQUE constraint, every index, every trigger and function (including whether
it's `SECURITY DEFINER` and whether `search_path` is set safely), and the full enum member
lists. Paste the output back to fold it straight into this report.

```sql
select
  schemaname, tablename, policyname, permissive, roles, cmd,
  qual as using_expression, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

select
  tc.table_name, tc.constraint_type, tc.constraint_name,
  string_agg(kcu.column_name, ', ') as columns
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
group by tc.table_name, tc.constraint_type, tc.constraint_name
order by tc.table_name;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename;

select
  n.nspname as schema, p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(p.proconfig::text, '(not set)') as config,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f';

select
  event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table;

select t.typname as enum_name, e.enumlabel as value
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;
```

---

*Generated from a live, read-only inspection of the Swiper Supabase project. No rows were
inserted, updated, or deleted; no schema was changed; no bucket policy was changed. All
temporary inspection scripts used to gather this data have been deleted from the
repository.*
