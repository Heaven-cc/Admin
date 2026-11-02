
create extension if not exists pgcrypto;
create schema if not exists admin_private;

create type public.admin_role as enum ('super_admin','operations_admin','support_admin','analytics_admin','engineering_admin');
create type public.issue_severity as enum ('critical','high','medium','low');
create type public.issue_status as enum ('open','investigating','resolved');
create type public.consent_state as enum ('unknown','granted','denied','withdrawn');
create type public.verification_status as enum ('unverified','verified','rejected');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null,
  active boolean not null default true,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.platform_businesses (
  business_ref uuid primary key, name text, plan text, account_status text,
  created_at timestamptz, last_active_at timestamptz, vision_enabled boolean not null default false,
  source_updated_at timestamptz, synced_at timestamptz not null default now()
);
create table public.platform_users (
  user_ref uuid primary key, business_ref uuid, user_type text, account_status text,
  created_at timestamptz, last_active_at timestamptz, app_version text, platform text,
  source_updated_at timestamptz, synced_at timestamptz not null default now()
);
create table public.app_installations (
  installation_id uuid primary key default gen_random_uuid(), installation_ref text not null unique,
  platform text not null, app_version text, first_open_at timestamptz not null,
  last_seen_at timestamptz, business_ref uuid, user_ref uuid, created_at timestamptz not null default now()
);
create table public.app_sessions (
  session_id uuid primary key default gen_random_uuid(), session_ref text not null unique,
  installation_ref text, user_ref uuid, business_ref uuid, app_version text, platform text,
  started_at timestamptz not null, ended_at timestamptz, duration_seconds integer check(duration_seconds is null or duration_seconds >= 0)
);
create table public.usage_events (
  id uuid primary key default gen_random_uuid(), event_id text not null unique, event_name text not null,
  event_version integer not null default 1, occurred_at timestamptz not null, business_ref uuid, user_ref uuid,
  installation_ref text, properties jsonb not null default '{}'::jsonb, received_at timestamptz not null default now()
);
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(), event_id text not null unique, business_ref uuid,
  event_type text not null, plan text, amount_minor bigint, currency text, occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);
create table public.platform_daily_metrics (
  metric_date date primary key, installs bigint not null default 0, first_opens bigint not null default 0,
  registrations bigint not null default 0, businesses_created bigint not null default 0, dau bigint not null default 0,
  mau bigint not null default 0, active_businesses bigint not null default 0, trials bigint not null default 0,
  paying_businesses bigint not null default 0, mrr_minor bigint not null default 0, churned_businesses bigint not null default 0,
  total_cameras bigint not null default 0, online_cameras bigint not null default 0, offline_cameras bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table public.business_daily_metrics (
  business_ref uuid not null, metric_date date not null, active_users bigint not null default 0,
  sessions bigint not null default 0, events bigint not null default 0, cameras bigint not null default 0,
  vision_events bigint not null default 0, alerts bigint not null default 0, primary key (business_ref, metric_date)
);
create table public.vision_metrics (
  id uuid primary key default gen_random_uuid(), business_ref uuid, captured_at timestamptz not null,
  service_status text, total_cameras integer not null default 0, online_cameras integer not null default 0,
  offline_cameras integer not null default 0, events_processed bigint not null default 0, alerts_generated bigint not null default 0,
  recording_failures bigint not null default 0, stream_failures bigint not null default 0, detection_failures bigint not null default 0,
  processing_latency_ms numeric, model_version text
);
create table public.intelligence_metrics (
  id uuid primary key default gen_random_uuid(), business_ref uuid, captured_at timestamptz not null,
  decisions bigint not null default 0, avg_confidence numeric, errors bigint not null default 0,
  reconciled bigint not null default 0, model_version text
);
create table public.system_health (
  service text primary key, status text not null, checked_at timestamptz not null,
  latency_ms numeric, version text, details jsonb not null default '{}'::jsonb
);
create table public.issue_reports (
  id uuid primary key default gen_random_uuid(), fingerprint text not null unique, source text not null,
  service text, severity public.issue_severity not null, status public.issue_status not null default 'open',
  error_type text, error_message text not null, sanitized_stack_trace text, app_version text, platform text,
  business_ref uuid, first_occurrence timestamptz not null, last_occurrence timestamptz not null,
  occurrence_count bigint not null default 1, resolved_at timestamptz, metadata jsonb not null default '{}'::jsonb
);
create table public.training_samples (
  id uuid primary key default gen_random_uuid(), source_event_ref text, business_ref uuid,
  vision_prediction jsonb, vision_confidence numeric, intelligence_prediction jsonb, intelligence_confidence numeric,
  pos_evidence jsonb, inventory_evidence jsonb, camera_evidence jsonb, final_outcome jsonb, correction jsonb,
  verification_status public.verification_status not null default 'unverified', model_version text,
  occurred_at timestamptz, training_eligible boolean not null default false,
  consent_state public.consent_state not null default 'unknown', restricted boolean not null default true,
  retention_until timestamptz, anonymization_state text, created_at timestamptz not null default now()
);
create table public.training_assets (
  id uuid primary key default gen_random_uuid(), sample_id uuid references public.training_samples(id) on delete cascade,
  provider text not null, bucket text, object_key text not null, asset_type text not null,
  content_hash text, size_bytes bigint, retention_until timestamptz, created_at timestamptz not null default now()
);
create table public.dataset_versions (
  id uuid primary key default gen_random_uuid(), name text not null, version text not null,
  status text not null default 'draft', sample_count bigint not null default 0, provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(name,version)
);
create table public.training_runs (
  id uuid primary key default gen_random_uuid(), dataset_version_id uuid references public.dataset_versions(id),
  status text not null, started_at timestamptz, completed_at timestamptz, config jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb
);
create table public.model_registry (
  id uuid primary key default gen_random_uuid(), model_name text not null, model_version text not null,
  status text not null default 'registered', artifact_ref text, created_at timestamptz not null default now(),
  unique(model_name,model_version)
);
create table public.model_evaluations (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.model_registry(id),
  dataset_version_id uuid references public.dataset_versions(id), metrics jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now()
);
create table public.model_deployments (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.model_registry(id),
  environment text not null, status text not null, deployed_at timestamptz, rolled_back_at timestamptz
);
create table public.sync_state (
  pipeline text primary key, cursor_value text, last_success_at timestamptz, last_attempt_at timestamptz,
  last_error text, consecutive_failures integer not null default 0, pipeline_version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id),
  action text not null, resource_type text, resource_ref text, metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index usage_events_name_time_idx on public.usage_events(event_name, occurred_at desc);
create index usage_events_business_time_idx on public.usage_events(business_ref, occurred_at desc);
create index app_sessions_user_time_idx on public.app_sessions(user_ref, started_at desc);
create index issue_reports_status_severity_idx on public.issue_reports(status,severity,last_occurrence desc);
create index vision_metrics_business_time_idx on public.vision_metrics(business_ref,captured_at desc);
create index training_samples_eligibility_idx on public.training_samples(training_eligible,verification_status,created_at desc);
create index admin_audit_logs_time_idx on public.admin_audit_logs(occurred_at desc);

create or replace function admin_private.is_admin(required_roles public.admin_role[] default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid()) and au.active
      and (required_roles is null or au.role = any(required_roles))
  );
$$;
revoke all on function admin_private.is_admin(public.admin_role[]) from public, anon;
grant execute on function admin_private.is_admin(public.admin_role[]) to authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'admin_users','platform_businesses','platform_users','app_installations','app_sessions','usage_events',
    'subscription_events','platform_daily_metrics','business_daily_metrics','vision_metrics','intelligence_metrics',
    'system_health','issue_reports','training_samples','training_assets','dataset_versions','training_runs',
    'model_registry','model_evaluations','model_deployments','sync_state','admin_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (admin_private.is_admin(null))', 'admin_read_'||t, t);
  end loop;
end $$;

grant update on public.issue_reports to authenticated;
create policy admin_update_issues on public.issue_reports for update to authenticated
using (admin_private.is_admin(array['super_admin','operations_admin','support_admin','engineering_admin']::public.admin_role[]))
with check (admin_private.is_admin(array['super_admin','operations_admin','support_admin','engineering_admin']::public.admin_role[]));

grant insert on public.admin_audit_logs to authenticated;
create policy admin_insert_audit on public.admin_audit_logs for insert to authenticated
with check ((select auth.uid()) = actor_user_id and admin_private.is_admin(null));

