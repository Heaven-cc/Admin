create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('trexven-admin-production-reporting','*/5 * * * *', $job$
 select net.http_post(url:='https://tsnkzkpgxvomfuzyeyup.supabase.co/functions/v1/sync-production',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='trexven_admin_cron_token')),body:='{}'::jsonb,timeout_milliseconds:=120000) where exists(select 1 from admin_private.pipeline_config where id and enabled);
$job$);
