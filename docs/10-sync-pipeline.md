# 10 — Secure Analytics Synchronization Architecture

| Field | Value |
|---|---|
| Document | 10 — Sync Pipeline |
| Version | 1.0 Baseline |
| Scope | One-way production → admin data movement; event schemas; idempotency; retries; reconciliation; app instrumentation requirements |

## 1. Objectives & non-goals

**Objectives:** deliver authorized operational, financial, and aggregate analytics data to the admin platform; idempotent + recoverable; schema-versioned; observable (lag, failures, DLQ); auditable; PII-minimal; multi-product extensible.

**Non-goals:** real-time streaming (1–60 min latency is fine); two-way sync; full database replication; customer-level data warehousing (E3 never leaves production).

## 2. Classification enforcement

Every event schema declares a class per payload field (doc 02 §3). The ingest validator **rejects** any payload containing keys not present in the registered schema for that `event_type`+`schema_version` — unknown/undeclared fields are dropped and logged, E3-classed fields are hard-rejected. Payloads are size-capped (2 MB/batch, 50 KB/event).

## 3. Event envelope (v1)

```json
{
  "event_id": "018f6d2e-7c1a-7f3e-9f2a-3b8c4d5e6f70",
  "event_type": "payment.succeeded",
  "schema_version": 1,
  "source_service": "owner_app_backend",
  "occurred_at": "2026-10-15T09:24:03.112Z",
  "producer": "admin_bridge@prod-1",
  "trace_id": "018f6d2e-0000-7f3e-9f2a-000000000001",
  "payload": {
    "business_id": "b_9fA2Kx7Q",
    "provider": "paystack",
    "provider_ref": "PSK_88h2...",
    "amount_minor": 1500000,
    "currency": "NGN",
    "status": "success"
  }
}
```

| Field | Rule |
|---|---|
| `event_id` | UUIDv7, globally unique, **the idempotency key** |
| `event_type` | `domain.name` — registered in the catalog (§5) |
| `schema_version` | Int; ingest supports current + previous major |
| `occurred_at` | Producer timestamp; ingest applies per-entity ordering by `occurred_at` with 5-min clock-skew tolerance |
| `payload` | Whitelisted fields only; E3 forbidden |

## 4. Delivery protocol

| Aspect | Specification |
|---|---|
| Transport | HTTPS POST, batches ≤ 500 events, from `bridge-publish` → `ingest-event` |
| Auth | Headers: `X-Admin-Key-Id` (kid), `X-Admin-Timestamp`, `X-Admin-Nonce`, `X-Admin-Signature: v1=HMAC_SHA256(secret, timestamp + "." + nonce + "." + body)` |
| Replay protection | Timestamp window ±5 min; nonce cache (15 min) rejects reuse |
| Key management | Dual HMAC keys in Supabase Vault (current + previous) → zero-downtime 90-day rotation |
| Response | `202` with per-event status list (`accepted` / `duplicate` / `rejected:<reason>`); `rejected` events are NOT retried by producer — they require a schema fix |

## 5. Event catalog v1 (producer → consumer)

| Event type | Payload highlights | Class | Consumer writes |
|---|---|---|---|
| `business.created.v1` / `.updated.v1` | business_id, name, country_code, registered_at | E1 | businesses_projection |
| `business.status_changed.v1` | business_id, status, reason? | E1 | businesses_projection |
| `subscription.created.v1` / `.renewed.v1` / `.canceled.v1` / `.expired.v1` | business_id, plan, status, currency, amount_minor, period, provider | E1/E2 | subscriptions_projection |
| `payment.succeeded.v1` / `.failed.v1` | business_id, provider, provider_ref, amount_minor, currency, failure_reason? | E2 | payments_projection |
| `payment.refunded.v1` | payment ref, amount, reason | E2 | refunds_projection |
| `pos.transaction.batch.v1` | daily aggregates per business: tx_count, gmv_minor, currency | E0/E1 | analytics_daily_aggregates |
| `analytics.event.batch.v1` | pre-aggregated event counters by type/platform/country/day | E0 | analytics_events / aggregates |
| `device.heartbeat.batch.v1` | device counts by platform per business/day | E1 | aggregates (POS active) |
| `vision.camera.heartbeat.v1` / `.batch.v1` | camera_id, business_id, status, model_version | E1 | cameras_projection |
| `vision.daily_summary.v1` | latency p95, throughput, errors, storage delta | E1 | vision_service_metrics |
| `ai.usage.daily.v1` | service (angel/intelligence), requests, errors, latency, tokens, est. cost, provider | E1 | ai_service_metrics |
| `error.occurrence.batch.v1` | fingerprint, service, severity, message (redacted), versions | E1 | system_errors |
| `command.result.v1` | command_id, status, result, error | E1 | administrative_commands |
| `reconciliation.snapshot.v1` | entity, window, count, checksum | E0 | reconciliation_runs |

Adding an event = schema PR + ingest registration + tests; producers cannot invent events silently.

## 6. Ingest processing & retry model

Per-event transaction in `ingest-event`:

1. **Dedupe:** `INSERT INTO sync_ingest_events ... ON CONFLICT (event_id) DO NOTHING` — if not inserted, ack as `duplicate` (idempotent redelivery).
2. **Validate:** schema check for `event_type` + `schema_version`; unknown fields dropped + logged; E3 fields hard-rejected.
3. **Apply:** idempotent upserts into projections/aggregates guarded by `occurred_at`/`updated_at` — a late or out-of-order event never regresses state.
4. **Mark:** `processing_status = processed`; lag = `applied_at − occurred_at` recorded per event.

| Failure type | Handling |
|---|---|
| Transient (DB, timeout) | Retry with backoff 1/5/15/60 min, max 12 attempts → `sync_dead_letters` + alert |
| Permanent (schema, E3, size) | Immediate dead-letter + alert; **no** blind retries; requires schema fix + manual replay |
| Poison batch | Per-event isolation — one bad event never blocks the batch |

**Ordering:** strict per-entity (`business_id` / `payment ref`) by `occurred_at`; cross-entity parallel. **Delivery semantics:** effectively-once via `event_id` PK + idempotent upserts (at-least-once transport tolerated). **Backfill:** ranges can be re-requested from the bridge without duplicate effects.

## 7. Reconciliation (self-healing)

| Aspect | Specification |
|---|---|
| Schedule | Daily 02:00 UTC + monthly full audit |
| Inputs | `reconciliation.snapshot.v1` events from production bridge views — **counts and checksums only**, never row data |
| Method | Compare per entity per day: businesses, subscriptions, payments, GMV aggregates. Checksum = cheap deterministic fingerprint (e.g. `sum(hashtext(business_id::text))`) |
| Drift | `|delta| > threshold` → `reconciliation_runs` row + alert (TA) + dashboard badge |
| Self-heal | Targeted `backfill.request` to bridge for affected ranges → events re-flow through the normal pipeline |
| Cost | No production read load beyond views; no admin-side full scans |

## 8. App instrumentation requirements `[UNVERIFIED — to be implemented in TREXVEN apps]`

The admin platform can only display what production emits. The following event set is **required**; until the apps emit it, affected metrics render "Not instrumented yet". Nothing here assumes existing telemetry.

| Event (apps → prod → bridge) | When | Fields (no PII) |
|---|---|---|
| `app.install` | First launch after install/update-attribution | platform, app_version, country_code |
| `business.registration_completed` | Account created | business_id, country_code |
| `onboarding.completed` | Guided setup finished | business_id, duration_s, steps_skipped |
| `session.start` / `session.end` | Foreground lifecycle | business_id, platform, app_version, duration_s |
| `feature.used` | Feature interaction (whitelist of feature keys) | business_id, feature_key, surface (owner/pos) |
| `pos.transaction.recorded` | Sale saved in POS (aggregated daily upstream) | business_id, amount_minor, currency, ts |
| `device.heartbeat` | Daily device ping | device_class (owner/pos), platform, app_version |

Batching: app events buffer and flush ≤ 24 h granularity; production aggregates them before bridge publication (apps never talk to the admin platform directly).

## 9. Production adapter & integration verification `[UNVERIFIED]`

All production assumptions are isolated in one place:

| Adapter concern | What must be verified against the real TREXVEN backend |
|---|---|
| Source tables for triggers | Actual table/column names for businesses, subscriptions, payments (schema uninspected) |
| Outbox population | Whether existing writes can carry trigger payloads or need app-side hooks |
| Paystack webhooks | Existing webhook endpoint, signature scheme, event coverage (success/failure/refund) |
| Command-handler surface | Agreed endpoint + secret exchange; production-side permission checks |
| Safe views | Read-only count/checksum views approved by TREXVEN backend owners |
| Telemetry existence | Whether ANY of §8's events exist today (expected: mostly not) |

A contract-test suite (doc 13 §5) runs against a mock bridge in CI and against the real bridge during integration; mismatches fail the build, never silently diverge.

## 10. Failure scenario matrix

| Scenario | Behavior |
|---|---|
| Duplicate delivery | Dedupe by `event_id` → `duplicate` ack |
| Out-of-order delivery | `occurred_at` guard → state never regresses; late events logged |
| Schema mismatch | Event rejected → dead-letter + alert; producer fixed via versioned schema |
| Admin Supabase down | Producer retains outbox rows (status `pending`), retries with backoff — no loss |
| Production down | No events flow; dashboards show freshness staleness + banner |
| HMAC failure | 401 + attempt log; alert after 3 consecutive failures (key rotation suspect) |
| Replay attack | Nonce/timestamp rejection |
| DLQ backlog > threshold | Critical alert; System Health shows queue size |
| Reconciliation drift | Alert + targeted backfill (§7) |