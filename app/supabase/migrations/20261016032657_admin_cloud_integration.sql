-- Additive integration for the existing Admin Project. Never apply the old generated baseline to this project.
create table admin_private.role_permissions(role_key text not null,permission text not null,primary key(role_key,permission));
alter table public.admin_users add column role_key text check(role_key in ('super_admin','operations_admin','finance_admin','support_admin','technical_admin','read_only_analyst'));
alter table public.admin_users add column invitation_accepted_at timestamptz;
alter table public.platform_businesses add column currency text;
alter table public.platform_businesses add column last_sync_cycle uuid;
create table public.admin_subscriptions(business_ref uuid primary key references public.platform_businesses(business_ref),plan_key text,status text,period_start timestamptz,period_end timestamptz,renews_at timestamptz,auto_renew boolean,amount_minor bigint,currency text,interval_months int,source_version int not null,source_updated_at timestamptz not null,synced_at timestamptz not null default now());
create table public.admin_payments(id uuid primary key,business_ref uuid not null references public.platform_businesses(business_ref),provider text not null,provider_ref text not null,amount_minor bigint not null check(amount_minor>=0),currency text not null check(currency in ('NGN','GHS','XOF')),status text not null check(status in ('verified','failed')),occurred_at timestamptz not null,unique(provider,provider_ref));
create table public.admin_usage_daily(business_ref uuid not null references public.platform_businesses(business_ref),metric_date date not null,currency text not null,transactions bigint not null check(transactions>=0),gmv_minor bigint not null check(gmv_minor>=0),primary key(business_ref,metric_date,currency));
create table public.admin_error_totals(application text not null,error_code text not null,metric_date date not null,occurrences bigint not null,last_seen_at timestamptz not null,primary key(application,error_code,metric_date));
create table public.admin_service_metrics(service text primary key,captured_at timestamptz,metrics jsonb not null default '{}',source text not null);
create table public.admin_incidents(id uuid primary key default gen_random_uuid(),reference bigint generated always as identity unique,title text not null check(length(title) between 4 and 200),severity text not null check(severity in ('S1','S2','S3','S4')),status text not null default 'open' check(status in ('open','investigating','mitigated','resolved','closed')),services text[] not null default '{}',opened_by uuid not null references auth.users(id),opened_at timestamptz not null default now(),resolved_at timestamptz);
create table public.admin_incident_timeline(id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.admin_incidents(id),entry text not null check(length(entry) between 1 and 4000),author_id uuid not null references auth.users(id),occurred_at timestamptz not null default now());
create table public.admin_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid references auth.users(id),permission text not null,title text not null,body text,href text,category text not null,severity text not null default 'info',created_at timestamptz not null default now());
create table public.admin_notification_reads(notification_id uuid not null references public.admin_notifications(id),user_id uuid not null references auth.users(id),read_at timestamptz not null default now(),primary key(notification_id,user_id));
create table public.admin_country_prices(id uuid primary key default gen_random_uuid(),country_code text not null check(country_code in ('NG','GH','TG','CI')),plan_key text not null check(plan_key in ('start','core','pro')),currency text not null,amount_minor bigint not null check(amount_minor>=0),effective_from date not null,version int not null check(version>0),active boolean not null default false,created_at timestamptz not null default now(),check((country_code='NG' and currency='NGN') or (country_code='GH' and currency='GHS') or (country_code in ('TG','CI') and currency='XOF')),unique(country_code,plan_key,version));
create unique index admin_price_active on public.admin_country_prices(country_code,plan_key) where active;
create table public.admin_dataset_registry(id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,domain text not null check(domain in ('vision','intelligence','sales','angel')),sensitivity text not null check(sensitivity in ('internal','confidential','restricted')),consent_basis text not null check(length(trim(consent_basis))>=8),retention_policy text not null check(length(trim(retention_policy))>=8),includes_customer_data boolean not null default false check(not includes_customer_data),status text not null default 'draft',owner_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.admin_dataset_versions(id uuid primary key default gen_random_uuid(),dataset_id uuid not null references public.admin_dataset_registry(id),version int not null check(version>0),row_count bigint not null check(row_count>=0),size_bytes bigint not null check(size_bytes>=0),checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),unique(dataset_id,version));
create table admin_private.invitations(id uuid primary key default gen_random_uuid(),email text not null check(email=lower(email)),role_key text not null,requested_by uuid,auth_user_id uuid references auth.users(id),state text not null default 'pending' check(state in ('pending','sent','accepted','failed')),expires_at timestamptz not null default now()+interval '72 hours',created_at timestamptz not null default now(),unique(email));
create table admin_private.pipeline_config(id boolean primary key default true check(id),export_url text not null,enabled boolean not null default true);
create table admin_private.pipeline_runs(id uuid primary key,started_at timestamptz not null default now(),last_offset int not null default 0,status text not null default 'running',source_count int,received_count int not null default 0,completed_at timestamptz,error_code text);
create table admin_private.pipeline_pages(cycle_id uuid not null references admin_private.pipeline_runs(id),page_offset int not null,checksum text not null,received_at timestamptz not null default now(),primary key(cycle_id,page_offset));
create index admin_payments_business_date on public.admin_payments(business_ref,occurred_at desc);
create index admin_business_country on public.platform_businesses(country_code);
create index admin_usage_date on public.admin_usage_daily(metric_date);
create index admin_notification_created on public.admin_notifications(created_at desc);

create or replace function admin_private.session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'aal')='aal2' and exists(select 1 from public.admin_users u join auth.sessions s on s.user_id=u.user_id where u.user_id=auth.uid() and u.active and s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.created_at>now()-interval '8 hours' and (s.not_after is null or s.not_after>now())),false)
$$;
create or replace function admin_private.role_key() returns text language sql stable security definer set search_path='' as $$
 select coalesce(u.role_key,case u.role::text when 'engineering_admin' then 'technical_admin' when 'analytics_admin' then 'read_only_analyst' else u.role::text end) from public.admin_users u where u.user_id=auth.uid() and u.active
$$;
create or replace function admin_private.has_permission(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select admin_private.session_valid() and exists(select 1 from admin_private.role_permissions p where p.role_key=admin_private.role_key() and p.permission=p_permission)
$$;
create or replace function public.admin_session() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email',a.email,'name',coalesce(u.display_name,a.email),'role',admin_private.role_key(),'permissions',(select jsonb_agg(p.permission) from admin_private.role_permissions p where p.role_key=admin_private.role_key()),'started_at',s.created_at,'expires_at',least(s.created_at+interval '8 hours',coalesce(s.not_after,s.created_at+interval '8 hours'))) from public.admin_users u join auth.users a on a.id=u.user_id join auth.sessions s on s.user_id=u.user_id and s.id=nullif(auth.jwt()->>'session_id','')::uuid where u.user_id=auth.uid() and admin_private.session_valid()
$$;
create or replace function admin_private.audit(p_action text,p_type text,p_ref text,p_metadata jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
 begin insert into public.admin_audit_logs(actor_user_id,action,resource_type,resource_ref,metadata,request_id) values(auth.uid(),p_action,p_type,p_ref,p_metadata,gen_random_uuid()); end
$$;
create or replace function admin_private.audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Audit history is append-only' using errcode='42501'; end $$;
create trigger admin_audit_immutable before update or delete or truncate on public.admin_audit_logs for each statement execute function admin_private.audit_immutable();
create or replace function public.record_admin_access(p_action text) returns void language plpgsql security definer set search_path='' as $$
 begin if not admin_private.session_valid() or p_action not in ('auth.login','auth.logout','audit.export') or (p_action='audit.export' and not admin_private.has_permission('audit.export')) then raise exception 'FORBIDDEN' using errcode='42501'; end if; perform admin_private.audit(p_action,'session',auth.uid()::text); end
$$;

create or replace function public.admin_incident_save(p_id uuid,p_title text default null,p_severity text default null,p_services text[] default '{}',p_status text default null,p_entry text default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid:=p_id; v_status text;
 begin
 if not admin_private.has_permission('incidents.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_entry is not null and length(trim(p_entry)) not between 1 and 4000 then raise exception 'Invalid entry'; end if;
 if p_id is null then
  if p_title is null or length(trim(p_title)) not between 4 and 200 or p_severity not in ('S1','S2','S3','S4') or cardinality(p_services)>10 then raise exception 'Invalid incident'; end if;
  insert into public.admin_incidents(title,severity,services,opened_by) values(trim(p_title),p_severity,p_services,auth.uid()) returning id into v_id;
 else
  select status into v_status from public.admin_incidents where id=p_id for update; if not found then raise exception 'Incident not found'; end if;
  if p_status is not null then
   if p_status not in ('open','investigating','mitigated','resolved','closed') or v_status='closed' then raise exception 'Invalid status transition'; end if;
   update public.admin_incidents set status=p_status,resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end where id=p_id;
  end if;
 end if;
 if p_entry is not null then insert into public.admin_incident_timeline(incident_id,entry,author_id) values(v_id,trim(p_entry),auth.uid()); end if;
 perform admin_private.audit(case when p_id is null then 'incident.created' else 'incident.updated' end,'incident',v_id::text,jsonb_build_object('status',p_status));
 insert into public.admin_notifications(permission,title,body,href,category,severity) values('incidents.read',case when p_id is null then 'Incident opened' else 'Incident updated' end,coalesce(p_title,'An incident status or timeline changed.'),'/incidents/'||v_id,'incident',case when p_severity='S1' then 'critical' else 'info' end);
 return v_id; end
$$;
create or replace function public.admin_mark_notifications_read() returns void language plpgsql security definer set search_path='' as $$
 begin if not admin_private.session_valid() then raise exception 'FORBIDDEN' using errcode='42501'; end if; insert into public.admin_notification_reads(notification_id,user_id) select id,auth.uid() from public.admin_notifications n where (recipient_id is null or recipient_id=auth.uid()) and admin_private.has_permission(n.permission) on conflict do nothing; end
$$;
create or replace function public.admin_dataset_register(p_name text,p_slug text,p_domain text,p_basis text,p_retention text,p_checksum text,p_rows bigint,p_bytes bigint) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;
 begin if not admin_private.has_permission('ai_data.manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if length(trim(p_name)) not between 3 and 160 or p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' then raise exception 'Invalid dataset'; end if;
 insert into public.admin_dataset_registry(name,slug,domain,sensitivity,consent_basis,retention_policy,owner_id) values(trim(p_name),p_slug,p_domain,'internal',trim(p_basis),trim(p_retention),auth.uid()) returning id into v_id;
 insert into public.admin_dataset_versions(dataset_id,version,row_count,size_bytes,checksum) values(v_id,1,p_rows,p_bytes,p_checksum);
 perform admin_private.audit('dataset.registered','dataset',v_id::text); return v_id; end
$$;
create or replace function public.admin_reserve_invite(p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;
 begin if not admin_private.has_permission('admin_team.invite') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from admin_private.role_permissions where role_key=p_role) or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation'; end if;
 insert into admin_private.invitations(email,role_key,requested_by) values(lower(trim(p_email)),p_role,auth.uid()) returning id into v_id;
 perform admin_private.audit('admin.invite_requested','invitation',v_id::text,jsonb_build_object('role',p_role)); return v_id; end
$$;
create or replace function public.admin_invite_details(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(i) from admin_private.invitations i where id=p_id and state='pending' and expires_at>now()
$$;
create or replace function public.admin_complete_invite(p_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare v admin_private.invitations;
 begin select * into v from admin_private.invitations where id=p_id and state='pending' and expires_at>now() for update; if not found then raise exception 'Invitation unavailable'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and lower(email)=v.email) then raise exception 'Identity mismatch'; end if;
 insert into public.admin_users(user_id,role,role_key,active,display_name,require_mfa) values(p_user_id,case v.role_key when 'technical_admin' then 'engineering_admin'::public.admin_role when 'finance_admin' then 'analytics_admin'::public.admin_role when 'read_only_analyst' then 'analytics_admin'::public.admin_role else v.role_key::public.admin_role end,v.role_key,false,v.email,true);
 update admin_private.invitations set state='sent',auth_user_id=p_user_id where id=p_id; end
$$;
create or replace function public.admin_activate_invitation(p_name text) returns void language plpgsql security definer set search_path='' as $$
 begin if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or length(trim(p_name)) not between 2 and 120 then raise exception 'MFA and name required'; end if;
 if not exists(select 1 from admin_private.invitations where auth_user_id=auth.uid() and state='sent' and expires_at>now()) then raise exception 'Valid invitation required'; end if;
 update public.admin_users set active=true,display_name=trim(p_name),invitation_accepted_at=now() where user_id=auth.uid() and not active;
 update admin_private.invitations set state='accepted' where auth_user_id=auth.uid() and state='sent'; perform admin_private.audit('admin.invite_accepted','admin',auth.uid()::text); end
$$;
create or replace function public.admin_bootstrap_invite(p_email text) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;
 begin if exists(select 1 from public.admin_users where role_key='super_admin') or exists(select 1 from admin_private.invitations where role_key='super_admin') then raise exception 'Bootstrap already reserved'; end if;
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 insert into admin_private.invitations(email,role_key) values(lower(trim(p_email)),'super_admin') returning id into v_id; return v_id; end
$$;
create or replace function public.admin_pipeline_credentials() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('export_url',c.export_url,'enabled',c.enabled,'export_token',(select decrypted_secret from vault.decrypted_secrets where name='trexven_admin_export_token'),'cron_token',(select decrypted_secret from vault.decrypted_secrets where name='trexven_admin_cron_token')) from admin_private.pipeline_config c where id
$$;

insert into admin_private.role_permissions(role_key,permission) values
('super_admin','dashboard.view'),
('super_admin','revenue.view'),
('super_admin','sales.view'),
('super_admin','businesses.read'),
('super_admin','businesses.suspend'),
('super_admin','businesses.restore'),
('super_admin','subscriptions.read'),
('super_admin','subscriptions.adjust'),
('super_admin','payments.read'),
('super_admin','payments.review'),
('super_admin','pricing.read'),
('super_admin','pricing.update'),
('super_admin','analytics.read'),
('super_admin','vision.read'),
('super_admin','angel.read'),
('super_admin','intelligence.read'),
('super_admin','health.read'),
('super_admin','health.manage_errors'),
('super_admin','health.manage_sync'),
('super_admin','incidents.read'),
('super_admin','incidents.manage'),
('super_admin','ai_data.read'),
('super_admin','ai_data.manage'),
('super_admin','admin_team.read'),
('super_admin','admin_team.invite'),
('super_admin','commands.read'),
('super_admin','commands.approve'),
('super_admin','audit.read'),
('super_admin','audit.export'),
('super_admin','settings.view'),
('super_admin','notifications.manage'),
('operations_admin','dashboard.view'),
('operations_admin','revenue.view'),
('operations_admin','sales.view'),
('operations_admin','businesses.read'),
('operations_admin','businesses.suspend'),
('operations_admin','businesses.restore'),
('operations_admin','subscriptions.read'),
('operations_admin','payments.read'),
('operations_admin','analytics.read'),
('operations_admin','vision.read'),
('operations_admin','incidents.read'),
('operations_admin','incidents.manage'),
('operations_admin','commands.read'),
('operations_admin','commands.approve'),
('operations_admin','settings.view'),
('finance_admin','dashboard.view'),
('finance_admin','revenue.view'),
('finance_admin','sales.view'),
('finance_admin','businesses.read'),
('finance_admin','subscriptions.read'),
('finance_admin','subscriptions.adjust'),
('finance_admin','payments.read'),
('finance_admin','payments.review'),
('finance_admin','pricing.read'),
('finance_admin','pricing.update'),
('finance_admin','analytics.read'),
('finance_admin','commands.read'),
('finance_admin','commands.approve'),
('finance_admin','settings.view'),
('support_admin','dashboard.view'),
('support_admin','businesses.read'),
('support_admin','subscriptions.read'),
('support_admin','payments.read'),
('support_admin','analytics.read'),
('support_admin','vision.read'),
('support_admin','incidents.read'),
('support_admin','incidents.manage'),
('support_admin','commands.read'),
('support_admin','settings.view'),
('technical_admin','dashboard.view'),
('technical_admin','sales.view'),
('technical_admin','businesses.read'),
('technical_admin','analytics.read'),
('technical_admin','vision.read'),
('technical_admin','angel.read'),
('technical_admin','intelligence.read'),
('technical_admin','health.read'),
('technical_admin','health.manage_errors'),
('technical_admin','health.manage_sync'),
('technical_admin','incidents.read'),
('technical_admin','incidents.manage'),
('technical_admin','ai_data.read'),
('technical_admin','ai_data.manage'),
('technical_admin','commands.read'),
('technical_admin','settings.view'),
('read_only_analyst','dashboard.view'),
('read_only_analyst','revenue.view'),
('read_only_analyst','sales.view'),
('read_only_analyst','businesses.read'),
('read_only_analyst','subscriptions.read'),
('read_only_analyst','payments.read'),
('read_only_analyst','analytics.read'),
('read_only_analyst','vision.read'),
('read_only_analyst','pricing.read');

-- Add restrictive scope alongside existing policies; do not remove legacy objects or policies.
do $$ declare r record; v_permission text; v_existing text[]:=array['admin_users','admin_roles','admin_user_roles','platform_businesses','platform_users','business_daily_metrics','subscription_events','revenue_metrics','usage_events','app_sessions','app_installations','platform_daily_metrics','vision_metrics','vision_daily_metrics','intelligence_metrics','issue_reports','error_reports','system_health','sync_state','sync_receipts','admin_audit_logs','model_registry','model_evaluations','dataset_versions','training_samples','training_assets','training_runs','model_deployments','dataset_samples','data_governance']; begin
for r in select tablename,schemaname from pg_tables where schemaname in ('public','admin_private') loop
 if r.schemaname='admin_private' and r.tablename not in ('role_permissions','invitations','pipeline_config','pipeline_runs','pipeline_pages') then continue; end if;
 if r.schemaname='public' and not(r.tablename=any(v_existing)) and r.tablename not like 'admin_%' then continue; end if;
 execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
 if r.schemaname='admin_private' then continue; end if;
 v_permission:=case when r.tablename in ('admin_users','admin_roles','admin_user_roles') then 'admin_team.read' when r.tablename in ('platform_businesses','platform_users','business_daily_metrics') then 'businesses.read' when r.tablename in ('admin_subscriptions','subscription_events') then 'subscriptions.read' when r.tablename='admin_payments' then 'payments.read' when r.tablename='revenue_metrics' then 'revenue.view' when r.tablename in ('usage_events','app_sessions','app_installations','platform_daily_metrics') then 'analytics.read' when r.tablename in ('vision_metrics','vision_daily_metrics') then 'vision.read' when r.tablename='intelligence_metrics' then 'intelligence.read' when r.tablename in ('issue_reports','error_reports','system_health','sync_state','sync_receipts','admin_error_totals') then 'health.read' when r.tablename='admin_audit_logs' then 'audit.read' when r.tablename in ('admin_incidents','admin_incident_timeline') then 'incidents.read' when r.tablename in ('admin_dataset_registry','admin_dataset_versions','model_registry','model_evaluations','dataset_versions') then 'ai_data.read' when r.tablename='admin_country_prices' then 'pricing.read' else null end;
 if v_permission is not null then execute format('create policy trexven_admin_scope on public.%I as %s for select to authenticated using(admin_private.has_permission(%L))',r.tablename,case when r.tablename=any(v_existing) then 'restrictive' else 'permissive' end,v_permission); execute format('grant select on public.%I to authenticated',r.tablename); elsif r.tablename=any(v_existing) then execute format('create policy trexven_no_training_access on public.%I as restrictive for all to authenticated using(false) with check(false)',r.tablename); end if;
end loop; end $$;
create policy trexven_audit_no_insert on public.admin_audit_logs as restrictive for insert to authenticated with check(false);
grant select on public.admin_notifications,public.admin_notification_reads,public.admin_service_metrics to authenticated;
create policy notifications_scoped on public.admin_notifications for select to authenticated using((recipient_id is null or recipient_id=auth.uid()) and admin_private.has_permission(permission));
create policy notification_reads_self on public.admin_notification_reads for select to authenticated using(user_id=auth.uid() and admin_private.session_valid());
create policy service_scoped on public.admin_service_metrics for select to authenticated using(admin_private.has_permission(service||'.read'));
revoke all on admin_private.role_permissions,admin_private.invitations,admin_private.pipeline_config,admin_private.pipeline_runs,admin_private.pipeline_pages from public,anon,authenticated;
grant usage on schema admin_private to authenticated;
do $$ declare r record; begin for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and (p.proname like 'admin_%' or p.proname='record_admin_access')) or (n.nspname='admin_private' and p.proname in ('session_valid','role_key','has_permission','audit','audit_immutable')) loop execute format('revoke execute on function %s from public,anon,authenticated',r.f); end loop; end $$;
grant execute on function admin_private.has_permission(text),admin_private.session_valid() to authenticated;
grant execute on function public.admin_session(),public.record_admin_access(text),public.admin_incident_save(uuid,text,text,text[],text,text),public.admin_mark_notifications_read(),public.admin_dataset_register(text,text,text,text,text,text,bigint,bigint),public.admin_reserve_invite(text,text),public.admin_activate_invitation(text) to authenticated;
grant execute on function public.admin_invite_details(uuid),public.admin_complete_invite(uuid,uuid),public.admin_bootstrap_invite(text),public.admin_pipeline_credentials() to service_role;
revoke insert,update,delete,truncate on public.admin_audit_logs from authenticated,anon,service_role;
insert into admin_private.pipeline_config(id,export_url,enabled) values(true,'https://ufehcfrlygqvminfjumf.supabase.co/functions/v1/admin-reporting-export',false);
