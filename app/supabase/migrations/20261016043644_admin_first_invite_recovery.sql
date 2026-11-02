create or replace function public.admin_bootstrap_details(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(i) from admin_private.invitations i where i.id=p_id and i.requested_by is null and i.role_key='super_admin' and i.state='pending' and i.expires_at>now() and not exists(select 1 from public.admin_users u where u.active or u.user_id is distinct from i.auth_user_id)
$$;
revoke all on function public.admin_bootstrap_details(uuid) from public,anon,authenticated;
grant execute on function public.admin_bootstrap_details(uuid) to service_role;
