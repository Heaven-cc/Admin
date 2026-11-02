create or replace function public.admin_activate_invitation(p_name text) returns void language plpgsql security definer set search_path='' as $$
 begin if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_name is null or length(trim(p_name)) not between 2 and 120 then raise exception 'MFA and name required'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and encrypted_password is not null and length(encrypted_password)>0) then raise exception 'Set an administrator password before activation'; end if;
 if not exists(select 1 from admin_private.invitations where auth_user_id=auth.uid() and state='sent' and expires_at>now()) then raise exception 'Valid invitation required'; end if;
 update public.admin_users set active=true,display_name=trim(p_name),invitation_accepted_at=now() where user_id=auth.uid() and not active;
 update admin_private.invitations set state='accepted' where auth_user_id=auth.uid() and state='sent'; perform admin_private.audit('admin.invite_accepted','admin',auth.uid()::text); end
$$;
