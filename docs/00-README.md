# TREXVEN / ODT Admin Platform
## Specification & Coding-Handoff Package

| Field | Value |
|---|---|
| Product | ODT Admin Platform — internal administration system for the TREXVEN ecosystem |
| Owner | ODT |
| Spec version | 1.0 — Baseline |
| Date | 2026-10-15 |
| Status | Ready for implementation handoff |
| Primary audience | ODT engineers and AI coding assistants implementing the platform |

## 1. What this package is

A complete, implementation-ready blueprint for a **standalone internal admin platform** that lets ODT staff monitor and manage the TREXVEN SaaS business: businesses, subscriptions, payments, product analytics, Vision fleet health, AI service monitoring, system health, incidents, AI-training data governance, and administrative audit.

The platform is **not** the TREXVEN Owner App, POS App, or public website. It reads a **controlled replica** of authorized production data from a **separate Admin Supabase project**, fed by a **one-way, authenticated, idempotent pipeline** from the existing TREXVEN production backend. It never connects to production with privileged credentials, and production-affecting actions run exclusively through a trusted command pipeline — never by editing replicated data.

## 2. Reading order (for AI coding assistants)

| Order | Document | Why |
|---|---|---|
| 1 | 00-README.md | Orientation, rules, conventions |
| 2 | 01-product-requirements.md | What to build and why; metric registry |
| 3 | 02-technical-architecture.md | System shape, decisions, tradeoffs |
| 4 | 03-system-architecture-diagrams.md | Visual reference for all flows |
| 5 | 08-database-schema.md · 09-auth-authorization.md · 10-sync-pipeline.md | Data foundation (build first) |
| 6 | 07-backend-architecture.md · 11-api-contracts.md | Services and API contracts |
| 7 | 05-design-system.md · 04-screen-specifications.md · 06-frontend-structure.md | UI implementation |
| 8 | 12-monitoring-architecture.md · 13-testing-qa-plan.md · 14-deployment-environments.md | Quality and operations |
| 9 | 15-implementation-roadmap.md · 17-coding-handoff.md | Execution plan and milestone checklist |
| ref | 16-risks-assumptions.md | Assumptions and open questions to verify during integration |

## 3. Non-negotiable rules

1. Separate admin Supabase project; production credentials never appear in any admin frontend or browser bundle.
2. One-way data flow: production → admin. The analytics pipeline is never a path into customer production data.
3. Data minimization: only E0–E2 classified data leaves production (doc 02 §3). E3 data (customer PII, CCTV footage, recordings) never syncs.
4. Projections are read-only replicas. No admin action may "fix" production by editing a projection.
5. Every production-affecting action: permission check → input validation → explicit confirmation → trusted production-side handler → idempotency → audit → verified completion.
6. Never invent metrics. If data is unavailable, the UI says so explicitly ("Not instrumented yet").
7. Roadmap features (Vision, Intelligence, Angel) display honest capability status: planned / implemented / tested / deployed.
8. Audit logs are append-only and immutable — including for Super Admins.
9. No public admin registration. Accounts are provisioned by invitation only.
10. Customer CCTV footage and recordings are never exposed to administrators by default; exceptional access requires explicit legal/privacy authorization and full auditing (out of scope for Phases 1–5).

## 4. Status label conventions

| Label | Meaning |
|---|---|
| `[VERIFIED]` | Confirmed against the actual TREXVEN environment |
| `[UNVERIFIED]` | Depends on an existing TREXVEN capability that has not been inspected; validate before/while integrating |
| `[ASSUMPTION A-nn]` | Documented assumption; see doc 16 and confirm during integration |

As of this baseline, **every integration point with the existing TREXVEN production backend is `[UNVERIFIED]`** — the production schema has not been inspected. The design isolates all production assumptions behind an adapter layer (doc 10 §9) and an integration-prerequisite checklist (doc 17 §7).

## 5. Glossary

| Term | Meaning |
|---|---|
| ODT | Company operating TREXVEN |
| Projection | Admin-side read replica derived from sync events (not authoritative) |
| Authoritative table | Admin-side table the platform itself owns (audit, commands, pricing, incidents, datasets) |
| Outbox | Production-side queue table ensuring reliable event delivery |
| DLQ | Dead-letter queue for events that permanently fail processing |
| RLS | PostgreSQL Row Level Security |
| MRR / ARR | Monthly / Annual Recurring Revenue — **ODT's subscription revenue** |
| GMV | Gross Merchandise Value — total sales recorded across customer businesses (**not** ODT revenue) |
| E0–E3 | Data classification tiers (doc 02 §3) |
| Capability status | planned → implemented → tested → deployed |