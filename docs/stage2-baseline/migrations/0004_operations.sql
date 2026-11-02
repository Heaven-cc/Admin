-- 0004_operations.sql — monitoring, sync pipeline, incidents, AI data, registries (docs/08 §E–§H)

-- ── Monitoring ──────────────────────────────────────────────────────────────
create table vision_service_metrics (
  id bigserial,
  captured_at timestamptz not null default now(),
  business_id text,
  camera_total int not null default 0,
  camera_connected int not null default 0,
  camera_offline int not null default 0,
  processing_latency_p95_ms int,
  inference_throughput numeric,
  event_throughput numeric,
  storage_bytes bigint,
  gpu_util_pct numeric,
  cpu_util_pct numeric,
  model_version text,
  errors jsonb,
  source_event_id uuid,
  primary key (id, captured_at)
) partition by range (captured_at);

create table vision_service_metrics_default partition of vision_service_metrics default;

alter table vision_service_metrics enable row level security;
create policy vision_metrics_read on vision_service_metrics for select using (has_permission('vision.read'));

create table ai_service_metrics (
  id bigserial primary key,
  service text not null check (service in ('angel','intelligence')),
  captured_at timestamptz not null default now(),
  requests int,
  errors int,
  latency_p50_ms int,
  latency_p95_ms int,
  latency_p99_ms int,
  tokens_in bigint,
  tokens_out bigint,
  estimated_cost_minor bigint,
  cost_currency char(3) default 'USD',
  provider text,
  model text,
  rate_limit_events int,
  source_event_id uuid
);

create index ai_metrics_service_idx on ai_service_metrics (service, captured_at desc);

alter table ai_service_metrics enable row level security;
create policy angel_metrics_read on ai_service_metrics for select
  using (service = 'angel' and has_permission('angel.read'));
create policy intelligence_metrics_read on ai_service_metrics for select
  using (service = 'intelligence' and has_permission('intelligence.read'));

create table system_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  service text not null,
  environment text not null default 'production',
  severity text not null check (severity in ('S1','S2','S3','S4')),
  error_type text not null,
  message text not null,
  sample jsonb,
  occurrence_count int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  affected_versions text[],
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  assigned_to uuid,
  sentry_url text,
  incident_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index errors_severity_idx on system_errors (severity, status);
create index errors_service_idx on system_errors (service, last_seen_at desc);

alter table system_errors enable row level security;
create policy errors_read on system_errors for select using (has_permission('health.read'));
create policy errors_manage on system_errors for update using (has_permission('health.manage_errors'));

-- ── Sync pipeline (docs/08 §G) ──────────────────────────────────────────────
create table sync_ingest_events (
  id uuid primary key, -- = event_id, the idempotency anchor
  event_type text not null,
  schema_version int not null,
  source_service text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','failed','dead_letter','duplicate_late')),
  applied_at timestamptz,
  error jsonb,
  trace_id text
);

revoke insert, update, delete on sync_ingest_events from authenticated, anon;
alter table sync_ingest_events enable row level security;
create policy sync_events_read on sync_ingest_events for select using (has_permission('health.read'));

create table sync_dead_letters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  event_type text not null,
  payload jsonb,
  first_failure_at timestamptz not null default now(),
  failure_count int not null default 1,
  last_error text,
  status text not null default 'retrying' check (status in ('retrying','quarantined','resolved','discarded')),
  resolved_by uuid,
  resolved_at timestamptz
);

alter table sync_dead_letters enable row level security;
create policy dlq_read on sync_dead_letters for select using (has_permission('health.read'));

create table sync_jobs (
  job_key text primary key,
  schedule text,
  last_run_at timestamptz,
  last_success_at timestamptz,
  next_run_at timestamptz,
  status text not null default 'idle' check (status in ('idle','running','failed')),
  last_duration_ms int,
  checkpoint jsonb,
  updated_at timestamptz not null default now()
);

alter table sync_jobs enable row level security;
create policy sync_jobs_read on sync_jobs for select using (has_permission('health.read'));

create table sync_failures (
  id bigserial primary key,
  job_key text not null,
  event_id uuid,
  error_type text,
  message text,
  context jsonb,
  occurred_at timestamptz not null default now()
);

alter table sync_failures enable row level security;
create policy sync_failures_read on sync_failures for select using (has_permission('health.read'));

create table reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  entity text not null,
  window_start date,
  window_end date,
  admin_count bigint,
  prod_count bigint,
  delta bigint,
  checksum_match boolean,
  status text not null default 'ok' check (status in ('ok','drift','healed','failed')),
  details jsonb
);

alter table reconciliation_runs enable row level security;
create policy reconcile_read on reconciliation_runs for select using (has_permission('health.read'));

-- ── Incidents & ops (docs/08 §H) ────────────────────────────────────────────
create table incidents (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  title text not null,
  severity text not null check (severity in ('S1','S2','S3','S4')),
  status text not null default 'open' check (status in ('open','investigating','mitigated','resolved','closed')),
  affected_services text[] not null default '{}',
  opened_by uuid,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  summary text,
  postmortem_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incidents_status_idx on incidents (status, severity);

alter table incidents enable row level security;
create policy incidents_read on incidents for select using (has_permission('incidents.read'));
create policy incidents_manage on incidents for insert
  with check (has_permission('incidents.manage'));
create policy incidents_update on incidents for update
  using (has_permission('incidents.manage'));

create table incident_timeline (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  entry text not null,
  author text,
  occurred_at timestamptz not null default now()
);

create index incident_timeline_idx on incident_timeline (incident_id, occurred_at);

alter table incident_timeline enable row level security;
create policy timeline_read on incident_timeline for select using (has_permission('incidents.read'));
create policy timeline_insert on incident_timeline for insert
  with check (has_permission('incidents.manage'));

create table support_cases (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  channel text not null default 'email',
  subject text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  opened_by_admin uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_business_idx on support_cases (business_id, opened_at desc);

alter table support_cases enable row level security;
create policy support_read on support_cases for select using (has_permission('businesses.read'));

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_admin_id uuid,
  recipient_role text,
  category text not null,
  severity text not null default 'info',
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_admin_id is not null or recipient_role is not null)
);

create index notifications_recipient_idx on notifications (recipient_admin_id, created_at desc);
create index notifications_role_idx on notifications (recipient_role, created_at desc);

alter table notifications enable row level security;
create policy notifications_read on notifications for select
  using (recipient_admin_id = auth.uid() or recipient_role = current_role_key());
create policy notifications_update on notifications for update
  using (recipient_admin_id = auth.uid() or recipient_role = current_role_key());

-- ── Registries (docs/08 §E, §F) ─────────────────────────────────────────────
create table metric_definitions (
  key text primary key,
  display_name text not null,
  definition text not null,
  source_type text not null,
  source_ref text,
  freshness_sla_minutes int not null default 1440,
  required_permission text,
  unit text not null default 'count',
  currency char(3),
  direction text not null default 'higher_better',
  status text not null default 'not_instrumented',
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table metric_definitions enable row level security;
create policy metrics_read on metric_definitions for select using (has_permission('dashboard.view'));

create table capabilities (
  key text primary key,
  product text not null,
  name text not null,
  status text not null default 'planned' check (status in ('planned','implemented','tested','deployed')),
  last_verified_at timestamptz,
  verified_by text,
  notes text
);

alter table capabilities enable row level security;
create policy capabilities_read on capabilities for select using (has_permission('dashboard.view'));

create table app_versions (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios','android')),
  version_name text not null,
  version_code int not null,
  released_at timestamptz,
  is_min_supported boolean not null default false,
  notes text,
  unique (platform, version_code)
);

alter table app_versions enable row level security;
create policy app_versions_read on app_versions for select using (has_permission('analytics.read'));

-- ── AI data governance (docs/08 §F) ─────────────────────────────────────────
create table dataset_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  domain text not null check (domain in ('vision','intelligence','sales','angel')),
  sensitivity text not null default 'internal' check (sensitivity in ('internal','confidential','restricted')),
  consent_basis text not null,
  includes_customer_data boolean not null default false,
  status text not null default 'draft' check (status in ('draft','under_review','approved','deprecated','deleted')),
  retention_policy text,
  owner_admin_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table dataset_registry enable row level security;
create policy datasets_read on dataset_registry for select using (has_permission('ai_data.read'));
create policy datasets_manage on dataset_registry for insert
  with check (has_permission('ai_data.manage'));

create table dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references dataset_registry(id) on delete cascade,
  version int not null,
  storage_bucket text,
  storage_path text,
  size_bytes bigint,
  row_count bigint,
  checksum_sha256 text,
  provenance jsonb,
  deidentification_method text,
  quality_status text not null default 'unrated',
  annotation_status text not null default 'unannotated',
  training_eligible boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (dataset_id, version)
);

alter table dataset_versions enable row level security;
create policy dataset_versions_read on dataset_versions for select using (has_permission('ai_data.read'));

create table model_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  provider text,
  model_ref text not null,
  status text not null default 'experimental',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table model_registry enable row level security;
create policy models_read on model_registry for select using (has_permission('ai_data.read'));

create table model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references model_registry(id) on delete cascade,
  dataset_version_id uuid references dataset_versions(id),
  metrics jsonb,
  evaluated_at timestamptz not null default now(),
  evaluator text,
  notes text
);

alter table model_evaluations enable row level security;
create policy evaluations_read on model_evaluations for select using (has_permission('ai_data.read'));

-- Private bucket for dataset assets (ADR-007) — metadata in DB, bytes in storage
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', false)
on conflict (id) do nothing;