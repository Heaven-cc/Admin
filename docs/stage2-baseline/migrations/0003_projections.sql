-- 0003_projections.sql — sync-derived projections (docs/08 §C)
-- Projections are written ONLY by the ingest Edge Function (service role).

create table businesses_projection (
  business_id text primary key,
  name text not null,
  country_code char(2) not null,
  registered_at timestamptz,
  account_status account_status not null default 'active',
  plan_key text not null default 'start',
  subscription_status text,
  subscription_renews_at timestamptz,
  payment_provider text,
  last_activity_at timestamptz,
  pos_summary jsonb,
  vision_status vision_status not null default 'none',
  vision_camera_count int not null default 0,
  integration_health jsonb,
  updated_at timestamptz not null default now(),
  source_event_id uuid
);

create index businesses_name_trgm on businesses_projection using gin (name gin_trgm_ops);
create index businesses_country_idx on businesses_projection (country_code);
create index businesses_status_idx on businesses_projection (account_status);
create index businesses_activity_idx on businesses_projection (last_activity_at desc);

alter table businesses_projection enable row level security;
create policy businesses_read on businesses_projection for select using (has_permission('businesses.read'));

create table subscriptions_projection (
  id uuid primary key,
  business_id text not null,
  plan_key text not null,
  status subscription_status not null default 'active',
  currency char(3) not null,
  amount_minor bigint not null default 0,
  billing_interval text not null default 'monthly',
  period_start timestamptz,
  period_end timestamptz,
  auto_renew boolean not null default true,
  provider text,
  provider_subscription_ref text unique,
  canceled_at timestamptz,
  cancel_reason text,
  updated_at timestamptz not null default now(),
  source_event_id uuid
);

create index subscriptions_business_idx on subscriptions_projection (business_id);
create index subscriptions_status_idx on subscriptions_projection (status);
create index subscriptions_period_idx on subscriptions_projection (period_end);

alter table subscriptions_projection enable row level security;
create policy subscriptions_read on subscriptions_projection for select using (has_permission('subscriptions.read'));

create table payments_projection (
  id uuid primary key,
  business_id text not null,
  provider text not null default 'paystack',
  provider_ref text not null unique,
  amount_minor bigint not null,
  currency char(3) not null,
  status text not null check (status in ('success','failed','pending')),
  failure_code text,
  failure_reason text,
  occurred_at timestamptz not null,
  reconciled boolean not null default false,
  reconciled_at timestamptz,
  updated_at timestamptz not null default now(),
  source_event_id uuid
);

create index payments_business_idx on payments_projection (business_id, occurred_at desc);
create index payments_status_idx on payments_projection (status);
create index payments_occurred_idx on payments_projection (occurred_at desc);

alter table payments_projection enable row level security;
create policy payments_read on payments_projection for select using (has_permission('payments.read'));

create table refunds_projection (
  id uuid primary key,
  payment_ref text not null,
  business_id text not null,
  amount_minor bigint not null,
  currency char(3) not null,
  reason text,
  provider_ref text unique,
  status text not null default 'pending',
  occurred_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table refunds_projection enable row level security;
create policy refunds_read on refunds_projection for select using (has_permission('payments.read'));

create table cameras_projection (
  camera_id text primary key,
  business_id text not null,
  label text,
  status text not null default 'online' check (status in ('online','offline','disabled')),
  last_heartbeat_at timestamptz,
  model_version text,
  health jsonb,
  site text,
  updated_at timestamptz not null default now()
);

create index cameras_business_idx on cameras_projection (business_id);
create index cameras_status_idx on cameras_projection (status, last_heartbeat_at);

alter table cameras_projection enable row level security;
create policy cameras_read on cameras_projection for select using (has_permission('vision.read'));

-- Business timeline (docs/04 §4.3 Timeline tab) — invoker rights so RLS applies
create view business_timeline
with (security_invoker = true) as
  select business_id, occurred_at as at, 'command' as type,
         command_type || ' · ' || status as label,
         coalesce(error, '') as detail, coalesce(requested_by_name, 'system') as actor
    from administrative_commands
  union all
  select business_id, occurred_at, 'payment',
         'Payment ' || status, coalesce(failure_reason, provider_ref), provider
    from payments_projection;

-- ── Analytics (docs/08 §D) ──────────────────────────────────────────────────
create table analytics_events (
  id uuid not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  business_id text,
  platform text,
  app_version text,
  country_code char(2),
  properties jsonb,
  schema_version int not null default 1,
  primary key (id, occurred_at)
) partition by range (occurred_at);

create table analytics_events_default partition of analytics_events default;
create index analytics_events_type_idx on analytics_events (event_type, occurred_at);

alter table analytics_events enable row level security;
create policy analytics_read on analytics_events for select using (has_permission('analytics.read'));

create table analytics_daily_aggregates (
  id bigserial primary key,
  date date not null,
  metric_key text not null,
  dimension jsonb not null default '{}',
  dimension_hash text not null,
  value numeric not null default 0,
  computed_at timestamptz not null default now(),
  unique (date, metric_key, dimension_hash)
);

create index aggregates_metric_date_idx on analytics_daily_aggregates (metric_key, date);

alter table analytics_daily_aggregates enable row level security;
create policy aggregates_read on analytics_daily_aggregates for select using (has_permission('analytics.read'));

create table fx_rates (
  date date not null,
  currency char(3) not null,
  rate numeric not null,
  source text not null default 'manual',
  primary key (date, currency)
);

alter table fx_rates enable row level security;
create policy fx_read on fx_rates for select using (has_permission('revenue.view'));
