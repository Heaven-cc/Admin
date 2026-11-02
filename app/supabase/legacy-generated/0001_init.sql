-- 0001_init.sql — identity & access (docs/08 §A, docs/09 §4–5)
-- Admin Supabase project. RLS ships in the same migration as every table.


-- ── Enums ───────────────────────────────────────────────────────────────────
create type admin_status as enum ('invited', 'active', 'suspended', 'deactivated');
create type account_status as enum ('unknown', 'active', 'trial', 'suspended', 'cancelled', 'churned');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
create type vision_status as enum ('none', 'active', 'suspended');
create type command_status as enum (
  'pending_approval','approved','rejected','dispatching',
  'executing','completed','failed','cancelled'
);

-- ── RBAC tables ─────────────────────────────────────────────────────────────
create table admin_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true
);

create table admin_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null,
  description text
);

create table admin_role_permissions (
  role_id uuid not null references admin_roles(id) on delete cascade,
  permission_id uuid not null references admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table admin_users (
  id uuid primary key, -- = auth.users.id
  email text not null unique check (email = lower(email)),
  full_name text,
  role_id uuid references admin_roles(id),
  status admin_status not null default 'invited',
  mfa_enforced boolean not null default true,
  invited_by uuid references admin_users(id),
  invited_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_users_role_idx on admin_users (role_id);
create index admin_users_status_idx on admin_users (status);

-- ── Permission helper (docs/09 §5) ─────────────────────────────────────────
create or replace function has_permission(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select bool_or(true)
    from admin_users au
    join admin_role_permissions rp on rp.role_id = au.role_id
    join admin_permissions p on p.id = rp.permission_id
    where au.id = auth.uid() and au.status = 'active' and p.key = p_key
  ), false);
$$;

create or replace function current_role_key() returns text
language sql stable security definer set search_path = public as $$
  select r.key from admin_users au join admin_roles r on r.id = au.role_id
  where au.id = auth.uid() and au.status = 'active';
$$;

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── RLS: enable everywhere, deny by default ────────────────────────────────
alter table admin_roles enable row level security;
alter table admin_permissions enable row level security;
alter table admin_role_permissions enable row level security;
alter table admin_users enable row level security;

create policy admin_roles_read on admin_roles for select
  using (has_permission('admin_team.read') or has_permission('dashboard.view'));
create policy admin_permissions_read on admin_permissions for select
  using (has_permission('admin_team.read') or has_permission('dashboard.view'));
create policy admin_role_permissions_read on admin_role_permissions for select
  using (has_permission('admin_team.read') or has_permission('dashboard.view'));

create policy admin_users_self_read on admin_users for select
  using (id = auth.uid() or has_permission('admin_team.read'));

create policy admin_users_insert on admin_users for insert
  with check (has_permission('admin_team.invite') and status = 'invited');

create policy admin_users_update on admin_users for update
  using (has_permission('admin_team.invite'))
  with check (id <> auth.uid()); -- users cannot act on their own account (FR-955)

-- ── Seeds: roles, permissions, matrix (docs/09 §4) ─────────────────────────
insert into admin_roles (key, name, description) values
  ('super_admin', 'Super Admin', 'Platform governance, admin team, final approvals'),
  ('operations_admin', 'Operations Admin', 'Day-to-day account operations'),
  ('finance_admin', 'Finance Admin', 'Revenue, payments, pricing'),
  ('support_admin', 'Support Admin', 'Account reviews, support cases'),
  ('technical_admin', 'Technical Admin', 'Service health, sync pipeline, errors'),
  ('read_only_analyst', 'Read-Only Analyst', 'Reporting and analysis; zero mutations');

insert into admin_permissions (key, category) values
  ('dashboard.view', 'dashboard'),
  ('revenue.view', 'dashboard'),
  ('sales.view', 'dashboard'),
  ('businesses.read', 'businesses'),
  ('businesses.suspend', 'businesses'),
  ('businesses.restore', 'businesses'),
  ('subscriptions.read', 'subscriptions'),
  ('subscriptions.adjust', 'subscriptions'),
  ('payments.read', 'payments'),
  ('payments.review', 'payments'),
  ('pricing.read', 'pricing'),
  ('pricing.update', 'pricing'),
  ('analytics.read', 'analytics'),
  ('vision.read', 'vision'),
  ('angel.read', 'ai'),
  ('intelligence.read', 'ai'),
  ('health.read', 'health'),
  ('health.manage_errors', 'health'),
  ('health.manage_sync', 'health'),
  ('incidents.read', 'incidents'),
  ('incidents.manage', 'incidents'),
  ('ai_data.read', 'ai_data'),
  ('ai_data.manage', 'ai_data'),
  ('admin_team.read', 'admin_team'),
  ('admin_team.invite', 'admin_team'),
  ('commands.read', 'commands'),
  ('commands.approve', 'commands'),
  ('audit.read', 'audit'),
  ('audit.export', 'audit'),
  ('settings.view', 'settings'),
  ('notifications.manage', 'settings');

-- Role matrix mirrors src/lib/auth/permissions.ts (pgTAP tests assert parity)
insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r, admin_permissions p
where (r.key = 'super_admin')
   or (r.key = 'operations_admin' and p.key in (
     'dashboard.view','revenue.view','sales.view','businesses.read','businesses.suspend',
     'businesses.restore','subscriptions.read','payments.read','analytics.read','vision.read',
     'incidents.read','incidents.manage','commands.read','commands.approve','settings.view'))
   or (r.key = 'finance_admin' and p.key in (
     'dashboard.view','revenue.view','sales.view','businesses.read','subscriptions.read',
     'subscriptions.adjust','payments.read','payments.review','pricing.read','pricing.update',
     'analytics.read','commands.read','commands.approve','settings.view'))
   or (r.key = 'support_admin' and p.key in (
     'dashboard.view','businesses.read','subscriptions.read','payments.read','analytics.read',
     'vision.read','incidents.read','incidents.manage','commands.read','settings.view'))
   or (r.key = 'technical_admin' and p.key in (
     'dashboard.view','sales.view','businesses.read','analytics.read','vision.read','angel.read',
     'intelligence.read','health.read','health.manage_errors','health.manage_sync','incidents.read',
     'incidents.manage','ai_data.read','ai_data.manage','commands.read','settings.view'))
   or (r.key = 'read_only_analyst' and p.key in (
     'dashboard.view','revenue.view','sales.view','businesses.read','subscriptions.read',
     'payments.read','analytics.read','vision.read','pricing.read'));

-- ── Lifecycle guard: no auto-provisioning without an invite (docs/09 §1) ───
create or replace function reject_uninvited_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'invited' then return new; end if;
  if not exists (select 1 from admin_users where id = new.id) then
    raise exception 'Signup rejected: no invited admin row for % (docs/09 §1)', new.email;
  end if;
  return new;
end $$;

create trigger admin_users_guard
  before insert on admin_users
  for each row execute function reject_uninvited_admin();
