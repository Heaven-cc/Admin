create or replace function public.admin_reporting_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not admin_private.has_permission('dashboard.view') and not admin_private.has_permission('businesses.read') and not admin_private.has_permission('health.read') then return null; end if;
 return (select jsonb_build_object('last_success_at',last_success_at,'status',status) from public.sync_state where pipeline='production_reporting');
end $$;
revoke all on function public.admin_reporting_status() from public,anon,authenticated;
grant execute on function public.admin_reporting_status() to authenticated;
