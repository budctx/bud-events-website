-- CODE-ONLY DRAFT. Not applied to any remote project.
-- Additive replacement model; never alters or drops historical bud_private objects.
begin;
create schema bud_platform;
revoke all on schema bud_platform from public, anon, authenticated;
grant usage on schema bud_platform to service_role;

create table bud_platform.wallets (
  host_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0)
);
create table bud_platform.checkout_orders (
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
create index bud_orders_host on bud_platform.checkout_orders(host_id);
create table bud_platform.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  start_key text not null check (start_key ~ '^[a-zA-Z0-9_-]{16,100}$'),
  phase text not null default 'live' check (phase in ('live','prizes','closing','completed')),
  version bigint not null default 0 check (version >= 0),
  started_at timestamptz not null default now(),
  unique(host_id,start_key)
);
create unique index bud_one_active_event on bud_platform.events(host_id) where phase <> 'completed';
create table bud_platform.manual_winners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bud_platform.events(id) on delete cascade,
  round_id uuid not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique(event_id,round_id)
);
-- No attendance, participant profiles, Discord IDs, signup or player tracking.
-- Winner mutation API is deliberately absent pending adjudication/version contracts.
create table bud_platform.webhook_receipts (
  environment text not null check (environment = 'sandbox'),
  message_id text not null,
  payment_id text not null,
  order_id uuid not null references bud_platform.checkout_orders(id),
  received_at timestamptz not null default now(),
  primary key(environment,message_id),
  unique(environment,payment_id)
);
create table bud_platform.credit_ledger (
  id bigint generated always as identity primary key,
  host_id uuid not null references auth.users(id) on delete cascade,
  delta smallint not null check (delta in (-1,1)),
  kind text not null check (kind in ('purchase','event_start')),
  source_key text not null unique,
  created_at timestamptz not null default now(),
  check ((kind = 'purchase' and delta = 1) or (kind = 'event_start' and delta = -1))
);
create index bud_ledger_host on bud_platform.credit_ledger(host_id,created_at desc);

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

create function public.bud_slot_balance(p_host uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('credits',coalesce((select credits from bud_platform.wallets where host_id=p_host),0));
$$;

create function public.bud_start_event(p_host uuid,p_key text,p_title text) returns jsonb
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

create function public.bud_resume_event(p_host uuid,p_event uuid) returns jsonb
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
create function public.bud_credit_verified_purchase(
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
commit;
