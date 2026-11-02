# 03 — System Architecture Diagrams

| Field | Value |
|---|---|
| Document | 03 — Architecture Diagrams |
| Version | 1.0 Baseline |
| Format | Mermaid (renders in GitHub / VS Code) |

## D1 — Ecosystem topology (high level)

```mermaid
flowchart TD
    subgraph PROD["TREXVEN Production (existing — untouched except additive bridge)"]
        OA[Owner App Flutter] --> PB[(TREXVEN Supabase)]
        POS[POS App] --> PB
        VIS[Vision Service] --> PB
        INT[Intelligence Service] --> PB
        ANG[Angel AI Service] --> PB
        PSC[Paystack Webhooks] --> PB
        BRIDGE["admin_bridge (additive only)"]
        BRIDGE --> PB
    end
    BRIDGE -->|"signed events (HMAC, HTTPS)"| ING["ingest-event Edge Function"]
    subgraph ADMIN["ODT Admin Platform (separate project)"]
        ING --> AS[(Admin Supabase<br/>Postgres + RLS + Auth)]
        WEB["Admin Web — Next.js on Vercel"] --> AS
        DISP["dispatch-command Edge Function"]
        CRON["Scheduled jobs (reconcile, refresh, freshness)"]
        CRON --> AS
    end
    AS --> WEB
    DISP -->|"approved commands only"| CH["command-handler (prod)"]
    CH --> BRIDGE
    CRON -->|"counts/checksums only"| BRIDGE
```

**Reading notes:** the only arrows entering production are (a) approved commands and (b) reconciliation count queries. The only arrow leaving production is the signed event stream. `[UNVERIFIED]`: production table names feeding the bridge triggers.

## D2 — Event ingestion (happy path + failure path)

```mermaid
sequenceDiagram
    participant PUB as bridge-publish (prod)
    participant ING as ingest-event (admin)
    participant DB as Admin Supabase
    participant VLT as Vault (HMAC keys)
    participant DLQ as dead-letter store
    PUB->>ING: POST batch of events (HMAC-SHA256 signature, kid, timestamp)
    ING->>VLT: resolve kid
    ING->>ING: verify signature + 5-min replay window
    alt signature invalid or expired
        ING-->>PUB: 401 rejected (attempt logged, alert after N)
    end
    ING->>DB: INSERT ingest_events ON CONFLICT (event_id) DO NOTHING
    Note over DB: duplicates silently ignored — idempotent redelivery is safe
    ING->>DB: apply projections via idempotent upserts (per entity, ordered by occurred_at)
    alt projection failure (schema/DB error)
        ING->>DB: mark event failed, schedule retry (exponential backoff)
        ING->>DLQ: after N failures → dead_letter + alert
    end
    ING-->>PUB: 202 with per-event status list
    PUB->>PUB: mark outbox rows sent / keep for retry
```

## D3 — Administrative command flow (production-affecting action)

```mermaid
sequenceDiagram
    participant ADM as Admin (user)
    participant WEB as Admin Web (Route Handler)
    participant DB as Admin Supabase
    participant APR as Second approver
    participant DISP as dispatch-command
    participant PROD as command-handler (prod)
    ADM->>WEB: submit command (e.g. suspend_business) with Idempotency-Key
    WEB->>WEB: JWT + permission check, Zod validation
    WEB->>DB: INSERT administrative_commands (status=pending or awaiting_approval)
    DB->>DB: audit log entry (append-only)
    alt high-risk command
        APR->>DB: approve or reject (approver ≠ requester, DB-enforced)
    end
    DISP->>DB: poll approved commands
    DISP->>PROD: POST command (mTLS-style shared secret, Idempotency-Key)
    PROD->>PROD: validate, execute against production data (scoped handler)
    PROD-->>DISP: 200 result (or async + result event)
    PROD->>ING: emits command.result.v1 event (via outbox)
    DISP->>DB: mark command completed/failed + store result
    DB->>DB: audit log entry with final status
    Note over DB: projections update only from command.result events — never hand-edited
```

## D4 — Authentication and authorization (request path)

```mermaid
sequenceDiagram
    participant U as Admin browser
    participant MW as Next.js Middleware
    participant SB as Supabase Auth
    participant RH as Route Handler
    participant DB as Admin Supabase (RLS)
    U->>SB: email + password
    SB-->>U: first factor OK → MFA challenge required
    U->>SB: TOTP code
    SB-->>U: session JWT (claims: role, permissions)
    U->>MW: request /dashboard
    MW->>MW: session valid? MFA verified? else redirect /login
    U->>RH: GET /api/v1/businesses (Bearer JWT)
    RH->>RH: zod parse + permission check (claims)
    RH->>DB: query with user JWT (RLS applies)
    DB-->>RH: only RLS-permitted rows
    RH-->>U: 200 JSON
    Note over DB: service-role key is never present in this path
```

## D5 — Environments and promotion

```mermaid
flowchart LR
    DEV["local dev<br/>supabase cli + seed"] --> PR["GitHub PR<br/>lint · typecheck · unit · build"]
    PR -->|merge to main| STG["staging<br/>Vercel + admin-staging Supabase<br/>fake producer script"]
    STG -->|e2e + pgTAP green| GA["manual approval<br/>(protected environment)"]
    GA --> PRD["production<br/>Vercel + admin-prod Supabase<br/>real bridge"]
    PRD --> RB["rollback: Vercel instant revert<br/>DB: PITR + down migrations"]
```

## Conventions for these diagrams

- Diagrams are authoritative for *flow shape*; schemas and contracts live in docs 08/10/11.
- Any production-side node name (`admin_bridge`, `command-handler`) is `[UNVERIFIED]` until the integration prerequisite checklist (doc 17 §7) is executed against the real TREXVEN backend.
- When adding products to the ecosystem, extend D1 with a new producer; do not add direct database links from the admin project to new product databases.