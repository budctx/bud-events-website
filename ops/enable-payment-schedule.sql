-- OPERATOR RUNBOOK ONLY, NOT A MIGRATION. NEVER EXECUTED AUTOMATICALLY.
-- Preconditions: verified real backup, three reviewed live migrations, reviewed deployment,
-- pg_cron + pg_net enabled separately, and a dedicated CRON_SECRET saved privately in both
-- Vercel Production and Vault as bud_payment_worker_token. Never store a service_role key here.
-- pg_net temporarily stores the outgoing bearer token in its request queue: review DB-login access first.
-- After explicit scheduling approval, SET bud.operator_schedule_approved='yes' for this session.
begin;
do $operator$
declare v_name text; v_path text; v_command text; v_existing record;
begin
 if current_setting('bud.operator_schedule_approved',true) is distinct from 'yes' then raise exception 'BUD_SCHEDULE_REQUIRES_OPERATOR_APPROVAL'; end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') or not exists(select 1 from pg_extension where extname='pg_net') then raise exception 'BUD_SCHEDULE_EXTENSIONS_NOT_READY'; end if;
 if to_regprocedure('public.bud_live_operations_health()') is null then raise exception 'BUD_OPERATIONS_SCHEMA_NOT_READY'; end if;
 if (select count(*) from vault.decrypted_secrets where name='bud_payment_worker_token' and decrypted_secret ~ '^[A-Za-z0-9_-]{32,128}$')<>1 then raise exception 'BUD_WORKER_TOKEN_NOT_READY'; end if;
 foreach v_path in array array['payment-worker','payment-reconcile'] loop
  v_name:='bud-'||v_path;
  v_command:=format($command$select net.http_get(
   url:='https://bud-events-website.vercel.app/api/%s',
   headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='bud_payment_worker_token')),
   timeout_milliseconds:=60000);$command$,v_path);
  select schedule,command into v_existing from cron.job where jobname=v_name;
  if found then
   if v_existing.schedule is distinct from '* * * * *' or v_existing.command is distinct from v_command then raise exception 'BUD_EXISTING_SCHEDULE_DIFFERS_REVIEW_REQUIRED'; end if;
  else perform cron.schedule(v_name,'* * * * *',v_command);
  end if;
 end loop;
end;
$operator$;
commit;
-- Inspect cron.job_run_details AND net._http_response: SQL enqueue success is not HTTP/worker success.
-- Poll the protected /api/payment-worker?health=1 with Authorization in a HEADER, never a URL.
-- Alert on a non-2xx health response, stale worker, review queue, old pending job or unreconciled order.
-- Pausing new purchases must leave these drain/reconciliation schedules running.
