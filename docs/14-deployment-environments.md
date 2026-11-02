# 14 — Deployment & Environment Strategy

| Field | Value |
|---|---|
| Document | 14 — Deployment & Environments |
| Version | 1.0 Baseline |
| Stack | Vercel (web) · Supabase (DB/Auth/Functions/Vault) · GitHub Actions (CI/CD) |

## 1. Environments

| Environment | Web | Database | Producer | Purpose |
|---|---|---|---|---|
| `local` | `next dev` | Supabase CLI (docker) | Fake producer script | Development |
| `staging` | Vercel (staging project, auto from `main`) | `admin-staging` Supabase project | Fake producer on schedule | Integration, e2e, demos |
| `production` | Vercel (prod project, manual promotion) | `admin-prod` Supabase project | Real bridge `[UNVERIFIED]` | Live internal use |

Rules: one Supabase project per environment; **no production data ever flows downward**; bridge exists only in real production — staging exercises the identical protocol against the fake producer.

## 2. Branching & reviews

Trunk-based: short-lived feature branches → PR → squash to `main`. Conventional Commits. `CODEOWNERS`: `supabase/**` → TA + SA; `src/lib/auth/**`, `middleware.ts` → SA. PR template: tests, states, audit, a11y, permissions checklist (doc 13 §10).

## 3. Environment variables & secrets

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | client | per environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | never in Next.js runtime env for client paths; CI injects per target |
| `INGEST_HMAC_CURRENT` / `_PREVIOUS` | Vault (both projects) | doc 10 §4 rotation |
| `COMMAND_PAIR_SECRET` | Vault (both projects) | dispatch ↔ prod handler |
| `SENTRY_DSN`, `SENTRY_WEBHOOK_SECRET` | server / edge | |
| `BRIDGE_INGEST_URL`, `PROD_COMMAND_URL` | edge config | per environment |
| `CRON_SECRET` | edge | guards scheduled endpoints |

No `.env*` files committed (`.env.example` only, names without values). CI greps bundles for forbidden strings (`service_role`, Vault keys) — build fails on match (NFR-09).

## 4. CI/CD pipeline (GitHub Actions)

```
PR:      install(pnpm) → lint → typecheck → unit+component → pgTAP(supabase db reset + test)
         → build → contract(openapi diff) → gitleaks → Vercel preview → e2e vs preview
main:    → auto deploy staging → apply migrations (supabase db push, ordered) → smoke tests
release: → manual approval (protected environment: production)
         → apply migrations to admin-prod → deploy Vercel prod → smoke + health checks → notify
```

Post-deploy verification: `/health/live`, `/health/ready`, ingest heartbeat, one seeded E2E pass against staging promotion artifacts.

## 5. Migrations & rollback

- Versioned SQL in `supabase/migrations/` (CLI-managed); every migration is **additive-first**; destructive changes require an ADR + fresh backup verification.
- Every migration ships a `-- down:` script where feasible; irreversibles (e.g., data backfills) documented with compensating plan.
- Rollback order: (1) Vercel instant revert, (2) `supabase` PITR (RPO 15 min) only if schema corrupted — accepted data loss window documented, (3) down migration for forward-fix.
- Migrations run in CI only — never from laptops.

## 6. Fake producer (staging & e2e)

Script (`supabase/seed/producer.ts`) replays deterministic event batches: 250 businesses, 90 days of subscriptions/payments/aggregates, deliberate failure modes (duplicates, out-of-order, bad schema, E3 attempts) to exercise DLQ and reconciliation. Same fixtures power Vitest integration tests.

## 7. Backup & DR

| Aspect | Plan |
|---|---|
| DB | Supabase PITR (RPO ≤ 15 min) + weekly logical dump to private bucket |
| Restore drill | Quarterly, timed against RTO ≤ 4 h |
| Secrets loss | Dual-key rotation covers HMAC; Vault export stored in secrets manager |
| Total platform loss | IaC + migrations rebuild the project; producer replay can repopulate projections from production outbox (source of truth remains production) |