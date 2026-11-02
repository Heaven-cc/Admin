# 07 — Backend Architecture & Service Boundaries

| Field | Value |
|---|---|
| Document | 07 — Backend Architecture |
| Version | 1.0 Baseline |
| Depends on | 02 (topology), 08 (schema), 09 (auth), 10 (sync), 11 (APIs) |

## 1. Service boundaries

| Service | Boundary | Owns | Never does |
|---|---|---|---|
| Admin Web (Next.js + Route Handlers) | Faces admin users only | UI, thin authorized reads, command intake, Sentry webhook receiver | Talk to production DB; hold service-role in client; mutate projections directly |
| Admin Supabase (Postgres) | Faces Admin Web + Edge Functions only | Authoritative admin data, projections, aggregates, RLS | Accept writes from anywhere except ingest/authorized paths |
| Ingest Edge Function | Faces production bridge only | HMAC verification, validation, dedupe, projection application | Expose any dashboard data; accept unsigned traffic |
| Dispatch Edge Function | Faces production command handler only | Deliver approved commands, track dispatch state | Execute business logic itself; retry indefinitely without DLQ |
| Cron jobs | Internal | Aggregate refresh, freshness checks, reconciliation, DLQ retry | Mutate production |
| Production bridge (in TREXVEN prod) | Faces admin ingest/dispatch only | Outbox, publishing, command execution, reconciliation views | Leak E3 data; accept unauthenticated commands |

## 2. Supabase Edge Functions (admin project)

| Function | Trigger | Responsibility | Auth |
|---|---|---|---|
| `ingest-event` | HTTPS POST from bridge | Verify HMAC (kid + timestamp + nonce), validate schema, dedupe by `event_id`, apply projections transactionally, write sync metrics | HMAC only (no Supabase JWT) |
| `dispatch-command` | Cron every 1 min + manual retry | Select approved commands (row-locked), POST to production handler, record dispatch result | Vault secret (pair key) |
| `reconcile` | Cron daily 02:00 UTC | Fetch count/checksum views from bridge, compare, write `reconciliation_runs`, alert on drift | Vault secret (pair key) |
| `refresh-aggregates` | Cron hourly + daily | Refresh materialized views / daily aggregates for the window | Internal (service role) |
| `check-freshness` | Cron every 5 min | Compute per-metric lag, update freshness, fire stale alerts past SLA | Internal |
| `retry-dead-letters` | Cron every 15 min | Re-process DLQ items with backoff; quarantine after max attempts | Internal |
| `sentry-ingest` | Sentry webhook | Map Sentry issues → `system_errors` with redaction | Shared secret header |

## 3. Production-side bridge (additive to TREXVEN production) `[UNVERIFIED]`

| Piece | Type | Responsibility |
|---|---|---|
| `admin_bridge.outbox_events` | Table | Idempotent event queue populated by triggers on whitelisted source tables (businesses, subscriptions, payments, telemetry batches) |
| `bridge-publish` | Edge Function (cron 1 min) | Batch unsent rows, sign (HMAC-SHA256, kid + timestamp + nonce), POST to `ingest-event`, mark sent/failed |
| `command-handler` | Edge Function | Validate command schema + pair secret + idempotency key; execute whitelisted operations with production-side permission logic; write result + emit `command.result.v1` |
| Reconciliation views | SQL views | **Counts and checksums only** — never row data |
| Retry policy | Function logic | Exponential backoff (1/5/15/60 min), max 12 attempts → `failed` + alert |

Deployment of this bridge requires TREXVEN backend team approval — see doc 17 §7.

## 4. Scheduled jobs overview

| Job | Schedule | Output | Failure handling |
|---|---|---|---|
| bridge-publish (prod) | 1 min | Events delivered | Backoff → alert → DLQ on admin side |
| dispatch-command | 1 min | Commands executed | Mark failed; alert; manual retry |
| refresh-aggregates | hourly + daily | Fresh aggregates | Retry next cycle; staleness visible |
| check-freshness | 5 min | Freshness + alerts | Alert if job itself fails |
| reconcile | daily | Drift report | Alert FA/TA; targeted re-request |
| retry-dead-letters | 15 min | DLQ drained | Quarantine + alert after max |
| audit-partition-rotate | monthly | New partition | Pre-created 3 months ahead |

## 5. Secrets & configuration

| Secret | Stored in | Used by |
|---|---|---|
| `INGEST_HMAC_CURRENT` / `_PREVIOUS` | Supabase Vault (both projects) | bridge-publish → ingest-event |
| `COMMAND_PAIR_SECRET` | Vault (both projects) | dispatch-command ↔ command-handler |
| `SERVICE_ROLE_KEY` (admin) | Edge Function env only | ingest/dispatch/cron |
| `SENTRY_WEBHOOK_SECRET` | Edge Function env | sentry-ingest |
| Provider/model keys (future AI) | Production/FastAPI only | Never in admin platform |

Rotation: HMAC keys support dual-key overlap (rotate without downtime, 90-day cycle); pair secrets 180-day; all rotations logged in audit. All runtime config is environment-based (doc 14 §3).

## 6. Route Handler internals (read path)

Standard pipeline for every `/api/v1/*` GET:

1. Middleware attached `request_id` + verified session.
2. Zod-parse query params → 400 on failure.
3. `requirePermission()` against JWT claims → 403 (also logs the denied attempt at `warn`).
4. Data access via `lib/api/*`, executing queries **with the user's cookie session** so Postgres RLS is authoritative.
5. Response envelope + `Cache-Control: private, max-age=30..60` (never shared-cache).
6. Errors mapped: `ZodError`→400 `VALIDATION` · auth→401 · permission→403 · missing→404 · rate limit→429 · unknown→500 + Sentry (generic message out).

## 7. Command intake pipeline (write path)

`POST /api/v1/{resource}/commands`:

1. `requirePermission(command.permission)`.
2. Zod-validated payload (`schemas/commands.ts`).
3. Insert `administrative_commands` with unique `idempotency_key`; unique violation → 409 with the existing command reference (safe retry).
4. Status starts `pending_approval` when `command_types.requires_second_approval` else `approved`.
5. Append audit entry (action, resource, redacted payload).
6. Return `202` + `command_id` + status URL; UI shows CommandStatusCard and subscribes via polling/invalidation.

Dispatch cycle (Edge Function, every 1 min): select `approved` rows `FOR UPDATE SKIP LOCKED` → POST pair-secret-signed request to production handler → store result → mark `completed`/`failed` → audit. Failures mark the command, never silently retry beyond limits; Technical Admin can retry from the UI.

## 8. Data access patterns

| Pattern | Rule |
|---|---|
| Aggregates | Dashboards read `analytics_daily_aggregates` / materialized views only |
| Pagination | Keyset cursors `(created_at, id)` — stable under concurrent inserts |
| Redaction | Shared `redact()` helper for audit payloads and error samples (emails → hash, tokens removed, E3 rejected) |
| Audit | `writeAudit()` used by handlers; DB triggers cover direct SQL paths |
| Time | All comparisons UTC; ranges resolved server-side from `range` param or explicit ISO bounds |

## 9. Observability hooks

- Structured logs per request: `request_id`, admin id, route, latency, status.
- Sentry traces span Route Handlers and Edge Functions; Edge Functions set `trace_id` = event `trace_id` where present.
- Health endpoints (`/api/v1/health/live`, `/ready`) for the uptime probe (M-SYS-02).
- Job runs write to `sync_jobs` / `sync_failures` — the pipeline observes itself (doc 12).