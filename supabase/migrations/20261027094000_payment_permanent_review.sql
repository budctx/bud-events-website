-- Terminal review for deterministic provider/payment contract conflicts.
-- Expand the existing safe, fixed retry-code enum before the worker can write PAYMENT_REVIEW.
alter table bud_platform.live_payment_jobs drop constraint live_payment_jobs_last_code_check;
alter table bud_platform.live_payment_jobs add constraint live_payment_jobs_last_code_check
check (last_code in ('PROVIDER_RETRY','PAYMENT_RETRY','PAYMENT_REVIEW','BACKEND_RETRY','ATTEMPTS_EXHAUSTED'));

-- Existing transient retry/backoff, service-only grants, and ledger fencing remain unchanged.
create or replace function public.bud_live_retry_payment(p_message text, p_lease uuid, p_code text)
returns jsonb language plpgsql set search_path to ''
as $function$
declare v_job bud_platform.live_payment_jobs;
begin
 if p_code is null or p_code not in ('PROVIDER_RETRY','PAYMENT_RETRY','PAYMENT_REVIEW','BACKEND_RETRY')
 then raise exception 'BUD_INVALID_LIVE_RETRY'; end if;
 select * into v_job from bud_platform.live_payment_jobs where message_id=p_message for update;
 if not found or v_job.status<>'processing' or v_job.lease_token is distinct from p_lease
    or v_job.lease_until<=clock_timestamp() then raise exception 'BUD_LIVE_LEASE_LOST'; end if;
 update bud_platform.live_payment_jobs
 set status=case when p_code='PAYMENT_REVIEW' or attempts>=12 then 'review' else 'pending' end,
     available_at=clock_timestamp()+make_interval(secs=>least(1800,30*power(2,attempts-1))::int),
     lease_token=null,lease_until=null,
     last_code=case when p_code='PAYMENT_REVIEW' then 'PAYMENT_REVIEW'
                    when attempts>=12 then 'ATTEMPTS_EXHAUSTED' else p_code end,
     updated_at=clock_timestamp()
 where message_id=p_message;
 return jsonb_build_object('recorded',true);
end;
$function$;
revoke all on function public.bud_live_retry_payment(text,uuid,text) from public,anon,authenticated;
grant execute on function public.bud_live_retry_payment(text,uuid,text) to service_role;
