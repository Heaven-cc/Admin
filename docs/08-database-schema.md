# 08 — PostgreSQL Database Schema Design

| Field | Value |
|---|---|
| Document | 08 — Database Schema (Admin Supabase project) |
| Version | 1.0 Baseline |
| Companion | 10-sync-pipeline (event schemas), 09-auth-authorization (RLS detail) |

## 1. Conventions

| Topic | Convention |
|---|---|
| Naming | `snake_case`; projections suffixed `_projection`; event tables prefixed `sync_` |
| PKs | `uuid default gen_random_uuid()` unless stated (projection PKs reuse production IDs) |
| Timestamps | `timestamptz`, UTC; every table has `created_at`; mutable tables have `updated_at` (trigger-maintained) |
| Money | Integer **minor units** (`amount_minor bigint`) + `currency char(3)`; never floats |
| Enums | Postgres enums for stable sets (`command_status`, `incident_status`, …); new values via migration |
| Soft delete | Not used — lifecycle via `status` columns; hard deletes only where retention policy says |
| Immutability | `admin_audit_logs` and `sync_ingest_events` have no UPDATE path (privileges revoked) |
| Partitioning | Monthly range partitions: `admin_audit_logs`, `analytics_events`, `vision_service_metrics`, `ai_service_metrics` |
| JSON | `jsonb` for payloads/provenance; schema validated at ingest, not trusted |
| RLS | Enabled on **every** table; deny-by-default; policies in doc 09 §5 |

## 2. Retention summary

| Data | Retention |
|---|---|
| `admin_audit_logs` | 7 years (partitioned, monthly) |
| `analytics_events` (raw) | 13 months, then dropped (aggregates retained indefinitely) |
| `analytics_daily_aggregates` | Indefinite |
| `vision_service_metrics`, `ai_service_metrics` | 18 months |
| `payments_projection`, `subscriptions_projection` | Life of platform (operational record) |
| `sync_ingest_events` | 90 days after `processed` |
| `sync_dead_letters` | 90 days after resolution |
| `sync_failures` | 12 months |
| `reconciliation_runs` | 24 months |
| `system_errors` | 12 months after resolution |
| Dataset assets (buckets) | Per dataset retention policy (doc 08 §G) |

## 3. Authoritative vs derived

| Category | Tables | Truth source |
|---|---|---|
| Admin-authoritative | admin_users, admin_roles, admin_permissions, admin_role_permissions, admin_audit_logs, administrative_commands, command_approvals, pricing_configurations, incidents, incident_timeline, support_cases, notifications, dataset_registry, dataset_versions, model_registry, model_evaluations, metric_definitions, capabilities, app_versions, fx_rates | The admin platform itself |
| Derived projections | businesses_projection, subscriptions_projection, payments_projection, refunds_projection, cameras_projection, vision_business_summary | Sync events (prod) — **never hand-edited** |
| Pipeline/telemetry | sync_ingest_events, sync_dead_letters, sync_jobs, sync_failures, reconciliation_runs, analytics_events, analytics_daily_aggregates, vision_service_metrics, ai_service_metrics | Ingest + jobs |

## A. Identity & access

**`admin_users`** — provisioned administrators (1:1 with `auth.users`).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| email | citext UNIQUE | |
| full_name | text | |
| role_id | uuid FK → admin_roles | |
| status | admin_status enum | `invited` / `active` / `suspended` / `deactivated` |
| mfa_enforced | boolean | default true |
| invited_by | uuid FK → admin_users | nullable |
| invited_at, last_login_at, created_at, updated_at | timestamptz | |

Indexes: `(role_id)`, `(status)`. RLS: self-read + `admin_team.read` holders. Source: admin platform.

**`admin_roles`** — `id uuid PK`, `key text UNIQUE` (`super_admin`, `operations_admin`, `finance_admin`, `support_admin`, `technical_admin`, `read_only_analyst`), `name`, `description`, `is_system boolean` (system roles undeletable). Seeded.

**`admin_permissions`** — `id uuid PK`, `key text UNIQUE` (`domain.action` — full list doc 09 §4), `category`, `description`. Seeded (~35 rows).

**`admin_role_permissions`** — PK (`role_id`,`permission_id`); FKs to both. Seeded matrix (doc 09 §4).

## B. Governance & commands

**`admin_audit_logs`** — append-only record of privileged activity. Partitioned monthly; PK (`id`, `occurred_at`).

| Column | Type | Notes |
|---|---|---|
| id | bigserial | within partition |
| occurred_at | timestamptz | partition key, default now() |
| actor_id | uuid | nullable (system events) |
| actor_role | text | denormalized for tamper-proof readability |
| action | text | e.g. `business.suspend_requested` |
| resource_type / resource_id | text | |
| request_id | text | correlation across logs |
| ip_hash | text | salted SHA-256 — raw IPs never stored |
| user_agent | text | truncated 200 |
| before / after | jsonb | redacted |
| metadata | jsonb | |

Indexes: (`resource_type`,`resource_id`,`occurred_at desc`), (`actor_id`,`occurred_at desc`), (`action`,`occurred_at`). **Immutability:** `REVOKE UPDATE, DELETE ON admin_audit_logs FROM PUBLIC, authenticated, service_role;` inserts only via security-definer function. Retention 7 y. Source: handlers + triggers.

**`administrative_commands`** — the command ledger (every production-affecting intent).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| command_type | text | must exist in `command_types` |
| target_type / target_id | text | e.g. `business` / uuid |
| payload | jsonb | schema-validated per type |
| status | command_status enum | `pending_approval → approved → dispatching → executing → completed / failed`; plus `rejected`, `cancelled` |
| requested_by | uuid FK → admin_users | |
| approval_required | boolean | from command type |
| idempotency_key | text UNIQUE | safe retries |
| result / error | jsonb | verified outcome |
| dispatched_at / completed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Indexes: partial on `status` for open states; (`requested_by`); (`target_type`,`target_id`).

```sql
create type command_status as enum (
  'pending_approval','approved','rejected','dispatching',
  'executing','completed','failed','cancelled'
);

create table administrative_commands (
  id               uuid primary key default gen_random_uuid(),
  command_type     text    not null,
  target_type      text    not null,
  target_id        text    not null,
  payload          jsonb   not null default '{}',
  status           command_status not null default 'pending_approval',
  requested_by     uuid    not null references admin_users(id),
  approval_required boolean not null default false,
  idempotency_key  text    not null unique,
  result           jsonb,
  error            jsonb,
  dispatched_at    timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index commands_open_idx on administrative_commands (status)
  where status in ('pending_approval','approved','dispatching','executing');
```

**`command_types`** — seeded registry: `key` PK, `permission_required`, `requires_second_approval bool`, `payload_schema jsonb`, `description`. Examples: `business.suspend` (OA+, second approval ✓), `business.restore` (OA+), `subscription.adjust` (FA+, ✓), `pricing.upsert` (FA+, ✓), `pricing.deactivate` (FA+, ✓), `admin.invite` (SA), `admin.role_change` (SA, ✓), `admin.deactivate` (SA, ✓), `dataset.version_register` (TA), `dataset.delete` (TA+SA, ✓).

**`command_approvals`** — `id uuid PK`, `command_id FK`, `approver_id FK → admin_users`, `decision enum('approved','rejected')`, `reason text not null`, `decided_at`. UNIQUE (`command_id`,`approver_id`). Trigger-enforced rule: `approver_id ≠ command.requested_by` (two-person rule, FR-997).

**`pricing_configurations`** — versioned country × plan price book.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| country_code | char(2) | `NG`,`GH`,`TG`,`CI` initially |
| plan_key | text | `start`,`core`,`pro` |
| currency | char(3) | NGN, GHS, XOF |
| amount_minor | bigint | |
| active | boolean | |
| effective_from | date | |
| superseded_by | uuid | chain of versions |
| created_by / approved_command_id | uuid / uuid | provenance |
| version | int | monotonic per (country, plan) |

UNIQUE (`country_code`,`plan_key`,`effective_from`). TG and CI are independent rows despite shared XOF `[A-04]`. **Edits occur only through `pricing.upsert` commands** that insert a new version — historical rows are never mutated.

## C. Projections (derived from sync — never hand-edited)

Cross-cutting rule: projections reference production IDs as plain `text` **without hard FKs** to tolerate out-of-order arrival; an orphan view surfaces unresolved references, and reconciliation closes gaps.

**`businesses_projection`** — the business directory record.

| Column | Type | Notes |
|---|---|---|
| business_id | text PK | production ID reused |
| name | text | E1 |
| country_code | char(2) | |
| registered_at | timestamptz | |
| account_status | enum | `active` / `trial` / `suspended` / `cancelled` / `churned` |
| plan_key / subscription_status | text / enum | current subscription snapshot |
| subscription_renews_at | timestamptz | |
| payment_provider | text | |
| last_activity_at | timestamptz | |
| pos_summary | jsonb | `{tx_30d, gmv_minor_30d, currency, active_devices}` (E0/E1) |
| vision_status / vision_camera_count | enum / int | metadata only |
| integration_health | jsonb | per-source freshness |
| updated_at / source_event_id | timestamptz / uuid | |

Indexes: `name` trigram GIN (search); (`country_code`), (`account_status`), (`last_activity_at desc`), (`plan_key`). RLS: `businesses.read`. Retention: life of platform. Source: `business.*`, `subscription.*`, `pos.*` events.

**`subscriptions_projection`** — `id uuid PK`; `business_id text`; `plan_key`; `status enum(trialing, active, past_due, canceled, expired)`; `currency char(3)`; `amount_minor bigint`; `billing_interval enum(monthly, annual)`; `period_start/period_end timestamptz`; `auto_renew bool`; `provider text`; `provider_subscription_ref text`; `canceled_at`; `cancel_reason`; `updated_at`; `source_event_id`. Indexes: (`business_id`), (`status`), (`period_end`) for the renewals window; UNIQUE (`provider`,`provider_subscription_ref`). Source: `subscription.*`.

**`payments_projection`** — `id uuid PK`; `business_id text`; `provider text`; `provider_ref text UNIQUE`; `amount_minor bigint`; `currency char(3)`; `status enum(success, failed, pending)`; `failure_code / failure_reason`; `occurred_at`; `reconciled bool default false`; `reconciled_at`; `updated_at`; `source_event_id`. Indexes: (`business_id`,`occurred_at desc`), (`status`), (`occurred_at desc`). **No card data, ever** (E2: amounts, currency, refs, reasons only). Source: `payment.*`.

**`refunds_projection`** — `id uuid PK`; `payment_ref text`; `business_id text`; `amount_minor`; `currency`; `reason`; `provider_ref UNIQUE`; `status enum(pending, completed, failed)`; `occurred_at`; `updated_at`. Source: `payment.refunded.v1`.

**`cameras_projection`** — `camera_id text PK`; `business_id text`; `label text`; `status enum(online, offline, disabled)`; `last_heartbeat_at timestamptz`; `model_version text`; `health jsonb`; `site text null` (reserved for on-prem hardware); `updated_at`. Indexes: (`business_id`), (`status`,`last_heartbeat_at`). **No media references of any kind.** Source: `vision.camera.*`.

## D. Analytics

**`analytics_events`** — raw events (13-month retention, monthly partitions by `occurred_at`).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | producer event id |
| event_type | text | from app instrumentation catalog |
| occurred_at / received_at | timestamptz | partition key |
| business_id | text | nullable (pre-registration events) |
| platform / app_version | text | `ios` / `android` / `web` |
| country_code | char(2) | country-level only |
| properties | jsonb | whitelist-validated |
| schema_version | int | |

Indexes: (`event_type`,`occurred_at`), (`business_id`,`occurred_at`). RLS: `analytics.read`.

**`analytics_daily_aggregates`** — the dashboard workhorse (ADR-008).

| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| date | date | UTC day |
| metric_key | text | registry key or event counter key |
| dimension | jsonb | `{country, platform, plan, …}` |
| dimension_hash | text | md5 of sorted JSON — with (`date`,`metric_key`) UNIQUE |
| value | numeric | |
| computed_at | timestamptz | |

Index: (`metric_key`,`date`). Retained indefinitely. Written by `refresh-aggregates` and by aggregate-bearing events (`pos.transaction.batch.v1`).

**Materialized views** (refreshed by cron, read by APIs): `mv_mrr_daily` (per currency + USD-normalized), `mv_plan_mix`, `mv_funnel_daily`, `mv_retention_cohorts`, `mv_platform_distribution`.

**`fx_rates`** — `date date`, `currency char(3)`, `rate numeric` (currency units per 1 USD), `source text`; PK (`date`,`currency`). Source: daily job or manual admin entry `[A-06: FX source to confirm]`. Enables honest multi-currency MRR consolidation.
## E. Monitoring

**`vision_service_metrics`** — time series, monthly partitions by `captured_at`. `id bigserial PK`; `captured_at timestamptz`; `business_id text null`; `camera_total / camera_connected / camera_offline int`; `processing_latency_p95_ms int`; `inference_throughput numeric`; `event_throughput numeric`; `storage_bytes bigint`; `gpu_util_pct / cpu_util_pct numeric null`; `model_version text`; `errors jsonb`; `source_event_id uuid`. Index (`captured_at`). Retention 18 months. Source: `vision.daily_summary.v1`. RLS: `vision.read`.

**`ai_service_metrics`** — `id bigserial PK`; `service enum(angel, intelligence)`; `captured_at`; `requests / errors int`; `latency_p50/p95/p99_ms int`; `tokens_in / tokens_out bigint`; `estimated_cost_minor bigint` + `cost_currency char(3)`; `provider text`; `model text`; `rate_limit_events int`; `source_event_id`. Index (`service`,`captured_at`). Retention 18 months. Source: `ai.usage.daily.v1`. RLS: `angel.read` / `intelligence.read` by service.

**`system_errors`** — grouped error registry. `id uuid PK`; `fingerprint text UNIQUE`; `service text`; `environment text`; `severity enum(S1..S4)`; `error_type text`; `message text` (redacted); `sample jsonb` (redacted, ≤ 4 KB); `occurrence_count int`; `first_seen_at / last_seen_at`; `affected_versions text[]`; `status enum(open, acknowledged, resolved)`; `assigned_to uuid null`; `sentry_url text`; `incident_id uuid null FK → incidents`; `resolved_at`; `created_at / updated_at`. Indexes: (`severity`,`status`), (`service`,`last_seen_at desc`). Retention 12 months post-resolution. Source: `sentry-ingest` + `error.occurrence.batch.v1`.

## F. AI data governance

**`dataset_registry`** — `id uuid PK`; `slug text UNIQUE`; `name`; `description`; `domain enum(vision, intelligence, sales, angel)`; `sensitivity enum(internal, confidential, restricted)`; `consent_basis text NOT NULL` (e.g. `contract:addendum-2026-01`, `consent:in-app`, `synthetic`); `includes_customer_data bool default false`; `status enum(draft, under_review, approved, deprecated, deleted)`; `retention_policy text`; `owner_admin_id FK`; `created_at / updated_at`. **Rule (FR-906):** `includes_customer_data = true` requires an explicit consent basis and review — nothing auto-populates datasets.

**`dataset_versions`** — `id uuid PK`; `dataset_id FK`; `version int`; `storage_bucket text`; `storage_path text`; `size_bytes / row_count bigint`; `checksum_sha256 text`; `provenance jsonb`; `deidentification_method text`; `quality_status enum(unrated, passed, failed)`; `annotation_status enum(unannotated, partial, complete)`; `training_eligible bool default false`; `created_by`; `created_at`. UNIQUE (`dataset_id`,`version`). Assets only in private buckets (ADR-007) — DB stores metadata/pointers.

**`model_registry`** — `id uuid PK`; `name`; `domain`; `provider text`; `model_ref text`; `status enum(experimental, evaluated, production, retired)`; `notes`; timestamps.

**`model_evaluations`** — `id uuid PK`; `model_id FK`; `dataset_version_id FK`; `metrics jsonb` (precision/recall/MAE…); `evaluated_at`; `evaluator text`; `notes`.

## G. Sync pipeline

**`sync_ingest_events`** — dedupe ledger + staging. `id uuid PK` (= **the event_id** — the idempotency anchor); `event_type text`; `schema_version int`; `source_service text`; `occurred_at / received_at timestamptz`; `payload jsonb`; `processing_status enum(received, processed, failed, dead_letter, duplicate_late)`; `applied_at`; `error jsonb`; `trace_id text`. Updates restricted to security-definer processing functions; `authenticated` has SELECT-only. Retention: rows dropped 90 days after `processed`.

**`sync_dead_letters`** — `id uuid PK`; `event_id uuid`; `event_type`; `payload jsonb`; `first_failure_at`; `failure_count int`; `last_error jsonb`; `status enum(retrying, quarantined, resolved, discarded)`; `resolved_by / resolved_at`. Retention 90 days post-resolution. UI: System Health → DLQ.

**`sync_jobs`** — `job_key text PK`; `last_run_at`; `last_success_at`; `next_run_at`; `status enum(idle, running, failed)`; `last_duration_ms`; `checkpoint jsonb`; `updated_at`. Powers M-SYNC-01 and the sync panel.

**`sync_failures`** — `id bigserial PK`; `job_key`; `event_id null`; `error_type`; `message`; `context jsonb`; `occurred_at`. Retention 12 months.

**`reconciliation_runs`** — `id uuid PK`; `run_at`; `entity text`; `window_start / window_end date`; `admin_count / prod_count bigint`; `delta bigint`; `checksum_match bool`; `status enum(ok, drift, healed, failed)`; `details jsonb`. Retention 24 months.
## H. Operations & registries

**`incidents`** — `id uuid PK`; `title`; `severity enum(S1..S4)`; `status enum(open, investigating, mitigated, resolved, closed)`; `affected_services text[]`; `opened_by FK`; `opened_at / resolved_at`; `summary`; `postmortem_url`; timestamps. Index (`status`,`severity`). Illegal transitions blocked by a status-transition function. RLS: `incidents.read` / manage via function with `incidents.manage`.

**`incident_timeline`** — `id uuid PK`; `incident_id FK`; `entry text`; `author_id FK`; `occurred_at`. Index (`incident_id`,`occurred_at`).

**`support_cases`** — `id uuid PK`; `business_id text` (projection reference); `channel enum(email, whatsapp, call, in_person, other)`; `subject`; `priority enum(low, normal, high, urgent)`; `status enum(open, pending_customer, resolved, closed)`; `opened_by_admin FK`; `opened_at / closed_at`; `summary`; timestamps. Indexes: (`business_id`,`opened_at desc`), (`status`).

**`notifications`** — `id uuid PK`; `recipient_admin_id uuid null` XOR `recipient_role text null` (role-wide); `category enum(incident, sync, payment, approval, security, system)`; `severity`; `title`; `body`; `href`; `read_at`; `created_at`. Index (recipient, `created_at desc`). Powers the bell + email routing (Settings → Notifications).

**`metric_definitions`** — the KPI registry (doc 01 §7 is the seed source). `key text PK` (`M-REV-01`); `display_name`; `definition text`; `source_type enum(projection, aggregate, derived, probe)`; `source_ref text`; `freshness_sla_minutes int`; `required_permission text`; `unit enum(count, currency, percent, ms, bytes)`; `currency char(3) null`; `direction enum(higher_better, lower_better)`; `status enum(live, estimated, not_instrumented)`; `owner text`; timestamps. Powers freshness chips, tooltips, and the "never invent metrics" rule mechanically.

**`capabilities`** — `key text PK` (`vision.streaming`); `product enum(owner_app, pos, vision, intelligence, angel, admin, website)`; `name`; `status enum(planned, implemented, tested, deployed)`; `last_verified_at`; `verified_by`; `notes`. Seeded with honest statuses — e.g. Angel `planned` until verified otherwise `[A-08]`.

**`app_versions`** — `id uuid PK`; `platform enum(ios, android)`; `version_name text`; `version_code int`; `released_at`; `is_min_supported bool`; `notes`. UNIQUE (`platform`,`version_code`). Source: manual entry or release events `[A-09]`.

## 12. Migrations, rollback & schema versioning

- `supabase/migrations/0001_init.sql` … sequential, CLI-managed; `supabase_migrations` tracks applied state.
- RLS policies ship **in the same migration** as their table — a table is never briefly unprotected.
- Seed data (roles, permissions, command types, metric definitions, capabilities) lives in idempotent seed migrations (`INSERT … ON CONFLICT DO UPDATE` on natural keys).
- Destructive migrations require an ADR + verified fresh backup + down script or documented compensating plan (doc 14 §5).
- CI: `supabase db reset` + full pgTAP suite on every PR; `supabase db diff` against shadow DB prevents drift.
- Each release tag exports a `schema.sql` snapshot for reviewable diffs; schema version surfaced at `/health/ready`.

**Full DDL note:** this document is the logical schema (authoritative for review); the executable DDL lives in the migration files and must implement exactly what is specified here — column names, types, constraints, indexes, and grants. Any divergence is a defect.