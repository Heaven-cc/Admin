create or replace function public.admin_finish_sync(p_cycle uuid,p_success boolean,p_error_code text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_run admin_private.pipeline_runs; v_count int; v_cameras int; v_online int; v_businesses int;
begin
 select * into v_run from admin_private.pipeline_runs where id=p_cycle for update; if not found then raise exception 'UNKNOWN_CYCLE'; end if;
 if p_success then
  if v_run.last_offset<>-1 or v_run.received_count<>v_run.source_count then raise exception 'RECONCILIATION_MISMATCH'; end if;
  select count(*) into v_count from public.platform_businesses where last_sync_cycle=p_cycle;
  if v_count<>v_run.source_count then raise exception 'RECONCILIATION_MISMATCH'; end if;
  update public.platform_businesses set source_present=coalesce(last_sync_cycle=p_cycle,false) where source_present is distinct from coalesce(last_sync_cycle=p_cycle,false);
  update public.admin_subscriptions s set present=false from public.platform_businesses b where b.business_ref=s.business_ref and not b.source_present;
  update admin_private.pipeline_runs set status='completed',completed_at=now(),error_code=null where id=p_cycle;
  update public.sync_state set status='idle',last_success_at=now(),last_error=null,consecutive_failures=0,next_retry_at=null,lease_expires_at=null,updated_at=now() where pipeline='production_reporting';
  insert into public.sync_receipts(pipeline,batch_id,idempotency_key,record_count,schema_version,status) values('production_reporting',p_cycle,p_cycle::text,v_count,1,'processed') on conflict(idempotency_key) do nothing;
  select coalesce(sum((attributes->>'camera_count')::int),0),coalesce(sum((attributes->>'online_cameras')::int),0),count(*) filter(where (attributes->>'camera_count')::int>0) into v_cameras,v_online,v_businesses from public.platform_businesses where last_sync_cycle=p_cycle;
  insert into public.vision_metrics(id,captured_at,service_status,total_cameras,online_cameras,offline_cameras,businesses) values(p_cycle,now(),'metadata_only',v_cameras,v_online,v_cameras-v_online,v_businesses) on conflict(id) do nothing;
 else
  update admin_private.pipeline_runs set status='failed',error_code=left(regexp_replace(coalesce(p_error_code,'SYNC_FAILED'),'[^A-Z0-9_]','','g'),80) where id=p_cycle;
  update public.sync_state set status='failed',last_error=left(regexp_replace(coalesce(p_error_code,'SYNC_FAILED'),'[^A-Z0-9_]','','g'),80),consecutive_failures=consecutive_failures+1,next_retry_at=now()+make_interval(secs=>least(3600,power(2,least(consecutive_failures+1,10))::int*15)),lease_expires_at=null,updated_at=now() where pipeline='production_reporting';
  if (select consecutive_failures from public.sync_state where pipeline='production_reporting')=1 then
  insert into public.admin_notifications(permission,title,body,href,category,severity) values('health.read','Production reporting sync failed','Reporting is delayed. Review System Health before retrying.','/health','sync','warning');
  end if;
 end if;
end $$;

