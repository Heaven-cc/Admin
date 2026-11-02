# 05 — Design System

| Field | Value |
|---|---|
| Document | 05 — Design System |
| Version | 1.0 Baseline |
| Implementation | Tailwind CSS variables + shadcn/ui theme; single `tokens.css` source of truth |

**Brand note:** TREXVEN brand colors were not supplied. The system ships with a neutral enterprise default (slate + indigo accent) and explicitly marked **brand slots** (`--brand-*` tokens) so exact TREXVEN colors can be dropped in without refactoring `[ASSUMPTION A-10]`.

## 1. Design principles

1. Data first: ink on paper; color carries meaning (status), not decoration.
2. Calm: one accent per view section; no gradient noise; restrained motion.
3. Dense but breathable: compact tables, 8-pt grid, consistent gutters.
4. Honest: freshness chips, explicit empty states, no fake data.
5. Accessible: AA contrast minimum everywhere, visible focus, keyboard-complete.

## 2. Color tokens

### Core (light / dark)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#FAFAFA` | `#0B0F17` | App background |
| `--surface` | `#FFFFFF` | `#111827` | Cards, panels |
| `--surface-muted` | `#F1F5F9` | `#1E293B` | Table headers, wells |
| `--foreground` | `#0F172A` | `#E2E8F0` | Primary text |
| `--muted-foreground` | `#64748B` | `#94A3B8` | Secondary text |
| `--border` | `#E2E8F0` | `#263449` | Hairlines |
| `--brand` | `#4F46E5` | `#818CF8` | **Brand slot** — primary accent (buttons, active nav) |
| `--brand-foreground` | `#FFFFFF` | `#0B0F17` | On-accent text |
| `--brand-soft` | `#EEF2FF` | `#312E81` | Accent backgrounds, selection |

### Status / semantic

| Token | Value | Usage |
|---|---|---|
| `--success` / `--success-soft` | `#16A34A` / `#DCFCE7` (dark: `#4ADE80` / `#14532D`) | Active, connected, completed, live |
| `--warning` / `--warning-soft` | `#D97706` / `#FEF3C7` (dark: `#FBBF24` / `#78350F`) | Pending approval, stale, degraded |
| `--danger` / `--danger-soft` | `#DC2626` / `#FEE2E2` (dark: `#F87171` / `#7F1D1D`) | Failed, disconnected, critical |
| `--info` / `--info-soft` | `#0EA5E9` / `#E0F2FE` (dark: `#38BDF8` / `#0C4A6E`) | Informational, running |

### Distinction color (mandatory)

| Token | Value | Usage |
|---|---|---|
| `--gmv` | `#0D9488` (dark `#2DD4BF`) | **Customer sales (GMV) only** — never used for ODT revenue. Enforces FR-103 separation |

### Chart palette (ordered, colorblind-safe)

`#4F46E5` `#0D9488` `#D97706` `#0EA5E9` `#9333EA` `#DC2626` `#65A30D` `#64748B` — dark mode uses the raised variants of the same hues. Series > 8 collapse to "Other".

## 3. Typography

| Token | Value | Usage |
|---|---|---|
| Font | Inter (variable), fallback system stack | Everything |
| Mono | JetBrains Mono | IDs, provider refs, amounts in tables |
| `display` | 30/36 semibold, -0.5% tracking | Page titles |
| `title` | 18/24 semibold | Card/section titles |
| `body` | 14/20 regular | Default |
| `label` | 12/16 medium, +2% tracking, uppercase | Field labels, table headers |
| `caption` | 12/16 regular | Helper text, timestamps |
| `kpi` | 28/34 semibold, tabular-nums | KPI values |
| Numeric | `tabular-nums` on all data tables and KPIs | Alignment stability |

## 4. Space, radius, elevation, layout

| Token | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 px (4-pt base) |
| Radius | `--radius-sm` 6 · `--radius` 8 · `--radius-lg` 12 · `--radius-full` 999 |
| Shadows | `sm` (cards resting) · `md` (popovers) · `lg` (modals); dark mode uses 1-px borders + subtle shadows |
| Breakpoints | sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1440 |
| Z-index | dropdown 1000 · sticky 1100 · drawer 1200 · modal 1300 · toast 1400 · palette 1500 |
| Layout shell | Sidebar 240 px (collapsible to 64 px rail), topbar 64 px, content max-width 1600 px, page padding 24 px |

## 5. Motion

| Pattern | Spec |
|---|---|
| Enter/exit | 120–200 ms, ease-out; opacity + 4 px translate |
| Chart updates | 300 ms interpolation; no looping animations |
| Loading | Skeleton shimmer 1.2 s; no spinners inside cards |
| Reduced motion | `prefers-reduced-motion: reduce` → all transitions ≤ 1 frame |
| Forbidden | Parallax, ambient loops, hover scale on data elements |

## 6. Component inventory

| Component | Variants / notes |
|---|---|
| Button | primary, secondary, ghost, destructive; sizes sm/md; loading spinner state; icon buttons have `aria-label` |
| Input / Textarea / Select / Combobox | label above, hint below, inline error; Combobox = async search for business picker |
| DateRangePicker | presets (Today, 7d, 30d, 90d) + custom calendar; shared global state |
| DataTable | server-driven; sticky header; column sort; row density toggle; empty/loading/error slots |
| KpiCard | value (tabular), delta chip (▲/▼ with color semantics), sparkline, freshness chip, info tooltip linking to metric definition |
| FreshnessChip | `live` (green) · `updated Xm ago` (neutral) · `stale` (amber) — tooltip shows source + SLA |
| StatusChip / StatusDot | account status, subscription status, camera health, incident severity; dot + label, never color-only |
| Tabs / Dialog / Sheet / Drawer | Sheet = right side panel for detail views; Drawer = mobile nav only |
| CommandDialog (confirm) | typed confirmation field, reason textarea, consequence list, permission-aware |
| CommandStatusCard | live state machine display: pending → approved → executing → completed/failed |
| Toast | bottom-right, 4 s, action slot (e.g. "View audit entry") |
| Timeline | vertical feed, icon per event type, timestamps, actor |
| CommandPalette (`⌘K`) | screens, businesses, payments, incidents, permitted quick actions |
| Misc | Tooltip, Popover, DropdownMenu, Skeleton, Avatar, RoleChip, CopyButton, SectionHeader, Pagination (cursor), ApprovalInbox, EmptyState, ErrorState, NotInstrumented, StaleBanner |

## 7. Interaction states

| State | Rule |
|---|---|
| Hover | background tint 4–8%; never moves layout |
| Focus-visible | 2 px `--brand` ring, 2 px offset — on **every** interactive element |
| Active | pressed tint; no scale on data elements |
| Disabled | 40% opacity + `not-allowed`; tooltip explains why when permission-related |
| Loading | button spinner + disabled; row skeletons in tables |
| Destructive | destructive buttons always inside CommandDialog with typed confirmation |

## 8. Standard data states (every data surface)

| State | Visual | Copy pattern |
|---|---|---|
| Loading | Skeleton matching final layout (no spinners in cards) | — |
| Empty (no data yet) | Icon + title + description + primary action | "No businesses match these filters." → Clear filters |
| Not instrumented | Distinct dashed-border card, muted | "Not instrumented yet — this metric requires `app.install` events from the Owner App (doc 10 §8)." |
| Error | Danger icon + message + Retry + error ID | "Couldn't load payments. Error `req_8f3…`" |
| Unauthorized | **Hidden** for cards/sections; `/403` page for direct navigation | 403: "You need `payments.read` — held by Finance Admin and above." |
| Stale / lagging | Amber StaleBanner above affected section | "Data is 3 h behind — last sync 14:02 UTC. View sync health." |
| Disconnected | Full-width banner, mutations disabled | "You're offline. Reconnecting…" |

## 9. Data display rules

- Money: minor units → `Intl.NumberFormat` with currency; never floats in DB or UI math.
- Dark mode: all tokens have dark variants; charts use raised variants; shadows → borders.
- Density: tables 36 px rows; cards 16 px padding min; KPI value 28 px.
- Dates: relative under 48 h ("2 h ago"), else `2026-10-15 14:02 UTC`; all timestamps stored UTC.
- IDs: monospace, 8-char prefix + copy button (e.g. `biz_9fA2…`).