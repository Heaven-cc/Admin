-- Server-only business operations. Installation does not change any existing business state.
create table private.admin_business_control(
 business_id uuid primary key,business_ref uuid not null unique,state text not null check(state in('active','suspended','deleting','deleted')),
 action_id uuid not null,updated_at timestamptz not null default now()
);
create table private.admin_business_receipts(
 id uuid primary key,business_id uuid not null,business_ref uuid not null,action text not null,actor_id uuid not null,
 intent jsonb not null,intent_hash text not null,state text not null,finished boolean not null default false,created_at timestamptz not null default now(),completed_at timestamptz
);
create table private.admin_business_objects(action_id uuid not null,bucket text not null,name text not null,primary key(action_id,bucket,name));
create table private.admin_business_media_scopes(scope_id uuid primary key,business_id uuid not null);
alter table private.admin_business_control enable row level security;
alter table private.admin_business_receipts enable row level security;
alter table private.admin_business_objects enable row level security;
alter table private.admin_business_media_scopes enable row level security;
revoke all on private.admin_business_control,private.admin_business_receipts,private.admin_business_objects,private.admin_business_media_scopes from public,anon,authenticated;
grant all on private.admin_business_control,private.admin_business_receipts,private.admin_business_objects,private.admin_business_media_scopes to service_role;
create or replace function private.admin_business_access_allowed(p_business uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_business is null or not exists(select 1 from private.admin_business_control where business_id=p_business and state in('suspended','deleting','deleted'))
$$;
revoke all on function private.admin_business_access_allowed(uuid) from public;
grant execute on function private.admin_business_access_allowed(uuid) to authenticated;
create or replace function public.user_owns_business(target_business_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.admin_business_access_allowed(target_business_id) and public.trexven_account_access_allowed() and private.account_deletion_previous_user_owns_business(target_business_id)
$$;
create or replace function public.is_business_member(target_business_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.admin_business_access_allowed(target_business_id) and public.trexven_account_access_allowed() and private.account_deletion_previous_is_business_member(target_business_id)
$$;
create or replace function private.has_business_permission(business uuid,permission text) returns boolean language sql stable security definer set search_path='' as $$
 select private.admin_business_access_allowed(business) and public.trexven_account_access_allowed() and private.account_deletion_previous_has_business_permission(business,permission)
$$;
create or replace function private.admin_record_business(p_table text,p_row jsonb) returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 case p_table
 when 'public.businesses' then return (p_row->>'id')::uuid;
 when 'public.angel_messages' then return (select q.business_id from public.angel_conversations q where q.id=(p_row->>'conversation_id')::uuid);
 when 'public.cash_register_assignments' then return (select q.business_id from public.cash_registers q where q.id=(p_row->>'register_id')::uuid);
 when 'public.cash_shift_members' then return (select q.business_id from public.cash_shifts q where q.id=(p_row->>'shift_id')::uuid);
 when 'public.employee_permissions' then return (select q.business_id from public.employees q where q.id=(p_row->>'employee_id')::uuid);
 when 'public.return_items' then return (select q.business_id from public.sale_returns q where q.id=(p_row->>'return_id')::uuid);
 when 'public.stocktake_counts' then return (select q.business_id from public.stocktake_sessions q where q.id=(p_row->>'session_id')::uuid);
 when 'public.sale_items' then return (select q.business_id from public.sales q where q.id=(p_row->>'sale_id')::uuid);
 else return (p_row->>'business_id')::uuid;
 end case;
end $$;
revoke all on function private.admin_record_business(text,jsonb) from public;
grant execute on function private.admin_record_business(text,jsonb) to authenticated;
create or replace function private.admin_guard_business_write() returns trigger language plpgsql security definer set search_path='' as $$
declare v_business uuid; v_bypass text:=current_setting('trexven.admin_business_action',true);
begin
 if tg_op<>'INSERT' then
  v_business:=private.admin_record_business(tg_table_schema||'.'||tg_table_name,to_jsonb(old));
  if not private.admin_business_access_allowed(v_business)
  and not (auth.role()='service_role' and exists(select 1 from private.admin_business_control where business_id=v_business and state='suspended'))
  and not (auth.role()='service_role' and exists(select 1 from private.admin_business_receipts where id=nullif(v_bypass,'')::uuid and business_id=v_business and action='delete' and not finished)) then raise exception 'BUSINESS_ACCESS_DISABLED' using errcode='42501'; end if;
 end if;
 if tg_op<>'DELETE' then
  v_business:=private.admin_record_business(tg_table_schema||'.'||tg_table_name,to_jsonb(new));
  if not private.admin_business_access_allowed(v_business)
  and not (auth.role()='service_role' and exists(select 1 from private.admin_business_control where business_id=v_business and state='suspended'))
  and not (auth.role()='service_role' and exists(select 1 from private.admin_business_receipts where id=nullif(v_bypass,'')::uuid and business_id=v_business and action='delete' and not finished)) then raise exception 'BUSINESS_ACCESS_DISABLED' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function private.admin_guard_business_write() from public,anon,authenticated;
create policy admin_business_boundary on public.businesses as restrictive for all to authenticated using(private.admin_business_access_allowed(id)) with check(private.admin_business_access_allowed(id));
create policy admin_business_boundary on public.angel_conversations as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.camera_zones as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.audit_logs as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.branches as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.business_settings as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.business_members as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.camera_health_logs as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.expenses as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.business_subscriptions as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.billing_sessions as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cash_transactions as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.camera_detections as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.subscription_change_requests as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cameras as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cash_events as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.offline_sale_reconciliations as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.credit_approvals as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.employees as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.inventory_movements as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.credit_limits as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cash_handovers as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cash_registers as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.camera_ai_jobs as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.trexven_notification_reads as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.application_error_events as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.credit_entries as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.supplier_stock_returns as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.stock_condition_entries as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.employee_activity as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cash_shifts as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.alerts as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.account_lifecycle_requests as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.operational_backup_status as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.billing_invoices as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.stock_transfers as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.camera_events as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.sale_returns as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.business_activity as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.inventory as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.camera_event_links as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.billing_payments as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.stocktake_sessions as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.sale_payments as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.sales as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.financial_transactions as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.credit_accounts as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.inventory_reconciliation_reviews as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.billing_customers as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.products as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.angel_insights as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.subscription_events as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.recordings as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.product_groups as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.cash_shift_members as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.cash_shift_members',jsonb_build_object('shift_id',shift_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.cash_shift_members',jsonb_build_object('shift_id',shift_id))));
create policy admin_business_boundary on public.cash_register_assignments as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.cash_register_assignments',jsonb_build_object('register_id',register_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.cash_register_assignments',jsonb_build_object('register_id',register_id))));
create policy admin_business_boundary on public.employee_permissions as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.employee_permissions',jsonb_build_object('employee_id',employee_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.employee_permissions',jsonb_build_object('employee_id',employee_id))));
create policy admin_business_boundary on public.sale_items as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.sale_items',jsonb_build_object('sale_id',sale_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.sale_items',jsonb_build_object('sale_id',sale_id))));
create policy admin_business_boundary on public.stocktake_counts as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.stocktake_counts',jsonb_build_object('session_id',session_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.stocktake_counts',jsonb_build_object('session_id',session_id))));
create policy admin_business_boundary on public.employee_branch_assignments as restrictive for all to authenticated using(private.admin_business_access_allowed(business_id)) with check(private.admin_business_access_allowed(business_id));
create policy admin_business_boundary on public.return_items as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.return_items',jsonb_build_object('return_id',return_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.return_items',jsonb_build_object('return_id',return_id))));
create policy admin_business_boundary on public.angel_messages as restrictive for all to authenticated using(private.admin_business_access_allowed(private.admin_record_business('public.angel_messages',jsonb_build_object('conversation_id',conversation_id)))) with check(private.admin_business_access_allowed(private.admin_record_business('public.angel_messages',jsonb_build_object('conversation_id',conversation_id))));
create trigger admin_business_write_boundary before insert or update or delete on public.businesses for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.angel_conversations for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.camera_zones for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.audit_logs for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.branches for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.business_settings for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.business_members for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.camera_health_logs for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.expenses for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.business_subscriptions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.billing_sessions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_transactions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.camera_detections for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.subscription_change_requests for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cameras for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_events for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.offline_sale_reconciliations for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.credit_approvals for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.employees for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on private.catalog_requests for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on private.angel_catalog_actions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.inventory_movements for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.credit_limits for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_handovers for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_registers for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.camera_ai_jobs for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.trexven_notification_reads for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.application_error_events for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.credit_entries for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.supplier_stock_returns for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.stock_condition_entries for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.employee_activity for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_shifts for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.alerts for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.account_lifecycle_requests for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.operational_backup_status for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.billing_invoices for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.stock_transfers for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.camera_events for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.sale_returns for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.business_activity for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.inventory for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on private.operation_cancellations for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on private.offline_cash_leases for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.camera_event_links for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.billing_payments for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.stocktake_sessions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.sale_payments for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on private.sale_requests for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.sales for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.financial_transactions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.credit_accounts for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.inventory_reconciliation_reviews for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.billing_customers for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.products for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.angel_insights for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.subscription_events for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.recordings for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.product_groups for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on private.catalog_low_stock_state for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_shift_members for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.cash_register_assignments for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.employee_permissions for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.sale_items for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.stocktake_counts for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.employee_branch_assignments for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.return_items for each row execute function private.admin_guard_business_write();
create trigger admin_business_write_boundary before insert or update or delete on public.angel_messages for each row execute function private.admin_guard_business_write();
create or replace function private.admin_uri_decode(p_value text) returns text language plpgsql immutable set search_path='' as $$
declare v_bytes bytea:=''::bytea; i integer:=1; c text;
begin
 if p_value is null or length(p_value)>4096 then return null; end if;
 while i<=length(p_value) loop
  c:=substr(p_value,i,1);
  if c='%' then
   if substr(p_value,i+1,2)!~'^[0-9A-Fa-f]{2}$' then return null; end if;
   v_bytes:=v_bytes||decode(substr(p_value,i+1,2),'hex');i:=i+3;
  else v_bytes:=v_bytes||convert_to(c,'UTF8');i:=i+1;end if;
 end loop;
 return convert_from(v_bytes,'UTF8');
exception when others then return null;
end $$;
revoke all on function private.admin_uri_decode(text) from public,anon,authenticated;
create or replace function private.admin_file_url(p_url text) returns table(bucket text,name text) language sql immutable set search_path='' as $$
 select private.admin_uri_decode(m[1]),private.admin_uri_decode(m[2]) from regexp_match(p_url,'^https://ufehcfrlygqvminfjumf[.]supabase[.]co/storage/v1/object/(?:public/|sign/|authenticated/)?([^/]+)/([^?]+)') m
$$;
revoke all on function private.admin_file_url(text) from public,anon,authenticated;
create or replace function private.admin_business_file_refs() returns table(business_id uuid,bucket text,name text) language sql stable security definer set search_path='' as $$
 select r.business_id,'recordings'::text,r.storage_path from public.recordings r where r.storage_path is not null
 union all
 select src.business_id,f.bucket,f.name from (
 select b.id business_id,b.logo_url url from public.businesses b
 union all select p.business_id,p.image_url from public.products p
 union all select e.business_id,e.image_url from public.camera_events e
 union all select e.business_id,e.video_url from public.camera_events e
 union all select r.business_id,r.playback_url from public.recordings r
 union all select j.business_id,j.input_url from public.camera_ai_jobs j
 ) src cross join lateral private.admin_file_url(src.url) f where f.bucket is not null and f.name is not null
$$;
revoke all on function private.admin_business_file_refs() from public,anon,authenticated;
create or replace function private.admin_refresh_business_objects(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_business uuid;
begin
 select business_id into v_business from private.admin_business_receipts where id=p_id and action='delete' and state='deleting';
 if not found then raise exception 'DELETE_NOT_PREPARED'; end if;
 insert into private.admin_business_objects(action_id,bucket,name)
 select p_id,o.bucket_id,o.name from storage.objects o where
 (exists(select 1 from private.admin_business_file_refs() f where f.business_id=v_business and f.bucket=o.bucket_id and f.name=o.name)
 or exists(select 1 from regexp_split_to_table(o.name,'/') segment join private.admin_business_media_scopes s on s.scope_id::text=split_part(segment,'.',1) where s.business_id=v_business))
 and not exists(select 1 from private.admin_business_file_refs() f where f.business_id<>v_business and f.bucket=o.bucket_id and f.name=o.name)
 on conflict do nothing;
end $$;
revoke all on function private.admin_refresh_business_objects(uuid) from public,anon,authenticated;
create or replace function private.admin_storage_business_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from regexp_split_to_table(new.name,'/') segment join private.admin_business_media_scopes s on s.scope_id::text=split_part(segment,'.',1)
 join private.admin_business_control b on b.business_id=s.business_id where b.state in('deleting','deleted'))
 or exists(select 1 from private.admin_business_file_refs() f join private.admin_business_control b on b.business_id=f.business_id where f.bucket=new.bucket_id and f.name=new.name and b.state in('deleting','deleted')) then
 raise exception 'BUSINESS_DELETION_IN_PROGRESS' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.admin_storage_business_guard() from public,anon,authenticated;
create trigger admin_business_storage_boundary before insert on storage.objects for each row execute function private.admin_storage_business_guard();
create or replace function public.trexven_admin_business_prepare(p_intent jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=(p_intent->>'id')::uuid; v_ref uuid:=(p_intent->>'business_ref')::uuid; v_actor uuid:=(p_intent->>'actor_id')::uuid;
 v_action text:=p_intent->>'action'; v_role text:=p_intent->>'actor_role'; v_business uuid; v_name text; v_key text;
 v private.admin_business_receipts%rowtype; v_state text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_id is null or v_ref is null or v_actor is null or v_action is null or v_role is null or p_intent->>'authorized_at' is null or v_action not in('suspend','restore','delete') or v_role not in('super_admin','operations_admin')
 or (v_action='delete' and v_role<>'super_admin') or length(coalesce(p_intent->>'reason','')) not between 8 and 2000
 or (p_intent->>'authorized_at')::timestamptz not between now()-interval '2 minutes' and now()+interval '10 seconds' then raise exception 'INVALID_AUTHORIZED_INTENT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_ref::text||':admin-control',0));
 select * into v from private.admin_business_receipts where id=v_id for update;
 if found then
  if v.intent_hash is distinct from encode(extensions.digest((p_intent-'authorized_at')::text,'sha256'),'hex') then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('id',v.id,'business_ref',v.business_ref,'action',v.action,'state',v.state,'finished',v.finished);
 end if;
 select pseudonym_key into v_key from private.admin_reporting_config where id;
 if v_key is null then raise exception 'BUSINESS_MAPPING_UNAVAILABLE'; end if;
 select id,business_name into v_business,v_name from public.businesses where md5('business:'||id::text||v_key)::uuid=v_ref for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
 if p_intent->>'confirmation' is distinct from v_name then raise exception 'BUSINESS_CHANGED'; end if;
 if exists(select 1 from private.admin_business_control where business_id=v_business and state in('deleting','deleted')) then raise exception 'DELETE_IN_PROGRESS'; end if;
 v_state:=case v_action when 'suspend' then 'suspended' when 'restore' then 'active' else 'deleting' end;
 insert into private.admin_business_receipts(id,business_id,business_ref,action,actor_id,intent,intent_hash,state,finished,completed_at)
 values(v_id,v_business,v_ref,v_action,v_actor,p_intent-'authorized_at',encode(extensions.digest((p_intent-'authorized_at')::text,'sha256'),'hex'),v_state,v_action<>'delete',case when v_action<>'delete' then now() end);
 insert into private.admin_business_control(business_id,business_ref,state,action_id) values(v_business,v_ref,v_state,v_id)
 on conflict(business_id) do update set state=excluded.state,action_id=excluded.action_id,updated_at=now();
 if v_action='delete' then
  insert into private.admin_business_media_scopes(scope_id,business_id)
  select id,v_business from public.businesses where id=v_business
  union select id,v_business from public.cameras where business_id=v_business
  union select id,v_business from public.camera_events where business_id=v_business
  union select id,v_business from public.recordings where business_id=v_business
  union select id,v_business from public.products where business_id=v_business on conflict do nothing;
  perform private.admin_refresh_business_objects(v_id);
 end if;
 return jsonb_build_object('id',v_id,'business_ref',v_ref,'action',v_action,'state',v_state,'finished',v_action<>'delete');
end $$;
revoke all on function public.trexven_admin_business_prepare(jsonb) from public,anon,authenticated;
grant execute on function public.trexven_admin_business_prepare(jsonb) to service_role;
create or replace function public.trexven_admin_business_objects(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform private.admin_refresh_business_objects(p_id);
 return coalesce((select jsonb_agg(jsonb_build_object('bucket',bucket,'name',name)) from
 (select m.bucket,m.name from private.admin_business_objects m join storage.objects o on o.bucket_id=m.bucket and o.name=m.name where m.action_id=p_id order by m.bucket,m.name limit 100) files),'[]'::jsonb);
end $$;
revoke all on function public.trexven_admin_business_objects(uuid) from public,anon,authenticated;
grant execute on function public.trexven_admin_business_objects(uuid) to service_role;
create or replace function public.trexven_admin_business_finalize(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.admin_business_receipts%rowtype; v_business uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into v from private.admin_business_receipts where id=p_id for update;
 if not found or v.action<>'delete' then raise exception 'DELETE_NOT_PREPARED'; end if;
 if v.finished then return jsonb_build_object('id',v.id,'business_ref',v.business_ref,'action',v.action,'state',v.state,'finished',true); end if;
 v_business:=v.business_id;
 perform 1 from public.businesses where id=v_business for update;
 perform private.admin_refresh_business_objects(p_id);
 if exists(select 1 from private.admin_business_objects m join storage.objects o on o.bucket_id=m.bucket and o.name=m.name where m.action_id=p_id) then
 return jsonb_build_object('id',v.id,'business_ref',v.business_ref,'action',v.action,'state','deleting','finished',false); end if;
 if exists(select 1 from public.inventory c join public.branches p on c.branch_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory c join public.products p on c.product_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cameras c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.operation_cancellations c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_shifts c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_shifts c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_shifts c join public.cash_registers p on c.register_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employee_branch_assignments c join public.branches p on c.branch_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employee_branch_assignments c join public.employees p on c.employee_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_events c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_events c join public.business_members p on c.member_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_events c join public.cash_shifts p on c.shift_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.offline_cash_leases c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.offline_cash_leases c join public.business_members p on c.member_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.offline_sale_reconciliations c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.offline_sale_reconciliations c join private.offline_cash_leases p on c.lease_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.offline_sale_reconciliations c join public.sales p on c.sale_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.alerts c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.account_lifecycle_requests c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_shift_members c join public.business_members p on c.member_id=p.id where p.business_id=v_business and (select q.business_id from public.cash_shifts q where q.id=c.shift_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_shift_members c join public.cash_shifts p on c.shift_id=p.id where p.business_id=v_business and (select q.business_id from public.cash_shifts q where q.id=c.shift_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_approvals c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_approvals c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employees c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.catalog_requests c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.angel_conversations c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_event_links c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_event_links c join public.camera_events p on c.camera_event_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.billing_payments c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.billing_payments c join public.billing_sessions p on c.session_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_zones c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_zones c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_payments c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_payments c join public.sales p on c.sale_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stocktake_sessions c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stocktake_sessions c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.audit_logs c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.audit_logs c join public.employees p on c.target_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.sale_requests c join public.branches p on c.branch_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.sale_requests c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.operational_backup_status c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.branches c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employee_permissions c join public.employees p on c.employee_id=p.id where p.business_id=v_business and (select q.business_id from public.employees q where q.id=c.employee_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sales c join public.branches p on c.branch_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sales c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sales c join public.business_members p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_movements c join public.branches p on c.branch_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_movements c join public.products p on c.product_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_movements c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_movements c join public.business_members p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_movements c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.angel_catalog_actions c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.angel_catalog_actions c join public.angel_conversations p on c.conversation_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.angel_catalog_actions c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_limits c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_limits c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.financial_transactions c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.financial_transactions c join public.employees p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.business_settings c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_items c join public.products p on c.product_id=p.id where p.business_id=v_business and (select q.business_id from public.sales q where q.id=c.sale_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_items c join public.sales p on c.sale_id=p.id where p.business_id=v_business and (select q.business_id from public.sales q where q.id=c.sale_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_accounts c join public.credit_approvals p on c.approval_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_accounts c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_accounts c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_accounts c join public.sales p on c.sale_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_handovers c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_handovers c join public.business_members p on c.incoming_member=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_handovers c join public.business_members p on c.outgoing_member=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_handovers c join public.cash_shifts p on c.shift_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_registers c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_registers c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.business_members c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_reconciliation_reviews c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_reconciliation_reviews c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_reconciliation_reviews c join public.sales p on c.sale_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.inventory_reconciliation_reviews c join public.stocktake_sessions p on c.session_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.billing_customers c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.billing_invoices c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.billing_invoices c join public.billing_payments p on c.payment_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_ai_jobs c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_ai_jobs c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.products c join public.product_groups p on c.catalog_group_id=p.id and c.business_id=p.business_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.products c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stock_transfers c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stock_transfers c join public.branches p on c.destination_branch=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stock_transfers c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stock_transfers c join public.branches p on c.source_branch=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_health_logs c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_health_logs c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.return_items c join public.sale_returns p on c.return_id=p.id where p.business_id=v_business and (select q.business_id from public.sale_returns q where q.id=c.return_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.return_items c join public.sale_items p on c.sale_item_id=p.id where (select q.business_id from public.sales q where q.id=p.sale_id)=v_business and (select q.business_id from public.sale_returns q where q.id=c.return_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.trexven_notification_reads c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.expenses c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.expenses c join public.business_members p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.business_subscriptions c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.angel_insights c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stocktake_counts c join public.products p on c.product_id=p.id where p.business_id=v_business and (select q.business_id from public.stocktake_sessions q where q.id=c.session_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stocktake_counts c join public.stocktake_sessions p on c.session_id=p.id where p.business_id=v_business and (select q.business_id from public.stocktake_sessions q where q.id=c.session_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.subscription_events c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.recordings c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.recordings c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.billing_sessions c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_events c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_events c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_events c join public.business_members p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_register_assignments c join public.business_members p on c.member_id=p.id where p.business_id=v_business and (select q.business_id from public.cash_registers q where q.id=c.register_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_register_assignments c join public.cash_registers p on c.register_id=p.id where p.business_id=v_business and (select q.business_id from public.cash_registers q where q.id=c.register_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_transactions c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.cash_transactions c join public.business_members p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_detections c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_detections c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_detections c join public.employees p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_detections c join public.camera_events p on c.event_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.camera_detections c join public.camera_zones p on c.zone_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.product_groups c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.application_error_events c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_returns c join public.branches p on c.branch_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_returns c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.sale_returns c join public.sales p on c.sale_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_entries c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.credit_entries c join public.credit_accounts p on c.sale_id=p.sale_id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.catalog_low_stock_state c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from private.catalog_low_stock_state c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.business_activity c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.business_activity c join public.business_members p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.supplier_stock_returns c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.supplier_stock_returns c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stock_condition_entries c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.stock_condition_entries c join public.products p on c.product_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.angel_messages c join public.angel_conversations p on c.conversation_id=p.id where p.business_id=v_business and (select q.business_id from public.angel_conversations q where q.id=c.conversation_id) is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employee_activity c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employee_activity c join public.cameras p on c.camera_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.employee_activity c join public.employees p on c.employee_id=p.id where p.business_id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 if exists(select 1 from public.subscription_change_requests c join public.businesses p on c.business_id=p.id where p.id=v_business and c.business_id is distinct from v_business) then raise exception 'CROSS_BUSINESS_REFERENCE'; end if;
 perform set_config('trexven.admin_business_action',p_id::text,true);
 update public.businesses set compatibility_branch_id=null where id=v_business;
 delete from private.angel_catalog_actions r where r.business_id=v_business;
 delete from private.catalog_low_stock_state r where r.business_id=v_business;
 delete from private.catalog_requests r where r.business_id=v_business;
 delete from private.operation_cancellations r where r.business_id=v_business;
 delete from private.sale_requests r where r.business_id=v_business;
 delete from public.account_lifecycle_requests r where r.business_id=v_business;
 delete from public.alerts r where r.business_id=v_business;
 delete from public.angel_insights r where r.business_id=v_business;
 delete from public.angel_messages r where (select q.business_id from public.angel_conversations q where q.id=r.conversation_id)=v_business;
 delete from public.application_error_events r where r.business_id=v_business;
 delete from public.audit_logs r where r.business_id=v_business;
 delete from public.billing_customers r where r.business_id=v_business;
 delete from public.billing_invoices r where r.business_id=v_business;
 delete from public.business_activity r where r.business_id=v_business;
 delete from public.business_settings r where r.business_id=v_business;
 delete from public.business_subscriptions r where r.business_id=v_business;
 delete from public.camera_ai_jobs r where r.business_id=v_business;
 delete from public.camera_detections r where r.business_id=v_business;
 delete from public.camera_event_links r where r.business_id=v_business;
 delete from public.camera_health_logs r where r.business_id=v_business;
 delete from public.cash_events r where r.business_id=v_business;
 delete from public.cash_handovers r where r.business_id=v_business;
 delete from public.cash_register_assignments r where (select q.business_id from public.cash_registers q where q.id=r.register_id)=v_business;
 delete from public.cash_shift_members r where (select q.business_id from public.cash_shifts q where q.id=r.shift_id)=v_business;
 delete from public.cash_transactions r where r.business_id=v_business;
 delete from public.credit_entries r where r.business_id=v_business;
 delete from public.credit_limits r where r.business_id=v_business;
 delete from public.employee_activity r where r.business_id=v_business;
 delete from public.employee_branch_assignments r where r.business_id=v_business;
 delete from public.employee_permissions r where (select q.business_id from public.employees q where q.id=r.employee_id)=v_business;
 delete from public.expenses r where r.business_id=v_business;
 delete from public.financial_transactions r where r.business_id=v_business;
 delete from public.inventory r where r.business_id=v_business;
 delete from public.inventory_movements r where r.business_id=v_business;
 delete from public.inventory_reconciliation_reviews r where r.business_id=v_business;
 delete from public.offline_sale_reconciliations r where r.business_id=v_business;
 delete from public.operational_backup_status r where r.business_id=v_business;
 delete from public.recordings r where r.business_id=v_business;
 delete from public.return_items r where (select q.business_id from public.sale_returns q where q.id=r.return_id)=v_business;
 delete from public.sale_payments r where r.business_id=v_business;
 delete from public.stock_condition_entries r where r.business_id=v_business;
 delete from public.stock_transfers r where r.business_id=v_business;
 delete from public.stocktake_counts r where (select q.business_id from public.stocktake_sessions q where q.id=r.session_id)=v_business;
 delete from public.subscription_change_requests r where r.business_id=v_business;
 delete from public.subscription_events r where r.business_id=v_business;
 delete from public.supplier_stock_returns r where r.business_id=v_business;
 delete from public.trexven_notification_reads r where r.business_id=v_business;
 delete from private.offline_cash_leases r where r.business_id=v_business;
 delete from public.angel_conversations r where r.business_id=v_business;
 delete from public.billing_payments r where r.business_id=v_business;
 delete from public.camera_events r where r.business_id=v_business;
 delete from public.camera_zones r where r.business_id=v_business;
 delete from public.cash_shifts r where r.business_id=v_business;
 delete from public.credit_accounts r where r.business_id=v_business;
 delete from public.employees r where r.business_id=v_business;
 delete from public.sale_items r where (select q.business_id from public.sales q where q.id=r.sale_id)=v_business;
 delete from public.sale_returns r where r.business_id=v_business;
 delete from public.stocktake_sessions r where r.business_id=v_business;
 delete from public.billing_sessions r where r.business_id=v_business;
 delete from public.cameras r where r.business_id=v_business;
 delete from public.cash_registers r where r.business_id=v_business;
 delete from public.credit_approvals r where r.business_id=v_business;
 delete from public.products r where r.business_id=v_business;
 delete from public.sales r where r.business_id=v_business;
 delete from public.branches r where r.business_id=v_business;
 delete from public.business_members r where r.business_id=v_business;
 delete from public.product_groups r where r.business_id=v_business;
 delete from public.businesses r where r.id=v_business;
 if exists(select 1 from public.businesses where id=v_business) then raise exception 'BUSINESS_DELETE_NOT_CONFIRMED'; end if;
 update private.admin_business_control set state='deleted',updated_at=now() where business_id=v_business;
 update private.admin_business_receipts set state='deleted',finished=true,completed_at=now(),intent=jsonb_build_object('id',id,'business_ref',business_ref,'action',action,'actor_id',actor_id) where id=p_id;
 delete from private.admin_business_objects where action_id=p_id;
 return jsonb_build_object('id',v.id,'business_ref',v.business_ref,'action',v.action,'state','deleted','finished',true);
end $$;
revoke all on function public.trexven_admin_business_finalize(uuid) from public,anon,authenticated;
grant execute on function public.trexven_admin_business_finalize(uuid) to service_role;

