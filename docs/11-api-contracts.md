# 11 — API Contract Specifications

| Field | Value |
|---|---|
| Document | 11 — API Contracts |
| Version | 1.0 Baseline |
| Scope | Admin Web Route Handlers (`/api/v1/*`) + Edge Function endpoints |

## 1. Conventions

| Topic | Specification |
|---|---|
| Base | `/api/v1` (path versioning; v2 may coexist) |
| Auth | `Authorization: Bearer <supabase-jwt>`; browser sends cookies via `@supabase/ssr` — handlers verify session + MFA claim |
| Content | `application/json; charset=utf-8` |
| Success | `{ "data": …, "meta": { "request_id", "next_cursor"?, "total_estimate"? } }` |
| Error | `{ "error": { "code", "message", "request_id", "details"? } }` — codes: `VALIDATION` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `INTERNAL` 500 · `UPSTREAM_UNAVAILABLE` 503 |
| Pagination | `?limit≤100&cursor=` keyset `(created_at,id)` → `meta.next_cursor`; never offset pagination on large sets |
| Sorting | `?sort=-created_at` (prefix `-` = desc) |
| Filtering | Explicit query params per endpoint (documented below); unknown params → 400 |
| Idempotency | `Idempotency-Key` header required on command POSTs; duplicate → 409 + existing command reference |
| Rate limits | Per admin: 120 req/min reads, 30/min mutations → 429 + `Retry-After` |
| Timestamps | ISO 8601 UTC |
| Validation | Zod schemas in `src/schemas/` are the single source for docs here and runtime validation |

## 2. Dashboard summary

### `GET /api/v1/summary/dashboard` — `dashboard.view` (+ per-metric filtering by claims)

Query: `range=today|7d|30d|90d|custom`, `from`/`to` (required when custom, ≤ 366 days).

```jsonc
// 200
{
  "data": {
    "metrics": [{
      "key": "M-REV-01", "value": 4825000, "unit": "currency", "currency": "USD",
      "previous_value": 4510000, "delta_percent": 6.98,
      "freshness": { "as_at": "2026-10-15T08:00:00Z", "sla_minutes": 1440, "status": "live" }
    },
    { "key": "M-POS-02", "status": "not_instrumented",
      "freshness": { "as_at": null, "sla_minutes": 1440, "status": "not_instrumented" } }],
    "series": { "mrr": [{ "date": "2026-10-14", "value": 4825000 }] },
    "recent_events": [{ "id", "type": "incident.opened", "severity": "S2", "at", "href" }]
  },
  "meta": { "request_id": "req_01HF…" }
}
```

Rules: metrics outside caller permissions are omitted (not zeroed); `not_instrumented` is a first-class status; series ≤ 120 points, downsampled server-side.

### `GET /api/v1/summary/metric-definitions` — `dashboard.view`
Returns the metric registry (key, definition, source, SLA, permission, status) powering tooltips and the definitions panel.

## 3. Businesses

| Method & path | Permission | Request | Response |
|---|---|---|---|
| `GET /businesses` | businesses.read | `query`, `status`, `country`, `plan`, `vision_status`, `sort=-last_activity_at`, `cursor`, `limit` | `{data: BusinessSummary[], meta}` |
| `GET /businesses/{id}` | businesses.read | — | `BusinessDetail` (header + tab payloads lazy-loaded via sub-resources) |
| `GET /businesses/{id}/timeline` | businesses.read | `cursor`, `limit` | merged event feed |
| `POST /businesses/{id}/commands` | per command type | `{command_type: "business.suspend"\|"business.restore", payload:{reason}, }` + `Idempotency-Key` | `202 {command}` — async; status via `/commands/{id}` |

```ts
// schemas/business.ts (excerpt — shared by client & server)
export const businessQuery = z.object({
  query: z.string().max(120).optional(),
  status: z.enum(['active','trial','suspended','cancelled','churned']).optional(),
  country: z.enum(['NG','GH','TG','CI']).optional(),
  plan: z.enum(['start','core','pro']).optional(),
  cursor: z.string().max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['last_activity_at','name','registered_at']).default('last_activity_at'),
});
```

## 4. Subscriptions & pricing

| Method & path | Permission | Notes |
|---|---|---|
| `GET /subscriptions/analytics` | subscriptions.read | `?range&country&plan` → KPIs (active/trial/churn/MRR by-currency + USD-normalized/ARR), series (mrr_trend, plan_mix, country_split), renewals (next 30 d), cancellations |
| `GET /subscriptions` | subscriptions.read | `?business_id&status&cursor` list (P1) |
| `POST /subscriptions/{id}/commands` | subscriptions.adjust | `{command_type:"subscription.adjust", payload:{plan?, status?, reason}}` + `Idempotency-Key` → `202` |
| `GET /settings/pricing` | pricing.read | full matrix + history per (country, plan) |
| `POST /settings/pricing/commands` | pricing.update | `{command_type:"pricing.upsert", payload:{country_code, plan_key, currency, amount_minor, effective_from, reason}}` → `202`; second approval required |

## 5. Payments

| Method & path | Permission | Notes |
|---|---|---|
| `GET /payments` | payments.read | `?status&country&provider&from&to&cursor` — projections only |
| `GET /payments/failures` | payments.read | failure queue with reason codes |
| `GET /payments/webhooks` | payments.read | webhook delivery monitor `[UNVERIFIED provider setup]` |
| `GET /payments/reconciliation` | payments.read | mismatch queue |
| `POST /payments/reconciliation/{id}/review` | payments.review | creates a review task (audited) — **no financial mutation possible from the admin platform** |

## 6. Product analytics

| Method & path | Permission | Notes |
|---|---|---|
| `GET /analytics/funnel` | analytics.read | `?range&platform&country` |
| `GET /analytics/retention` | analytics.read | cohort grid |
| `GET /analytics/adoption` | analytics.read | `?feature&range` heatmap data |
| `GET /analytics/distribution` | analytics.read | `?dimension=platform\|device\|version` |
| `GET /analytics/geo` | analytics.read | country-level only |
| `GET /analytics/conversion` | analytics.read | registration → paid |

Shared response envelope for analytics views:

```jsonc
{
  "data": { "series": [], "matrix": [] },
  "meta": {
    "status": "not_instrumented",          // 'live' | 'not_instrumented'
    "required_events": ["app.install"],    // what would provide this data
    "freshness": { "as_at": null, "sla_minutes": 1440, "status": "not_instrumented" }
  }
}
```

## 7. Services (Vision · Intelligence · Angel)

| Method & path | Permission | Notes |
|---|---|---|
| `GET /vision/overview` | vision.read | KPIs + pipeline status + capability status; **no media fields exist** |
| `GET /vision/cameras` | vision.read | `?business_id&status&cursor` fleet |
| `GET /ai/angel` | angel.read | usage, latency, tokens, estimated cost, rate limits, config names, capability status |
| `GET /ai/intelligence` | intelligence.read | jobs, insights, freshness, model versions, evaluations, capability status |

Every service response carries `capability_status` (`planned|implemented|tested|deployed`) + `last_verified_at` — UI renders honest states from this field alone.

## 8. Health, errors, incidents

| Method & path | Permission | Notes |
|---|---|---|
| `GET /health/services` | health.read | status board rows |
| `GET /health/errors` | health.read | error groups + filters; detail embeds redacted sample + sentry_url |
| `PATCH /health/errors/{id}` | health.manage_errors | `{status?, assignee?}` — audited |
| `GET /health/sync` | health.read | per-job lag/failures + DLQ |
| `POST /health/sync/dead-letters/{id}/retry` | health.manage_sync | Technical Admin |
| `GET /health/live` · `/health/ready` | public (probe) | no data; 200/503 |
| `GET /incidents` · `POST /incidents` | incidents.read / manage | lifecycle transitions validated server-side |
| `PATCH /incidents/{id}` · `POST /incidents/{id}/timeline` | incidents.manage | audited |

## 9. AI data, admin team, audit, commands

| Method & path | Permission | Notes |
|---|---|---|
| `GET /ai-data/datasets` · `POST` | ai_data.read / manage | metadata only; consent basis required |
| `POST /ai-data/datasets/{id}/versions` | ai_data.manage | storage upload via private bucket (presigned, server-issued) |
| `POST /ai-data/datasets/{id}/delete-command` | ai_data.manage | second approval + audit |
| `GET /admin-team` · `POST /admin-team/invite` | admin_team.read / invite | invite creates single-use token |
| `POST /commands/{id}/approve` · `/reject` | commands.approve + type permission | reason required; self-approval rejected 403/409 |
| `GET /commands?status&cursor` | commands.read | history |
| `POST /commands/{id}/retry` | health.manage_sync | Technical Admin (failed dispatch only) |
| `GET /audit` | audit.read | filters + keyset pagination |
| `POST /audit/export` | audit.export | async CSV → notification; audited |

## 10. Internal endpoints (not browser-facing)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /functions/v1/ingest-event` | HMAC (kid + timestamp + nonce) | doc 10 §4–6 |
| `POST /functions/v1/dispatch-command` (outbound) | pair secret | approved commands → production handler |
| `POST /functions/v1/sentry-ingest` | shared secret | Sentry → `system_errors` (redacted) |
| Cron: `reconcile`, `refresh-aggregates`, `check-freshness`, `retry-dead-letters` | service context | doc 07 §4 |

## 11. Versioning & deprecation

- Path-versioned (`/api/v1`); breaking changes → `v2` with overlap window; Zod schemas are the machine-readable contract; `openapi.json` generated from schemas in CI (doc 13 §5) and diffed to block accidental breaks.