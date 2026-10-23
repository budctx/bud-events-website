begin;
create table bud_platform.rate_limits (
 scope text not null check(scope in ('auth-signin','auth-session','auth-callback','auth-logout','host','checkout','webhook')),
 bucket text not null check(bucket ~ '^[a-f0-9]{64}$'),
 count integer not null check(count>0),
 resets_at timestamptz not null,
 primary key(scope,bucket)
);
create index bud_rate_expiry on bud_platform.rate_limits(resets_at);
alter table bud_platform.rate_limits enable row level security;
revoke all on bud_platform.rate_limits from public,anon,authenticated;
grant select,insert,update,delete on bud_platform.rate_limits to service_role;
create function public.bud_consume_rate_limit(p_scope text,p_bucket text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_limit integer; v_row bud_platform.rate_limits; v_now timestamptz:=clock_timestamp();
begin
 v_limit:=case p_scope when 'auth-signin' then 10 when 'auth-callback' then 15 when 'auth-session' then 60 when 'auth-logout' then 15 when 'host' then 120 when 'checkout' then 10 when 'webhook' then 120 else null end;
 if v_limit is null or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then raise exception 'BUD_INVALID_RATE_BUCKET'; end if;
 -- Bound cleanup work; expired rows contain only keyed pseudonyms, never raw IPs.
 with expired as(select scope,bucket from bud_platform.rate_limits where resets_at<v_now-interval '10 minutes' order by resets_at limit 100 for update skip locked)
 delete from bud_platform.rate_limits r using expired x where r.scope=x.scope and r.bucket=x.bucket;
 insert into bud_platform.rate_limits(scope,bucket,count,resets_at) values(p_scope,p_bucket,1,v_now+interval '60 seconds')
 on conflict(scope,bucket) do update set count=case when bud_platform.rate_limits.resets_at<=v_now then 1 else least(bud_platform.rate_limits.count+1,v_limit+1) end,
 resets_at=case when bud_platform.rate_limits.resets_at<=v_now then v_now+interval '60 seconds' else bud_platform.rate_limits.resets_at end returning * into v_row;
 return jsonb_build_object('allowed',v_row.count<=v_limit,'retryAfter',case when v_row.count<=v_limit then 0 else greatest(1,least(60,ceil(extract(epoch from v_row.resets_at-v_now))::integer)) end);
end;
$$;
revoke all on function public.bud_consume_rate_limit(text,text) from public,anon,authenticated;
grant execute on function public.bud_consume_rate_limit(text,text) to service_role;

alter table bud_platform.checkout_orders add column request_key text check(request_key ~ '^[a-zA-Z0-9_-]{16,100}$');
alter table bud_platform.checkout_orders add column plan_id text;
alter table bud_platform.checkout_orders add column checkout_id text;
alter table bud_platform.checkout_orders add column checkout_url text;
create unique index bud_order_request on bud_platform.checkout_orders(host_id,request_key) where request_key is not null;
create unique index bud_order_checkout on bud_platform.checkout_orders(checkout_id) where checkout_id is not null;
create function bud_platform.sandbox_order(p_order uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('orderId',id,'hostId',host_id,'environment',environment,'companyId',company_id,'productId',product_id,'planId',plan_id,'currency',lower(currency),'amountMinor',amount_minor,'checkoutId',checkout_id,'checkoutUrl',checkout_url)
 from bud_platform.checkout_orders where id=p_order;
$$;
revoke all on function bud_platform.sandbox_order(uuid) from public,anon,authenticated;
grant execute on function bud_platform.sandbox_order(uuid) to service_role;
create function public.bud_create_sandbox_order(p_host uuid,p_key text,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.checkout_orders;
begin
 if p_host is null or p_key is null or p_key !~ '^[a-zA-Z0-9_-]{16,100}$' or p_company is null or char_length(p_company) not between 1 and 100 or p_product is null or char_length(p_product) not between 1 and 100 or p_plan is null or char_length(p_plan) not between 1 and 100 or p_currency is null or upper(p_currency) !~ '^[A-Z]{3}$' or p_amount is null or p_amount<1 or p_amount>100000000 then raise exception 'BUD_INVALID_ORDER'; end if;
 insert into bud_platform.checkout_orders(host_id,request_key,company_id,product_id,plan_id,environment,currency,amount_minor) values(p_host,p_key,p_company,p_product,p_plan,'sandbox',upper(p_currency),p_amount)
 on conflict(host_id,request_key) where request_key is not null do nothing;
 select * into v_order from bud_platform.checkout_orders where host_id=p_host and request_key=p_key for update;
 if v_order.company_id<>p_company or v_order.product_id<>p_product or v_order.plan_id<>p_plan or v_order.currency<>upper(p_currency) or v_order.amount_minor<>p_amount then raise exception 'BUD_KEY_REUSED'; end if;
 return bud_platform.sandbox_order(v_order.id);
end;
$$;
create function public.bud_attach_sandbox_checkout(p_host uuid,p_order uuid,p_checkout text,p_url text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_order bud_platform.checkout_orders;
begin
 if p_checkout is null or char_length(p_checkout)>200 or p_checkout !~ '^ch_[A-Za-z0-9]+$' or p_url is null or p_url not in ('https://sandbox.whop.com/checkout/'||p_checkout,'https://sandbox.whop.com/checkout/'||p_checkout||'/') then raise exception 'BUD_INVALID_CHECKOUT'; end if;
 select * into v_order from bud_platform.checkout_orders where id=p_order and host_id=p_host for update;
 if not found then raise exception 'BUD_ORDER_NOT_FOUND'; end if;
 if v_order.checkout_id is not null and (v_order.checkout_id<>p_checkout or v_order.checkout_url<>p_url) then raise exception 'BUD_CHECKOUT_ALREADY_ATTACHED'; end if;
 update bud_platform.checkout_orders set checkout_id=p_checkout,checkout_url=p_url where id=p_order;
 return bud_platform.sandbox_order(p_order);
end;
$$;
create function public.bud_sandbox_order(p_order uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select bud_platform.sandbox_order(p_order); $$;
revoke all on function public.bud_create_sandbox_order(uuid,text,text,text,text,text,bigint),public.bud_attach_sandbox_checkout(uuid,uuid,text,text),public.bud_sandbox_order(uuid) from public,anon,authenticated;
grant execute on function public.bud_create_sandbox_order(uuid,text,text,text,text,text,bigint),public.bud_attach_sandbox_checkout(uuid,uuid,text,text),public.bud_sandbox_order(uuid) to service_role;
commit;
