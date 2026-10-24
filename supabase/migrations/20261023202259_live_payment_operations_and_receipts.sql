-- LOCAL ONLY: no extension, schedule, secret, or live activation is installed by this migration.
begin;
create table bud_platform.live_reconciliation (
 order_id uuid primary key references bud_platform.live_orders(id) on delete restrict,
 payment_id text not null unique check(payment_id ~ '^pay_[A-Za-z0-9]{5,80}$'),
 state text not null default 'unverified' check(state in ('unverified','clear','review','refunded','disputed')),
 next_check_at timestamptz not null default clock_timestamp(), checked_at timestamptz, attempted_at timestamptz,
 lease_token uuid,lease_until timestamptz,
 check((lease_token is null)=(lease_until is null))
);
create index bud_live_reconcile_due on bud_platform.live_reconciliation(next_check_at);
create table bud_platform.live_worker_health (
 task text primary key check(task in ('payments','reconcile')), attempted_at timestamptz, succeeded_at timestamptz,
 status text not null default 'never' check(status in ('never','running','ok','attention','failed'))
);
insert into bud_platform.live_worker_health(task) values('payments'),('reconcile');
alter table bud_platform.live_reconciliation enable row level security;
alter table bud_platform.live_worker_health enable row level security;
revoke all on bud_platform.live_reconciliation,bud_platform.live_worker_health from public,anon,authenticated,service_role;
grant select,insert,update on bud_platform.live_reconciliation to service_role;
grant select,update on bud_platform.live_worker_health to service_role;

create function bud_platform.queue_live_reconciliation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.fulfilled_payment_id is not null then
  insert into bud_platform.live_reconciliation(order_id,payment_id) values(new.id,new.fulfilled_payment_id) on conflict(order_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function bud_platform.queue_live_reconciliation() from public,anon,authenticated;
create trigger bud_live_reconcile_purchase after insert or update of fulfilled_payment_id on bud_platform.live_orders
 for each row execute function bud_platform.queue_live_reconciliation();
insert into bud_platform.live_reconciliation(order_id,payment_id) select id,fulfilled_payment_id from bud_platform.live_orders where fulfilled_payment_id is not null;

create function public.bud_live_claim_reconciliation() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
 with due as (select order_id from bud_platform.live_reconciliation where next_check_at<=clock_timestamp()
  and (lease_until is null or lease_until<=clock_timestamp()) order by next_check_at limit 1 for update skip locked),
 claimed as (update bud_platform.live_reconciliation r set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempted_at=clock_timestamp()
  from due where r.order_id=due.order_id returning jsonb_build_object('orderId',r.order_id,'paymentId',r.payment_id,'leaseToken',r.lease_token) item)
 select coalesce(jsonb_agg(item),'[]'::jsonb) into v_result from claimed;
 return v_result;
end;
$$;
create function public.bud_live_record_reconciliation(p_order uuid,p_lease uuid,p_state text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_check bud_platform.live_reconciliation; v_host uuid;
begin
 if p_state is null or p_state not in ('clear','review','refunded','disputed','unavailable') then raise exception 'BUD_INVALID_RECONCILIATION'; end if;
 select * into v_check from bud_platform.live_reconciliation where order_id=p_order for update;
 if not found or p_lease is null or v_check.lease_token is null or v_check.lease_until is null
  or v_check.lease_token is distinct from p_lease or v_check.lease_until<=clock_timestamp() then raise exception 'BUD_LIVE_LEASE_LOST'; end if;
 select host_id into v_host from bud_platform.live_orders where id=p_order;
 -- Serialize a new financial hold with new event starts; existing events remain resumable.
 perform 1 from bud_platform.live_wallets where host_id=v_host for update;
 update bud_platform.live_reconciliation set
  state=case when p_state='unavailable' then state when state='disputed' or p_state='disputed' then 'disputed'
    when state='refunded' or p_state='refunded' then 'refunded' when state='review' or p_state='review' then 'review' else p_state end,
  checked_at=case when p_state='unavailable' then checked_at else clock_timestamp() end,
  next_check_at=clock_timestamp()+case when p_state='unavailable' then interval '1 minute' else interval '15 minutes' end,
  lease_token=null,lease_until=null where order_id=p_order;
 -- No refund API call, wallet reversal, debt, or automatic release of a hold.
 return jsonb_build_object('recorded',true);
end;
$$;

create function bud_platform.guard_live_event_payment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from bud_platform.live_reconciliation r join bud_platform.live_orders o on o.id=r.order_id
  where o.host_id=new.host_id and r.state in ('review','refunded','disputed')) then raise exception 'BUD_PAYMENT_REVIEW'; end if;
 return new;
end;
$$;
revoke all on function bud_platform.guard_live_event_payment() from public,anon,authenticated;
create trigger bud_live_event_payment_guard before insert on bud_platform.live_events for each row execute function bud_platform.guard_live_event_payment();
create trigger bud_live_order_payment_guard before insert on bud_platform.live_orders for each row execute function bud_platform.guard_live_event_payment();

create or replace function public.bud_live_host_dashboard(p_host uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_review boolean;
begin
 perform bud_platform.expire_live_host_events(p_host);
 v_review:=exists(select 1 from bud_platform.live_reconciliation r join bud_platform.live_orders o on o.id=r.order_id
  where o.host_id=p_host and r.state in ('review','refunded','disputed'));
 return jsonb_build_object('credits',coalesce((select credits from bud_platform.live_wallets where host_id=p_host),0),'paymentReview',v_review,
 'events',coalesce((select jsonb_agg(bud_platform.live_host_event(e.id) order by e.updated_at desc) from
  (select * from bud_platform.live_events where host_id=p_host order by updated_at desc limit 100) e),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slotCost',p.slot_cost,'available',not v_review
  and coalesce((select host_enabled from bud_platform.live_commerce_control where singleton),false) and p.status='published' and c.status='published'))
  from bud_platform.products p left join bud_platform.content_versions c on c.id=p.content_version),'[]'::jsonb),
 'contentVersions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'questionCount',jsonb_array_length(c.questions),'conditionCount',jsonb_array_length(c.conditions)))
  from bud_platform.content_versions c where c.status='published'),'[]'::jsonb));
end;
$$;

create function public.bud_live_payment_status(p_host uuid,p_order uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('orderId',o.id,'state',case when r.state in ('review','refunded','disputed') then r.state
  when o.fulfilled_payment_id is not null then 'confirmed' else 'pending' end,'currency',o.currency,'amountMinor',o.amount_minor,
  'createdAt',o.created_at,'checkedAt',r.checked_at)
 from bud_platform.live_orders o left join bud_platform.live_reconciliation r on r.order_id=o.id where o.id=p_order and o.host_id=p_host;
$$;
create function public.bud_live_worker_heartbeat(p_task text,p_status text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_task is null or p_task not in ('payments','reconcile') or p_status is null or p_status not in ('running','ok','attention','failed') then raise exception 'BUD_INVALID_WORKER_STATUS'; end if;
 update bud_platform.live_worker_health set status=p_status,
  attempted_at=case when p_status='running' then clock_timestamp() else attempted_at end,
  succeeded_at=case when p_status='ok' then clock_timestamp() else succeeded_at end where task=p_task;
 return jsonb_build_object('recorded',true);
end;
$$;
create function public.bud_live_operations_health() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('queue',public.bud_live_queue_status(),
 'due', (select count(*) from bud_platform.live_payment_jobs where status='pending' and available_at<=statement_timestamp()),
 'reconciliationReview',(select count(*) from bud_platform.live_reconciliation where state in ('review','refunded','disputed')),
 'reconciliationStale',(select count(*) from bud_platform.live_reconciliation where
  (checked_at is null and next_check_at<statement_timestamp()-interval '15 minutes') or checked_at<statement_timestamp()-interval '1 day'),
 'workers',(select jsonb_agg(jsonb_build_object('task',task,'lastAttemptAt',attempted_at,'lastSuccessAt',succeeded_at,'status',status) order by task) from bud_platform.live_worker_health));
$$;
revoke all on function public.bud_live_claim_reconciliation(),public.bud_live_record_reconciliation(uuid,uuid,text),public.bud_live_payment_status(uuid,uuid),public.bud_live_worker_heartbeat(text,text),public.bud_live_operations_health() from public,anon,authenticated;
grant execute on function public.bud_live_claim_reconciliation(),public.bud_live_record_reconciliation(uuid,uuid,text),public.bud_live_payment_status(uuid,uuid),public.bud_live_worker_heartbeat(text,text),public.bud_live_operations_health() to service_role;
commit;
