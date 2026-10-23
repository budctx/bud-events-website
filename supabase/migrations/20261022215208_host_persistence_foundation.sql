-- Historical base recreated only when absent after Stage00 reset.
-- Additive replacement model; never alters or drops historical bud_private objects.
begin;
create schema if not exists bud_platform;
revoke all on schema bud_platform from public, anon, authenticated;
grant usage on schema bud_platform to service_role;

create table if not exists bud_platform.wallets (
  host_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0)
);
create table if not exists bud_platform.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null,
  product_id text not null,
  environment text not null check (environment = 'sandbox'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  slots smallint not null default 1 check (slots = 1),
  fulfilled_payment_id text,
  created_at timestamptz not null default now(),
  unique(environment,fulfilled_payment_id)
);
create index if not exists bud_orders_host on bud_platform.checkout_orders(host_id);
create table if not exists bud_platform.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  start_key text not null check (start_key ~ '^[a-zA-Z0-9_-]{16,100}$'),
  phase text not null default 'live' check (phase in ('live','prizes','closing','completed')),
  version bigint not null default 0 check (version >= 0),
  started_at timestamptz not null default now(),
  unique(host_id,start_key)
);
create unique index if not exists bud_one_active_event on bud_platform.events(host_id) where phase <> 'completed';
create table if not exists bud_platform.manual_winners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bud_platform.events(id) on delete cascade,
  round_id uuid not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique(event_id,round_id)
);
-- No attendance, participant profiles, Discord IDs, signup or player tracking.
-- Winner mutation API is deliberately absent pending adjudication/version contracts.
create table if not exists bud_platform.webhook_receipts (
  environment text not null check (environment = 'sandbox'),
  message_id text not null,
  payment_id text not null,
  order_id uuid not null references bud_platform.checkout_orders(id),
  received_at timestamptz not null default now(),
  primary key(environment,message_id),
  unique(environment,payment_id)
);
create table if not exists bud_platform.credit_ledger (
  id bigint generated always as identity primary key,
  host_id uuid not null references auth.users(id) on delete cascade,
  delta smallint not null check (delta in (-1,1)),
  kind text not null check (kind in ('purchase','event_start')),
  source_key text not null unique,
  created_at timestamptz not null default now(),
  check ((kind = 'purchase' and delta = 1) or (kind = 'event_start' and delta = -1))
);
create index if not exists bud_ledger_host on bud_platform.credit_ledger(host_id,created_at desc);

alter table bud_platform.wallets enable row level security;
alter table bud_platform.checkout_orders enable row level security;
alter table bud_platform.events enable row level security;
alter table bud_platform.manual_winners enable row level security;
alter table bud_platform.webhook_receipts enable row level security;
alter table bud_platform.credit_ledger enable row level security;
revoke all on all tables in schema bud_platform from public,anon,authenticated;
grant select,insert,update on bud_platform.wallets,bud_platform.checkout_orders,bud_platform.events to service_role;
grant select,insert on bud_platform.credit_ledger,bud_platform.webhook_receipts to service_role;
grant select on bud_platform.manual_winners to service_role;
grant usage,select on all sequences in schema bud_platform to service_role;
-- No UPDATE/DELETE grants on the append-only audit/credit rows.

create or replace function public.bud_slot_balance(p_host uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('credits',coalesce((select credits from bud_platform.wallets where host_id=p_host),0));
$$;

create or replace function public.bud_start_event(p_host uuid,p_key text,p_title text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_event bud_platform.events; v_credits integer;
begin
  if p_host is null or p_key is null or p_key !~ '^[a-zA-Z0-9_-]{16,100}$'
    or p_title is null or char_length(btrim(p_title)) not between 1 and 100 then
    raise exception 'BUD_INVALID_EVENT';
  end if;
  insert into bud_platform.wallets(host_id) values(p_host) on conflict do nothing;
  -- Serializes all starts and purchase credit operations for this host.
  select credits into v_credits from bud_platform.wallets where host_id=p_host for update;
  select * into v_event from bud_platform.events where host_id=p_host and start_key=p_key;
  if found then
    if v_event.title <> btrim(p_title) then raise exception 'BUD_KEY_REUSED'; end if;
    return jsonb_build_object('eventId',v_event.id,'phase',v_event.phase,'replayed',true);
  end if;
  if exists(select 1 from bud_platform.events where host_id=p_host and phase <> 'completed') then
    raise exception 'BUD_ACTIVE_EVENT';
  end if;
  if v_credits < 1 then raise exception 'BUD_NO_CREDIT'; end if;
  insert into bud_platform.events(host_id,start_key,title) values(p_host,p_key,btrim(p_title)) returning * into v_event;
  insert into bud_platform.credit_ledger(host_id,delta,kind,source_key)
    values(p_host,-1,'event_start','event:'||v_event.id::text);
  update bud_platform.wallets set credits=credits-1 where host_id=p_host;
  return jsonb_build_object('eventId',v_event.id,'phase',v_event.phase,'replayed',false);
end;
$$;

create or replace function public.bud_resume_event(p_host uuid,p_event uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_event bud_platform.events;
begin
  select * into v_event from bud_platform.events where id=p_event and host_id=p_host;
  if not found then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
  -- Read only: never creates an event or ledger entry, including completed events.
  return jsonb_build_object('eventId',v_event.id,'title',v_event.title,'phase',v_event.phase,'version',v_event.version);
end;
$$;

-- SERVER ONLY. Must be called only after cryptographic provider verification.
-- No HTTP endpoint currently calls this function; webhook deliberately returns 503.
create or replace function public.bud_credit_verified_purchase(
  p_order uuid,p_environment text,p_company text,p_product text,p_currency text,
  p_amount_minor bigint,p_payment text,p_message text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order bud_platform.checkout_orders;
begin
  if p_payment is null or char_length(p_payment) not between 1 and 200
    or p_message is null or char_length(p_message) not between 1 and 200 then raise exception 'BUD_INVALID_PAYMENT'; end if;
  select * into v_order from bud_platform.checkout_orders where id=p_order for update;
  if not found then raise exception 'BUD_ORDER_NOT_FOUND'; end if;
  if v_order.environment is distinct from p_environment or v_order.company_id is distinct from p_company
    or v_order.product_id is distinct from p_product or v_order.currency is distinct from p_currency
    or v_order.amount_minor is distinct from p_amount_minor then raise exception 'BUD_PAYMENT_MISMATCH'; end if;
  if v_order.fulfilled_payment_id is not null then
    if v_order.fulfilled_payment_id <> p_payment then raise exception 'BUD_ORDER_ALREADY_FULFILLED'; end if;
    return jsonb_build_object('credited',false,'replayed',true);
  end if;
  insert into bud_platform.wallets(host_id) values(v_order.host_id) on conflict do nothing;
  perform 1 from bud_platform.wallets where host_id=v_order.host_id for update;
  insert into bud_platform.webhook_receipts(environment,message_id,payment_id,order_id)
    values(p_environment,p_message,p_payment,p_order);
  insert into bud_platform.credit_ledger(host_id,delta,kind,source_key)
    values(v_order.host_id,1,'purchase','payment:'||p_environment||':'||p_payment);
  update bud_platform.wallets set credits=credits+1 where host_id=v_order.host_id;
  update bud_platform.checkout_orders set fulfilled_payment_id=p_payment where id=p_order;
  return jsonb_build_object('credited',true,'replayed',false);
end;
$$;

revoke all on function public.bud_slot_balance(uuid) from public,anon,authenticated;
revoke all on function public.bud_start_event(uuid,text,text) from public,anon,authenticated;
revoke all on function public.bud_resume_event(uuid,uuid) from public,anon,authenticated;
revoke all on function public.bud_credit_verified_purchase(uuid,text,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.bud_slot_balance(uuid),public.bud_start_event(uuid,text,text),public.bud_resume_event(uuid,uuid),
  public.bud_credit_verified_purchase(uuid,text,text,text,text,bigint,text,text) to service_role;

-- Additive host persistence, applied only to the dedicated development project.
-- The historical contract is restored above because Stage00 removed its schema.

create table bud_platform.content_versions (
  id text primary key,
  status text not null check(status in ('draft','published','retired')),
  questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 500),
  conditions jsonb not null check(jsonb_typeof(conditions)='array' and jsonb_array_length(conditions) between 1 and 500),
  created_at timestamptz not null default now()
);
create table bud_platform.products (
  id text primary key,
  name text not null,
  status text not null check(status in ('draft','published','retired')),
  content_version text references bud_platform.content_versions(id),
  slot_cost smallint not null default 1 check(slot_cost=1)
);
alter table bud_platform.events add column state jsonb;
alter table bud_platform.events add column start_fingerprint text;
alter table bud_platform.events add column content_version text references bud_platform.content_versions(id);
alter table bud_platform.events add column pair_order jsonb;
alter table bud_platform.events add column updated_at timestamptz not null default now();
create index bud_events_host_updated on bud_platform.events(host_id,updated_at desc);
create index bud_events_content on bud_platform.events(content_version);
create index bud_products_content on bud_platform.products(content_version);
create index bud_receipts_order on bud_platform.webhook_receipts(order_id);
create function bud_platform.expire_host_events(p_host uuid) returns void
language sql security invoker set search_path='' as $$
 update bud_platform.events set phase='completed',version=version+1,updated_at=clock_timestamp(),
 state=jsonb_set(jsonb_set(jsonb_set(state,'{phase}','"closing"'),'{deadline}','null'),'{pendingWinner}','false')
 where host_id=p_host and phase<>'completed' and state is not null and started_at + interval '4 hours' <= clock_timestamp();
$$;
revoke all on function bud_platform.expire_host_events(uuid) from public,anon,authenticated;
grant execute on function bud_platform.expire_host_events(uuid) to service_role;
create table bud_platform.action_receipts (
  event_id uuid not null references bud_platform.events(id) on delete cascade,
  request_key text not null check(request_key ~ '^[a-zA-Z0-9_-]{16,100}$'),
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  action text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(event_id,request_key)
);
alter table bud_platform.content_versions enable row level security;
alter table bud_platform.products enable row level security;
alter table bud_platform.action_receipts enable row level security;
revoke all on bud_platform.content_versions,bud_platform.products,bud_platform.action_receipts from public,anon,authenticated;
grant select on bud_platform.content_versions,bud_platform.products to service_role;
grant select,insert on bud_platform.action_receipts to service_role;

-- Draft examples are not approved inventory and never unlock a playable purchase.
insert into bud_platform.content_versions(id,status,questions,conditions) values(
 'qc-example-v1','draft',
 '[{"ar":"دولة","en":"A country"},{"ar":"تطبيق جوال","en":"A mobile app"},{"ar":"مدينة","en":"A city"}]',
 '[{"ar":"تبدأ بحرف س","en":"Starts with S"},{"ar":"تحتوي على حرف م","en":"Contains M"},{"ar":"من كلمتين","en":"Two words"}]'
);
insert into bud_platform.products(id,name,status,content_version) values('question-condition','سؤال وشرط','draft','qc-example-v1');

create function bud_platform.protect_content_version() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.status <> 'draft' and (new.id is distinct from old.id or new.questions is distinct from old.questions or new.conditions is distinct from old.conditions or new.status='draft') then
  raise exception 'BUD_IMMUTABLE_CONTENT';
 end if;
 return new;
end;
$$;
create trigger bud_content_immutable before update on bud_platform.content_versions for each row execute function bud_platform.protect_content_version();
revoke all on function bud_platform.protect_content_version() from public,anon,authenticated;

create function bud_platform.host_event(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('eventId',e.id,'title',e.title,'phase',e.phase,'version',e.version,'state',e.state,
 'updatedAt',e.updated_at,'serverNow',floor(extract(epoch from statement_timestamp())*1000),
 'cards',jsonb_build_object('question',c.questions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)/jsonb_array_length(c.conditions))->>'ar',
 'condition',c.conditions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)%jsonb_array_length(c.conditions))->>'ar'),
 'cardsEn',jsonb_build_object('question',c.questions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)/jsonb_array_length(c.conditions))->>'en',
 'condition',c.conditions->(coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)%jsonb_array_length(c.conditions))->>'en'))
 from bud_platform.events e join bud_platform.content_versions c on c.id=e.content_version where e.id=p_event;
$$;
revoke all on function bud_platform.host_event(uuid) from public,anon,authenticated;
grant execute on function bud_platform.host_event(uuid) to service_role;

create function public.bud_host_dashboard(p_host uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform bud_platform.expire_host_events(p_host);
 return jsonb_build_object('credits',coalesce((select credits from bud_platform.wallets where host_id=p_host),0),
 'events',coalesce((select jsonb_agg(bud_platform.host_event(e.id) order by e.updated_at desc) from (select * from bud_platform.events where host_id=p_host and state is not null order by updated_at desc limit 100) e),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'slotCost',p.slot_cost,'available',p.status='published' and c.status='published')) from bud_platform.products p left join bud_platform.content_versions c on c.id=p.content_version),'[]'::jsonb),
 'contentVersions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'questionCount',jsonb_array_length(c.questions),'conditionCount',jsonb_array_length(c.conditions))) from bud_platform.content_versions c where c.status='published'),'[]'::jsonb));
end;
$$;

create function public.bud_host_resume(p_host uuid,p_event uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform bud_platform.expire_host_events(p_host);
 if not exists(select 1 from bud_platform.events where id=p_event and host_id=p_host and state is not null) then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 return bud_platform.host_event(p_event);
end;
$$;

create function public.bud_host_start(p_host uuid,p_key text,p_title text,p_config jsonb,p_prize_text text,p_state jsonb,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_event bud_platform.events; v_product bud_platform.products; v_content bud_platform.content_versions; v_started jsonb;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_state is null or p_state->>'phase' <> 'live' or p_state->'config' is distinct from p_config then raise exception 'BUD_INVALID_EVENT'; end if;
 insert into bud_platform.wallets(host_id) values(p_host) on conflict do nothing;
 perform 1 from bud_platform.wallets where host_id=p_host for update;
 perform bud_platform.expire_host_events(p_host);
 select * into v_event from bud_platform.events where host_id=p_host and start_key=p_key;
 if found then
  if v_event.start_fingerprint is distinct from p_fingerprint then raise exception 'BUD_KEY_REUSED'; end if;
  return bud_platform.host_event(v_event.id);
 end if;
 select * into v_product from bud_platform.products where id='question-condition' and status='published';
 if not found then raise exception 'BUD_PRODUCT_UNAVAILABLE'; end if;
 select * into v_content from bud_platform.content_versions where id=v_product.content_version and status='published';
 if not found then raise exception 'BUD_CONTENT_NOT_READY'; end if;
 v_started:=public.bud_start_event(p_host,p_key,p_title);
 update bud_platform.events set state=p_state,start_fingerprint=p_fingerprint,content_version=v_content.id,version=1,
 pair_order=(select jsonb_agg(n order by random()) from generate_series(0,jsonb_array_length(v_content.questions)*jsonb_array_length(v_content.conditions)-1) n)
 where id=(v_started->>'eventId')::uuid returning * into v_event;
 return bud_platform.host_event(v_event.id);
end;
$$;

create function public.bud_host_receipt(p_host uuid,p_event uuid,p_key text,p_fingerprint text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_receipt bud_platform.action_receipts;
begin
 if not exists(select 1 from bud_platform.events where id=p_event and host_id=p_host) then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 select * into v_receipt from bud_platform.action_receipts where event_id=p_event and request_key=p_key;
 if not found then return null; end if;
 if v_receipt.fingerprint <> p_fingerprint then raise exception 'BUD_KEY_REUSED'; end if;
 return v_receipt.result;
end;
$$;

create function public.bud_host_update(p_host uuid,p_event uuid,p_expected_version integer,p_key text,p_state jsonb,p_action text,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_event bud_platform.events; v_result jsonb;
begin
 select * into v_event from bud_platform.events where id=p_event and host_id=p_host for update;
 if not found then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 v_result:=public.bud_host_receipt(p_host,p_event,p_key,p_fingerprint);
 if v_result is not null then return v_result; end if;
 if v_event.version <> p_expected_version then raise exception 'BUD_VERSION_CONFLICT'; end if;
 if v_event.phase='completed' then raise exception 'BUD_EVENT_CLOSED'; end if;
 if p_state is null or p_state->>'phase' not in ('live','prizes','closing') or jsonb_typeof(p_state->'winners') <> 'array' or jsonb_array_length(p_state->'winners')>1000 or octet_length(p_state::text)>262144 then raise exception 'BUD_INVALID_EVENT'; end if;
 update bud_platform.events set state=p_state,phase=case when p_state->>'phase'='closing' then 'completed' else p_state->>'phase' end,version=version+1,updated_at=clock_timestamp() where id=p_event;
 v_result:=bud_platform.host_event(p_event);
 insert into bud_platform.action_receipts(event_id,request_key,fingerprint,action,result) values(p_event,p_key,p_fingerprint,p_action,v_result);
 return v_result;
end;
$$;

revoke all on function public.bud_host_dashboard(uuid),public.bud_host_resume(uuid,uuid),public.bud_host_start(uuid,text,text,jsonb,text,jsonb,text),public.bud_host_receipt(uuid,uuid,text,text),public.bud_host_update(uuid,uuid,integer,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.bud_host_dashboard(uuid),public.bud_host_resume(uuid,uuid),public.bud_host_start(uuid,text,text,jsonb,text,jsonb,text),public.bud_host_receipt(uuid,uuid,text,text),public.bud_host_update(uuid,uuid,integer,text,jsonb,text,text) to service_role;
commit;


