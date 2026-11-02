# 02 — Technical Architecture Specification

| Field | Value |
|---|---|
| Document | 02 — Technical Architecture |
| Version | 1.0 Baseline |
| Date | 2026-10-15 |
| Depends on | 00-README; detailed companions: 08 (schema), 09 (auth), 10 (sync), 11 (APIs) |

## 1. Architectural principles

| # | Principle | Consequence |
|---|---|---|
| P1 | Separation of trust | Admin platform is its own Supabase project, its own auth domain, its own deployment. No shared database with TREXVEN production. |
| P2 | One-way flow | Data moves production → admin only. The only admin → production traffic is authenticated commands and reconciliation count queries. |
| P3 | Least privilege | Browsers get only the anon key + user JWT. Service-role keys exist only inside Edge Functions and CI secrets. |
| P4 | Data minimization | Sync payloads are whitelisted per event schema. Nothing is synced "just in case". |
| P5 | Idempotency everywhere | Every event carries a unique `event_id`; every command carries an `idempotency_key`; replays are safe by construction. |
| P6 | Auditability | Append-only audit log at the DB level; every command, approval, and restricted read is recorded. |
| P7 | Graceful degradation | Missing telemetry, stale data, and dead pipelines render as explicit states, never as zeros or crashes. |
| P8 | Multi-product future | Event envelopes carry `source_service`; projections are keyed by product so a future ODT product is a new event type, not a redesign. |

## 2. System components

| Component | Technology | Hosting | Responsibility |
|---|---|---|---|
| Admin Web | Next.js 15 (App Router), TypeScript strict, Tailwind, shadcn/ui, TanStack Query | Vercel | All UI; thin authorized read APIs (Route Handlers) |
| Admin API layer | Next.js Route Handlers `/api/v1/*` | Vercel | Dashboard/business/etc. queries via user JWT (RLS-scoped); command intake |
| Admin Supabase | PostgreSQL + RLS, Supabase Auth, Storage, Edge Functions | Supabase (dedicated project) | Authoritative admin data, projections, analytics aggregates |
| Ingest Edge Function | Deno Edge Function `ingest-event` | Supabase | HMAC verification, schema validation, dedupe, projection application |
| Command Dispatcher | Edge Function `dispatch-command` | Supabase | Delivers approved commands to the production command handler |
| Scheduled Jobs | Edge Functions on cron (`reconcile`, `refresh-aggregates`, `check-freshness`, `retry-dead-letters`) | Supabase cron | Maintenance and self-healing |
| TREXVEN Production Supabase | Existing `[UNVERIFIED]` | Supabase | Source of truth for the business — **not modified by this project except the additive bridge (below)** |
| Production Admin Bridge | Additive schema `admin_bridge` + Edge Functions `bridge-publish`, `command-handler`, reconciliation views | TREXVEN production project | Outbox publishing of signed events; execution of approved commands |
| Paystack | Existing production integration `[UNVERIFIED]` | External | Payment source events (webhooks land in production, are summarized into sync events) |
| Sentry | SaaS | External | Frontend/backend error capture → webhook into admin `system_errors` |
| Future AI infra | Python + FastAPI + workers | TBD (Phase 5+) | Training/evaluation — explicitly separated from the admin web app |

## 3. Data classification (E0–E3)

Every synced field and table is classified. Classification is enforced at the pipeline (payload whitelist) and reviewed per release.

| Class | Name | Examples | Synced to admin? | Storage rules |
|---|---|---|---|---|
| E0 | Public aggregate | Daily GMV totals, plan distribution, install counts | Yes | Aggregates retained indefinitely |
| E1 | Operational metadata | Business name, country, plan, status, camera counts, app versions | Yes | Projections, updated in place |
| E2 | Financial | Payment amounts, currency, provider refs, failure reasons | Yes | Projections; amounts as integer minor units; no card data ever |
| E3 | Restricted | Customer PII (emails, phones, addresses), transaction-level customer data, CCTV footage, recordings, live streams, credentials | **Never synced** | Stays in production; admin sees only E0/E1 summaries |

Rules: (1) payloads declare a class per field; (2) E3 fields are rejected by the ingest validator; (3) any exceptional E3 need requires a documented legal/privacy authorization and a new reviewed event schema — there is no ad-hoc path.

## 4. Core data flows

| Flow | Summary | Detail |
|---|---|---|
| F1 Replica sync | Production writes → `admin_bridge.outbox_events` (triggers) → `bridge-publish` batches → signed HTTPS POST → `ingest-event` verifies + dedupes → staging → idempotent projection upserts → daily aggregates refreshed on schedule | doc 03 D2, doc 10 |
| F2 Command execution | Admin UI → Route Handler (perm + validation) → `administrative_commands` row → approval (if high-risk) → `dispatch-command` → production `command-handler` executes → `command.result.v1` event flows back → command marked completed → audit | doc 03 D3, doc 09 §6 |
| F3 Audit | Route handlers and DB triggers append to `admin_audit_logs` (append-only): actor, action, resource, before/after (redacted), `request_id` correlation, IP hash | doc 08 §B, doc 09 §7 |
| F4 Reconciliation | Daily job queries production bridge **count/checksum views only**; compares with admin projections; drift → alert → targeted re-request of affected ID ranges | doc 10 §6 |
| F5 Error intake | Sentry webhook (admin web) → `system_errors` with redaction; Flutter crashes and service errors arrive as `error.occurrence.batch.v1` events via the bridge | doc 12 |

## 5. Architecture Decision Records

| ADR | Title | Decision | Rationale / consequences |
|---|---|---|---|
| ADR-001 | Separate Supabase project | Dedicated admin project; no shared DB with production | Blast-radius isolation, independent policies/scaling, no credential sharing. Cost: duplicate infra management. |
| ADR-002 | Push-based signed events (outbox) | Production publishes HMAC-signed events from an outbox; pull-based reader role used **only** for reconciliation counts | No long-lived prod credential inside admin; natural retry/audit story. Cost: requires additive prod schema + functions `[UNVERIFIED approval]`. |
| ADR-003 | Defense-in-depth authorization | UI gating → Route Handler check → **Postgres RLS (authoritative)** → service role confined to Edge Functions | A leaked anon key grants nothing beyond RLS-visible data. Cost: RLS policy test burden (pgTAP). |
| ADR-004 | Route Handlers for app APIs; Edge Functions for cross-service endpoints | Dashboard APIs in Next.js (typed, co-versioned with UI); `ingest-event`, `dispatch-command`, cron jobs as Supabase Edge Functions | Ingest availability decoupled from web deploys; DB-adjacent processing. Cost: two deploy targets. |
| ADR-005 | Immutable audit at DB level | `REVOKE UPDATE, DELETE`; monthly partitions; Super Admin included; optional WORM export | Insider-tamper resistant. Cost: corrections require compensating entries, never edits. |
| ADR-006 | Command sourcing for mutations | Production changes only via command records executed by production handler; projections update from result events | Prevents "edit the replica" failure mode; complete trail. Cost: latency (async), requires prod-side handler. |
| ADR-007 | Object storage for datasets | Supabase Storage private buckets; DB stores metadata/checksums only | Postgres stays lean; bucket policies enforce access. |
| ADR-008 | Aggregate-first reporting | `analytics_daily_aggregates` + materialized views; raw events partitioned monthly, 13-month retention | Constant-time dashboards at 100k businesses. Cost: aggregation jobs + freshness lag. |
| ADR-009 | Postgres-only for Phase 1 | No ClickHouse/Kafka/Temporal initially | Ops simplicity for a small team; revisit at documented thresholds (doc 16 §4). |

## 6. Technology stack

| Layer | Choice | Rationale / notes |
|---|---|---|
| Framework | Next.js 15, App Router, React 19 | RSC for data-heavy pages, Route Handlers, Vercel-first DX |
| Language | TypeScript 5.x, `strict: true` | Non-negotiable |
| Styling | Tailwind CSS v4 (fallback v3 if shadcn registry parity requires — decide at scaffold time, one line in `docs/decisions.md`) | Utility-first, token-driven theming |
| Components | shadcn/ui + Radix primitives, Lucide icons | Accessible primitives, ownable code |
| Charts | Recharts 2 | Declarative, SSR-friendly, team-familiar |
| Server state | TanStack Query 5 | Cache, retries, freshness UX |
| Forms | React Hook Form 7 + Zod 3 | Shared schemas client/server |
| Backend | Supabase (Postgres 15+, Auth, Storage, Edge Functions, Vault) | As briefed; RLS is the authorization backbone |
| Migrations | Supabase CLI SQL migrations (versioned, reviewed) | Rollback = down migration + PITR (doc 14 §5) |
| Tests | Vitest, Testing Library, Playwright, pgTAP | Layers per doc 13 |
| Errors | Sentry (web now; Flutter via bridge events later) | doc 12 |
| CI/CD | GitHub Actions + Vercel | doc 14 |
| Future AI | Python 3.12, FastAPI, background workers, configurable model providers | Phase 5+; isolated from web app |

## 7. Performance & scalability approach

| Scale (businesses) | Strategy |
|---|---|
| 100 | Straightforward; aggregates still used so patterns are proven early |
| 1,000 | Index-tuned projections; cursor pagination everywhere; daily aggregates carry dashboards |
| 10,000 | Monthly partitions on raw tables; materialized views refreshed on schedule; read-load isolated from ingest |
| 100,000 | Partition pruning + parallel aggregate refresh; consider ClickHouse for analytics (ADR-009 revisit); API caching layer |

Targets: dashboard p95 API < 500 ms (aggregated reads); KPI page TTI < 3 s on 4G; ingest batch of 1,000 events < 5 s; no dashboard query scans raw `analytics_events`.

## 8. Environments (summary)

`local` → `staging` (Vercel preview + admin-staging Supabase + fake producer) → `production` (Vercel prod + admin-prod Supabase + real bridge). Full strategy, variables, and promotion gates: doc 14.

## 9. Security summary

MFA-enforced invite-only auth; RLS on every table; service-role keys only in Edge Functions/CI; HMAC-signed pipeline with replay protection; append-only audit; secrets in Supabase Vault; no secrets in client bundle (CI-enforced). Full detail: docs 09, 10, 12.