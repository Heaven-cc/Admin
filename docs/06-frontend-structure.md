# 06 — Frontend Application Structure

| Field | Value |
|---|---|
| Document | 06 — Frontend Structure |
| Version | 1.0 Baseline |
| Stack | Next.js 15 App Router · TypeScript strict · Tailwind · shadcn/ui · TanStack Query 5 · RHF + Zod · Recharts · Lucide · Framer Motion |

## 1. Directory tree

```
odt-admin/
├── .env.example                     # every var documented, no values (doc 14 §3)
├── middleware.ts                    # session + MFA gate, security headers
├── next.config.ts
├── package.json                     # pnpm; scripts per doc 14 §4
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── mfa/page.tsx
│   │   │   ├── invite/[token]/page.tsx
│   │   │   └── reset/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # shell: sidebar, topbar, providers
│   │   │   ├── overview/page.tsx
│   │   │   ├── businesses/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [businessId]/page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── vision/page.tsx
│   │   │   ├── intelligence/page.tsx
│   │   │   ├── angel/page.tsx
│   │   │   ├── health/page.tsx
│   │   │   ├── incidents/page.tsx
│   │   │   │   └── [incidentId]/page.tsx
│   │   │   ├── ai-data/page.tsx
│   │   │   │   └── [datasetId]/page.tsx
│   │   │   ├── admin-team/page.tsx
│   │   │   ├── audit/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       └── pricing/page.tsx
│   │   ├── 403/page.tsx
│   │   └── api/v1/                  # Route Handlers (doc 11)
│   │       ├── summary/dashboard/route.ts
│   │       ├── businesses/route.ts
│   │       ├── businesses/[businessId]/route.ts
│   │       ├── businesses/[businessId]/commands/route.ts
│   │       ├── subscriptions/analytics/route.ts
│   │       ├── payments/route.ts
│   │       ├── analytics/[view]/route.ts
│   │       ├── vision/route.ts
│   │       ├── ai/[service]/route.ts
│   │       ├── health/route.ts
│   │       ├── incidents/route.ts
│   │       ├── ai-data/route.ts
│   │       ├── admin-team/route.ts
│   │       ├── audit/route.ts
│   │       ├── commands/route.ts
│   │       └── settings/pricing/route.ts
│   ├── components/
│   │   ├── ui/                      # shadcn primitives (button, dialog, table…)
│   │   ├── layout/                  # sidebar, topbar, command-palette, env-badge
│   │   ├── data-table/              # DataTable, FilterBar, CursorPagination
│   │   ├── kpi/                     # KpiCard, FreshnessChip, DeltaChip
│   │   ├── charts/                  # AreaTrend, Donut, Bars, StackedBars, Funnel
│   │   ├── states/                  # EmptyState, ErrorState, NotInstrumented,
│   │   │                            # Unauthorized, StaleBanner, Skeletons
│   │   ├── commands/                # CommandDialog, ApprovalInbox, CommandStatusCard
│   │   └── domain/                  # per-module composites (BusinessHeader, …)
│   ├── lib/
│   │   ├── supabase/client.ts       # browser (anon key)
│   │   ├── supabase/server.ts       # RSC/route handler (user cookie session)
│   │   ├── supabase/admin.ts        # server-only, service role — NEVER imported client-side
│   │   ├── auth/permissions.ts      # permission keys + role matrix (doc 09 §4)
│   │   ├── auth/require-permission.ts
│   │   ├── api/response.ts          # envelope + RFC-style errors
│   │   ├── format/currency.ts date.ts number.ts
│   │   └── utils/cn.ts
│   ├── hooks/                       # useDateRange, useDebounce, usePermissions
│   ├── queries/                     # TanStack Query hooks per domain + queryKeys.ts
│   ├── schemas/                     # Zod schemas shared client/server (doc 11)
│   ├── types/                       # generated DB types + API DTOs
│   └── config/                      # nav config, metric registry constants
├── supabase/
│   ├── migrations/                  # versioned SQL (doc 08 §12)
│   ├── functions/                   # ingest-event, dispatch-command, cron jobs
│   ├── tests/                       # pgTAP (doc 13 §4)
│   └── seed/                        # staging seed + fake producer fixtures
└── tests/
    ├── unit/ · component/ · e2e/ (Playwright)
```

## 2. Conventions

| Topic | Convention |
|---|---|
| Rendering | React Server Components by default; `"use client"` only for interactivity (forms, charts, palette) |
| Data fetching | Server components call `lib/api/*` directly; client interactivity via TanStack Query hooks in `queries/` |
| Query keys | Factory in `queries/queryKeys.ts`: `qk.businesses(filters)`, `qk.business(id)`, `qk.dashboard(range)` — single source, invalidation-safe |
| Permissions | `requirePermission('businesses.read')` guards Route Handlers; `usePermissions()` gates UI. UI hiding is UX only — RLS is the real gate |
| Env vars | `NEXT_PUBLIC_*` only for URL + anon key; everything else server-only; `lib/supabase/admin.ts` is banned from client bundles (ESLint `no-restricted-imports` + CI grep) |
| Validation | Zod schemas in `schemas/` shared by forms and Route Handlers; parse all inputs and outputs |
| Errors | Route segments define `error.tsx`; global `not-found.tsx` + `403/`; API errors use the envelope in `lib/api/response.ts` |
| Naming | Components `PascalCase.tsx`; hooks `use-thing.ts`; everything else `kebab-case.ts`; types `PascalCase` |
| Imports | Path alias `@/`; order: react/next → external → internal |
| State | URL is source of truth for filters/ranges (shareable views); no global client store needed |
| Styling | Tokens from doc 05 only; no hex literals in components |
| Commits | Conventional Commits (`feat(businesses): …`); PR template with checklist |

## 3. Route ↔ permission ↔ data map (summary)

| Route | Permission | Primary source |
|---|---|---|
| `/overview` | dashboard.view | `GET /api/v1/summary/dashboard` |
| `/businesses` (+detail) | businesses.read | businesses endpoints |
| `/subscriptions` | subscriptions.read | subscription analytics |
| `/payments` | payments.read | payments endpoints |
| `/analytics` | analytics.read | analytics views |
| `/vision` | vision.read | vision endpoints |
| `/intelligence`, `/angel` | intelligence.read / angel.read | ai endpoints |
| `/health` | health.read | health endpoints |
| `/incidents` | incidents.read (+manage) | incidents endpoints |
| `/ai-data` | ai_data.read (+manage) | dataset endpoints |
| `/admin-team` | admin_team.read (+invite) | admin endpoints |
| `/audit` | audit.read (+export) | audit endpoints |
| `/settings`, `/settings/pricing` | settings.view / pricing.update | settings endpoints |

## 4. Performance rules

- Server components fetch in parallel (`Promise.all`); no waterfall requests.
- TanStack Query: `staleTime` 60 s (dashboard 30 s), retry ×2 with backoff, `refetchOnWindowFocus` off.
- Charts: downsample server-side to ≤ 120 points per series.
- Tables: server pagination (cursor), never client-side over full result sets.
- Route-level code splitting is automatic; keep `domain/` composites tree-shakeable (no barrel side effects).