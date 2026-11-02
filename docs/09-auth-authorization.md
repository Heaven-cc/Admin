# 09 — Authentication & Authorization Design

| Field | Value |
|---|---|
| Document | 09 — Auth & Authorization |
| Version | 1.0 Baseline |
| Scope | Admin platform identity, sessions, RBAC, RLS, audit immutability |

## 1. Identity model

- Supabase Auth (`auth.users`) on the **admin project** holds credentials; `admin_users` (doc 08 §A) is the profile + role record, PK-equal to `auth.users.id`.
- **Open registration disabled** in Supabase Auth config. Accounts exist only via invitation: Super Admin (or `admin_team.invite` holder) issues invite → `admin_users(status='invited')` → single-use token email → `/invite/[token]` sets password + enrolls TOTP → `active`.
- `auth.users` never auto-provisions `admin_users`; a DB trigger **rejects** signups that have no matching `invited` row (belt-and-braces against config drift).
- Deactivation disables the `auth.users` entry and sets `admin_users.status='deactivated'`; rows are never deleted (audit FK integrity).

## 2. Authentication factors

| Control | Specification |
|---|---|
| First factor | Email + password; min 12 chars, breach-list checked; generic error copy (no user enumeration) |
| Second factor | **TOTP mandatory** (Supabase AAL2). Middleware blocks `aal1` sessions everywhere; recovery codes issued at enrollment |
| Login protection | Rate limit 5 attempts / 15 min per (email + IP hash); exponential lockout; CAPTCHA after 3 failures; all attempts → `auth_events` audit |
| Session theft response | Refresh-token reuse detection (Supabase built-in) revokes the session family; security alert to SA |

## 3. Sessions

| Control | Specification |
|---|---|
| Tokens | Short-lived access JWT (Supabase default) + refresh token in `httpOnly`, `Secure`, `SameSite=Lax` cookies (`@supabase/ssr`) |
| Absolute expiry | 8 h → forced re-auth (checked in middleware via session start claim) |
| Idle behaviour | Standard refresh flow; no "remember me" option |
| Concurrency | Max 3 active sessions; newest wins, others revoked (SA can force-logout any admin) |
| Logout | Server-side: revoke refresh token family + clear cookies + audit entry |
| CSRF | `SameSite=Lax` + custom `X-Admin-Request` header required on all mutating fetches (double-submit pattern) |

## 4. RBAC — roles and permission matrix

Permission key format `domain.action`. Enforced in three layers (UI hide → Route Handler check → **Postgres RLS, authoritative**). JWT carries `role` + `permissions` claims via a custom Supabase Auth hook reading `admin_users`/`admin_role_permissions` (claims refreshed on each login and on role change).

Roles: **SA** super_admin · **OA** operations · **FA** finance · **SuA** support · **TA** technical · **RO** read-only analyst.

| Permission | SA | OA | FA | SuA | TA | RO | Notes |
|---|---|---|---|---|---|---|---|
| dashboard.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| revenue.view | ✓ | ✓ | ✓ | – | – | ✓ | MRR/ARR/churn cards |
| sales.view | ✓ | ✓ | ✓ | – | ✓ | ✓ | GMV + POS |
| businesses.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| businesses.suspend / restore | ✓ | ✓ | – | – | – | – | via command |
| subscriptions.read | ✓ | ✓ | ✓ | ✓ | – | ✓ | |
| subscriptions.adjust | ✓ | – | ✓ | – | – | – | via command |
| payments.read | ✓ | ✓ | ✓ | ✓ | – | ✓ | |
| payments.review | ✓ | – | ✓ | – | – | – | reconciliation actions |
| pricing.read | ✓ | – | ✓ | – | – | ✓ | |
| pricing.update | ✓ | – | ✓ | – | – | – | via command |
| analytics.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| vision.read | ✓ | ✓ | – | ✓ | ✓ | ✓ | metadata only |
| angel.read / intelligence.read | ✓ | – | – | – | ✓ | ✓ | |
| health.read | ✓ | – | – | – | ✓ | ✓ | |
| incidents.read / manage | ✓ | ✓ | – | ✓ | ✓ | – | |
| ai_data.read / manage | ✓ | – | – | – | ✓ / ✓ | ✓ / – | |
| admin_team.read / invite | ✓ / ✓ | – | – | – | – | – | |
| commands.read / approve | ✓ | ✓ | ✓ | – | – | – | approvers per type |
| audit.read / export | ✓ | – | – | – | – | – | export itself audited |
| settings.view / notifications.manage | ✓ | ✓ | ✓ | ✓ | ✓ | – | |

Rules: no permission may be granted outside this matrix; changing the matrix is a migration + ADR. Read-only analyst holds **zero** mutating permissions by construction.

## 5. RLS policy patterns (authoritative)

```sql
-- helper: does the caller hold the permission?
create or replace function has_permission(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select bool_or(rp.permission_id = perm.id)
    from admin_role_permissions rp
    join admin_permissions perm on perm.id = rp.permission_id
    join admin_users au on au.role_id = rp.role_id
    where au.id = auth.uid() and au.status = 'active'
  ), false);
$$;

-- example: projections readable with businesses.read
alter table businesses_projection enable row level security;
create policy businesses_read on businesses_projection
  for select using (has_permission('businesses.read'));
```

| Table group | Policy |
|---|---|
| Projections / analytics | SELECT with matching `.read` permission |
| `admin_audit_logs` | SELECT with `audit.read`; **no UPDATE/DELETE grants exist** |
| `administrative_commands` | SELECT with `commands.read`; INSERT via Route Handler (service context); status transitions only via security-definer functions |
| `pricing_configurations` | SELECT `pricing.read`; INSERT only via command executor function |
| `admin_users` | SELECT self row, or `admin_team.read` |
| Datasets metadata | SELECT `ai_data.read`; manage via functions with `ai_data.manage` |

Service-role key is confined to Edge Functions (ingest/dispatch/cron), which run as definer with explicit, narrow grants.

## 6. Command authorization detail

| Step | Enforcement |
|---|---|
| Create | `command_types.permission_required` checked in Route Handler; payload validated against `payload_schema`; audit row written |
| Approve | Approver must hold `commands.approve` **and** the command's permission; `approver_id ≠ requested_by` enforced by trigger; rejection requires a reason |
| Dispatch | Edge Function (pair secret) sends to production `command-handler`, which **independently** validates schema + business rules (defense in depth) |
| Complete | `command.result.v1` event verifies the outcome; command marked `completed`/`failed`; result audited |

**Super Admin constraints (by construction, not policy):** SA cannot edit or delete audit rows (no grants exist), cannot bypass the two-person rule (trigger applies to everyone), cannot fabricate payment success (no such command type), and has no path to E3 data (never synced, never stored).

## 7. Audit immutability & completeness

- `REVOKE UPDATE, DELETE` from every role including `service_role`; INSERT only through a security-definer `write_audit()` function.
- DB triggers on sensitive tables (`administrative_commands`, `command_approvals`, `pricing_configurations`, `admin_users`, `dataset_*`) write audit rows **in the same transaction** — SQL-level changes cannot bypass it.
- Denied permission attempts are logged (actor, route) at `warn`.
- Optional WORM export: nightly JSONL dump to an immutable object bucket (Phase 2 hardening).
- pgTAP verifies no role can mutate audit rows (doc 13 §4).

## 8. Account lifecycle & recovery

```
invited ──(accept: password + TOTP)──► active ──(SA command)──► suspended ──► active
   │                                    │                                     
   │ 72 h expiry                        └──(SA command)──► deactivated (never deleted)
   └──(re-issue)──► invited
```

| Scenario | Flow |
|---|---|
| Lost MFA device | Admin contacts SA → SA issues `admin.mfa_reset` command (second approval required) → next login forces TOTP re-enrollment; audit + security notification |
| Forgot password | Standard reset email (rate-limited); MFA still required at next sign-in |
| Invite expiry | 72 h; SA re-issues (old token invalidated) |
| Suspended admin | Sessions revoked immediately; login blocked; status visible in Admin Team |

## 9. Security verification hooks

- **pgTAP:** RLS matrix per role; audit immutability; two-person rule; permission-claim refresh after role change.
- **Playwright:** unauthorized nav items hidden; direct URL access → `/403`; command flows require confirmation + approver ≠ requester.
- **Pre-launch:** external penetration test against OWASP ASVS L2 (doc 13 §9).