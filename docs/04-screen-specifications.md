# 04 — Screen-by-Screen UI/UX Specification

| Field | Value |
|---|---|
| Document | 04 — Screen Specifications |
| Version | 1.0 Baseline |
| Depends on | 05-design-system (components, states), 11 (APIs), 09 (permissions) |

Every screen below follows the same template. Global rules first; then the app shell; then all screens. **Accessibility:** every screen must pass WCAG 2.1 AA (doc 13 §7). **States:** every data surface implements loading (skeleton), empty, error (retry), unauthorized (hidden or explainer), and disconnected/stale (banner + last-updated) states — components defined in doc 05 §8.

## 1. Global conventions

| Topic | Rule |
|---|---|
| Routes | Kebab-case; nested detail routes: `/businesses/[businessId]` |
| Data display | Money: minor units → formatted by currency (NGN ₦, GHS ₵, XOF CFA, USD $); dates: relative < 48 h else `yyyy-MM-dd HH:mm (UTC±)`; IDs: monospace, truncated with copy button |
| Freshness | Every KPI/aggregate shows a freshness chip: `live` / `updated 12 min ago` / `stale — 3 h behind` with tooltip explaining source & SLA |
| Empty data | Distinguish "no data yet" (info) vs "not instrumented" (explainer + what would provide it) vs "filtered to zero" (clear-filters action) |
| Destructive/impactful actions | Typed confirmation (type the business ID or action name), reason field, explicit consequence list |
| Page header | Title + description, last-updated, primary actions right-aligned, breadcrumbs on detail pages |
| Density | Compact tables (36 px rows), generous cards, 8-pt spacing grid |
| Responsiveness | Desktop-first; 1280+ full sidebar; <1280 icon rail; <768 sidebar drawer, tables convert to stacked cards or horizontal scroll |
| Motion | Framer Motion: enter/exit 120–200 ms, ease-out; respect `prefers-reduced-motion`; no decorative loops |

## 2. App shell

| Element | Specification |
|---|---|
| Left sidebar (240 px) | Grouped nav — **Business:** Overview, Businesses, Subscriptions, Payments, Product Analytics · **Services:** Vision, Intelligence, Angel, System Health, Incidents · **Platform:** AI Data, Admin Team, Audit Logs, Settings. Active state: filled background + accent left bar. Badges: error counts (System Health), pending approvals (Admin) |
| Top bar (64 px) | Global search (`⌘K` command palette: businesses, invoices, incidents, screens, actions), date-range selector (shared state across pages, persisted per user), **environment indicator** (`STAGING` amber chip / `PRODUCTION` neutral chip; local = dev chip), notifications bell (unread dot → panel), admin profile menu (name, role chip, MFA status, logout) |
| Command palette | Fuzzy search over businesses, subscriptions, payments, incidents, screens, and permitted quick actions |
| Keyboard | `⌘K` palette · `g o/b/s/p/a…` jumps · `Esc` closes overlays |
| Sidebar footer | Sync pipeline status dot (healthy/lagging/down) → links to System Health › Sync |

## 3. Auth screens

| Screen | Route | Spec |
|---|---|---|
| Login | `/login` | Centered card on branded gradient; email + password; rate-limit error copy; **no registration link** — footer: "Access is provisioned by your ODT administrator." On success → `/mfa` |
| MFA challenge | `/mfa` | 6-digit TOTP input, auto-focus/advance; recovery code fallback; attempts counter; failure lockout notice |
| Invite acceptance | `/invite/[token]` | Set password + scan TOTP QR + confirm code; token single-use, 72 h expiry; expired → request-new-invite explainer |
| Password reset | `/reset` | Email-based reset (no account enumeration copy); reset forced through MFA re-enrollment if MFA device lost — admin-initiated flow (doc 09 §8) |
| Unauthorized | `/403` | Explains missing permission + which role holds it; link back. Rendered inside app shell |
| Session expired | global | Modal: "Session expired — sign in again" preserving intended URL |

## 4. Screens

### 4.1 Overview — `/` → `/overview`

| Aspect | Specification |
|---|---|
| Access | `dashboard.view` |
| Purpose | 30-second answer to "how is TREXVEN doing?" |
| Layout | (1) Toolbar: date-range selector + comparison toggle. (2) Section **ODT Revenue** (accent border-left): MRR, ARR, Estimated churn, Failed payments. (3) Section **Businesses**: Registered, Active, New (range), Paying, Trial. (4) Section **Customer sales — GMV** (distinct teal accent, labelled "customer revenue — not ODT income"): Recorded sales, Active POS installations. (5) Section **Services**: Connected cameras, Vision businesses, Angel availability, API health, Open critical errors, Sync lag. (6) Charts row: MRR trend (area, 30/90d) · Plan mix (donut) · Registrations vs activations (bars). (7) Recent platform events feed (right rail ≥1440 px, below otherwise) |
| Data | `GET /api/v1/summary/dashboard?range=` → metric cards + series + events |
| Components | KpiCard (value, delta chip, sparkline, freshness chip, info tooltip), SectionHeader, AreaChart, DonutChart, EventFeed |
| States | "Not instrumented yet" cards (POS installs, app installs, devices, Vision, Angel) with explainer; stale banner when `sync lag > SLA`; skeleton grid while loading |
| Interactions | Range change refetches all sections (single request); card click → module deep-link; event feed item → source page |
| Acceptance | Values match metric registry definitions; deltas computed vs equal-length previous period; unauthorized cards absent from DOM; permission-gated sections never render zeros |

### 4.2 Businesses — `/businesses`

| Aspect | Specification |
|---|---|
| Access | `businesses.read` |
| Layout | Toolbar: search input (debounced 300 ms), filter group (status, plan, country, Vision status), sort dropdown, results count. Table: Business (name + short ID), Country, Plan (chip), Account status (chip), Subscription renews, Last activity, Vision (dot), row action → open. Cursor pagination footer |
| Data | `GET /api/v1/businesses?query&filters&cursor&limit&sort` |
| Components | DataTable (server-driven), FilterBar, StatusChip, CursorPagination |
| States | Empty (no matches → "Clear filters"), error (retry), skeleton rows |
| Interactions | Column sort re-requests; URL query params mirror state (shareable); no bulk actions in v1 (risk control) |
| Acceptance | Search + filters composable; pagination stable under concurrent sync updates (cursor-based); renders 50 rows < 500 ms |

### 4.3 Business profile — `/businesses/[businessId]`

| Aspect | Specification |
|---|---|
| Access | `businesses.read` (tabs may require more: `payments.read`, `vision.read`, `commands.execute`) |
| Layout | Header card: name, ID (copy), country flag+code, registration date, account status chip, subscription summary chip, quick actions (⋮ menu, permission-gated). Tab bar below: Overview · Subscription · Payments · POS · Vision · Support · Timeline · Actions |
| Overview tab | Subscription card (plan, status, renewal, provider) · POS usage card (30d tx count, GMV, devices) · Vision card (activation, cameras) · Integration health list (sync freshness per source) |
| Subscription tab | Plan history table (from subscription events), upcoming renewal, adjustments list (commands w/ approver), "Adjust subscription" button (Finance + command modal) |
| Payments tab | Transactions table (this business): date, amount, currency, status, provider ref; failure reasons inline |
| POS tab | Usage summary + trend chart; `[UNVERIFIED telemetry]` graceful absence |
| Vision tab | Activation status, camera count table, last heartbeats; explicit note: "Media is never accessible from the Admin Platform" |
| Support tab | Cases list + "New support case" (subject, priority, summary) |
| Timeline tab | Merged chronological feed: subscription, payment, status, command, support events with actor icons |
| Actions tab | Suspend account / Restore account: typed confirmation (type business ID), mandatory reason, consequence list; creates command → shows live status card (pending approval → executing → completed) |
| Data | `GET /api/v1/businesses/{id}` + sub-resources; `POST /api/v1/businesses/{id}/commands` |
| Acceptance | Command modal is server-acknowledged before closing; approval state visible on page without refresh (TanStack invalidation); unauthorized tabs hidden |

### 4.4 Subscriptions — `/subscriptions`

| Aspect | Specification |
|---|---|
| Access | `subscriptions.read` |
| Layout | KPI row: Active, Trial, Churn (est.), MRR, ARR. Charts row: MRR trend (area), Plan distribution (donut), Country split (stacked bars NG/GH/TG/CI). Tables: Renewals next 30 days (business, plan, amount, currency, date); Recent cancellations (business, date, reason if provided); Tier transitions (P1) |
| Data | `GET /api/v1/subscriptions/analytics?range&country&plan` |
| Filters | Country, plan, status — affect charts + tables |
| Acceptance | Currency formatted per country; MRR movement waterfall (new/expansion/contraction/churn) P1; renewal rows link to business profiles |

### 4.5 Payments — `/payments`

| Aspect | Specification |
|---|---|
| Access | `payments.read` |
| Layout | KPI row: success rate, failed count (range), refunded amount, reconciliation mismatches. Charts: success-rate trend (line), failures by reason code (horizontal bars), volume by country (stacked). Tables below, tabbed: **Transactions** (date, business, amount, currency, status, provider, provider ref) · **Failed queue** (reason code, retryable hint, business link) · **Refunds** (read-only) · **Webhook monitor** (event type, status, latency, last error) `[UNVERIFIED]` · **Reconciliation** (mismatched items with "Open review" action — creates a review task, never mutates financial truth) |
| Filters | Status, country, provider, date range |
| Data | `GET /api/v1/payments`, `/payments/failures`, `/payments/webhooks`, `/payments/reconciliation` |
| Acceptance | No card data anywhere; provider refs copyable (mono); currency formatted per country; mismatch actions audited |

### 4.6 Product Analytics — `/analytics`

| Aspect | Specification |
|---|---|
| Access | `analytics.read` |
| Layout | Toolbar: range, platform, country. **Definitions panel** (collapsible, shown by default on first visit): Install vs Download vs Registration vs Active user — with required event names. Sections: Acquisition (installs, registrations, onboarding completion; funnel chart) · Engagement (active businesses, session trend) · Retention (cohort grid D1/D7/D30) · Feature adoption (heatmap matrix, Owner + POS features) · Distribution (platform/device donut, app-version bars) · Geography (country bars, country-level only) · Conversion (registration → paid funnel) |
| Data | `GET /api/v1/analytics/{funnel|retention|adoption|distribution|geo|conversion}` |
| States | Charts fed by non-instrumented events render the NotInstrumented explainer listing the exact event name needed (doc 10 §8) |
| Acceptance | Definitions panel matches metric registry; no PII; precision location never shown; funnel steps map 1:1 to event catalog |

### 4.7 Vision — `/vision`

| Aspect | Specification |
|---|---|
| Access | `vision.read` |
| Layout | Capability banner (if status ≠ deployed). KPI row: registered cameras, connected, disconnected, Vision businesses, processing latency p95, storage used. **Fleet table**: business, camera count, connected/offline, health badge, last heartbeat, model version. **Pipeline panel**: server status, inference throughput, event throughput, recording pipeline status, detection failures (24 h). Charts: latency trend, throughput trend. **Privacy notice card** (persistent): "No customer camera media is accessible from this platform. Exceptional access is disabled by default and requires documented legal authorization." |
| Data | `GET /api/v1/vision/overview`, `/vision/cameras` |
| Acceptance | Zero media links/players in DOM; heartbeats > SLA highlighted; on-prem site field reserved for later (P2) |

### 4.8 Intelligence — `/intelligence`

| Aspect | Specification |
|---|---|
| Access | `intelligence.read` |
| Layout | Capability banner. KPI row: jobs (24 h), failed jobs, insights generated, data freshness per input source. Tables: **Job runs** (id, type, scope, status, duration, error group) · **Model versions** (model, version, status, evaluation metrics). Cards: anomaly-detection performance (precision/recall where evaluation exists); Vision → Intelligence flow health |
| Data | `GET /api/v1/ai/intelligence` |
| Acceptance | If the product is roadmap-only, page renders capability status + planned instrumentation, never fake job data |

### 4.9 Angel — `/angel`

| Aspect | Specification |
|---|---|
| Access | `angel.read` |
| Layout | Capability banner. KPI row: requests (24 h), error rate, p95 latency, tokens in/out, **estimated** cost, rate-limit events, uptime. Charts: volume trend, latency percentile bands (p50/p95/p99), cost by provider (bars). Config panel: model + provider names/versions and rate limits — **credentials are never displayed** |
| Data | `GET /api/v1/ai/angel` |
| Acceptance | Cost figures labeled "estimated"; capability banner honest; zero secret material in responses |

### 4.10 System Health — `/health`

| Aspect | Specification |
|---|---|
| Access | `health.read` |
| Layout | **Status board** (grid of service cards: name, status dot, latency, last check, 24 h uptime): TREXVEN backend · Sync pipeline · Vision · Angel · Intelligence · Payment webhooks · Admin platform. **Error groups table**: severity chip, type/title, service, environment, occurrences, first/last seen, affected versions, status, assignee, Sentry link. Row → detail Sheet: redacted sample, occurrence trend, actions (acknowledge / resolve / assign). **Sync health panel**: per-job rows (job, schedule, last run, lag, failures 24 h, DLQ count) + DLQ table with Retry / Quarantine (Technical Admin only) |
| Data | `GET /api/v1/health/services`, `/health/errors`, `/health/sync` |
| Acceptance | Severity follows doc 12 §3 matrix; S1/S2 trigger notification bell; all resolution actions audited |

### 4.11 Incidents — `/incidents`

| Aspect | Specification |
|---|---|
| Access | `incidents.read` (+ `incidents.manage` to edit) |
| Layout | List: severity chip, title, affected services, status stepper chip, opened at, duration. **Create dialog**: title, severity, affected services (multi-select), initial note. **Detail page**: status stepper header, timeline feed (+ entry form for managers), linked error groups / sync failures, postmortem URL |
| Data | `GET/POST /api/v1/incidents`, `PATCH /incidents/{id}` |
| Acceptance | Illegal transitions blocked server-side; notifications fired on create/escalate; every change audited |

### 4.12 AI Data — `/ai-data`

| Aspect | Specification |
|---|---|
| Access | `ai_data.read` (+ `ai_data.manage`) |
| Layout | **Registry table**: name, domain chip (vision/intelligence/sales/angel), sensitivity chip, consent basis, status, version count, latest quality. **Detail page**: metadata card (owner, basis, retention), versions table (version, created, size, rows, checksum, quality, annotation status, training-eligible), provenance viewer (JSON), storage pointer (private bucket — **no in-app asset viewing in v1**), actions: Register version (upload → storage), Request deletion (command + second approval). **Model registry** section: models, versions, evaluation records |
| Data | `GET/POST /api/v1/ai-data/datasets`, `POST /datasets/{id}/versions` |
| Acceptance | Consent basis mandatory at creation; deletion only via approval command; assets never downloadable from UI |

### 4.13 Admin Team — `/admin-team`

| Aspect | Specification |
|---|---|
| Access | `admin_team.read` (+ `admin_team.invite`, `commands.approve`) |
| Layout | **Admins table**: name, email, role chip, status, MFA (ok/missing), last login. Actions: Invite (dialog: email, role, note) · Change role (command, second approval) · Deactivate (command). **Approvals tab**: commands awaiting second approval with payload diff + Approve/Reject (reason required). **Command history tab**: all commands with status, result, error, idempotency key, retry (Technical Admin) |
| Data | `GET /api/v1/admin-team`, `POST /admin-team/invite`, `POST /commands/{id}/approve|reject` |
| Acceptance | Users cannot act on their own account (role/deactivate); every action audited; invite tokens single-use |

### 4.14 Audit Logs — `/audit`

| Aspect | Specification |
|---|---|
| Access | `audit.read` |
| Layout | Filter bar: actor (combobox), action type (multi-select tree), resource type, date range, request-ID search. Table: timestamp, actor (name + role chip), action (mono), resource (type + linked ID), request ID (copy). Row → detail Sheet: full entry, **before/after diff view** (redacted fields render a "redacted" chip), metadata JSON. Export CSV button (`audit.export` — the export itself is audited) |
| Acceptance | No edit affordances exist (immutable by DB); server-side filtering with partition pruning; 7-year window queryable |

### 4.15 Settings — `/settings`

| Section | Specification |
|---|---|
| Pricing | Country × plan matrix (FA+): cell = amount + currency + version + effective date; row history drawer; **Edit** opens command modal with reason, effective date, diff preview; TG and CI priced independently despite shared XOF `[A-04]` |
| Notifications | Per-role email routing per alert class (critical errors, sync down, payment anomalies, pending approvals) |
| Capabilities | Read-only flags per product (planned/implemented/tested/deployed) with `last_verified_at` |
| Integrations | Sentry, bridge, Paystack webhook status + metadata — **never secret values** |
| Accessibility | All sections keyboard-navigable; matrix editable only through the command flow |

### 4.16 Cross-screen: command status

`CommandStatusCard` is embedded wherever commands originate (business Actions tab, subscription adjustments, pricing edits, dataset deletion) and shows the live state machine: `pending approval → approved → executing → completed / failed`, with actor + approver and links into `/admin-team` history.

## 5. Global screen acceptance checklist

- [ ] Every list: search + filters + sort + cursor pagination
- [ ] Every KPI: freshness chip + definition tooltip (metric registry)
- [ ] Every mutation: CommandDialog (typed confirm + reason) → audit → status card
- [ ] Every data surface: loading / empty / not-instrumented / error / unauthorized / stale states (doc 05 §8)
- [ ] Permissions hide UI; the server enforces regardless of UI
- [ ] WCAG 2.1 AA, keyboard-complete, visible focus, tested in light + dark
- [ ] Missing telemetry renders NotInstrumented — never zeros
- [ ] Desktop 1440, laptop 1280, tablet 768, mobile 390 verified