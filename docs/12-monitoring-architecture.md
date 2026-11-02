# 12 — Operational Monitoring Architecture

| Field | Value |
|---|---|
| Document | 12 — Monitoring Architecture |
| Version | 1.0 Baseline |
| Depends on | 07 (functions), 10 (pipeline telemetry), 13 (verification) |

## 1. Signal sources

| Source | Captures | Path into admin |
|---|---|---|
| Sentry (admin web + Edge Functions) | Frontend exceptions, API errors, function crashes | `sentry-ingest` webhook → `system_errors` |
| TREXVEN apps (Flutter) + backend services | Crashes, service errors | `error.occurrence.batch.v1` via bridge `[UNVERIFIED existing crash reporting]` |
| Supabase logs | DB errors, auth failures, function logs | Queries + auth-failure counters |
| Vercel observability | Runtime errors, edge metrics | Sentry + manual review |
| Uptime probes (recommend Better Stack or UptimeRobot; either is fine — pick on price/integration) | Synthetic availability of admin web + health endpoints | Probe webhooks → service status board |
| Pipeline self-telemetry | Lag, DLQ depth, job failures, freshness | `sync_*` tables — the pipeline observes itself |

## 2. Error pipeline

1. `sentry-ingest` receives issue webhooks; groups by deterministic `fingerprint` (service + type + top frames).
2. Redaction pass (§5) before persistence; sample capped 4 KB.
3. Upsert `system_errors`: occurrence count, first/last seen, affected versions/services, severity.
4. App/service errors arrive as `error.occurrence.batch.v1` and flow through the same upsert.
5. Resolution actions (acknowledge / resolve / assign) are admin mutations — audited.

## 3. Severity model

| Severity | Definition | Response |
|---|---|---|
| **S1** | Platform down, data loss risk, security event, audit-immutability violation attempt | Page immediately (on-call), incident opened |
| **S2** | Major feature down; sync halted; payment webhook failures above threshold; auth-failure spike | Alert ≤ 15 min, incident likely |
| **S3** | Degraded performance, elevated error rate, stale analytics beyond SLA | Same-business-day triage |
| **S4** | Minor / cosmetic / single-occurrence noise | Backlog |

## 4. Alert matrix

| Condition | Severity | Channel | Runbook |
|---|---|---|---|
| Sync lag > 2× SLA | S2 | Email + Slack + bell | R-01 sync lag |
| DLQ depth > 50 or growing | S2 | Email + Slack | R-02 DLQ |
| Reconciliation drift | S2 | Email | R-03 drift |
| Payment webhook failures > 10 / 15 min | S2 | Email + Slack | R-04 webhooks |
| API error rate > 5% over 5 min | S2 | Slack | R-05 API errors |
| Uptime < 99% (1 h) | S1/S2 | Page | R-06 outage |
| Auth failure spike (> 10× baseline) | S2 | Email + Slack | R-07 auth |
| Audit immutability violation attempt | S1 | Page + SA | R-08 security |
| Freshness stale > 24 h on any registry metric | S3 | Email | R-09 freshness |
| Scheduled job missed 2× | S3 | Email | R-10 jobs |
| MFA-disabled attempt on any admin | S2 | Email + SA | R-07 auth |

Runbooks live in `docs/runbooks/R-01…R-10` (created in Phase 3; each: symptoms, diagnosis steps, mitigation, escalation).

## 5. Redaction & hygiene rules

- Strip `Authorization`/cookies/token fields from all captured contexts.
- Emails → salted hash; IPs → salted hash; no raw request bodies containing PII.
- E3-classed content is never persisted anywhere in the admin platform.
- Error samples capped (4 KB); stack traces fine, payloads filtered by allowlist.
- Logs are structured JSON; secrets never logged (CI secret-scan guard).

## 6. Health checks & status board

| Check | Method | Maps to |
|---|---|---|
| Admin web | External uptime probe → `/api/v1/health/live` | Service board, M-SYS-02 |
| Admin DB | `ready` query + connection pool saturation | Service board |
| Ingest pipeline | Heartbeat: newest `sync_jobs.last_run_at` + lag | Sync panel, M-SYNC-01 |
| Production bridge | Freshness of latest events per source | Service board (degraded if silent > 2× SLA) |
| Paystack webhooks | Delivery success/latency counters `[UNVERIFIED]` | Payments module |
| Vision / Angel / Intelligence | Latest `vision.daily_summary` / `ai.usage.daily` + capability status | Service board (shows "no telemetry" honestly) |

## 7. Incidents linkage

Error groups and sync failures are linkable to `incidents` records (doc 04 §4.11); opening/escalating an incident notifies role-based destinations from Settings → Notifications.

## 8. Ownership

Technical Admin owns pipeline monitoring health; on-call rotation (Ops + TA) handles S1/S2; every alert references a runbook; monthly review of alert noise (target: < 10% non-actionable).