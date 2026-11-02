# TREXVEN Admin: Stage 1 integration audit

Date: 16 October 2026, Africa/Lagos. Target: `C:\Users\USER\Downloads\Trexven Admin`.

Decision: **not ready for production**. Preserve the existing application and design, but repair identity, database migrations, authorization, ingestion, and reporting semantics before connecting operational data.

## Scope and evidence limits

This is the requested inspection and implementation proposal, before approval to change code. No application code, dependency declarations, migrations, production data, cloud configuration, payments, or Owner/POS/Vision code was changed. No resources were created, resumed, deployed, deleted, or migrated. Only this audit and its companion implementation plan were added.

Evidence includes the local application, tests, four migrations and seed file, the architecture/specification documents, read-only production catalog/function/policy inspection through the connected Supabase plugin, and targeted reads of the existing Owner billing adapter and canonical Vision source. Eight isolated probes exercised the existing authentication and Edge Function code with synthetic values and mocked dependencies; they made no network calls.

The application could not be compiled or rendered because executable dependencies are missing. Accordingly, UI quality and live workflows are not certified. SQL defects below are source findings, not results from applying migrations. The inactive Admin project's current database objects and Auth configuration could not be inspected. Historical notes were used to locate that project and Vision source; current project status was verified independently.

## 1. Existing implementation

| Area | Observed implementation |
|---|---|
| Framework | Next.js App Router, manifest range `^15.1.6`; React `^19.0.0`; TypeScript with strict mode |
| Styling | Tailwind CSS 4, CSS variables for light/dark themes, Radix primitives, Lucide icons |
| Charts/state | Recharts; React Query provider; most reads are Server Component calls |
| Backend clients | `@supabase/ssr` and `@supabase/supabase-js`; cookie-scoped server client and browser client |
| Data architecture | `DataProvider`/`MutationBackend` contracts, environment-selected demo and Supabase implementations |
| Authentication | Password login scaffold, TOTP challenge form, signed demo cookies, six role definitions |
| API | 13 Route Handler files under `/api/v1`; operations listed below |
| Database | Four SQL migration files, registries/pricing seed, two Deno Edge Functions |
| Tests | Two Vitest files containing 11 cases; one Playwright file containing two cases |
| Configuration | `.env.example` only; required Supabase environment variables absent in the inspected process |
| Repository/CI | This supplied folder is not a Git checkout; no lockfile, GitHub Actions workflow, CODEOWNERS, generated database types, or OpenAPI artifact found |
| Footprint | 22 page files; 118 TS/TSX/SQL/TOML files across `src`, `supabase`, and `tests`, approximately 9,140 lines; 18 existing specification documents |

Source: [package.json](../app/package.json), [tsconfig](../app/tsconfig.json), [configuration](../app/next.config.ts), [provider contract](../app/src/lib/data/provider.ts), [provider selection](../app/src/lib/data/index.ts).

There are no unresolved local `@/` imports in the static import-path check. That does not validate exported symbols, TypeScript compatibility, external dependencies, or runtime behavior.

### Routes

Auth: `/login`, `/mfa`, `/invite/[token]`; `/` redirects into the application; `/403` exists. Middleware lists `/reset` as public, but no reset page exists.

Dashboard: `/overview`, `/businesses`, `/businesses/[businessId]`, `/subscriptions`, `/payments`, `/analytics`, `/vision`, `/angel`, `/intelligence`, `/health`, `/incidents`, `/incidents/[incidentId]`, `/ai-data`, `/admin-team`, `/audit`, `/settings`, `/settings/pricing`.

API Route Handlers:

- POST `/api/v1/auth/demo`, `/auth/logout`, `/admin-team/invite`, `/commands`, `/commands/[id]/approve`, `/commands/[id]/reject`, `/health/dead-letters/[id]/retry`, `/incidents`, `/notifications/read`.
- GET `/api/v1/commands/[id]`, `/audit/export`, `/health`.
- PATCH `/api/v1/incidents/[id]`.

Server Components read the provider directly; absence of separate dashboard GET endpoints is not itself a defect. The broader API described in document 11 is not fully implemented, however, and should not be advertised as available.

## 2. Feature classification

Classification: **1** fully implemented and working; **2** implemented but not connected; **3** partially implemented; **4** mock/demo; **5** missing; **6** externally blocked. Multiple classifications distinguish the UI from its real integration. No end-to-end module qualifies for category 1 on the evidence obtained.

| Feature | Class | Existing code and remaining work |
|---|---|---|
| Shell/navigation/themes | 3 | Role-filtered sidebar, search palette, light/dark tokens exist; no browser verification; mobile navigation and demo labeling need repair |
| Overview | 3, 4, 6 | Rich fixture dashboard; real provider supplies only four metrics; several trends/metrics missing; no production feed |
| Business directory | 2, 3, 4, 6 | Real projection queries and filters exist; name-only search despite ID placeholder, capped results, no real pagination, unsafe fallback values |
| Business profile/timeline | 3, 4 | Tabs exist; generated provider/renewal/support values; timeline migration references nonexistent columns |
| Subscriptions | 3, 4, 6 | Plan counts and some lifecycle fields mapped; revenue trends/country split absent; renewals are not constrained to next 30 days |
| Payments | 3, 4, 6 | Projection reads exist; production billing schema differs; provider integration inactive; refund/webhook/reconciliation UI is incomplete |
| Country pricing | 3, 4, 6 | Country+plan key preserves TG/CI separation; active example prices are incorrectly included in the real seed; no approved commercial prices |
| Product analytics | 3, 4, 6 | Funnel/session read scaffold; retention, feature adoption, versions and conversion empty in real provider; no store integration |
| Vision | 2, 3, 4, 6 | Projection reads exist; real source has health telemetry, but contracts do not match and no receiver is connected |
| Intelligence | 3, 6 | Unavailable-state UI exists; real provider hardcodes `planned`; existing native implementation/health must be distinguished from missing Admin telemetry |
| Angel | 2, 3, 4, 6 | Metrics reader scaffold; deployed production Angel verified; token/cost/latency reporting feed absent |
| System health | 3, 4, 6 | Error/job/DLQ readers exist; operational status is inferred without probes; no retry worker or freshness evaluation |
| Incidents | 3, 4 | Local CRUD scaffold; real writes not atomic with timeline/audit, notifications not sent, no resolution timestamp maintenance |
| AI Data | 3, 4 | Dataset/version/model metadata tables and read page; versions not loaded; no complete registry write flow; no real collection/training enabled |
| Administrator login | 3, 4, 6 | Password UI and profile lookup; demo fallback and real session enforcement need repair |
| MFA | 3, 4 | TOTP verification form; no enrollment, no authoritative AAL2 enforcement |
| Invitations/recovery | 3, 5 | Invite form reports success without saving; real invite backend cannot provision an Auth user; password recovery missing |
| Six roles/RBAC | 3 | TS/SQL role matrices exist; command/RPC and aggregate-data authorization gaps; specification and implementation differ |
| Audit logs/export | 3, 4 | Table, command trigger, CSV export; missing RLS and comprehensive auditing/immutability controls |
| Commands/approvals | 3, 4, 6 | Confirmation dialogs, ledger, approval APIs; database bypasses and no approved production executor |
| Notifications | 3, 4 | Demo store and UI; real list always returns `[]`; broadcast read tracking missing |
| Secure data pipeline | 3, 5, 6 | Receiver skeleton and tables; no production bridge, transactional consumer, retries, reconciliation worker or backfill implementation |
| Database/RLS tests | 5 | Mentioned in documents, not present in the supplied application |
| CI/release automation | 5 | Described in documents, not supplied as executable workflows |

## 3. Supabase separation and production reality

Read-only project discovery returned:

| Purpose | Project reference | Observed status |
|---|---|---|
| Existing TREXVEN production | `ufehcfrlygqvminfjumf` | `ACTIVE_HEALTHY` |
| Separate Admin Project | `tsnkzkpgxvomfuzyeyup` | `INACTIVE` |
| Existing Trexven-Staging | `qysspzlfiysekvxnlzsh` | `ACTIVE_HEALTHY`; not treated as an Admin environment |

The separate Admin project exists. **This application is not configured to use it.** `supabase/config.toml` contains a local identifier `odt-admin`, not a verified remote project link. There is no project-identity guard preventing an operator from accidentally configuring the production URL. Admin migration listing timed out; Admin Edge Function listing returned an empty list. The project was not resumed. Its current schema, grants, signup settings, enrolled admins, and migration state remain unverified; the old empty-schema snapshot is not asserted as current.

Production catalog inspection found 64 public base tables, all with RLS enabled. Policy presence does not prove policy correctness, and no production role impersonation, business mutations, or security changes were attempted.

### Verified production-to-Admin mapping

| Reporting requirement | Real source | Mapping/limitation |
|---|---|---|
| Registrations/directory | `businesses(id, business_name, country, currency, created_at, updated_at)` | Map `business_name` to projection `name`; explicitly normalize country; exclude owner/contact/address fields |
| Subscription state | `business_subscriptions(business_id, plan_id, status, started_at, renews_at, expires_at, grace_until, cancel_at_period_end, version, updated_at)` | Status values include `trialing`, `active`, `past_due`, `canceled`, `expired`; do not derive a business suspension from subscription status |
| Plan catalog | `subscription_plans` | `start`, `core`, `pro` verified; all three have null price, currency and interval at inspection |
| Billing records | `billing_sessions`, `billing_payments`, `billing_invoices`; private provider-event ledger | Payment statuses are `verified`/`failed`, not the projection's `success`/`failed`/`pending`; amount is numeric major units, not precomputed integer minor units |
| Verified billing ingestion | `record_verified_trexven_billing_event(...)` | Validates trusted session, amount/currency and event/payment identities, with replay handling; service-role execute permitted, anon/authenticated execute denied |
| Renewal activation | `activate_verified_trexven_billing_subscription(...)`, `apply_verified_trexven_subscription(...)` | Existing server-only financial authority; preserve it; Admin reporting must not activate subscriptions |
| Cancellation/change history | `subscription_events`, `subscription_change_requests`, `process_trexven_subscription_cancellation(...)` | Actual event vocabulary must drive projections; history presence is not Paystack webhook availability |
| Sales/product usage | `sales`, `sale_items`, `products`, inventory and related operational tables | Server-side aggregate counts/sums can support usage estimates; ordinary sales do not establish POS install/device/session counts or distinguish every Owner/POS origin |
| App errors | `application_error_events`; `record_trexven_application_error(...)` | Only fixed safe error codes, rate-limited and authorized; no arbitrary crash payloads. Do not imply complete crash monitoring |
| Vision | `cameras`, `camera_health_logs`; canonical local Vision `/health` and `safe_metrics()` | Health metadata exists; omit stream URLs, footage, recordings, image/video URLs and raw event payloads |
| Intelligence | Native `C:\Users\USER\ODT-Vision\vision\shared_vision.py` | Safe metrics include running state, event/alert counts, processing latency/failures and queue depth; not the generated Admin batch-job model |
| Angel | Active production `angel` Edge Function version 13 | Source uses Groq and authenticated business access. No persisted Admin usage/token/cost aggregation found in inspected function/catalog |
| Registration/activity funnel | Registration table exists; sessions/features/onboarding events not found in inspected public schema | Transaction-based activity can be named and calculated explicitly; session-based activity, retention and feature adoption need additional instrumentation |
| Downloads/installs/versions | No connected store or event pipeline found | Require Google Play Console/approved analytics integration; do not substitute registration counts |

Billing configuration inspection returned **zero provider configuration rows**. The local Owner adapter's `enabledBillingProviders` is an empty map. No Paystack function appeared in the deployed production Edge Function inventory. This disproves the generated project's assumption of an already-connected Paystack feed within the inspected architecture; it does not inspect a separate Paystack account or every possible external host.

The deployed production functions listed were `angel`, `camera-ingest`, `camera-worker-ingest`, `camera-ai`, `create-employee`, `manage-employee`, `employee-login`, `delete-account`, and `account-deletion-recovery`. No Admin bridge schema was found in the production namespace catalog.

### Existing Vision delivery is a different contract

Canonical Vision already has a disabled-by-default, consent-gated worker with a bounded SQLite outbox, revisions, retries and pseudonymization. It sends Bearer-authenticated `{record, health}` with an `Idempotency-Key`. Admin ingestion expects HMAC headers and `{events:[...]}`. They cannot be connected simply by copying a URL/token.

Preserve Vision's behavior. A reviewed gateway/adapter must translate only approved operational aggregates and honor consent/revocation/retention. The existing record-oriented delivery must not silently become an AI-training collection path. Live Vision process health, pairing, credentials, customer consent, and export activation were not tested or changed.

## 4. Critical and high-priority findings

These concern the supplied Admin code unless explicitly identified as a production observation. They are not claims of exploitation against a deployed Admin site.

### A-01 — Critical: demo sessions accepted in configured real mode

[session.ts:25](../app/src/lib/auth/session.ts#L25) supplies a known fallback signing secret. [getSession:74](../app/src/lib/auth/session.ts#L74) accepts a valid demo token before considering Supabase configuration. The verifier trusts the token's supplied role/permissions and does not validate the complete session shape. Middleware also admits the mere presence of a demo cookie.

An isolated execution reproduced acceptance of a synthetic Super Admin demo cookie while Supabase variables were configured. Closing `/auth/demo` in real mode is insufficient. Database RLS still independently limits cookie-scoped Supabase calls; this probe does not prove all database data is exposed. The application session/authorization boundary itself fails.

Required: explicit local-only demo mode, fail closed in shared/production mode, reject demo tokens in real mode, validate shape and derive authorization from the active administrator record.

### A-02 — Critical: database command creation bypasses permissions/approval

[0002:110](../app/supabase/migrations/0002_governance.sql#L110) checks only `requested_by = auth.uid()`. It does not validate command permission, active-admin status, payload schema, initial status, or required approval. If table INSERT grants exist, a signed-in caller can bypass the web handler and submit a command with attacker-chosen `approved` or `completed` status. The expected validating trigger described in comments is absent.

Required: narrowly granted command RPC with server-derived actor, permission and payload validation, fixed initial state, immutable receipt fields and transactional audit. Direct table INSERT must be denied.

### A-03 — Critical: approver identity and command scope are not bound

[approve/reject RPCs:128](../app/supabase/migrations/0002_governance.sql#L128) accept `p_approver` and compare the requester to that supplied value instead of binding approval to `auth.uid()`. They require generic `commands.approve` but not the command-specific permission. A requester with approval permission can supply another administrator's ID; an Operations Admin can approve a finance-only change under the generic check.

Required: derive approver identity from verified session, recheck active status/AAL2 and command-specific authority, enforce distinct immutable user IDs, restrict function execute grants and serialize transitions. Source finding only; no real RPC was invoked.

### A-04 — Critical: dispatcher callable without authentication

[dispatch-command:8](../app/supabase/functions/dispatch-command/index.ts#L8) ignores the request and performs service-role work; [config.toml](../app/supabase/config.toml) disables JWT verification. No cron secret or equivalent caller authentication is implemented. A mocked unauthenticated GET invoked it and caused a database update even with production dispatch unconfigured.

The comment claiming row locks is inaccurate: commands are selected then updated separately, enabling concurrent dispatch. There is no timeout, retry queue, claim lease, approved target allowlist or complete result reconciliation. Production activation depends only on two environment variables, not an independently enforced reviewed enablement state.

Required: keep production-changing execution disabled; authenticate scheduling, atomically claim work, enforce approved target configuration, timeouts/retries and verified result receipts in local mocks before any separate activation review.

### A-05 — High: receiver can lose events and report false acceptance

[ingest-event:63](../app/supabase/functions/ingest-event/index.ts#L63) inserts the deduplication row before projection application, outside a transaction. Supabase `{error}` results from writes in `applyEvent()` are ignored. Unknown types return normally and are marked processed. Failed events remain in the ledger; a retry then returns `duplicate` without reapplying them.

All three behaviors were reproduced against the actual function code with a mocked database. Subscription, refund, POS, analytics, camera-health, AI-usage, error and reconciliation consumers are absent.

Required: validate first; atomically claim/apply/mark with per-event isolation; duplicate-success and retryable-failure are distinct; inspect every database result; implement registered consumers and ordering/version guards.

### A-06 — High: claimed payload minimization/replay controls are absent

The receiver stores arbitrary payloads before any schema/classification check. A synthetic unapproved field was persisted in a probe. There are no event/batch size/count limits, schema-version enforcement, unknown-field rejection, durable nonce TTL, per-source authorization or persistent authentication-failure logging. The nonce set is unbounded and process-local; any key ID other than `1` selects the previous secret. Malformed non-array `events` causes an uncaught error.

Required: strict versioned allowlists and bounded parsing before persistence, deterministic key-ID lookup, signed-source scope, durable replay controls, redaction and safe error accounting. Event-ID deduplication does not replace nonce handling or failed-event recovery.

### A-07 — High: migrations are not bootstrappable as supplied

- [0001:41](../app/supabase/migrations/0001_init.sql#L41) uses `citext` but the migration creates only `pgcrypto` and `pg_trgm`; clean application depends on an undeclared extension.
- [0002:114](../app/supabase/migrations/0002_governance.sql#L114) enables RLS and creates a policy for `command_approvals` before creating the table at line 118.
- [0003:116](../app/supabase/migrations/0003_projections.sql#L116) creates `business_timeline` using `business_id` and `occurred_at` from `administrative_commands`, which contains `target_id` and `created_at` instead. The resulting timeline also needs stable row IDs.
- No clean-database migration test or deployed-state comparison is available. Do not upload these files unchanged. Determine actual Admin migration history after separately authorized project restoration before choosing baseline repair versus additive corrections.

### A-08 — High: audit RLS/immutability and grants are incomplete

`admin_audit_logs` and `command_types` have no RLS enablement/policies. Public default partitions also lack a direct-access protection strategy. Actual exposure depends on deployment grants, which are not verified on the inactive Admin project. `write_audit()` is a public-schema SECURITY DEFINER function without explicit execute restrictions or authorization validation.

Revoking UPDATE/DELETE from anon/authenticated/public on the parent audit table is insufficient to establish the advertised guarantee: direct INSERT/TRUNCATE, partitions, service-role privileges, and function entry points need explicit treatment. Only command changes have audit triggers; invitations, admin/profile changes, incident changes, data-registry workflows, real logins/logouts, denied requests and real audit exports are not comprehensively recorded.

Required: explicit grants/RLS for every exposed relation and partition; narrow internal audit writer; immutable application-role audit permissions; actor/request identity from trusted context; transactional audit coverage and tests. Database owner/superuser authority is a separate boundary and must not be described as impossible.

### A-09 — High: MFA and session lifecycle are not enforced

[session.ts:100](../app/src/lib/auth/session.ts#L100) reads an assurance-level property from the user object rather than using the MFA assurance API; the login form uses the same unsupported property. Neither middleware, `requireApiSession`, nor `has_permission()` actually requires AAL2. A synthetic session with `mfa:false` passed the real API guard in an isolated probe.

The real-session expiry is recreated as `now + 8h` on every read, so it is not an absolute session lifetime. Middleware refresh sets response cookies without the provided cookie options and without updating request cookies. [logout](../app/src/app/api/v1/auth/logout/route.ts) deletes only the demo cookie; it never signs out Supabase. Session concurrency/revocation controls described in the specification are absent.

Required: supported AAL checks, TOTP enrollment/challenge/recovery, database enforcement for sensitive access, correct SSR refresh and real signout, explicit absolute lifetime and active-admin revalidation.

### A-10 — High: invitation flow fabricates completion

[invite form:35](<../app/src/app/(auth)/invite/[token]/invite-form.tsx#L35>) only sets React state. It validates no token, saves no password/name and provisions no factor or profile. `SupabaseMutations.inviteAdmin()` inserts an `admin_users` row without its mandatory ID, ignores the requested role, and never provisions `auth.users` or sends an invitation. No Auth signup-disable setting or Auth lifecycle hook is supplied; a trigger on `admin_users` cannot itself prevent public Supabase Auth signup.

Required: real invite-only provisioning using a server-only privileged boundary, token verification/expiry and role binding, bootstrap procedure, verified MFA enrollment, recovery routes and Auth configuration evidence. The UI must not claim success before the durable action succeeds.

### A-11 — High: revenue/GMV authorization leaks through charts

[overview:92](<../app/src/app/(dashboard)/overview/page.tsx#L92>) renders MRR and GMV charts without their permission checks. Only KPI cards are filtered. [aggregate RLS](../app/supabase/migrations/0003_projections.sql#L162) permits every `analytics.read` role to read all metrics; Support/Technical roles therefore have more data access than the revenue/sales matrix implies. Business profile POS/GMV fields need the same review.

Required: enforce metric-level permissions in database access and server DTOs, then consistently gate tables, charts and exports. Hidden buttons/cards alone are insufficient.

### A-12 — High: financial projections invent or mislabel meaning

The real provider hardcodes every business currency to NGN, assumes Paystack and auto-renew from account status, substitutes the current time for unknown registration/activity, and defaults missing metrics to zero. It labels summed `gmv_minor` values USD without establishing conversion or currency dimensions. `mrr_usd` values have no enforced unit convention against a formatter that expects minor units. Truncated queries are used as totals, and date ranges mostly slice chart points without filtering KPI calculations.

Payments discard stored failure details, return zero refunds without querying refunds, calculate a nominal 30-day success rate over up to 300 unbounded records, and label every reconciliation run `amount_mismatch` regardless of status. Empty results are presented as clean reconciliation/healthy queues. Most query errors are ignored, conflating unavailable data and no activity.

The real seed marks invented country prices active. Those values must remain fixture-only; production prices are currently unconfigured. Neither shared XOF currency nor an assumed exchange rate authorizes collapsing TG and CI pricing.

Required: explicit source/status/unit/time-window contracts; nullable unavailable values; accurate counts/pagination; per-country/currency money; no FX normalization without an approved dated source; confirmed verified-payment mapping; no active example commercial prices.

## 5. Additional defects and incomplete workflows

- **TypeScript/configuration:** Next's TS include globs also include Deno functions with remote URL imports and no Deno type boundary. `login-form.tsx` accesses the unsupported user assurance property. Analytics passes `{platform, share}[]` to `Donut`, which requires `{name, value}[]`. These are source-level incompatibilities; the compiler did not run.
- **Build reproducibility:** no lockfile; dependency ranges are unpinned; partial `node_modules`; installed versions/security posture cannot be established. The build deliberately skips lint, and `verify` omits lint entirely.
- **Mobile/demo labels:** sidebar is hidden below `md` without a mobile navigation menu; the palette provides some alternate navigation. Both sidebar DEMO and topbar DEMO DATA labels disappear on small screens, so most mobile screens lack a persistent fixture warning. Notifications use a fixed 384px dropdown width. Browser layout/contrast remains untested.
- **Accessibility:** `Field` renders sibling label and input without IDs/`htmlFor`; many controls lack a programmatically associated label. Palette input lacks an accessible label. Existing Radix focus handling and reduced-motion CSS can be retained.
- **Error/loading:** no route `loading.tsx`, `error.tsx`, or custom `not-found.tsx`; reusable skeleton/error components largely unused. `ErrorState` claims logging without an implemented logger. An unavailable source often becomes zero, an empty table or a 404.
- **Command UX:** no mounted `CommandStatusCard`; submitting a command closes the dialog without persistent status tracking. A new idempotency key is created on each retry. Reasons/typed confirmation/target-specific fields are enforced primarily in UI, not in the authoritative backend. Approval toast claims dispatch is running even when paused.
- **Approval accessibility:** approvals are nested under Admin Team, which only Super Admin can read; Operations/Finance approvers lack a usable inbox despite API approval permission.
- **Production effects:** suspension text promises immediate Owner/POS access loss and billing pause, but no reviewed production mechanism implements those semantics. Production `businesses` has no generic account-status column matching the replica. Do not substitute `pos_writes_paused` as a whole-account suspension.
- **Pricing:** editor accepts fractional minor units and weak date validation; active/effective price selection is not deterministic for multiple active/history rows. No database constraint prevents overlapping active intervals.
- **Monitoring:** `/api/v1/health` constructs a provider and returns OK without checking dependencies; sync is declared healthy from any old success timestamp; failed jobs do not determine service status. Live probes, aggregate refresh, alert routing and retention jobs are described but absent.
- **Incidents:** partial success possible between incident and timeline writes; initial timeline error ignored; updates do not populate `resolved_at`; no durable audit or actual notification producer despite success copy.
- **Notifications:** real list is hardcoded empty; mark-read ignores database errors and only targets direct recipients. Role-recipient messages use one shared `read_at` instead of per-admin read receipts.
- **Audit export:** actor filter is ignored; result capped at 200; no real export audit; CSV quoting does not neutralize spreadsheet formulas.
- **Dataset governance:** consent text column and private bucket are foundations, not enforced consent/revocation/retention automation. Versions/evaluations are not loaded; no registry round trip; no automatic purge implementation supports the page's “enforced” claims. Metadata-only scope is appropriate; customer collection and training remain disabled.
- **Spec drift:** some role permissions differ between document 09 and code/seeds; documents assume Angel is undeployed and Paystack live, contrary to current inspection. Resolve deliberately and update documentation with the approved implementation.

## 6. Verification actually executed

Environment: Node `v22.20.0`, npm `10.9.3`. Commands ran from `app`.

| Check | Exact outcome |
|---|---|
| `npm.cmd run typecheck` | Exit 1: `'tsc' is not recognized...`; compiler never started |
| `npm.cmd run lint` | Exit 1: `'eslint' is not recognized...`; linter never started |
| `npm.cmd run test` | Exit 1: `'vitest' is not recognized...`; zero Vitest cases executed |
| `npm.cmd run build` | Exit 1: `'next' is not recognized...`; build never started |
| `.\node_modules\.bin\playwright.cmd test` | Exit 1: command not found; zero Playwright cases executed |
| Static local import paths | No unresolved local `@/` path found; does not substitute for typecheck |
| Read-only production inspection | Project, catalog, relevant columns, policies, constraints, billing grants/configuration and deployed functions obtained |
| Admin migration inspection | Connection timeout; current Admin DB state unverified |
| Admin Edge Function listing | Empty list returned |
| Local SQL/RLS execution | Not run; no `docker`, `psql`, `supabase`, or `deno` executable found on PATH |
| Browser/a11y/performance | Not run; application could not start |

### Isolated source-code probes

Node's `stripTypeScriptTypes` and VM executed the existing function/session source in memory. Remote imports were replaced with synthetic dependencies; Supabase was mocked, request signatures used a test-only key, and no credentials or requests reached real services. These are diagnostic reproductions, not the project's test suite or a deployed-Deno verification.

| Probe | Observed unsafe behavior |
|---|---|
| Unknown event type | HTTP 202, `accepted`, ledger `processed` |
| Projection write returns Supabase error | HTTP 202, `accepted`, ledger `processed` |
| Projection throws transient failure, then replay | First `rejected:processing_error`; second `duplicate`; one application attempt; ledger remains `failed` |
| Payload has synthetic unapproved field | Field persisted in the ingest ledger |
| `events` is an object | Uncaught “object is not iterable” error |
| Unauthenticated GET to dispatcher | HTTP 200; paused-command path performed one database update |
| Demo token with Supabase environment configured | Accepted as demo Super Admin |
| Signed session with `mfa:false` | `requireApiSession('admin_team.invite')` accepted it |

All eight unsafe behaviors were reproduced. None was repaired during this audit. The existing two E2E cases also contain a source mismatch: direct Admin Team denial renders the shared Unauthorized message, but the smoke test expects “Access denied” from `/403`. This was not run as an E2E failure because Playwright was unavailable.

No passing unit/integration/RLS/payment-consistency/E2E suite or successful production build is claimed.

## 7. Readiness, blockers, and next decision

**Implemented:** substantial screen/component foundation, demo providers, role vocabulary, initial schema and function scaffolding. **Verified:** source findings, read-only backend contracts, eight local diagnostic reproductions. **Deployed by this task:** nothing. **Fixed by this task:** no application defects; approval is required first.

Primary blockers are the security/data-integrity findings above, unavailable executable dependencies/local database tooling, the inactive and unconfigured Admin project, missing production publisher and telemetry adapters, unconfigured commercial billing/pricing, absent store/crash instrumentation, and unapproved administrative action semantics.

The next authorized step should be the local implementation and verification work in [the approval plan](19-implementation-plan-2026-10-16.md). Cloud restoration/configuration, project creation, migrations, enabling data export, Owner/POS changes, payment configuration, production-changing actions and deployment remain separate approval gates.

## Reference guidance checked

The SSR plan follows the distinction between request and response cookie refresh in [Supabase SSR documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs). MFA assurance must use the [assurance-level API](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel) and be enforced for protected access, as described in the [MFA guide](https://supabase.com/docs/guides/auth/auth-mfa). Exposed relations require deliberate grants and policies; see [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The skill-requested markdown changelog URL returned an unsupported-content-type error; the [HTML changelog](https://supabase.com/changelog) was accessible. No dependencies were installed or upgraded on that basis. Exact APIs and resolved package security must be checked again during approved implementation.
