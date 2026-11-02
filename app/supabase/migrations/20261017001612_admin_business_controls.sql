-- Only the independently authorized business-control workflow is enabled.
insert into admin_private.role_permissions(role_key,permission) values('super_admin','businesses.delete') on conflict do nothing;
create table public.admin_business_actions(
 id uuid primary key,business_ref uuid not null,action text not null check(action in('suspend','restore','delete')),
 requested_by uuid not null,session_id uuid not null,actor_role text not null,
 reason text not null check(length(reason) between 8 and 2000),confirmation text not null,
 status text not null default 'pending' check(status in('pending','completed')),
 result jsonb,error_code text,created_at timestamptz not null default now(),authorized_at timestamptz not null default now(),completed_at timestamptz
);
create index admin_business_actions_target on public.admin_business_actions(business_ref,created_at desc);
create index admin_business_actions_pending on public.admin_business_actions(requested_by,business_ref,action) where status='pending';
alter table public.admin_business_actions enable row level security;
revoke all on public.admin_business_actions from public,anon,authenticated;
grant select on public.admin_business_actions to authenticated;
grant all on public.admin_business_actions to service_role;
create policy admin_business_actions_read on public.admin_business_actions for select to authenticated using(admin_private.has_permission('businesses.read') and (action<>'delete' or admin_private.role_key()='super_admin'));
create trigger admin_business_actions_no_delete before delete or truncate on public.admin_business_actions for each statement execute function admin_private.audit_immutable();
create table public.admin_business_control_state(
 business_ref uuid primary key,state text not null check(state in('active','suspended','deleting','deleted')),
 last_action_id uuid not null,updated_at timestamptz not null default now()
);
alter table public.admin_business_control_state enable row level security;
revoke all on public.admin_business_control_state from public,anon,authenticated;
grant select on public.admin_business_control_state to authenticated;
grant all on public.admin_business_control_state to service_role;
create policy admin_business_control_read on public.admin_business_control_state for select to authenticated using(admin_private.has_permission('businesses.read'));
create or replace function admin_private.business_action_allowed(p_action text) returns boolean language sql stable security definer set search_path='' as $$
 select admin_private.session_valid() and case p_action
 when 'delete' then admin_private.role_key()='super_admin' and admin_private.has_permission('businesses.delete')
 when 'suspend' then admin_private.has_permission('businesses.suspend')
 when 'restore' then admin_private.has_permission('businesses.restore') else false end
$$;
revoke all on function admin_private.business_action_allowed(text) from public,anon,authenticated;
create or replace function admin_private.business_delete_stepup() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m
 where m->>'method'='totp' and jsonb_typeof(m->'timestamp')='number'
 and (m->>'timestamp')::numeric between extract(epoch from now()-interval '5 minutes') and extract(epoch from now()+interval '10 seconds'))
$$;
revoke all on function admin_private.business_delete_stepup() from public,anon,authenticated;
create or replace function public.admin_begin_business_action(p_id uuid,p_business uuid,p_action text,p_reason text,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.admin_business_actions%rowtype; v_name text; v_id uuid:=p_id;
begin
 if not admin_private.business_action_allowed(p_action) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action='delete' and not admin_private.business_delete_stepup() then raise exception 'FRESH_MFA_REQUIRED' using errcode='42501'; end if;
 if p_id is null or p_business is null or p_reason is null or length(trim(p_reason)) not between 8 and 2000 or p_confirmation is null then raise exception 'INVALID_ACTION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_business::text||':admin-action',0));
 select * into v from public.admin_business_actions where id=p_id for update;
 if found then
  if v.requested_by<>auth.uid() or v.business_ref<>p_business or v.action<>p_action or v.confirmation<>p_confirmation then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if v.status='completed' then return v.id; end if;
 else
  select name into v_name from public.platform_businesses where business_ref=p_business and source_present;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  if p_confirmation<>v_name then raise exception 'CONFIRMATION_MISMATCH'; end if;
  if exists(select 1 from public.admin_business_control_state where business_ref=p_business and state='deleted') then raise exception 'BUSINESS_DELETED'; end if;
  select * into v from public.admin_business_actions where business_ref=p_business and action=p_action and requested_by=auth.uid() and status='pending' order by created_at limit 1 for update;
  if not found then
   insert into public.admin_business_actions(id,business_ref,action,requested_by,session_id,actor_role,reason,confirmation)
   values(p_id,p_business,p_action,auth.uid(),(auth.jwt()->>'session_id')::uuid,admin_private.role_key(),trim(p_reason),p_confirmation) returning * into v;
   perform admin_private.audit('business.'||p_action||'_requested','business',p_business::text,jsonb_build_object('action_id',v.id,'reason',trim(p_reason)));
  end if;
 end if;
 update public.admin_business_actions set session_id=(auth.jwt()->>'session_id')::uuid,authorized_at=now(),error_code=null where id=v.id;
 return v.id;
end $$;
revoke all on function public.admin_begin_business_action(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_begin_business_action(uuid,uuid,text,text,text) to authenticated;
create or replace function public.admin_authorize_business_action(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.admin_business_actions%rowtype;
begin
 select * into v from public.admin_business_actions where id=p_id and requested_by=auth.uid();
 if not found or not admin_private.business_action_allowed(v.action) or v.session_id is distinct from nullif(auth.jwt()->>'session_id','')::uuid or v.authorized_at<now()-interval '2 minutes' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v.action='delete' and not admin_private.business_delete_stepup() then raise exception 'FRESH_MFA_REQUIRED' using errcode='42501'; end if;
 return jsonb_build_object('id',v.id,'business_ref',v.business_ref,'action',v.action,'actor_id',auth.uid(),'actor_role',admin_private.role_key(),'reason',v.reason,'confirmation',v.confirmation,'authorized_at',now());
end $$;
revoke all on function public.admin_authorize_business_action(uuid) from public,anon,authenticated;
grant execute on function public.admin_authorize_business_action(uuid) to authenticated;
create or replace function public.admin_finish_business_action(p_id uuid,p_result jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.admin_business_actions%rowtype; v_state text:=p_result->>'state';
begin
 select * into v from public.admin_business_actions where id=p_id for update;
 if not found or (p_result->>'id')::uuid is distinct from v.id or (p_result->>'business_ref')::uuid is distinct from v.business_ref or p_result->>'action' is distinct from v.action
 or v_state not in('active','suspended','deleting','deleted') or jsonb_typeof(p_result->'finished') is distinct from 'boolean' then raise exception 'INVALID_PRODUCTION_RECEIPT'; end if;
 if v.status='completed' then return; end if;
 if (v.action='suspend' and v_state<>'suspended') or (v.action='restore' and v_state<>'active') or (v.action='delete' and v_state not in('deleting','deleted')) or ((p_result->>'finished')::boolean is distinct from (v_state<>'deleting')) then raise exception 'RECEIPT_ACTION_MISMATCH'; end if;
 insert into public.admin_business_control_state(business_ref,state,last_action_id) values(v.business_ref,v_state,v.id)
 on conflict(business_ref) do update set state=excluded.state,last_action_id=excluded.last_action_id,updated_at=now();
 if v_state='deleted' then
  delete from public.dataset_samples where sample_id in(select id from public.training_samples where business_ref=v.business_ref);
 delete from public.platform_users where business_ref=v.business_ref;
 delete from public.app_installations where business_ref=v.business_ref;
 delete from public.app_sessions where business_ref=v.business_ref;
 delete from public.usage_events where business_ref=v.business_ref;
 delete from public.data_governance where business_ref=v.business_ref;
 delete from public.subscription_events where business_ref=v.business_ref;
 delete from public.intelligence_metrics where business_ref=v.business_ref;
 delete from public.business_daily_metrics where business_ref=v.business_ref;
 delete from public.training_samples where business_ref=v.business_ref;
 delete from public.vision_daily_metrics where business_ref=v.business_ref;
 delete from public.vision_metrics where business_ref=v.business_ref;
 delete from public.issue_reports where business_ref=v.business_ref;
 delete from public.admin_payments where business_ref=v.business_ref;
 delete from public.admin_subscriptions where business_ref=v.business_ref;
 delete from public.admin_usage_daily where business_ref=v.business_ref;
  delete from public.platform_businesses where business_ref=v.business_ref;
 end if;
 update public.admin_business_actions set status=case when v_state='deleting' then 'pending' else 'completed' end,result=p_result,
 completed_at=case when v_state='deleting' then null else now() end where id=p_id;
 if v.result->>'state' is distinct from v_state then
  insert into public.admin_audit_logs(actor_user_id,action,resource_type,resource_ref,metadata,request_id)
  values(v.requested_by,'business.'||v.action||case when v_state='deleting' then '_in_progress' else '_completed' end,'business',v.business_ref::text,
   jsonb_build_object('action_id',v.id,'reason',v.reason,'state',v_state,'actor_role',v.actor_role),gen_random_uuid());
 end if;
end $$;
revoke all on function public.admin_finish_business_action(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_finish_business_action(uuid,jsonb) to service_role;
CREATE OR REPLACE FUNCTION public.admin_apply_reporting_page(p_cycle uuid, p_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b jsonb; s jsonb; p jsonb; u jsonb; e jsonb; v_ref uuid; v_capture timestamptz; v_offset integer; v_hash text; v_old text; v_existing public.admin_payments; v_next integer; k text;
begin
 if jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>4194304 then raise exception 'INVALID_ENVELOPE'; end if;
 for k in select jsonb_object_keys(p_snapshot) loop if k not in ('schema_version','captured_at','page_offset','next_offset','source_count','businesses','errors','angel_activity') then raise exception 'UNDECLARED_FIELD'; end if; end loop;
 if (p_snapshot->>'schema_version')::int<>1 or jsonb_typeof(p_snapshot->'businesses')<>'array' or jsonb_array_length(p_snapshot->'businesses')>100 or jsonb_typeof(p_snapshot->'errors')<>'array' then raise exception 'INVALID_SCHEMA'; end if;
 v_capture:=(p_snapshot->>'captured_at')::timestamptz; v_offset:=(p_snapshot->>'page_offset')::int; v_next:=coalesce((p_snapshot->>'next_offset')::int,-1);
 if v_capture is null or abs(extract(epoch from(now()-v_capture)))>300 or v_offset<0 then raise exception 'STALE_SNAPSHOT'; end if;
 perform 1 from admin_private.pipeline_runs where id=p_cycle and status in ('running','failed') for update; if not found then raise exception 'UNKNOWN_CYCLE'; end if;
 v_hash:=encode(sha256(convert_to(p_snapshot::text,'UTF8')),'hex');
 select checksum into v_old from admin_private.pipeline_pages where cycle_id=p_cycle and page_offset=v_offset;
 if found then if v_old<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return jsonb_build_object('status','duplicate','next_offset',v_next); end if;
 if not exists(select 1 from admin_private.pipeline_runs where id=p_cycle and last_offset=v_offset) then raise exception 'CHECKPOINT_CONFLICT'; end if;
 for b in select value from jsonb_array_elements(p_snapshot->'businesses') loop
  for k in select jsonb_object_keys(b) loop if k not in ('business_ref','name','country_code','currency','registered_at','source_updated_at','last_active_at','product_count','camera_count','online_cameras','subscription','payments','usage') then raise exception 'UNDECLARED_BUSINESS_FIELD'; end if; end loop;
  v_ref:=(b->>'business_ref')::uuid;
  if exists(select 1 from public.admin_business_control_state where business_ref=v_ref and state='deleted') then continue; end if;
  s:=b->'subscription';
  if v_ref is null or length(b->>'name')>160 or (b->>'country_code') not in ('NG','GH','TG','CI') or (b->>'currency') not in ('NGN','GHS','XOF') or (b->>'camera_count')::int<0 or (b->>'product_count')::int<0 then raise exception 'INVALID_BUSINESS'; end if;
  insert into public.platform_businesses(business_ref,name,plan,account_status,created_at,last_active_at,vision_enabled,source_updated_at,synced_at,country_code,currency,last_sync_cycle,attributes)
  values(v_ref,b->>'name',s->>'plan_key','unknown',(b->>'registered_at')::timestamptz,(b->>'last_active_at')::timestamptz,(b->>'camera_count')::int>0,(b->>'source_updated_at')::timestamptz,v_capture,b->>'country_code',b->>'currency',p_cycle,jsonb_build_object('product_count',(b->>'product_count')::int,'camera_count',(b->>'camera_count')::int,'online_cameras',(b->>'online_cameras')::int,'subscription_status',s->>'status','renews_at',s->>'renews_at','auto_renew',s->'auto_renew'))
  on conflict(business_ref) do update set name=excluded.name,plan=excluded.plan,created_at=excluded.created_at,last_active_at=excluded.last_active_at,vision_enabled=excluded.vision_enabled,source_updated_at=excluded.source_updated_at,synced_at=excluded.synced_at,country_code=excluded.country_code,currency=excluded.currency,last_sync_cycle=excluded.last_sync_cycle,attributes=excluded.attributes where public.platform_businesses.synced_at<=excluded.synced_at;
  if s is not null and s<>'null'::jsonb then
   for k in select jsonb_object_keys(s) loop if k not in ('plan_key','status','period_start','period_end','renews_at','auto_renew','source_version','source_updated_at','amount_minor','currency','interval_months') then raise exception 'UNDECLARED_SUBSCRIPTION_FIELD'; end if; end loop;
   if s->>'plan_key' not in ('start','core','pro') or s->>'status' not in ('trialing','active','past_due','canceled','expired') then raise exception 'INVALID_SUBSCRIPTION'; end if;
   insert into public.admin_subscriptions(business_ref,plan_key,status,period_start,period_end,renews_at,auto_renew,amount_minor,currency,interval_months,source_version,source_updated_at,present)
   values(v_ref,s->>'plan_key',s->>'status',(s->>'period_start')::timestamptz,(s->>'period_end')::timestamptz,(s->>'renews_at')::timestamptz,(s->>'auto_renew')::boolean,(s->>'amount_minor')::bigint,s->>'currency',(s->>'interval_months')::int,(s->>'source_version')::int,(s->>'source_updated_at')::timestamptz,true)
   on conflict(business_ref) do update set plan_key=excluded.plan_key,status=excluded.status,period_start=excluded.period_start,period_end=excluded.period_end,renews_at=excluded.renews_at,auto_renew=excluded.auto_renew,amount_minor=excluded.amount_minor,currency=excluded.currency,interval_months=excluded.interval_months,source_version=excluded.source_version,source_updated_at=excluded.source_updated_at,synced_at=now(),present=true where public.admin_subscriptions.source_version<=excluded.source_version;
  else update public.admin_subscriptions set present=false where business_ref=v_ref; end if;
  for p in select value from jsonb_array_elements(b->'payments') loop
   for k in select jsonb_object_keys(p) loop if k not in ('id','provider','provider_ref','amount_minor','currency','status','occurred_at') then raise exception 'UNDECLARED_PAYMENT_FIELD'; end if; end loop;
   if p->>'status' not in ('verified','failed') or p->>'currency' not in ('NGN','GHS','XOF') or (p->>'amount_minor')::bigint<0 or p->>'amount_minor' is null then raise exception 'INVALID_PAYMENT'; end if;
   select * into v_existing from public.admin_payments where provider=p->>'provider' and provider_ref=p->>'provider_ref' for update;
   if found and (v_existing.id<>(p->>'id')::uuid or v_existing.business_ref<>v_ref or v_existing.amount_minor<>(p->>'amount_minor')::bigint or v_existing.currency<>p->>'currency') then raise exception 'PAYMENT_IDENTITY_CONFLICT'; end if;
   insert into public.admin_payments(id,business_ref,provider,provider_ref,amount_minor,currency,status,occurred_at) values((p->>'id')::uuid,v_ref,p->>'provider',p->>'provider_ref',(p->>'amount_minor')::bigint,p->>'currency',p->>'status',(p->>'occurred_at')::timestamptz)
   on conflict(provider,provider_ref) do update set status=case when public.admin_payments.status='verified' then 'verified' else excluded.status end,occurred_at=case when excluded.status='verified' then excluded.occurred_at else public.admin_payments.occurred_at end;
  end loop;
  for u in select value from jsonb_array_elements(b->'usage') loop
   for k in select jsonb_object_keys(u) loop if k not in ('metric_date','transactions','gmv_minor','currency') then raise exception 'UNDECLARED_USAGE_FIELD'; end if; end loop;
   if u->>'currency' in ('NGN','GHS','XOF') then insert into public.admin_usage_daily(business_ref,metric_date,currency,transactions,gmv_minor) values(v_ref,(u->>'metric_date')::date,u->>'currency',(u->>'transactions')::bigint,(u->>'gmv_minor')::bigint) on conflict(business_ref,metric_date,currency) do update set transactions=excluded.transactions,gmv_minor=excluded.gmv_minor; end if;
  end loop;
 end loop;
 for e in select value from jsonb_array_elements(p_snapshot->'errors') loop
  for k in select jsonb_object_keys(e) loop if k not in ('application','error_code','metric_date','occurrences','last_seen_at') then raise exception 'UNDECLARED_ERROR_FIELD'; end if; end loop;
  if e->>'application' not in ('owner','pos','backend') or e->>'error_code' not in ('OPERATION_UNCONFIRMED','OFFLINE_SYNC_UNCONFIRMED','ENCRYPTED_STORAGE_UNAVAILABLE','BILLING_REQUEST_UNCONFIRMED','CAMERA_EVIDENCE_REQUEST_FAILED') then raise exception 'UNAPPROVED_ERROR_CODE'; end if;
  insert into public.admin_error_totals(application,error_code,metric_date,occurrences,last_seen_at) values(e->>'application',e->>'error_code',(e->>'metric_date')::date,(e->>'occurrences')::bigint,(e->>'last_seen_at')::timestamptz) on conflict(application,error_code,metric_date) do update set occurrences=excluded.occurrences,last_seen_at=excluded.last_seen_at;
 end loop;
 if p_snapshot->'angel_activity'<>'null'::jsonb then
  if exists(select 1 from jsonb_object_keys(p_snapshot->'angel_activity') as field(key) where field.key not in ('persisted_messages_24h','conversations_24h')) then raise exception 'UNDECLARED_AI_FIELD'; end if;
  insert into public.admin_service_metrics(service,captured_at,metrics,source) values('angel',v_capture,p_snapshot->'angel_activity','Production persisted activity; not request/token telemetry') on conflict(service) do update set captured_at=excluded.captured_at,metrics=excluded.metrics where public.admin_service_metrics.captured_at<=excluded.captured_at;
 end if;
 insert into admin_private.pipeline_pages(cycle_id,page_offset,checksum) values(p_cycle,v_offset,v_hash);
 update admin_private.pipeline_runs set last_offset=v_next,source_count=(p_snapshot->>'source_count')::int,received_count=received_count+jsonb_array_length(p_snapshot->'businesses'),status='running' where id=p_cycle;
 update public.sync_state set lease_expires_at=now()+interval '3 minutes',cursor_value=p_cycle::text||':'||v_next,updated_at=now() where pipeline='production_reporting';
 return jsonb_build_object('status','processed','next_offset',v_next);
end $function$


