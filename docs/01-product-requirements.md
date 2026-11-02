# 01 — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Document | 01 — Product Requirements |
| Version | 1.0 Baseline |
| Date | 2026-10-15 |
| Depends on | 00-README (conventions), 16-risks-assumptions |

## 1. Product overview

The **ODT Admin Platform** is a standalone internal web application that gives ODT staff a single, trustworthy command center for the TREXVEN business: who is subscribed, how much revenue the platform earns, how customers actually use the products, whether Vision / Angel / Intelligence services are healthy, where errors occur, and which administrative actions were taken by whom.

It consumes a **controlled replica** of authorized production data (businesses, subscriptions, payments, product analytics, service telemetry) and owns **authoritative admin-side data** (audit logs, administrative commands, pricing configuration, incidents, AI dataset registry).

**Definition of success (v1):** an ODT manager can answer "how is TREXVEN doing today?" in under 30 seconds, and every privileged action is permission-checked, confirmable, traceable to a production-side effect, and permanently audited.

## 2. Goals and non-goals

### Goals

| ID | Goal |
|---|---|
| G-1 | Single source of truth for TREXVEN business health across all products |
| G-2 | Safe administrative operations with explicit approval and immutable audit |
| G-3 | Data honesty: every metric shows source, freshness, and availability status |
| G-4 | Architecture that generalizes to future ODT products without redesign |
| G-5 | Zero direct privileged access from the admin platform to customer production data |

### Non-goals (explicit)

| ID | Non-goal |
|---|---|
| N-1 | Customer-facing functionality of any kind |
| N-2 | Processing payments or fabricating payment success (status comes only from trusted provider events + reconciliation) |
| N-3 | Executing AI training jobs (Phase 5 delivers registry/governance only) |
| N-4 | Storing customer PII beyond operational minimums; no E3 data (doc 02 §3) |
| N-5 | Access to CCTV footage, recordings, or live streams |
| N-6 | Replacing or embedding the Owner App, POS App, or public website |

## 3. Users and personas

| Role | Code | Primary jobs | Core modules |
|---|---|---|---|
| Super Admin | SA | Platform governance, admin team, final approvals | All; Admin Team; Audit |
| Operations Admin | OA | Day-to-day account operations | Businesses, Subscriptions, Incidents |
| Finance Admin | FA | Revenue, payments, pricing | Subscriptions, Payments, Settings → Pricing |
| Support Admin | SuA | Account reviews, support cases | Businesses, Payments (read), Incidents |
| Technical Admin | TA | Service health, sync pipeline, errors | System Health, Vision, Angel, Intelligence, AI Data |
| Read-Only Analyst | RO | Reporting and analysis; zero mutations | All read-only dashboards |

Full permission matrix: doc 09 §4.

## 4. Scope

**In-scope modules (14):** Overview, Businesses, Subscriptions, Payments, Product Analytics, Vision, Intelligence, Angel, System Health, Incidents, AI Data, Admin Team, Audit Logs, Settings.

**Out of scope:** §2 non-goals; native mobile admin apps (responsive web only in v1).

## 5. Product principles

| # | Principle | Implication |
|---|---|---|
| P-1 | Data honesty | Every KPI carries freshness timestamp and status; unavailable ≠ zero |
| P-2 | Safety by default | Mutations require confirmation; high-risk actions require a second approver |
| P-3 | Replicas are not truth | Projections display state; only production handlers change production |
| P-4 | Speed at any scale | Dashboards read pre-aggregated data, never raw production transactions |
| P-5 | Minimal PII | Sync payloads carry the least data that answers operational questions |
| P-6 | Audit everything | Every restricted read and every mutation is logged |

## 6. Functional requirements

Priorities: **P0** = Phase 1–2 mandatory, **P1** = Phase 3–4, **P2** = Phase 5 / nice-to-have. Phase mapping: doc 15.

### 6.1 Dashboard Home (FR-1xx) — P0, Phase 1

| ID | Requirement | P |
|---|---|---|
| FR-101 | KPI card grid covering the metric registry (§7), with global date-range filter: Today / 7d / 30d / 90d / custom | P0 |
| FR-102 | Each card: value, delta vs previous equal-length period, sparkline, freshness timestamp, definition tooltip | P0 |
| FR-103 | ODT subscription revenue (MRR/ARR) visually and semantically separated from customer sales volume (GMV) | P0 |
| FR-104 | Recent platform events feed: incidents, critical errors, sync failures, payment anomalies | P0 |
| FR-105 | Metrics without data show explicit "Not instrumented yet" state with explanation — never zero or blank | P0 |
| FR-106 | Cards gated by permission; unauthorized cards hidden entirely (not zeroed) | P0 |
| FR-107 | Comparison mode toggle (previous period / previous year) | P2 |

### 6.2 Business Management (FR-2xx) — P0, Phase 2

| ID | Requirement | P |
|---|---|---|
| FR-201 | Directory: full-text search (name, ID), filters (status, plan, country, Vision status), sortable columns, cursor pagination | P0 |
| FR-202 | Business profile: identifier, name, country, registration date, plan, subscription status, renewal date, payment provider, last activity, account status | P0 |
| FR-203 | Profile tabs: Overview · Subscription · Payments · POS usage · Vision · Support history · Timeline · Actions | P0 |
| FR-204 | POS usage summary: transaction counts, GMV, active POS devices (E0/E1 only) `[UNVERIFIED telemetry]` | P0 |
| FR-205 | Vision status: subscription/activation state, camera counts — no footage links | P1 |
| FR-206 | Integration health indicators (payments, Vision, sync freshness per source) | P1 |
| FR-207 | Actions: suspend / restore account via command flow with typed confirmation; suspend = high-risk (second approval) | P1 |
| FR-208 | Owner PII minimized to business-level fields; no personal contact data in list views | P0 |
| FR-209 | Activity timeline merging subscription, payment, status, support, and command events | P1 |

### 6.3 Subscriptions (FR-3xx) — P0, Phase 2

| ID | Requirement | P |
|---|---|---|
| FR-301 | Overview: active / canceled / trialing counts by plan (Start, Core, Pro) and by country | P0 |
| FR-302 | Revenue analytics: MRR, ARR, MRR movement (new / expansion / contraction / churn) | P0 |
| FR-303 | Country-level reports: NG (NGN), GH (GHS), TG (XOF), CI (XOF) with independent pricing | P0 |
| FR-304 | Plan distribution and tier-transition flows | P1 |
| FR-305 | Renewals calendar: upcoming renewals/expirations (next 30 days) | P0 |
| FR-306 | Cancellation tracking with reason where the source provides it | P1 |
| FR-307 | Authorized subscription adjustments (plan/status override) via command flow: permission → approval → audit → verified result. Never fabricates a successful payment. | P1 |
| FR-308 | Pricing configuration UI (country × plan matrix) — changes are commands requiring Finance permission + second approval | P1 |

### 6.4 Payments (FR-4xx) — P0, Phase 2

| ID | Requirement | P |
|---|---|---|
| FR-401 | Transaction list from projections: amount (minor units), currency, status, provider, date, business ref — no card data, ever | P0 |
| FR-402 | Payment success rate: overall, per country, per provider | P0 |
| FR-403 | Failed payments queue with provider reason codes | P0 |
| FR-404 | Refund records (read-only view) — refund *execution* stays with provider tooling | P1 |
| FR-405 | Reconciliation status: provider-summary events vs projection match/unmatch queue | P1 |
| FR-406 | Provider webhook monitor: delivery health, latency, failure counts `[UNVERIFIED existing webhook setup]` | P1 |
| FR-407 | Multi-provider-ready design (provider dimension on all payment views) | P0 |

### 6.5 Product Analytics (FR-5xx) — P0, Phase 2

| ID | Requirement | P |
|---|---|---|
| FR-501 | Funnel: install → registration → onboarding completed → active → paid `[telemetry must be implemented in apps — see doc 10 §8]` | P0 |
| FR-502 | Definitions panel distinguishing installations vs downloads vs registrations vs active users | P0 |
| FR-503 | Retention cohorts (D1 / D7 / D30) | P1 |
| FR-504 | Feature adoption matrix for Owner App and POS features `[requires feature_used events]` | P1 |
| FR-505 | Platform / device / app-version distribution | P0 |
| FR-506 | Geographic distribution at country level only (no precise location) | P0 |
| FR-507 | Session trends over time | P0 |
| FR-508 | Conversion: registration → paid subscription funnel | P0 |
| FR-509 | Feature abandonment (started vs completed flows) | P2 |

### 6.6 Vision Monitoring (FR-6xx) — P1, Phase 3

| ID | Requirement | P |
|---|---|---|
| FR-601 | Fleet overview: registered / connected / disconnected cameras with health badges | P1 |
| FR-602 | Vision server status, processing latency, inference + event-processing throughput | P1 |
| FR-603 | Recording pipeline status and storage consumption (aggregate only) | P1 |
| FR-604 | AI model versions in use, detection failures, processing errors | P1 |
| FR-605 | Vision businesses by subscription tier | P1 |
| FR-606 | Model supports cloud-hosted Vision now and on-premises TREXVEN hardware later (site entity) | P2 |
| FR-607 | **No** footage, streams, or recordings exposed; exceptional-access workflow documented but disabled by default | P0 |
| FR-608 | Capability-status banner + "awaiting telemetry" states until real events exist | P0 |

### 6.7 Angel Monitoring (FR-75x) — P1, Phase 3

| ID | Requirement | P |
|---|---|---|
| FR-751 | Request volume, latency percentiles (p50/p95/p99), error rate | P1 |
| FR-752 | Model/provider configuration view (names + versions only; credentials never visible) | P1 |
| FR-753 | Token consumption and estimated provider cost by period | P1 |
| FR-754 | Rate-limit events and service uptime | P1 |
| FR-755 | Capability status: Angel is never presented as operational until `capabilities.status = deployed` `[ASSUMPTION A-08]` | P0 |

### 6.8 Intelligence Monitoring (FR-76x) — P1, Phase 3

| ID | Requirement | P |
|---|---|---|
| FR-761 | Processing job counts by status; failed jobs with error grouping | P1 |
| FR-762 | Insight generation rate and data freshness per input source | P1 |
| FR-763 | Model versions and evaluation results | P1 |
| FR-764 | Anomaly-detection performance (precision/recall where evaluation exists) | P2 |
| FR-765 | Vision → Intelligence integration health | P1 |
| FR-766 | Capability status handling identical to FR-608/755 | P0 |

### 6.9 System Health (FR-80x) — P1, Phase 3

| ID | Requirement | P |
|---|---|---|
| FR-801 | Service status board: TREXVEN backend, sync pipeline, Vision, Angel, Intelligence, payment webhooks — status, latency, last check | P1 |
| FR-802 | Error groups: severity, first/last seen, occurrence count, affected versions, affected service, environment, resolution status, assignee | P1 |
| FR-803 | Sentry deep-link per error group `[Sentry integration]` | P1 |
| FR-804 | Sync pipeline health: per-job lag, failure counts, DLQ size, last successful run | P1 |
| FR-805 | Authentication-failure monitoring with anomaly highlighting (spike detection) | P2 |
| FR-806 | Background job failure feed with retry controls (Technical Admin) | P1 |

### 6.10 Incidents (FR-85x) — P1, Phase 3

| ID | Requirement | P |
|---|---|---|
| FR-851 | Incident records: title, severity (S1–S4), lifecycle (open → investigating → mitigated → resolved → closed), affected services, timeline entries | P1 |
| FR-852 | Link error groups and sync failures to incidents | P1 |
| FR-853 | Postmortem URL + summary fields | P2 |
| FR-854 | Notifications on open and severity escalation | P1 |

### 6.11 AI Data Governance (FR-90x) — P2, Phase 5

| ID | Requirement | P |
|---|---|---|
| FR-901 | Dataset registry: name, domain (vision/intelligence/sales/angel), sensitivity, consent/licensing basis, status lifecycle | P2 |
| FR-902 | Dataset versions: storage pointer (private bucket), checksum, size, row count, provenance, quality status, annotation status, training eligibility | P2 |
| FR-903 | Model registry + evaluation records linked to dataset versions | P2 |
| FR-904 | Retention policies and deletion workflow (deletion = command requiring second approval + audit) | P2 |
| FR-905 | Metadata access by permission; assets only in private storage buckets | P2 |
| FR-906 | **Customer business data never automatically becomes training data** — explicit inclusion basis required per dataset | P0 |

### 6.12 Admin Team (FR-95x) — P0, Phase 1

| ID | Requirement | P |
|---|---|---|
| FR-951 | Admin list: name, email, role, status, MFA status, last login | P0 |
| FR-952 | Invite admin (email + role) — provisioning token; no public signup path exists | P0 |
| FR-953 | Role change is a high-risk command (second approval + audit) | P0 |
| FR-954 | Deactivate admin (never hard-delete; audit FK preserved) | P0 |
| FR-955 | Users cannot change their own role; no role can edit/delete audit records (impossible by DB design) | P0 |

### 6.13 Audit Logs (FR-97x) — P0, Phase 1

| ID | Requirement | P |
|---|---|---|
| FR-971 | Filterable immutable log: actor, action, resource type/ID, date range, request ID | P0 |
| FR-972 | Detail view with before/after diff (sensitive fields redacted) | P0 |
| FR-973 | CSV export behind `audit.export`, itself audited | P1 |
| FR-974 | 7-year retention, partitioned monthly | P0 |

### 6.14 Settings, Commands & Approvals (FR-99x)

| ID | Requirement | P |
|---|---|---|
| FR-991 | Pricing matrix (country × plan, currency, amount) — read for FA+; edits are commands with effective date + reason | P1 |
| FR-992 | Notification preferences per role (alert email destinations) | P1 |
| FR-993 | Capability flags view (planned/implemented/tested/deployed per product) | P0 |
| FR-994 | Integrations status (Sentry, Paystack webhooks, bridge) — metadata only, never secret values | P1 |
| FR-995 | Pending-approvals inbox with payload diff view | P1 |
| FR-996 | Command history: status, result, error, idempotency key; retry of failed dispatch (Technical Admin) | P1 |
| FR-997 | Two-person rule enforced in DB: `approver_id ≠ requested_by` | P0 |

## 7. Metric registry (authoritative summary)

Canonical copy lives in `metric_definitions` (doc 08 §E). Launch status reflects what the pipeline can honestly deliver on day one.

| Key | Metric | Definition | Source | Freshness SLA | Permission | Launch status |
|---|---|---|---|---|---|---|
| M-BIZ-01 | Registered businesses | Distinct business accounts ever registered | `business.*` events | 60 min | dashboard.view | live post-sync |
| M-BIZ-02 | Active businesses | ≥1 session or transaction in range | analytics aggregates | 24 h | dashboard.view | live |
| M-BIZ-03 | New registrations | Created in range | `business.created` | 60 min | dashboard.view | live |
| M-SUB-01 | Active subscriptions | status = active | `subscription.*` | 60 min | dashboard.view | live |
| M-SUB-02 | Trial accounts | status = trial `[A-05: trial tier exists]` | `subscription.*` | 60 min | dashboard.view | live |
| M-SUB-03 | Paying businesses | ≥1 successful payment in range | `payment.*` | 24 h | dashboard.view | live |
| M-REV-01 | MRR | Σ normalized monthly value of active subs, reporting currency | `subscription.*` + fx_rates | 24 h | revenue.view | live |
| M-REV-02 | ARR | MRR × 12 | derived | 24 h | revenue.view | live |
| M-REV-03 | Est. churn | Cancellations ÷ active at period start | `subscription.*` | 24 h | revenue.view | live |
| M-PAY-01 | Failed payments | `payment.failed` in range | `payment.*` | 60 min | payments.read | live |
| M-POS-01 | Recorded sales (GMV) | Σ sales across businesses — customer revenue, **not** ODT income | `pos.transaction.batch` | 24 h | sales.view | live `[UNVERIFIED telemetry]` |
| M-POS-02 | Active POS installations | POS devices seen in 30 d | `device.heartbeat` | 24 h | sales.view | not instrumented yet |
| M-APP-01 | App installations | Attributed installs | `app.install` | 24 h | analytics.read | not instrumented yet |
| M-APP-02 | Active devices | ≥1 session in range | `session.start` | 24 h | analytics.read | not instrumented yet |
| M-VIS-01 | Connected cameras | Heartbeat < 5 min | `vision.camera.heartbeat` | 5 min | vision.read | not instrumented yet |
| M-VIS-02 | Active Vision businesses | ≥1 connected camera | derived | 24 h | vision.read | not instrumented yet |
| M-SYS-01 | Open critical errors | S1/S2 `system_errors`, status open | error pipeline | 5 min | health.read | live (admin-side) |
| M-SYS-02 | API health | Synthetic probe success (1 h) | uptime probe | 1 min | health.read | live |
| M-AI-01 | Angel availability | Probe + error-rate composite | `ai.usage.daily` + probe | 15 min | angel.read | not instrumented yet |
| M-SYNC-01 | Sync lag | Newest prod event → applied | pipeline internal | 5 min | health.read | live |

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Aggregated-read API p95 < 500 ms; Overview TTI < 3 s on 4G |
| NFR-02 | Admin web availability ≥ 99.9% monthly |
| NFR-03 | RPO ≤ 15 min (PITR); RTO ≤ 4 h |
| NFR-04 | WCAG 2.1 AA across all screens |
| NFR-05 | Latest two versions of Chrome/Edge/Firefox/Safari; tablet/mobile usable |
| NFR-06 | Every mutation audited within 1 s of execution |
| NFR-07 | Sync lag p95 < 15 min (operational), < 24 h (analytics batches) |
| NFR-08 | MFA for 100% of admin accounts; 8 h absolute session expiry |
| NFR-09 | Zero secrets in client bundle (CI-enforced) |
| NFR-10 | Retention per doc 08 §2; PII redaction in all logs (doc 12 §5) |

## 9. v1 success criteria

1. All 14 modules ship with loading/empty/error/unauthorized/stale states.
2. Overview answers "how is the business doing?" with zero invented numbers.
3. Sync pipeline is idempotent under duplicate replay (doc 13 §6).
4. One business suspended end-to-end via command + approval, visible in audit with verified production result.
5. Pricing change executed with approval and effective-date handling.
6. All pgTAP policy tests green: every role reaches only permitted rows.
7. Zero critical Sentry issues at launch; alerts routed and fire-drilled.
8. Staging→production promotion exercised once via the documented pipeline.