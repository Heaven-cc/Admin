create or replace function public.admin_reserve_invite(p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_existing admin_private.invitations;
begin
 if not admin_private.has_permission('admin_team.invite') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or not exists(select 1 from admin_private.role_permissions where role_key=p_role) then raise exception 'Invalid invitation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)),0));
 select * into v_existing from admin_private.invitations where email=lower(trim(p_email)) for update;
 if found then
  if v_existing.state='accepted' or exists(select 1 from public.admin_users where user_id=v_existing.auth_user_id and active) then raise exception 'Administrator already active'; end if;
  if v_existing.role_key<>p_role then raise exception 'Existing invitation role must be preserved'; end if;
  if v_existing.state='sent' and v_existing.created_at>now()-interval '60 seconds' then raise exception 'Wait before resending'; end if;
  update admin_private.invitations set state='pending',expires_at=now()+interval '72 hours',requested_by=auth.uid(),created_at=now() where id=v_existing.id returning id into v_id;
 else
  insert into admin_private.invitations(email,role_key,requested_by) values(lower(trim(p_email)),p_role,auth.uid()) returning id into v_id;
 end if;
 perform admin_private.audit('admin.invite_requested','invitation',v_id::text,jsonb_build_object('role',p_role)); return v_id;
end $$;
create or replace function public.admin_complete_invite(p_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v admin_private.invitations;
begin
 select * into v from admin_private.invitations where id=p_id and state='pending' and expires_at>now() for update; if not found then raise exception 'Invitation unavailable'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and lower(email)=v.email) then raise exception 'Identity mismatch'; end if;
 if exists(select 1 from public.admin_users where user_id=p_user_id and (active or role_key is distinct from v.role_key)) then raise exception 'Existing administrator cannot be changed by an invitation'; end if;
 insert into public.admin_users(user_id,role,role_key,active,display_name,require_mfa) values(p_user_id,case v.role_key when 'technical_admin' then 'engineering_admin'::public.admin_role when 'finance_admin' then 'analytics_admin'::public.admin_role when 'read_only_analyst' then 'analytics_admin'::public.admin_role else v.role_key::public.admin_role end,v.role_key,false,v.email,true) on conflict(user_id) do nothing;
 update admin_private.invitations set state='sent',auth_user_id=p_user_id where id=p_id;
end $$;
