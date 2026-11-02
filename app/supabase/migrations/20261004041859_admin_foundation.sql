
-- Dedicated Admin project only. Never apply to TREXVEN production.
create table public.admin_roles (
 role text primary key check(role in ('super_admin','operations_admin','support_admin','analytics_admin','engineering_admin')),
 permissions text[] not null
);
insert into public.admin_roles values
('super_admin',array['overview','businesses','users','subscriptions','revenue','analytics','vision','intelligence','issues','system-health','training','datasets','models','issue:update','governance:revoke','dataset:create','dataset:review']),
('operations_admin',array['overview','businesses','subscriptions','vision','intelligence','issues','system-health','issue:update']),
('support_admin',array['overview','businesses','users','issues','issue:update']),
('analytics_admin',array['overview','subscriptions','revenue','analytics','vision','intelligence']),
('engineering_admin',array['overview','vision','intelligence','issues','system-health','training','datasets','models','issue:update','dataset:create']);
create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null references public.admin_roles(role),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.admin_audit_logs (
 id bigint generated always as identity primary key, actor_id uuid, action text not null,
 target_ref text, result text not null, created_at timestamptz not null default now()
);
create index admin_audit_time on public.admin_audit_logs(created_at desc);
create table public.ingest_sources (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 business_refs text[] not null default '{}', enabled boolean not null default false,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table public.data_governance (
 source_id uuid not null references public.ingest_sources(id), business_ref text not null,
 analytics_allowed boolean not null default false, training_allowed boolean not null default false,
 consent_version text, consent_record_ref text,
 retention_days integer not null default 30 check(retention_days between 1 and 365),
 revoked_at timestamptz, anonymization text not null default 'pseudonymized' check(anonymization='pseudonymized'),
 primary key(source_id,business_ref),
 check(not training_allowed or (consent_version is not null and consent_record_ref is not null))
);
create table public.sync_state (
 source_id uuid primary key references public.ingest_sources(id), last_success_at timestamptz,
 accepted_count bigint not null default 0, duplicate_count bigint not null default 0,
 last_schema_version text, checkpoint jsonb not null default '{}'
);
create table public.sync_receipts (
 source_id uuid not null references public.ingest_sources(id), key text not null,
 payload_hash text not null, received_at timestamptz not null default now(),
 primary key(source_id,key)
);
create index sync_receipts_time on public.sync_receipts(received_at);
create table public.ingest_rate_windows (
 source_id uuid not null references public.ingest_sources(id), window_start timestamptz not null,
 requests integer not null default 1, primary key(source_id,window_start)
);
create table public.platform_businesses (
 source_id uuid not null references public.ingest_sources(id), business_ref text not null,
 registered_at timestamptz not null, source_updated_at timestamptz not null,
 country text, currency text check(currency ~ '^[A-Z]{3}$'),
 account_status text not null default 'active' check(account_status in ('active','suspended','deleted','unknown')),
 plan text, subscription_status text,
 cameras integer not null default 0 check(cameras>=0),
 online_cameras integer not null default 0 check(online_cameras>=0 and online_cameras<=cameras),
 connected_cameras integer not null default 0 check(connected_cameras>=0 and connected_cameras<=cameras),
 users integer not null default 0 check(users>=0),
 products integer not null default 0 check(products>=0),
 inventory_items integer not null default 0 check(inventory_items>=0),
 last_activity_at timestamptz, primary key(source_id,business_ref)
);
create table public.platform_users (
 source_id uuid not null references public.ingest_sources(id), user_ref text not null,
 business_ref text not null, registered_at timestamptz not null, primary key(source_id,business_ref,user_ref)
);
create table public.app_installations (
 source_id uuid not null references public.ingest_sources(id), installation_ref text not null,
 business_ref text not null, installed_at timestamptz not null,
 platform text not null, app_version text not null,
 primary key(source_id,business_ref,installation_ref)
);
create table public.app_sessions (
 source_id uuid not null references public.ingest_sources(id), session_ref text not null,
 business_ref text not null, installation_ref text, user_ref text,
 started_at timestamptz not null, ended_at timestamptz, platform text, app_version text,
 primary key(source_id,business_ref,session_ref)
);
create index app_sessions_activity on public.app_sessions(started_at,user_ref);
create table public.usage_events (
 source_id uuid not null references public.ingest_sources(id), event_ref text not null,
 business_ref text not null, user_ref text, installation_ref text,
 kind text not null check(kind in ('install','first_open','registration','business_created','trial_started','subscription_started','renewal','cancellation','upgrade','downgrade','session_started','feature_used')),
 occurred_at timestamptz not null, app_version text, platform text,
 primary key(source_id,business_ref,event_ref)
);
create index usage_events_time on public.usage_events(occurred_at,kind);
create table public.subscription_metrics (
 source_id uuid not null references public.ingest_sources(id), business_ref text not null,
 day date not null, plan text not null, status text not null check(status in ('trial','active','cancelled','expired','none')),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 recurring_monthly_minor bigint not null default 0 check(recurring_monthly_minor>=0),
 previous_status text, change_type text check(change_type in ('new','renewal','upgrade','downgrade','cancellation','none')),
 primary key(source_id,business_ref,day)
);
create table public.revenue_metrics (
 day date not null, currency text not null, mrr_minor bigint not null default 0,
 paying_businesses integer not null default 0, trials integer not null default 0,
 cancellations integer not null default 0, primary key(day,currency)
);
create table public.business_daily_metrics (
 source_id uuid not null references public.ingest_sources(id), business_ref text not null,
 day date not null, completed_sales integer not null default 0 check(completed_sales>=0),
 sales_minor bigint not null default 0, currency text not null check(currency ~ '^[A-Z]{3}$'),
 active_users integer not null default 0, sessions integer not null default 0,
 primary key(source_id,business_ref,day)
);
create table public.platform_daily_metrics (
 day date primary key, installs integer not null default 0, first_opens integer not null default 0,
 registrations integer not null default 0, businesses_created integer not null default 0,
 active_users integer not null default 0, active_businesses integer not null default 0,
 sessions integer not null default 0, upgrades integer not null default 0,
 downgrades integer not null default 0, cancellations integer not null default 0
);
create table public.vision_metrics (
 source_id uuid not null references public.ingest_sources(id), business_ref text not null,
 event_ref text not null, occurred_at timestamptz not null, event_version integer not null,
 prediction text, confidence numeric check(confidence between 0 and 1),
 camera_refs jsonb not null default '[]', model_versions jsonb not null default '{}',
 primary key(source_id,business_ref,event_ref)
);
create index vision_metrics_time on public.vision_metrics(occurred_at);
create table public.intelligence_metrics (
 source_id uuid not null references public.ingest_sources(id), business_ref text not null,
 event_ref text not null, occurred_at timestamptz not null, decision text not null,
 confidence numeric check(confidence between 0 and 1), outcome text, pos_status text,
 primary key(source_id,business_ref,event_ref)
);
create table public.vision_daily_metrics (
 day date primary key, events integer not null default 0, reviewed integer not null default 0,
 resolved integer not null default 0, mean_confidence numeric
);
create table public.system_health (
 source_id uuid not null references public.ingest_sources(id), service text not null,
 observed_at timestamptz not null default now(), status text not null check(status in ('healthy','degraded','offline','unknown')),
 metrics jsonb not null default '{}', primary key(source_id,service)
);
create table public.issue_reports (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references public.ingest_sources(id),
 fingerprint text not null, source text not null, service text not null, error_type text not null,
 severity text not null check(severity in ('critical','high','medium','low')),
 message text not null, stack text, app_version text, platform text,
 first_seen_at timestamptz not null, last_seen_at timestamptz not null,
 occurrence_count bigint not null default 1, status text not null default 'open' check(status in ('open','investigating','resolved')),
 resolved_at timestamptz, unique(source_id,fingerprint)
);
create index issue_reports_open on public.issue_reports(severity,last_seen_at desc) where status<>'resolved';
create table public.error_reports (
 source_id uuid not null references public.ingest_sources(id), event_ref text not null,
 issue_id uuid not null references public.issue_reports(id) on delete cascade,
 business_ref text not null, occurred_at timestamptz not null,
 primary key(source_id,event_ref)
);
create table public.training_samples (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references public.ingest_sources(id),
 business_ref text not null, event_ref text not null, event_version integer not null,
 occurred_at timestamptz not null, received_at timestamptz not null default now(),
 expires_at timestamptz not null, consent_version text,
 verification_status text not null check(verification_status in ('human_verified','pos_supported','unverified')),
 eligible boolean not null default false, eligibility_reason text not null,
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected','revoked')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 record jsonb not null, unique(source_id,business_ref,event_ref)
);
create index training_samples_review on public.training_samples(expires_at,review_status) where eligible;
create table public.training_assets (
 id uuid primary key default gen_random_uuid(), sample_id uuid not null references public.training_samples(id) on delete cascade,
 asset_ref text not null, provider text not null default 'unconfigured',
 object_key text, sha256 text, mime_type text, size_bytes bigint,
 rights_verified boolean not null default false, expires_at timestamptz not null,
 deleted_at timestamptz, unique(sample_id,asset_ref),
 check(sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
 check(size_bytes is null or size_bytes>=0)
);
create table public.dataset_versions (
 id uuid primary key default gen_random_uuid(), name text not null, version text not null,
 status text not null default 'draft' check(status in ('draft','approved','revoked')),
 created_by uuid not null references auth.users(id), approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(), approved_at timestamptz,
 provenance jsonb not null default '{}', unique(name,version)
);
create table public.dataset_samples (
 dataset_id uuid not null references public.dataset_versions(id), sample_id uuid not null references public.training_samples(id) on delete cascade,
 sample_version integer not null, consent_version text not null,
 primary key(dataset_id,sample_id)
);
create table public.training_runs (
 id uuid primary key default gen_random_uuid(), dataset_id uuid not null references public.dataset_versions(id),
 status text not null default 'planned' check(status in ('planned','running','completed','failed','cancelled')),
 infrastructure_ref text, artifact_ref text, started_at timestamptz, completed_at timestamptz,
 config jsonb not null default '{}'
);
create table public.model_registry (
 id uuid primary key default gen_random_uuid(), name text not null, version text not null,
 artifact_provider text, artifact_key text, artifact_sha256 text,
 status text not null default 'candidate' check(status in ('candidate','approved','retired')),
 training_run_id uuid references public.training_runs(id),
 created_at timestamptz not null default now(), unique(name,version)
);
create table public.model_evaluations (
 id uuid primary key default gen_random_uuid(), model_id uuid not null references public.model_registry(id),
 dataset_id uuid not null references public.dataset_versions(id), evaluated_at timestamptz not null default now(),
 metrics jsonb not null default '{}', passed boolean not null default false, evaluator_ref text
);
create table public.model_deployments (
 id uuid primary key default gen_random_uuid(), model_id uuid not null references public.model_registry(id),
 environment text not null, approved_by uuid references auth.users(id), deployed_at timestamptz,
 rollback_model_id uuid references public.model_registry(id), status text not null default 'planned'
);
-- No direct browser table access, including to administrator JWTs. API is the authorization boundary.
do $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('revoke all on public.%I from anon, authenticated',t.tablename);
  execute format('grant select,insert,update,delete on public.%I to service_role',t.tablename);
 end loop;
end $$;
grant usage,select on all sequences in schema public to service_role;

