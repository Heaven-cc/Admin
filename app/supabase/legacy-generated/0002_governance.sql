-- 0002_governance.sql — audit, commands, approvals (docs/08 §B)

-- ── Append-only audit (ADR-005) ─────────────────────────────────────────────
create table admin_audit_logs (
  id bigserial,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text not null,
  resource_type text,
  resource_id text,
  request_id text,
  ip_hash text,
  user_agent text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  primary key (id, occurred_at)
) partition by range (occurred_at);

create table admin_audit_logs_default partition of admin_audit_logs default;
create index audit_resource_idx on admin_audit_logs (resource_type, resource_id, occurred_at desc);
create index audit_actor_idx on admin_audit_logs (actor_id, occurred_at desc);

revoke update, delete on admin_audit_logs from public, authenticated, anon;

create or replace function write_audit(
  p_action text, p_resource_type text default null, p_resource_id text default null,
  p_before jsonb default null, p_after jsonb default null, p_metadata jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  insert into admin_audit_logs (actor_id, actor_name, actor_role, action, resource_type, resource_id, request_id, before, after, metadata)
  values (
    v_user,
    coalesce((select full_name from admin_users where id = v_user), 'system'),
    coalesce(current_role_key(), 'system'),
    p_action, p_resource_type, p_resource_id,
    coalesce(current_setting('request_id', true), gen_random_uuid()::text),
    p_before, p_after, p_metadata
  );
end $$;

-- ── Command ledger ──────────────────────────────────────────────────────────
create table command_types (
  key text primary key,
  permission_required text not null,
  requires_second_approval boolean not null default false,
  payload_schema jsonb,
  description text
);

insert into command_types (key, permission_required, requires_second_approval, description) values
  ('business.suspend', 'businesses.suspend', true, 'Suspend a business account'),
  ('business.restore', 'businesses.restore', false, 'Restore a suspended business account'),
  ('subscription.adjust', 'subscriptions.adjust', true, 'Authorized subscription adjustment'),
  ('pricing.upsert', 'pricing.update', true, 'New country/plan price version'),
  ('pricing.deactivate', 'pricing.update', true, 'Deactivate a price row'),
  ('admin.invite', 'admin_team.invite', false, 'Invite an administrator'),
  ('admin.role_change', 'admin_team.invite', true, 'Change an administrator role'),
  ('admin.deactivate', 'admin_team.invite', true, 'Deactivate an administrator'),
  ('dataset.version_register', 'ai_data.manage', false, 'Register a dataset version'),
  ('dataset.delete', 'ai_data.manage', true, 'Delete a dataset');

create table administrative_commands (
  id uuid primary key default gen_random_uuid(),
  command_type text not null references command_types(key),
  target_type text not null,
  target_id text not null,
  payload jsonb not null default '{}',
  status command_status not null default 'pending_approval',
  requested_by uuid references admin_users(id),
  requested_by_name text,
  approver_name text,
  approval_required boolean not null default false,
  idempotency_key text not null unique,
  result jsonb,
  error text,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commands_open_idx on administrative_commands (status)
  where status in ('pending_approval','approved','dispatching','executing');
create index commands_target_idx on administrative_commands (target_type, target_id);

create trigger commands_touch before update on administrative_commands
  for each row execute function touch_updated_at();

create or replace function audit_command_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform write_audit(
    'command.' || case when tg_op = 'INSERT' then 'requested' else 'changed' end,
    'command', new.id::text, to_jsonb(old), to_jsonb(new)
  );
  return new;
end $$;

create trigger commands_audit after insert or update on administrative_commands
  for each row execute function audit_command_change();

alter table administrative_commands enable row level security;
create policy commands_select on administrative_commands for select
  using (has_permission('commands.read') or requested_by = auth.uid());
create policy commands_insert on administrative_commands for insert
  with check (requested_by = auth.uid());
-- No UPDATE/DELETE policies: status transitions only via the RPCs below.


-- ── Approvals: two-person rule at the DB level (FR-997) ─────────────────────
create table command_approvals (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references administrative_commands(id) on delete cascade,
  approver_id uuid not null references admin_users(id),
  decision text not null check (decision in ('approved','rejected')),
  reason text not null,
  decided_at timestamptz not null default now(),
  unique (command_id, approver_id)
);
alter table command_approvals enable row level security;
create policy approvals_select on command_approvals for select using (has_permission('commands.read'));


create or replace function approve_command(p_command_id uuid, p_approver uuid, p_approver_name text)
returns administrative_commands
language plpgsql security definer set search_path = public as $$
declare v_row administrative_commands;
begin
  if not has_permission('commands.approve') then
    raise exception 'FORBIDDEN: requires commands.approve';
  end if;
  select * into v_row from administrative_commands where id = p_command_id for update;
  if not found then raise exception 'Command not found'; end if;
  if v_row.status <> 'pending_approval' then
    raise exception 'Command is %, not pending_approval', v_row.status;
  end if;
  if v_row.requested_by = p_approver then
    raise exception 'Two-person rule: the requester cannot approve their own command';
  end if;
  insert into command_approvals (command_id, approver_id, decision, reason)
  values (p_command_id, p_approver, 'approved', 'approved');
  update administrative_commands
    set status = 'approved', approver_name = p_approver_name
    where id = p_command_id
    returning * into v_row;
  return v_row;
end $$;

create or replace function reject_command(p_command_id uuid, p_approver uuid, p_approver_name text, p_reason text)
returns administrative_commands
language plpgsql security definer set search_path = public as $$
declare v_row administrative_commands;
begin
  if not has_permission('commands.approve') then
    raise exception 'FORBIDDEN: requires commands.approve';
  end if;
  if p_reason is null or length(trim(p_reason)) < 4 then
    raise exception 'A rejection reason is required';
  end if;
  select * into v_row from administrative_commands where id = p_command_id for update;
  if not found then raise exception 'Command not found'; end if;
  if v_row.status <> 'pending_approval' then
    raise exception 'Command is %, not pending_approval', v_row.status;
  end if;
  if v_row.requested_by = p_approver then
    raise exception 'Two-person rule: the requester cannot decide on their own command';
  end if;
  insert into command_approvals (command_id, approver_id, decision, reason)
  values (p_command_id, p_approver, 'rejected', trim(p_reason));
  update administrative_commands
    set status = 'rejected', approver_name = p_approver_name, error = trim(p_reason), completed_at = now()
    where id = p_command_id
    returning * into v_row;
  return v_row;
end $$;

-- ── Pricing (versioned; edits only via pricing commands) ────────────────────
create table pricing_configurations (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  plan_key text not null,
  currency char(3) not null,
  amount_minor bigint not null check (amount_minor >= 0),
  active boolean not null default true,
  effective_from date not null,
  superseded_by uuid,
  created_by uuid,
  approved_command_id uuid references administrative_commands(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, plan_key, effective_from)
);

create index pricing_active_idx on pricing_configurations (country_code, plan_key) where active;

alter table pricing_configurations enable row level security;
create policy pricing_read on pricing_configurations for select using (has_permission('pricing.read'));
-- No insert/update policies: pricing rows are written only by the ingest/dispatch
-- service role when a pricing command completes (docs/07 §7).
