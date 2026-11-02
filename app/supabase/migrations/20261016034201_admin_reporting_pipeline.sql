-- Admin-only reporting receiver and scheduler state. Source data is minimized by the production exporter.
alter table public.admin_usage_daily alter column gmv_minor drop not null;
alter table public.admin_subscriptions add column present boolean not null default true;
alter table public.vision_metrics add column businesses integer;
create or replace function public.admin_start_sync() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.sync_state; v_run admin_private.pipeline_runs;
begin
 insert into public.sync_state(pipeline,status) values('production_reporting','idle') on conflict do nothing;
 select * into v_state from public.sync_state where pipeline='production_reporting' for update;
 if v_state.lease_expires_at>now() or v_state.next_retry_at>now() then return null; end if;
 select * into v_run from admin_private.pipeline_runs where status in ('running','failed') order by started_at desc limit 1;
 if not found then insert into admin_private.pipeline_runs(id) values(gen_random_uuid()) returning * into v_run; end if;
 update public.sync_state set status='running',last_attempt_at=now(),lease_expires_at=now()+interval '3 minutes',cursor_value=v_run.id::text,updated_at=now() where pipeline='production_reporting';
 return jsonb_build_object('cycle_id',v_run.id,'offset',v_run.last_offset);
end $$;
create or replace function public.admin_apply_reporting_page(p_cycle uuid,p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  v_ref:=(b->>'business_ref')::uuid; s:=b->'subscription';
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
  if exists(select 1 from jsonb_object_keys(p_snapshot->'angel_activity') k where k not in ('persisted_messages_24h','conversations_24h')) then raise exception 'UNDECLARED_AI_FIELD'; end if;
  insert into public.admin_service_metrics(service,captured_at,metrics,source) values('angel',v_capture,p_snapshot->'angel_activity','Production persisted activity; not request/token telemetry') on conflict(service) do update set captured_at=excluded.captured_at,metrics=excluded.metrics where public.admin_service_metrics.captured_at<=excluded.captured_at;
 end if;
 insert into admin_private.pipeline_pages(cycle_id,page_offset,checksum) values(p_cycle,v_offset,v_hash);
 update admin_private.pipeline_runs set last_offset=v_next,source_count=(p_snapshot->>'source_count')::int,received_count=received_count+jsonb_array_length(p_snapshot->'businesses'),status='running' where id=p_cycle;
 update public.sync_state set lease_expires_at=now()+interval '3 minutes',cursor_value=p_cycle::text||':'||v_next,updated_at=now() where pipeline='production_reporting';
 return jsonb_build_object('status','processed','next_offset',v_next);
end $$;
create or replace function public.admin_finish_sync(p_cycle uuid,p_success boolean,p_error_code text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_run admin_private.pipeline_runs; v_count int; v_cameras int; v_online int; v_businesses int;
begin
 select * into v_run from admin_private.pipeline_runs where id=p_cycle for update; if not found then raise exception 'UNKNOWN_CYCLE'; end if;
 if p_success then
  if v_run.last_offset<>-1 or v_run.received_count<>v_run.source_count then raise exception 'RECONCILIATION_MISMATCH'; end if;
  select count(*) into v_count from public.platform_businesses where last_sync_cycle=p_cycle;
  if v_count<>v_run.source_count then raise exception 'RECONCILIATION_MISMATCH'; end if;
  update admin_private.pipeline_runs set status='completed',completed_at=now(),error_code=null where id=p_cycle;
  update public.sync_state set status='idle',last_success_at=now(),last_error=null,consecutive_failures=0,next_retry_at=null,lease_expires_at=null,updated_at=now() where pipeline='production_reporting';
  insert into public.sync_receipts(pipeline,batch_id,idempotency_key,record_count,schema_version,status) values('production_reporting',p_cycle,p_cycle::text,v_count,1,'processed') on conflict(idempotency_key) do nothing;
  select coalesce(sum((attributes->>'camera_count')::int),0),coalesce(sum((attributes->>'online_cameras')::int),0),count(*) filter(where (attributes->>'camera_count')::int>0) into v_cameras,v_online,v_businesses from public.platform_businesses where last_sync_cycle=p_cycle;
  insert into public.vision_metrics(id,captured_at,service_status,total_cameras,online_cameras,offline_cameras,businesses) values(p_cycle,now(),'metadata_only',v_cameras,v_online,v_cameras-v_online,v_businesses) on conflict(id) do nothing;
 else
  update admin_private.pipeline_runs set status='failed',error_code=left(regexp_replace(coalesce(p_error_code,'SYNC_FAILED'),'[^A-Z0-9_]','','g'),80) where id=p_cycle;
  update public.sync_state set status='failed',last_error=left(regexp_replace(coalesce(p_error_code,'SYNC_FAILED'),'[^A-Z0-9_]','','g'),80),consecutive_failures=consecutive_failures+1,next_retry_at=now()+make_interval(secs=>least(3600,power(2,least(consecutive_failures+1,10))::int*15)),lease_expires_at=null,updated_at=now() where pipeline='production_reporting';
  insert into public.admin_notifications(permission,title,body,href,category,severity) values('health.read','Production reporting sync failed','Reporting is delayed. Review System Health before retrying.','/health','sync','warning');
 end if;
end $$;
create or replace function public.admin_request_sync() returns void language plpgsql security definer set search_path='' as $$
begin if not admin_private.has_permission('health.manage_sync') then raise exception 'FORBIDDEN' using errcode='42501'; end if; update public.sync_state set next_retry_at=null where pipeline='production_reporting' and lease_expires_at is null; perform admin_private.audit('sync.requested','pipeline','production_reporting'); end $$;
revoke all on function public.admin_start_sync(),public.admin_apply_reporting_page(uuid,jsonb),public.admin_finish_sync(uuid,boolean,text),public.admin_request_sync() from public,anon,authenticated;
grant execute on function public.admin_start_sync(),public.admin_apply_reporting_page(uuid,jsonb),public.admin_finish_sync(uuid,boolean,text) to service_role;
grant execute on function public.admin_request_sync() to authenticated;
create policy usage_sales_read on public.admin_usage_daily for select to authenticated using(admin_private.has_permission('sales.view'));
grant select on public.admin_usage_daily to authenticated;
