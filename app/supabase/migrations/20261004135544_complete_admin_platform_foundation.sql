
create extension if not exists pgcrypto;
create schema if not exists admin_private;
revoke all on schema admin_private from public,anon,authenticated;

create table if not exists public.admin_roles(
 role admin_role primary key, description text not null
);
insert into public.admin_roles(role,description) values
('super_admin','Full platform administration'),('operations_admin','Operations and health'),
('support_admin','Customer and issue support'),('analytics_admin','Analytics and reporting'),
('engineering_admin','System, Vision and model operations') on conflict(role) do update set description=excluded.description;
create table if not exists public.admin_user_roles(
 user_id uuid not null references public.admin_users(user_id) on delete cascade,
 role admin_role not null references public.admin_roles(role),
 granted_by uuid references public.admin_users(user_id),
 granted_at timestamptz not null default now(), primary key(user_id,role)
);
create table if not exists public.error_reports(
 id uuid primary key default gen_random_uuid(), issue_id uuid not null references public.issue_reports(id) on delete cascade,
 event_id text not null unique, occurred_at timestamptz not null, request_id uuid, context jsonb not null default '{}'
);
create table if not exists public.data_governance(
 business_ref uuid primary key, analytics_consent consent_state not null default 'unknown',
 training_consent consent_state not null default 'unknown', retention_days integer not null default 90 check(retention_days between 1 and 3650),
 anonymization_level text not null default 'pseudonymized', restricted_categories text[] not null default '{}',
 deletion_requested_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.dataset_samples(
 dataset_id uuid not null references public.dataset_versions(id) on delete cascade,
 sample_id uuid not null references public.training_samples(id) on delete restrict,
 added_at timestamptz not null default now(), primary key(dataset_id,sample_id)
);
create table if not exists public.sync_receipts(
 id uuid primary key default gen_random_uuid(), pipeline text not null, batch_id uuid not null,
 idempotency_key text not null unique, record_count integer not null default 0,
 schema_version integer not null default 1, checksum text, received_at timestamptz not null default now(),
 status text not null default 'accepted' check(status in ('accepted','processed','failed')), error_message text
);
create table if not exists public.revenue_metrics(
 metric_date date not null,currency text not null,mrr_minor bigint not null default 0,arr_minor bigint not null default 0,
 new_mrr_minor bigint not null default 0,expansion_mrr_minor bigint not null default 0,
 contraction_mrr_minor bigint not null default 0,churned_mrr_minor bigint not null default 0,
 calculated_at timestamptz not null default now(),primary key(metric_date,currency)
);
create table if not exists public.vision_daily_metrics(
 metric_date date not null,business_ref uuid,total_cameras integer not null default 0,
 connected_cameras integer not null default 0,online_cameras integer not null default 0,offline_cameras integer not null default 0,
 events_processed bigint not null default 0,alerts_generated bigint not null default 0,
 recording_failures bigint not null default 0,stream_failures bigint not null default 0,detection_failures bigint not null default 0,
 avg_processing_latency_ms numeric,p95_processing_latency_ms numeric,model_versions jsonb not null default '{}',
 primary key(metric_date,business_ref)
);

alter table public.admin_users add column if not exists require_mfa boolean not null default true;
alter table public.admin_audit_logs add column if not exists request_id uuid;
alter table public.admin_audit_logs add column if not exists ip_hash text;
alter table public.platform_businesses add column if not exists pseudonymous_key text;
alter table public.platform_businesses add column if not exists country_code text;
alter table public.platform_businesses add column if not exists member_count integer not null default 0;
alter table public.platform_businesses add column if not exists attributes jsonb not null default '{}';
alter table public.platform_users add column if not exists pseudonymous_key text;
alter table public.platform_users add column if not exists attributes jsonb not null default '{}';
alter table public.app_installations add column if not exists consent_state consent_state not null default 'unknown';
alter table public.app_installations add column if not exists country_code text;
alter table public.app_installations add column if not exists attributes jsonb not null default '{}';
alter table public.app_sessions add column if not exists attributes jsonb not null default '{}';
alter table public.usage_events add column if not exists session_ref text;
alter table public.usage_events add column if not exists app_version text;
alter table public.usage_events add column if not exists platform text;
alter table public.platform_daily_metrics add column if not exists upgrades bigint not null default 0;
alter table public.platform_daily_metrics add column if not exists downgrades bigint not null default 0;
alter table public.platform_daily_metrics add column if not exists cancellations bigint not null default 0;
alter table public.platform_daily_metrics add column if not exists churn_rate numeric not null default 0;
alter table public.platform_daily_metrics add column if not exists retention_rate numeric not null default 0;
alter table public.platform_daily_metrics add column if not exists vision_businesses bigint not null default 0;
alter table public.platform_daily_metrics add column if not exists app_versions jsonb not null default '{}';
alter table public.intelligence_metrics add column if not exists unresolved bigint not null default 0;
alter table public.intelligence_metrics add column if not exists outcomes jsonb not null default '{}';
alter table public.issue_reports add column if not exists latest_context jsonb not null default '{}';
alter table public.training_samples add column if not exists provenance jsonb not null default '{}';
alter table public.training_samples add column if not exists verified_at timestamptz;
alter table public.training_samples add column if not exists verified_by uuid references public.admin_users(user_id);
alter table public.training_assets add column if not exists content_type text;
alter table public.training_assets add column if not exists restricted boolean not null default true;
alter table public.dataset_versions add column if not exists selection_query jsonb not null default '{}';
alter table public.dataset_versions add column if not exists frozen_at timestamptz;
alter table public.model_registry add column if not exists metadata jsonb not null default '{}';
alter table public.model_evaluations add column if not exists passed boolean;
alter table public.model_evaluations add column if not exists evaluator text;
alter table public.model_deployments add column if not exists metadata jsonb not null default '{}';
alter table public.sync_state add column if not exists status text not null default 'idle';
alter table public.sync_state add column if not exists next_retry_at timestamptz;
alter table public.sync_state add column if not exists lease_expires_at timestamptz;

create unique index if not exists platform_businesses_pseudonymous_idx on public.platform_businesses(pseudonymous_key) where pseudonymous_key is not null;
create unique index if not exists platform_users_pseudonymous_idx on public.platform_users(pseudonymous_key) where pseudonymous_key is not null;
create index if not exists usage_events_name_time_idx on public.usage_events(event_name,occurred_at desc);
create index if not exists issues_status_severity_idx on public.issue_reports(status,severity,last_occurrence desc);
create index if not exists training_eligibility_idx on public.training_samples(training_eligible,verification_status,occurred_at desc);
create index if not exists audit_actor_time_idx on public.admin_audit_logs(actor_user_id,occurred_at desc);
create index if not exists sync_receipts_pipeline_time_idx on public.sync_receipts(pipeline,received_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('admin-training-assets','admin-training-assets',false,1073741824,array['image/jpeg','image/png','video/mp4','application/json','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$
declare t text;
begin
 foreach t in array array['admin_roles','admin_user_roles','error_reports','data_governance','dataset_samples','sync_receipts','revenue_metrics','vision_daily_metrics']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon,authenticated',t);
 end loop;
end $$;

create or replace function admin_private.redact_text(input text)
returns text language sql immutable set search_path='' as $$
 select regexp_replace(regexp_replace(regexp_replace(coalesce(input,''),
 '(?i)(bearer|apikey|password|secret|token|authorization)[[:space:]]*[:=][[:space:]]*[^[:space:],;]+','\1=[REDACTED]','g'),
 '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[EMAIL_REDACTED]','g'),
 '(sb_(secret|publishable)_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)','[CREDENTIAL_REDACTED]','g');
$$;
revoke all on function admin_private.redact_text(text) from public,anon,authenticated;

create or replace function admin_private.ingest_issue(
 p_event_id text,p_fingerprint text,p_source text,p_service text,p_severity issue_severity,p_error_type text,
 p_message text,p_stack text,p_occurred_at timestamptz,p_app_version text default null,
 p_platform text default null,p_business_ref uuid default null,p_context jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_issue uuid;
begin
 insert into public.issue_reports(fingerprint,source,service,severity,error_type,error_message,sanitized_stack_trace,
 app_version,platform,business_ref,first_occurrence,last_occurrence,latest_context)
 values(p_fingerprint,p_source,p_service,p_severity,p_error_type,admin_private.redact_text(p_message),
 admin_private.redact_text(p_stack),p_app_version,p_platform,p_business_ref,p_occurred_at,p_occurred_at,p_context)
 on conflict(fingerprint) do update set last_occurrence=greatest(public.issue_reports.last_occurrence,excluded.last_occurrence),
 occurrence_count=public.issue_reports.occurrence_count+1,severity=excluded.severity,error_message=excluded.error_message,
 sanitized_stack_trace=excluded.sanitized_stack_trace,latest_context=excluded.latest_context returning id into v_issue;
 insert into public.error_reports(issue_id,event_id,occurred_at,context)
 values(v_issue,p_event_id,p_occurred_at,p_context) on conflict(event_id) do nothing;
 return v_issue;
end $$;
revoke all on function admin_private.ingest_issue(text,text,text,text,issue_severity,text,text,text,timestamptz,text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function admin_private.training_sample_is_eligible(p_business_ref uuid,p_restricted boolean,p_verified boolean)
returns boolean language sql stable security invoker set search_path='' as $$
 select p_verified and not p_restricted and exists(select 1 from public.data_governance g
 where g.business_ref=p_business_ref and g.training_consent='granted' and g.deletion_requested_at is null);
$$;
revoke all on function admin_private.training_sample_is_eligible(uuid,boolean,boolean) from public,anon,authenticated;

comment on table public.platform_businesses is 'Pseudonymized operational projection; never a production database replica.';
comment on table public.training_samples is 'Governed labelled evidence; eligibility requires consent and verification.';
comment on table public.sync_state is 'Resumable retry state for fail-open production-to-admin pipelines.';

