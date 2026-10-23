-- LOCAL PREPARATION ONLY. Backup/review gates precede any remote application.
begin;
-- enabled continues to control NEW checkout/order creation. Drain and event starts are independent.
alter table bud_platform.live_commerce_control add column fulfillment_enabled boolean not null default false;
alter table bud_platform.live_commerce_control add column host_enabled boolean not null default false;

create table bud_platform.live_payment_jobs (
 message_id text primary key check(message_id ~ '^msg_[A-Za-z0-9]{5,100}$'),
 payment_id text not null check(payment_id ~ '^pay_[A-Za-z0-9]{5,80}$'),
 status text not null default 'pending' check(status in ('pending','processing','done','review')),
 attempts smallint not null default 0 check(attempts between 0 and 12),
 available_at timestamptz not null default clock_timestamp(),
 lease_token uuid, lease_until timestamptz,
 last_code text check(last_code in ('PROVIDER_RETRY','PAYMENT_RETRY','BACKEND_RETRY','ATTEMPTS_EXHAUSTED')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check((status='processing')=(lease_token is not null and lease_until is not null)),
 check((lease_token is null)=(lease_until is null))
);
create index bud_live_jobs_due on bud_platform.live_payment_jobs(available_at,created_at) where status in ('pending','processing');
create index bud_live_jobs_payment on bud_platform.live_payment_jobs(payment_id);
alter table bud_platform.live_payment_jobs enable row level security;
revoke all on bud_platform.live_payment_jobs from public,anon,authenticated,service_role;
grant select,insert,update on bud_platform.live_payment_jobs to service_role;

-- Called only after a fresh raw signature/account/version check. Persist references, never raw provider/customer data.
create function public.bud_live_enqueue_payment(p_message text,p_payment text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_job bud_platform.live_payment_jobs;
begin
 if p_message is null or p_message !~ '^msg_[A-Za-z0-9]{5,100}$' or p_payment is null or p_payment !~ '^pay_[A-Za-z0-9]{5,80}$' then raise exception 'BUD_INVALID_LIVE_PAYMENT'; end if;
 insert into bud_platform.live_payment_jobs(message_id,payment_id) values(p_message,p_payment) on conflict(message_id) do nothing;
 select * into v_job from bud_platform.live_payment_jobs where message_id=p_message;
 if v_job.payment_id<>p_payment then raise exception 'BUD_LIVE_MESSAGE_REUSED'; end if;
 return jsonb_build_object('queued',true);
end;
$$;

create function public.bud_live_claim_payments(p_limit integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if not coalesce((select fulfillment_enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_FULFILLMENT_DISABLED'; end if;
 if p_limit is null or p_limit not between 1 and 5 then raise exception 'BUD_INVALID_LIVE_BATCH'; end if;
 update bud_platform.live_payment_jobs set status='review',lease_token=null,lease_until=null,last_code='ATTEMPTS_EXHAUSTED',updated_at=clock_timestamp()
 where status='processing' and lease_until<=clock_timestamp() and attempts>=12;
 with due as (
  select message_id from bud_platform.live_payment_jobs where attempts<12 and
   ((status='pending' and available_at<=clock_timestamp()) or (status='processing' and lease_until<=clock_timestamp()))
  order by available_at,created_at limit p_limit for update skip locked
 ), claimed as (
  update bud_platform.live_payment_jobs j set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),
   lease_until=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp()
  from due where j.message_id=due.message_id
  returning jsonb_build_object('messageId',j.message_id,'paymentId',j.payment_id,'leaseToken',j.lease_token) item
 ) select coalesce(jsonb_agg(item),'[]'::jsonb) into v_result from claimed;
 return v_result;
end;
$$;

create function public.bud_live_retry_payment(p_message text,p_lease uuid,p_code text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_job bud_platform.live_payment_jobs;
begin
 if p_code is null or p_code not in ('PROVIDER_RETRY','PAYMENT_RETRY','BACKEND_RETRY') then raise exception 'BUD_INVALID_LIVE_RETRY'; end if;
 select * into v_job from bud_platform.live_payment_jobs where message_id=p_message for update;
 if not found or v_job.status<>'processing' or v_job.lease_token is distinct from p_lease or v_job.lease_until<=clock_timestamp() then raise exception 'BUD_LIVE_LEASE_LOST'; end if;
 update bud_platform.live_payment_jobs set status=case when attempts>=12 then 'review' else 'pending' end,
  available_at=clock_timestamp()+make_interval(secs=>least(1800,30*power(2,attempts-1))::int),
  lease_token=null,lease_until=null,last_code=case when attempts>=12 then 'ATTEMPTS_EXHAUSTED' else p_code end,updated_at=clock_timestamp()
 where message_id=p_message;
 return jsonb_build_object('recorded',true);
end;
$$;

create function public.bud_live_finish_payment(p_message text,p_lease uuid,p_order uuid,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint,p_checkout text,p_payment text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_job bud_platform.live_payment_jobs; v_result jsonb;
begin
 select * into v_job from bud_platform.live_payment_jobs where message_id=p_message for update;
 if not found or v_job.status<>'processing' or v_job.lease_token is distinct from p_lease or v_job.lease_until<=clock_timestamp() then raise exception 'BUD_LIVE_LEASE_LOST'; end if;
 if v_job.payment_id is distinct from p_payment then raise exception 'BUD_LIVE_PAYMENT_MISMATCH'; end if;
 v_result:=public.bud_live_credit_purchase(p_order,p_company,p_product,p_plan,p_currency,p_amount,p_checkout,p_payment,p_message);
 update bud_platform.live_payment_jobs set status='done',lease_token=null,lease_until=null,last_code=null,updated_at=clock_timestamp() where message_id=p_message;
 return v_result;
end;
$$;

create function public.bud_live_queue_status() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('pending',count(*) filter(where status='pending'),'processing',count(*) filter(where status='processing'),
 'done',count(*) filter(where status='done'),'review',count(*) filter(where status='review'),
 'oldestPendingAt',min(created_at) filter(where status in ('pending','processing'))) from bud_platform.live_payment_jobs;
$$;
revoke all on function public.bud_live_enqueue_payment(text,text),public.bud_live_claim_payments(integer),public.bud_live_retry_payment(text,uuid,text),public.bud_live_finish_payment(text,uuid,uuid,text,text,text,text,bigint,text,text),public.bud_live_queue_status() from public,anon,authenticated;
grant execute on function public.bud_live_enqueue_payment(text,text),public.bud_live_claim_payments(integer),public.bud_live_retry_payment(text,uuid,text),public.bud_live_finish_payment(text,uuid,uuid,text,text,text,text,bigint,text,text),public.bud_live_queue_status() to service_role;

create or replace function public.bud_live_create_order(p_host uuid,p_key text,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint,p_locale text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.live_orders;
begin
 if not coalesce((select enabled and fulfillment_enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_COMMERCE_DISABLED'; end if;
 if p_host is null or p_key is null or p_key !~ '^[A-Za-z0-9_-]{16,100}$' or p_company is null or p_company !~ '^biz_[A-Za-z0-9]{5,80}$'
 or p_product is null or p_product !~ '^prod_[A-Za-z0-9]{5,80}$' or p_plan is null or p_plan !~ '^plan_[A-Za-z0-9]{5,80}$'
 or p_currency is distinct from 'sar' or p_amount is null or p_amount not between 1 and 99999999
 or p_locale is null or p_locale not in ('ar','en') then raise exception 'BUD_INVALID_LIVE_ORDER'; end if;
 insert into bud_platform.live_orders(host_id,request_key,company_id,product_id,plan_id,currency,amount_minor,locale)
 values(p_host,p_key,p_company,p_product,p_plan,p_currency,p_amount,p_locale) on conflict(host_id,request_key) do nothing;
 select * into v_order from bud_platform.live_orders where host_id=p_host and request_key=p_key for update;
 if v_order.company_id<>p_company or v_order.product_id<>p_product or v_order.plan_id<>p_plan or v_order.currency<>p_currency or v_order.amount_minor<>p_amount or v_order.locale<>p_locale then raise exception 'BUD_KEY_REUSED'; end if;
 return bud_platform.live_order(v_order.id);
end;
$$;

create or replace function public.bud_live_credit_purchase(p_order uuid,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint,p_checkout text,p_payment text,p_message text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.live_orders; v_delivery bud_platform.live_deliveries;
begin
 if not coalesce((select fulfillment_enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_FULFILLMENT_DISABLED'; end if;
 if p_payment is null or p_payment !~ '^pay_[A-Za-z0-9]{5,80}$' or p_message is null or p_message !~ '^msg_[A-Za-z0-9]{5,100}$' then raise exception 'BUD_INVALID_LIVE_PAYMENT'; end if;
 select * into v_order from bud_platform.live_orders where id=p_order for update;
 if not found then raise exception 'BUD_ORDER_NOT_FOUND'; end if;
 if v_order.company_id is distinct from p_company or v_order.product_id is distinct from p_product or v_order.plan_id is distinct from p_plan
 or v_order.currency is distinct from p_currency or v_order.amount_minor is distinct from p_amount or v_order.checkout_id is null
 or v_order.checkout_id is distinct from p_checkout then raise exception 'BUD_LIVE_PAYMENT_MISMATCH'; end if;
 insert into bud_platform.live_deliveries(message_id,payment_id,order_id) values(p_message,p_payment,p_order) on conflict(message_id) do nothing;
 select * into v_delivery from bud_platform.live_deliveries where message_id=p_message;
 if v_delivery.payment_id<>p_payment or v_delivery.order_id<>p_order then raise exception 'BUD_LIVE_MESSAGE_REUSED'; end if;
 if v_order.fulfilled_payment_id is not null then
  if v_order.fulfilled_payment_id<>p_payment then raise exception 'BUD_LIVE_ORDER_ALREADY_FULFILLED'; end if;
  return jsonb_build_object('credited',false,'replayed',true);
 end if;
 insert into bud_platform.live_wallets(host_id) values(v_order.host_id) on conflict do nothing;
 perform 1 from bud_platform.live_wallets where host_id=v_order.host_id for update;
 insert into bud_platform.live_credit_ledger(host_id,order_id,payment_id) values(v_order.host_id,p_order,p_payment);
 update bud_platform.live_wallets set credits=credits+1 where host_id=v_order.host_id;
 update bud_platform.live_orders set fulfilled_payment_id=p_payment,fulfilled_at=now() where id=p_order;
 return jsonb_build_object('credited',true,'replayed',false);
end;
$$;

create table bud_platform.live_events (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 100),
 start_key text not null check(start_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 phase text not null check(phase in ('live','prizes','closing','completed')), version bigint not null check(version>=1),
 started_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 state jsonb not null, start_fingerprint text not null check(start_fingerprint ~ '^[a-f0-9]{64}$'),
 content_version text not null references bud_platform.content_versions(id), pair_order jsonb not null,
 unique(host_id,start_key)
);
create unique index bud_one_active_live_event on bud_platform.live_events(host_id) where phase<>'completed';
create index bud_live_events_host_updated on bud_platform.live_events(host_id,updated_at desc);
create index bud_live_events_content on bud_platform.live_events(content_version);
create table bud_platform.live_event_debits (
 event_id uuid primary key references bud_platform.live_events(id) on delete restrict,
 host_id uuid not null references auth.users(id) on delete restrict,
 delta smallint not null default -1 check(delta=-1), created_at timestamptz not null default clock_timestamp()
);
create index bud_live_debits_host on bud_platform.live_event_debits(host_id,created_at desc);
create table bud_platform.live_action_receipts (
 event_id uuid not null references bud_platform.live_events(id) on delete restrict,
 request_key text not null check(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), action text not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(event_id,request_key)
);
alter table bud_platform.live_events enable row level security;
alter table bud_platform.live_event_debits enable row level security;
alter table bud_platform.live_action_receipts enable row level security;
revoke all on bud_platform.live_events,bud_platform.live_event_debits,bud_platform.live_action_receipts from public,anon,authenticated,service_role;
grant select,insert,update on bud_platform.live_events to service_role;
grant select,insert on bud_platform.live_event_debits,bud_platform.live_action_receipts to service_role;
create function bud_platform.expire_live_host_events(p_host uuid) returns void
language sql security invoker set search_path='' as $$
 update bud_platform.live_events set phase='completed',version=version+1,updated_at=clock_timestamp(),
 state=jsonb_set(jsonb_set(jsonb_set(state,'{phase}','"closing"'),'{deadline}','null'),'{pendingWinner}','false')
 where host_id=p_host and phase<>'completed' and state is not null and started_at + interval '4 hours' <= clock_timestamp();
$$;
revoke all on function bud_platform.expire_live_host_events(uuid) from public,anon,authenticated;
grant execute on function bud_platform.expire_live_host_events(uuid) to service_role;
create function bud_platform.live_host_event(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('eventId',e.id,'title',e.title,'phase',e.phase,'version',e.version,'state',e.state,
 'updatedAt',e.updated_at,'serverNow',floor(extract(epoch from statement_timestamp())*1000),
 'cards',jsonb_build_object('question',c.questions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)/jsonb_array_length(c.conditions))->>'ar',
 'condition',c.conditions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)%jsonb_array_length(c.conditions))->>'ar'),
 'cardsEn',jsonb_build_object('question',c.questions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)/jsonb_array_length(c.conditions))->>'en',
 'condition',c.conditions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)%jsonb_array_length(c.conditions))->>'en'))
 from bud_platform.live_events e join bud_platform.content_versions c on c.id=e.content_version where e.id=p_event;
$$;
revoke all on function bud_platform.live_host_event(uuid) from public,anon,authenticated;
grant execute on function bud_platform.live_host_event(uuid) to service_role;

create function public.bud_live_host_dashboard(p_host uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform bud_platform.expire_live_host_events(p_host);
 return jsonb_build_object('credits',coalesce((select credits from bud_platform.live_wallets where host_id=p_host),0),
 'events',coalesce((select jsonb_agg(bud_platform.live_host_event(e.id) order by e.updated_at desc) from (select * from bud_platform.live_events where host_id=p_host and state is not null order by updated_at desc limit 100) e),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slotCost',p.slot_cost,'available',coalesce((select host_enabled from bud_platform.live_commerce_control where singleton),false) and p.status='published' and c.status='published')) from bud_platform.products p left join bud_platform.content_versions c on c.id=p.content_version),'[]'::jsonb),
 'contentVersions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'questionCount',jsonb_array_length(c.questions),'conditionCount',jsonb_array_length(c.conditions))) from bud_platform.content_versions c where c.status='published'),'[]'::jsonb));
end;
$$;

create function public.bud_live_host_resume(p_host uuid,p_event uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform bud_platform.expire_live_host_events(p_host);
 if not exists(select 1 from bud_platform.live_events where id=p_event and host_id=p_host and state is not null) then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 return bud_platform.live_host_event(p_event);
end;
$$;


create function public.bud_live_host_start(p_host uuid,p_key text,p_title text,p_config jsonb,p_prize_text text,p_state jsonb,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_event bud_platform.live_events; v_product bud_platform.products; v_content bud_platform.content_versions; v_credits integer;
begin
 if p_host is null or p_key is null or p_key !~ '^[A-Za-z0-9_-]{16,100}$' or p_title is null or char_length(btrim(p_title)) not between 1 and 100
 or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_state is null or p_state->>'phase' is distinct from 'live'
 or p_state->'config' is distinct from p_config then raise exception 'BUD_INVALID_EVENT'; end if;
 insert into bud_platform.live_wallets(host_id) values(p_host) on conflict do nothing;
 select credits into v_credits from bud_platform.live_wallets where host_id=p_host for update;
 perform bud_platform.expire_live_host_events(p_host);
 select * into v_event from bud_platform.live_events where host_id=p_host and start_key=p_key;
 if found then
  if v_event.start_fingerprint is distinct from p_fingerprint then raise exception 'BUD_KEY_REUSED'; end if;
  return bud_platform.live_host_event(v_event.id);
 end if;
 if not coalesce((select host_enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_HOST_DISABLED'; end if;
 select * into v_product from bud_platform.products where id='question-condition' and status='published';
 if not found then raise exception 'BUD_PRODUCT_UNAVAILABLE'; end if;
 select * into v_content from bud_platform.content_versions where id=v_product.content_version and status='published';
 if not found then raise exception 'BUD_CONTENT_NOT_READY'; end if;
 if exists(select 1 from bud_platform.live_events where host_id=p_host and phase<>'completed') then raise exception 'BUD_ACTIVE_EVENT'; end if;
 if v_credits<1 then raise exception 'BUD_NO_CREDIT'; end if;
 insert into bud_platform.live_events(host_id,title,start_key,phase,version,state,start_fingerprint,content_version,pair_order)
 values(p_host,btrim(p_title),p_key,'live',1,p_state,p_fingerprint,v_content.id,
  (select jsonb_agg(n order by random()) from generate_series(0,jsonb_array_length(v_content.questions)*jsonb_array_length(v_content.conditions)-1) n)) returning * into v_event;
 insert into bud_platform.live_event_debits(event_id,host_id) values(v_event.id,p_host);
 update bud_platform.live_wallets set credits=credits-1 where host_id=p_host;
 return bud_platform.live_host_event(v_event.id);
end;
$$;
create function public.bud_live_host_receipt(p_host uuid,p_event uuid,p_key text,p_fingerprint text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_receipt bud_platform.live_action_receipts;
begin
 if not exists(select 1 from bud_platform.live_events where id=p_event and host_id=p_host) then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 select * into v_receipt from bud_platform.live_action_receipts where event_id=p_event and request_key=p_key;
 if not found then return null; end if;
 if v_receipt.fingerprint <> p_fingerprint then raise exception 'BUD_KEY_REUSED'; end if;
 return v_receipt.result;
end;
$$;

create function public.bud_live_host_update(p_host uuid,p_event uuid,p_expected_version integer,p_key text,p_state jsonb,p_action text,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_event bud_platform.live_events; v_result jsonb;
begin
 select * into v_event from bud_platform.live_events where id=p_event and host_id=p_host for update;
 if not found then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 v_result:=public.bud_live_host_receipt(p_host,p_event,p_key,p_fingerprint);
 if v_result is not null then return v_result; end if;
 if v_event.version <> p_expected_version then raise exception 'BUD_VERSION_CONFLICT'; end if;
 if v_event.phase='completed' then raise exception 'BUD_EVENT_CLOSED'; end if;
 if p_state is null or p_state->>'phase' not in ('live','prizes','closing') or jsonb_typeof(p_state->'winners') <> 'array' or jsonb_array_length(p_state->'winners')>1000 or octet_length(p_state::text)>262144 then raise exception 'BUD_INVALID_EVENT'; end if;
 update bud_platform.live_events set state=p_state,phase=case when p_state->>'phase'='closing' then 'completed' else p_state->>'phase' end,version=version+1,updated_at=clock_timestamp() where id=p_event;
 v_result:=bud_platform.live_host_event(p_event);
 insert into bud_platform.live_action_receipts(event_id,request_key,fingerprint,action,result) values(p_event,p_key,p_fingerprint,p_action,v_result);
 return v_result;
end;
$$;

revoke all on function public.bud_live_host_dashboard(uuid),public.bud_live_host_resume(uuid,uuid),public.bud_live_host_start(uuid,text,text,jsonb,text,jsonb,text),public.bud_live_host_receipt(uuid,uuid,text,text),public.bud_live_host_update(uuid,uuid,integer,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.bud_live_host_dashboard(uuid),public.bud_live_host_resume(uuid,uuid),public.bud_live_host_start(uuid,text,text,jsonb,text,jsonb,text),public.bud_live_host_receipt(uuid,uuid,text,text),public.bud_live_host_update(uuid,uuid,integer,text,jsonb,text,text) to service_role;

commit;
