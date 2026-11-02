# 13 — Testing & Quality Assurance Plan

| Field | Value |
|---|---|
| Document | 13 — Testing & QA |
| Version | 1.0 Baseline |
| Tools | Vitest · Testing Library · Playwright · pgTAP · k6 · Lighthouse CI · axe |

## 1. Test pyramid & CI gates

| Layer | Tool | Scope | CI gate |
|---|---|---|---|
| Unit | Vitest | `lib/` utilities (currency, dates, redaction), RBAC helper, Zod schemas, command state machine | every PR — must pass |
| Component | Vitest + Testing Library | KpiCard (all states), DataTable, CommandDialog, forms, FreshnessChip | every PR — must pass |
| Contract | Vitest | Zod schemas ↔ generated `openapi.json` diff; ingest event schemas ↔ mock bridge | every PR — must pass |
| Database | pgTAP (supabase test) | RLS per role, audit immutability, constraints, triggers | every PR touching `supabase/` — must pass |
| Integration | Vitest + local Supabase | ingest pipeline, command dispatch (mock prod handler), sentry-ingest redaction | every PR on `backend` paths — must pass |
| E2E | Playwright | Critical journeys (§6) | merge to main — must pass |
| Performance | k6 + Lighthouse CI | API p95, TTI budget | nightly + release candidate |
| Security | gitleaks, dependency audit, ASVS checklist, pentest | secrets, CVEs, OWASP L2 | every PR (scans) + pre-launch (pentest) |
| Accessibility | axe-core in Playwright | WCAG 2.1 AA on all screens | every PR on UI paths |

## 2. Test data policy

- Deterministic seeded fixtures via the **fake producer** script (doc 14 §6) — reproducible scenarios (e.g., 250 businesses, known payment failures, deliberate DLQ items).
- **Never** production data in lower environments; production exports are prohibited by policy and by the E-classification design.

## 3. Coverage targets

| Area | Target |
|---|---|
| `lib/` (api, auth, format, sync helpers) | 90% lines |
| Command lifecycle paths (create → approve → dispatch → complete) | 100% |
| UI components | 70% |
| Overall | 80% |
| pgTAP policies | every table × every role matrix cell |

## 4. pgTAP scenarios (database)

1. `read_only_analyst` cannot SELECT `administrative_commands` payload of other admins beyond `commands.read` scope — and cannot INSERT/UPDATE anything mutable.
2. Every role's SELECT access matches the doc 09 §4 matrix (table × role loop).
3. `service_role` cannot UPDATE or DELETE `admin_audit_logs` (immutability).
4. Trigger rejects `command_approvals` where `approver_id = requested_by` (two-person rule).
5. Duplicate `event_id` insert into `sync_ingest_events` is a no-op (idempotency).
6. Overlapping `pricing_configurations` active rows for same (country, plan) are rejected.
7. Out-of-order projection upsert cannot regress `updated_at` (occurred_at guard).
8. Suspended/deactivated admin gets zero rows everywhere.
9. `write_audit()` is the only INSERT path to audit (direct INSERT denied).
10. Partition pruning verified for 7-year audit query plan.

## 5. Contract testing

- `openapi.json` generated from Zod schemas in CI; committed spec diff blocks breaking changes (doc 11 §11).
- Event schemas (doc 10 §5) have fixtures: valid, unknown-field (must drop+log), E3-injected (must hard-reject), oversized (reject), wrong `schema_version` (reject).
- **Mock bridge** (scripted producer implementing doc 10 §4 protocol) backs integration and staging e2e; the same suite runs against the real bridge during integration with `[UNVERIFIED]` items on the checklist.

## 6. E2E journeys & required failure scenarios (Playwright)

| # | Journey / scenario | Assertions |
|---|---|---|
| 1 | Login + MFA; session expiry mid-navigation | Lands overview; redirect preserves intended URL |
| 2 | **Unauthorized access** | Analyst: Admin Team hidden, direct URL → `/403`; API returns 403 |
| 3 | Business search + filters + profile tabs | Results correct; tabs permission-gated |
| 4 | Suspend business (command + approval) | Typed confirm → pending → second admin approves → `completed`; audit rows for request + approval + result |
| 5 | Pricing change | Version increments; history drawer shows chain; TG/CI independence preserved |
| 6 | **Payment inconsistency** | Failed queue shows reason codes; reconciliation review creates task, mutates nothing financial |
| 7 | **Duplicate events** | Same batch posted twice → zero duplicates (integration-level, idempotency) |
| 8 | **Failed synchronization** | Mock bridge killed → stale banners; restart → DLQ drains, freshness recovers |
| 9 | **Stale analytics** | Aggregates frozen → StaleBanner + explicit states, never zeros |
| 10 | **Partial service outage** | Vision endpoint 500 → other sections render; error state + retry works |
| 11 | Audit export | Analyst denied; SA allowed + export itself audited |
| 12 | Dark mode + axe | Pass on 5 core screens |

The bold rows map 1:1 to the brief's mandatory scenarios (unauthorized access, duplicate events, failed synchronization, payment inconsistencies, stale analytics, partial outages).

## 7. Accessibility verification

- axe-core in Playwright on every page; zero critical violations to merge.
- Manual screen-reader pass (NVDA + VoiceOver) on: login/MFA, Overview, Businesses, command flows.
- Contrast enforced by tokens (doc 05 §2); focus traps verified in all dialogs.

## 8. Performance verification

| Test | Target | Tool |
|---|---|---|
| `GET /summary/dashboard` | p95 < 500 ms @ 50 rps | k6 |
| `GET /businesses` | p95 < 400 ms @ 50 rps | k6 |
| Ingest batch (1,000 events) | < 5 s | integration bench |
| Overview TTI (4G) | < 3 s | Lighthouse CI |
| CLS | < 0.1 | Lighthouse CI |

## 9. Security testing

- gitleaks pre-commit + CI; dependency audit blocks on high/Critical.
- OWASP ASVS L2 checklist reviewed pre-launch.
- Pentest scope: auth bypass, IDOR on business/payment endpoints, RLS bypass via direct API, HMAC replay, self-approval of commands, injection via search inputs.
- Findings triaged by severity; Critical/High block GA.

## 10. Definition of done (per feature)

1. Code + unit/component tests; 2. pgTAP for any schema change; 3. contract spec updated; 4. all five data states implemented; 5. audit coverage for mutations; 6. a11y pass; 7. permission gating verified in UI **and** RLS; 8. docs updated when behavior changes; 9. review approval (CODEOWNERS for auth/sync paths).