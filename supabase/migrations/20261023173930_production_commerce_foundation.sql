-- Preparation only. Additive, no Auth changes, no old wallet/order changes, no activation.
begin;
create table bud_platform.live_commerce_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into bud_platform.live_commerce_control(singleton,enabled) values(true,false);
create table bud_platform.live_orders (
 id uuid primary key default gen_random_uuid(),
 host_id uuid not null references auth.users(id) on delete restrict,
 request_key text not null check(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 locale text not null check(locale in ('ar','en')),
 company_id text not null check(company_id ~ '^biz_[A-Za-z0-9]{5,80}$'),
 product_id text not null check(product_id ~ '^prod_[A-Za-z0-9]{5,80}$'),
 plan_id text not null check(plan_id ~ '^plan_[A-Za-z0-9]{5,80}$'),
 currency text not null check(currency='sar'),
 amount_minor bigint not null check(amount_minor between 1 and 99999999),
 checkout_id text unique check(checkout_id ~ '^ch_[A-Za-z0-9]{5,80}$'),
 checkout_url text,
 fulfilled_payment_id text unique check(fulfilled_payment_id ~ '^pay_[A-Za-z0-9]{5,80}$'),
 created_at timestamptz not null default now(),
 fulfilled_at timestamptz,
 unique(host_id,request_key),
 check((checkout_id is null)=(checkout_url is null)),
 check(checkout_url is null or checkout_url in ('https://whop.com/checkout/'||checkout_id,'https://whop.com/checkout/'||checkout_id||'/')),
 check((fulfilled_payment_id is null)=(fulfilled_at is null)),
 check(fulfilled_payment_id is null or checkout_id is not null)
);
create index bud_live_orders_host_created on bud_platform.live_orders(host_id,created_at desc);
create table bud_platform.live_wallets (
 host_id uuid primary key references auth.users(id) on delete restrict,
 credits integer not null default 0 check(credits>=0)
);
create table bud_platform.live_deliveries (
 message_id text primary key check(message_id ~ '^msg_[A-Za-z0-9]{5,100}$'),
 payment_id text not null check(payment_id ~ '^pay_[A-Za-z0-9]{5,80}$'),
 order_id uuid not null references bud_platform.live_orders(id) on delete restrict,
 received_at timestamptz not null default now()
);
create index bud_live_deliveries_payment on bud_platform.live_deliveries(payment_id);
create table bud_platform.live_credit_ledger (
 id bigint generated always as identity primary key,
 host_id uuid not null references auth.users(id) on delete restrict,
 order_id uuid not null unique references bud_platform.live_orders(id) on delete restrict,
 payment_id text not null unique check(payment_id ~ '^pay_[A-Za-z0-9]{5,80}$'),
 delta smallint not null default 1 check(delta=1),
 created_at timestamptz not null default now()
);
create index bud_live_ledger_host on bud_platform.live_credit_ledger(host_id,created_at desc);
alter table bud_platform.live_commerce_control enable row level security;
alter table bud_platform.live_orders enable row level security;
alter table bud_platform.live_wallets enable row level security;
alter table bud_platform.live_deliveries enable row level security;
alter table bud_platform.live_credit_ledger enable row level security;
revoke all on bud_platform.live_commerce_control,bud_platform.live_orders,bud_platform.live_wallets,bud_platform.live_deliveries,bud_platform.live_credit_ledger from public,anon,authenticated,service_role;
grant select on bud_platform.live_commerce_control to service_role;
grant select,insert,update on bud_platform.live_orders,bud_platform.live_wallets to service_role;
grant select,insert on bud_platform.live_deliveries,bud_platform.live_credit_ledger to service_role;
grant usage,select on sequence bud_platform.live_credit_ledger_id_seq to service_role;

create function bud_platform.live_order(p_order uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('orderId',id,'hostId',host_id,'environment','production','companyId',company_id,'productId',product_id,
 'planId',plan_id,'currency',currency,'amountMinor',amount_minor,'locale',locale,'checkoutId',checkout_id,'checkoutUrl',checkout_url,'fulfilled',fulfilled_payment_id is not null)
 from bud_platform.live_orders where id=p_order;
$$;
create function public.bud_live_create_order(p_host uuid,p_key text,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint,p_locale text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.live_orders;
begin
 if not coalesce((select enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_COMMERCE_DISABLED'; end if;
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
create function public.bud_live_attach_checkout(p_host uuid,p_order uuid,p_checkout text,p_url text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.live_orders;
begin
 if not coalesce((select enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_COMMERCE_DISABLED'; end if;
 if p_checkout is null or p_checkout !~ '^ch_[A-Za-z0-9]{5,80}$' or p_url is null or p_url not in ('https://whop.com/checkout/'||p_checkout,'https://whop.com/checkout/'||p_checkout||'/') then raise exception 'BUD_INVALID_LIVE_CHECKOUT'; end if;
 select * into v_order from bud_platform.live_orders where id=p_order and host_id=p_host for update;
 if not found then raise exception 'BUD_ORDER_NOT_FOUND'; end if;
 if v_order.checkout_id is not null and (v_order.checkout_id<>p_checkout or v_order.checkout_url<>p_url) then raise exception 'BUD_CHECKOUT_ALREADY_ATTACHED'; end if;
 update bud_platform.live_orders set checkout_id=p_checkout,checkout_url=p_url where id=p_order;
 return bud_platform.live_order(p_order);
end;
$$;
create function public.bud_live_order(p_order uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select bud_platform.live_order(p_order); $$;
create function public.bud_live_balance(p_host uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('credits',coalesce((select credits from bud_platform.live_wallets where host_id=p_host),0));
$$;
-- Only call after raw-signature verification and authoritative provider/payment matching.
-- No boolean supplied by a browser can substitute for those server checks.
create function public.bud_live_credit_purchase(p_order uuid,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint,p_checkout text,p_payment text,p_message text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.live_orders; v_delivery bud_platform.live_deliveries;
begin
 if not coalesce((select enabled from bud_platform.live_commerce_control where singleton),false) then raise exception 'BUD_LIVE_COMMERCE_DISABLED'; end if;
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
revoke all on function bud_platform.live_order(uuid),public.bud_live_create_order(uuid,text,text,text,text,text,bigint,text),public.bud_live_attach_checkout(uuid,uuid,text,text),public.bud_live_order(uuid),public.bud_live_balance(uuid),public.bud_live_credit_purchase(uuid,text,text,text,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function bud_platform.live_order(uuid),public.bud_live_create_order(uuid,text,text,text,text,text,bigint,text),public.bud_live_attach_checkout(uuid,uuid,text,text),public.bud_live_order(uuid),public.bud_live_balance(uuid),public.bud_live_credit_purchase(uuid,text,text,text,text,bigint,text,text,text) to service_role;
commit;
