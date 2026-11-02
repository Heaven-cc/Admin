alter table public.platform_businesses add column source_present boolean not null default true;
create or replace function public.admin_start_sync() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.sync_state; v_run admin_private.pipeline_runs;
begin
 insert into public.sync_state(pipeline,status) values('production_reporting','idle') on conflict do nothing;
 select * into v_state from public.sync_state where pipeline='production_reporting' for update;
 if v_state.lease_expires_at>now() or v_state.next_retry_at>now() then return null; end if;
 select * into v_run from admin_private.pipeline_runs where status in ('running','failed') and (error_code is null or error_code not in ('RECONCILIATION_FAILED','CHECKPOINT_INVALID')) order by started_at desc limit 1;
 if not found then insert into admin_private.pipeline_runs(id) values(gen_random_uuid()) returning * into v_run; end if;
 update public.sync_state set status='running',last_attempt_at=now(),lease_expires_at=now()+interval '3 minutes',cursor_value=v_run.id::text,updated_at=now() where pipeline='production_reporting';
 return jsonb_build_object('cycle_id',v_run.id,'offset',v_run.last_offset);
end $$;
create or replace function public.admin_finish_sync(p_cycle uuid,p_success boolean,p_error_code text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_run admin_private.pipeline_runs; v_count int; v_cameras int; v_online int; v_businesses int;
begin
 select * into v_run from admin_private.pipeline_runs where id=p_cycle for update; if not found then raise exception 'UNKNOWN_CYCLE'; end if;
 if p_success then
  if v_run.last_offset<>-1 or v_run.received_count<>v_run.source_count then raise exception 'RECONCILIATION_MISMATCH'; end if;
  select count(*) into v_count from public.platform_businesses where last_sync_cycle=p_cycle;
  if v_count<>v_run.source_count then raise exception 'RECONCILIATION_MISMATCH'; end if;
  update public.platform_businesses set source_present=(last_sync_cycle=p_cycle);
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

create policy issue_update_mfa on public.issue_reports as restrictive for update to authenticated using(admin_private.has_permission('health.manage_errors')) with check(admin_private.has_permission('health.manage_errors'));
create or replace function admin_private.audit_issue_update() returns trigger language plpgsql security definer set search_path='' as $$ begin if auth.uid() is not null then perform admin_private.audit('issue.reviewed','issue',new.id::text,jsonb_build_object('previous_status',old.status,'status',new.status)); end if; return new; end $$;
revoke all on function admin_private.audit_issue_update() from public,anon,authenticated;
create trigger admin_issue_update_audit after update on public.issue_reports for each row execute function admin_private.audit_issue_update();
