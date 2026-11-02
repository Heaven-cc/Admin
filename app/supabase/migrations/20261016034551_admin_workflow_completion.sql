-- Administrator directory and self-service invitation state; authorization remains database-owned.
create or replace function public.admin_login_state() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',u.active,'name',u.display_name,'invited',exists(select 1 from admin_private.invitations i where i.auth_user_id=u.user_id and i.state='sent' and i.expires_at>now())) from public.admin_users u where u.user_id=auth.uid()
$$;
create or replace function public.admin_team_directory() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not admin_private.has_permission('admin_team.read') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'display_name',u.display_name,'email',a.email,'role_key',u.role_key,'active',u.active,'invitation_accepted_at',u.invitation_accepted_at,'mfa',exists(select 1 from auth.mfa_factors f where f.user_id=u.user_id and f.status='verified'),'last_login_at',a.last_sign_in_at)) from public.admin_users u join auth.users a on a.id=u.user_id),'[]'::jsonb); end $$;
create or replace function public.admin_reporting_freshness() returns timestamptz language plpgsql stable security definer set search_path='' as $$
begin if not admin_private.has_permission('dashboard.view') and not admin_private.has_permission('businesses.read') and not admin_private.has_permission('health.read') then return null; end if; return (select last_success_at from public.sync_state where pipeline='production_reporting'); end $$;
create or replace function public.admin_bootstrap_details(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(i) from admin_private.invitations i where i.id=p_id and i.requested_by is null and i.role_key='super_admin' and i.state='pending' and i.expires_at>now() and not exists(select 1 from public.admin_users)
$$;
create or replace function public.admin_invitation_failed(p_id uuid) returns void language sql security definer set search_path='' as $$ update admin_private.invitations set state='failed' where id=p_id and state='pending' $$;
create or replace function public.admin_price_draft(p_country text,p_plan text,p_minor bigint,p_effective date) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_currency text; v_version int;
begin
 if not admin_private.has_permission('pricing.update') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_country not in ('NG','GH','TG','CI') or p_plan not in ('start','core','pro') or p_minor is null or p_minor<0 or p_effective is null or p_effective<current_date then raise exception 'INVALID_PRICE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_country||':'||p_plan,0));
 v_currency:=case p_country when 'NG' then 'NGN' when 'GH' then 'GHS' else 'XOF' end;
 select coalesce(max(version),0)+1 into v_version from public.admin_country_prices where country_code=p_country and plan_key=p_plan;
 insert into public.admin_country_prices(country_code,plan_key,currency,amount_minor,effective_from,version,active) values(p_country,p_plan,v_currency,p_minor,p_effective,v_version,false) returning id into v_id;
 perform admin_private.audit('pricing.draft_created','price',v_id::text,jsonb_build_object('country',p_country,'plan',p_plan,'version',v_version)); return v_id;
end $$;
create index admin_incident_timeline_parent on public.admin_incident_timeline(incident_id,occurred_at);
create index admin_dataset_versions_parent on public.admin_dataset_versions(dataset_id,version);
revoke all on function public.admin_login_state(),public.admin_team_directory(),public.admin_reporting_freshness(),public.admin_bootstrap_details(uuid),public.admin_invitation_failed(uuid),public.admin_price_draft(text,text,bigint,date) from public,anon,authenticated;
grant execute on function public.admin_login_state(),public.admin_team_directory(),public.admin_reporting_freshness(),public.admin_price_draft(text,text,bigint,date) to authenticated;
grant execute on function public.admin_bootstrap_details(uuid),public.admin_invitation_failed(uuid) to service_role;
