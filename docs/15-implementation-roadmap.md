# 15 — Phased Implementation Roadmap

| Field | Value |
|---|---|
| Document | 15 — Roadmap |
| Version | 1.0 Baseline |
| Basis | Team assumption: 1–2 full-stack engineers + part-time design `[A-13]`. Durations are **estimates** in working weeks, not commitments. |

## 0. Phase overview

| Phase | Scope | Estimate | Exit gate |
|---|---|---|---|
| 0 — Bootstrap | Repo, scaffold, CI, Supabase projects, tokens | 0.5 wk | CI green end-to-end |
| 1 — Admin Foundation | Auth/MFA, RBAC+RLS, shell, dashboard skeleton, audit base | 2–3 wk | Phase 1 AC (§2) |
| 2 — Analytics & Business Monitoring | Bridge, ingest, projections, aggregates, directory, revenue, payments, product analytics | 3–4 wk | Phase 2 AC (§3) |
| 3 — Operations Monitoring | Errors, health, sync health, Vision/Angel/Intelligence, incidents | 2–3 wk | Phase 3 AC (§4) |
| 4 — Administrative Operations | Command dispatch, prod handler integration, subscription/account/pricing ops, approvals | 2–3 wk | Phase 4 AC (§5) |
| 5 — AI Data & Advanced | Dataset/model registries, governance, retention, capability management | 2 wk | Phase 5 AC (§6) |

**Integration checkpoints (hard dependencies):**
- **I-1** before Phase 2: TREXVEN backend owners approve the additive `admin_bridge` `[UNVERIFIED]`.
- **I-2** before Phase 4: production `command-handler` surface agreed + secret exchange `[UNVERIFIED]`.
- **I-3** any time (independent): app telemetry decisions (doc 10 §8) — dashboard shows honest "not instrumented" until then.

## 1. Phase 0 — Bootstrap

**Deliverables:** repo + pnpm + TS strict; Next.js 15 scaffold with empty routes; Tailwind + shadcn + `tokens.css` (doc 05); ESLint/Prettier; GitHub Actions pipeline (doc 14 §4); Supabase CLI project layout; seed scaffolding.

**Acceptance criteria:**
- [ ] `pnpm verify` runs lint + typecheck + tests + build locally and in CI
- [ ] Preview deploy works from a PR
- [ ] Local Supabase resets and seeds deterministically

## 2. Phase 1 — Admin Foundation

**Deliverables:** Supabase Auth + invite-only provisioning + TOTP MFA enforcement; `admin_users/roles/permissions` + matrix seed; RLS on all Phase-1 tables + pgTAP suite; middleware + session rules; app shell (sidebar, topbar, palette, env badge); state components (doc 05 §8); Overview page with metric-registry-driven cards (empty/not-instrumented states); audit foundation (`admin_audit_logs` + `write_audit()` + immutability); command ledger schema + command types registry; Admin Team + Approvals UI; `/audit` screen; capability flags table + Settings view.

**Acceptance criteria:**
- [ ] No public registration exists; invite flow works end-to-end; MFA enforced (middleware + AAL2)
- [ ] pgTAP: role matrix, audit immutability, two-person rule all green
- [ ] Overview renders honestly with zero data (all "not instrumented" or "awaiting sync")
- [ ] Every mutation path already writes audit rows
- [ ] `/audit` shows admin invites, logins, and permission denials

## 3. Phase 2 — Analytics & Business Monitoring

**Deliverables (after I-1):** production `admin_bridge` (outbox + `bridge-publish`) — additive migration to TREXVEN prod `[UNVERIFIED approval]`; `ingest-event` with HMAC + validation + dedupe; projections + aggregates + materialized views; `refresh-aggregates` + `check-freshness` crons; **Businesses** directory + profile (read-only tabs); **Subscriptions** analytics; **Payments** monitoring; **Product Analytics** pages with definitions panel; Overview goes live; reconcile + DLQ foundations; fake producer for staging.

**Acceptance criteria:**
- [ ] Duplicate replay of full event history produces identical projections (idempotency proof)
- [ ] Payment, subscription, and business projections reconcile with production counts
- [ ] Overview shows live ODT revenue vs GMV separation; freshness chips correct
- [ ] All doc 13 §6 scenarios 3, 6, 7, 9 pass
- [ ] No E3 field exists anywhere in admin DB (audit grep + ingest tests)
## 4. Phase 3 — Operations Monitoring

**Deliverables:** `sentry-ingest` + `system_errors` (System Health board, error groups with acknowledge/resolve/assign, Sentry deep-links); sync health panel + DLQ UI + retry controls; **Vision** module (fleet, pipeline metrics, privacy notice); **Angel** module; **Intelligence** module; capability banners wired to `capabilities`; **Incidents** module; alert routing (role emails + Slack via `notifications`); runbooks R-01…R-10; uptime probes.

**Acceptance criteria:**
- [ ] Error groups dedupe by fingerprint; redaction verified — no tokens/PII in samples (doc 12 §5)
- [ ] Killing the mock bridge triggers stale banners + S2 alerts; DLQ retry flow works end-to-end
- [ ] Vision/Angel/Intelligence pages render capability status honestly; zero fabricated telemetry
- [ ] Incident lifecycle transitions validated server-side; notifications fire on open/escalate
- [ ] doc 13 §6 scenarios 8 and 10 pass

## 5. Phase 4 — Administrative Operations (after I-2)

**Deliverables:** `dispatch-command` + production `command-handler` integration `[UNVERIFIED]`; business suspend/restore flows; authorized subscription adjustments; pricing administration (matrix, versioning, effective dates); approvals inbox with payload diff; command history + retry; `command.result.v1` verification loop.

**Acceptance criteria:**
- [ ] Suspend → approve → production effect verified → projection updates **only** from the result event (doc 03 D3)
- [ ] Self-approval rejected by DB trigger; command permissions enforced end-to-end
- [ ] Pricing change inserts a new version; history intact; audit complete
- [ ] Failed dispatch surfaces error + retry; idempotency keys prevent double-execution (verified against mock, then real handler)
- [ ] doc 13 §6 scenarios 4 and 5 pass

## 6. Phase 5 — AI Data & Advanced Intelligence

**Deliverables:** private storage buckets + dataset registry/versioning UI; upload flow (checksum, provenance, de-identification declaration); model registry + evaluations; retention policies + approved-deletion workflow; capability management UI; metric-registry groundwork for future platform insights.

**Acceptance criteria:**
- [ ] No dataset asset downloadable via UI; presigned access only, server-issued, audited
- [ ] Deletion requires second approval; status flow + audit complete
- [ ] FR-906 enforced: customer data never auto-included (UI rule + DB check)
- [ ] Registry round-trip passes: create → version → evaluate → deprecate → delete (approved)

## 7. Release plan

| Stage | After | Audience |
|---|---|---|
| Internal alpha | Phase 2 | SA + TA only |
| Beta | Phase 3 | All roles, staging data |
| GA | Phase 4 + pentest (doc 13 §9) + restore drill (doc 14 §7) | All ODT staff |
| Phase 5 | Continuous | GA + governance features |