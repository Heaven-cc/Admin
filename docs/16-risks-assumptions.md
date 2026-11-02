# 16 — Risks, Assumptions & Open Questions

| Field | Value |
|---|---|
| Document | 16 — Risks & Assumptions |
| Version | 1.0 Baseline |
| Usage | Every `[ASSUMPTION A-nn]` and `[UNVERIFIED]` label across the package resolves here; verify during integration and update status |

## 1. Assumption register

| ID | Assumption | Used in | Impact if wrong | Verification | Status |
|---|---|---|---|---|---|
| A-01 | Production DB schema is uninspected; no table names assumed | 10 §9, all sync design | Adapter remapping needed (contained by design) | Schema review with TREXVEN backend | open |
| A-02 | Businesses/subscriptions/payments have stable write points to hang bridge triggers on | 10 §5 | Event derivation moves to app hooks | I-1 integration review | open |
| A-03 | Paystack is live in production with webhook delivery | Payments module | Payments views degrade to "not instrumented" | Inspect webhook config | open |
| A-04 | TG and CI have independent XOF prices | Pricing matrix | Collapse/expand rows — cosmetic | Ask Finance | open |
| A-05 | A trial tier exists | M-SUB-02, funnels | Metric stays "not instrumented" | Subscription lifecycle review | open |
| A-06 | USD-normalized consolidated MRR is wanted; FX source TBD | fx_rates, M-REV-01 | Remove normalization, keep per-currency | Q-01 (Finance) | open |
| A-07 | Plans: Start/Core/Pro; monthly billing first | Registry, pricing | Adjust plan keys | Pricing review | open |
| A-08 | Angel is not yet a deployed service | Capability flags | Flip capability status + enable probes | Verify with AI team | open |
| A-09 | App version metadata obtainable or manually maintained | app_versions | Manual registry upkeep | Check app release process | open |
| A-10 | Brand colors not yet supplied | 05 tokens | Drop-in replacement via `--brand-*` | Design input | open |
| A-11 | Admin team ≤ ~10 users initially | RBAC sizing | No change needed (design scales) | ODT input | open |
| A-12 | No on-prem Vision hardware in Phase 1 | cameras_projection.site | Field already reserved | Vision roadmap | open |
| A-13 | 1–2 engineers; part-time design | 15 estimates | Re-plan durations | ODT staffing | open |
| A-14 | No E3 data requirement exists that cannot be expressed as E0–E2 aggregate | 02 §3 | Requires reviewed new schema + legal basis | Data requirements workshop | open |
| A-15 | TREXVEN prod Supabase plan supports Edge Functions + cron | 07 §3 | Alternative: standalone worker (Node) publishing events | Check Supabase project plan | open |

## 2. Open questions

| ID | Question | Owner | Needed by |
|---|---|---|---|
| Q-01 | Reporting currency for consolidated MRR/ARR? (proposal: USD-normalized + per-currency breakdowns) | Finance | Phase 2 |
| Q-02 | Source of truth for a business's country; how are country changes handled? | TREXVEN backend | I-1 |
| Q-03 | Refund execution path — provider dashboard only, or API later? | Finance | Phase 2 |
| Q-04 | Trial → paid conversion rules and trial length? | Finance | Phase 2 |
| Q-05 | Feature-adoption whitelist (feature keys) for Owner/POS? | Product | Phase 2 |
| Q-06 | Vision telemetry availability, cadence, and format? | Vision team | Phase 3 |
| Q-07 | Angel provider(s), token accounting, cost data availability? | AI team | Phase 3 |
| Q-08 | Data-residency and NDPR obligations for admin-side replicas? | Legal | before GA |
| Q-09 | On-call rotation and alert destinations (Slack workspace, emails)? | Ops | Phase 3 |
| Q-10 | Formal approval of 7-year audit retention? | Legal | before GA |

## 3. Risk register

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-01 | Production bridge rejected/deferred by TREXVEN backend team | M | H | Phases 1–3 are fully functional read-only with fake producer; bridge isolation keeps scope tiny; escalate early with security rationale |
| R-02 | Production schema differs wildly from expectations | M | M | Adapter layer (doc 10 §9) + contract tests; remap without touching core |
| R-03 | PII/E3 leakage through payloads | L | H | Whitelist schemas, ingest rejection, CI grep, audits; pentest checks |
| R-04 | Sync pipeline complexity delays value | M | M | Phase 2 scope is read-only dashboards; reconcile/DLQ incremental |
| R-05 | Metrics trusted despite staleness | M | M | Freshness chips + staleness banners + SLA alerts everywhere |
| R-06 | Admin misuse (over-broad roles) | M | M | Least-privilege matrix, two-person rule, full audit |
| R-07 | Audit tampering by insider | L | H | DB-level immutability, WORM export (Phase 2+), alert on denial attempts |
| R-08 | Cost growth (Vercel/Supabase) | M | L | Aggregate-first design, retention jobs, cost review quarterly |
| R-09 | Roadmap features displayed as real | L | M | Capability model mechanically enforced in UI |
| R-10 | Single-vendor lock-in (Supabase/Vercel) | M | L | Postgres-standard schema; IaC + migrations allow port; documented at ADR-009 thresholds |
| R-11 | Scope creep into customer-facing tooling | M | M | Non-goals (doc 01 §2) + phase gates |
| R-12 | AI infrastructure overpromise (training "coming soon") | M | M | Phase 5 explicitly registry-only; no training jobs |

## 4. Recommended improvements (post-v1)

1. ClickHouse (or similar) for analytics if raw-event volume grows (ADR-009 trigger).
2. Temporal or durable workflow engine if command workflows grow beyond simple dispatch.
3. WORM audit export + SIEM forwarding (security maturity).
4. Formal DPIA + NDPR compliance review before any dataset with customer data is approved.
5. SOC 2 readiness track if ODT pursues enterprise customers.
6. SLA-grade status page for internal stakeholders.