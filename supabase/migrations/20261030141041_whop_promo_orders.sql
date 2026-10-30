-- Additive preparation. Does not change provider prices, commerce gates or credit balances.
begin;
alter table bud_platform.live_orders add column promotion jsonb;
alter table bud_platform.live_orders add constraint bud_order_promotion_shape check(promotion is null or
 coalesce((jsonb_typeof(promotion)='object' and promotion ?& array['id','code','baseAmountMinor','discountMinor','percent'] and promotion->>'id' ~ '^promo_[A-Za-z0-9]{5,80}$'
 and promotion->>'code' ~ '^[a-z0-9_-]{3,40}$' and (promotion->>'baseAmountMinor')::bigint>amount_minor
 and (promotion->>'discountMinor')::bigint=(promotion->>'baseAmountMinor')::bigint-amount_minor
 and (promotion->>'percent')::int between 1 and 99
 and (promotion->>'baseAmountMinor')::bigint*(promotion->>'percent')::int=(promotion->>'discountMinor')::bigint*100),false));
create or replace function bud_platform.live_order(p_order uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('orderId',id,'hostId',host_id,'environment','production','companyId',company_id,'productId',product_id,
 'planId',plan_id,'currency',currency,'amountMinor',amount_minor,'locale',locale,'checkoutId',checkout_id,'checkoutUrl',checkout_url,'fulfilled',fulfilled_payment_id is not null)
 ||case when promotion is null then '{}'::jsonb else jsonb_build_object('promotion',promotion) end
 from bud_platform.live_orders where id=p_order;
$$;
create function public.bud_live_create_promo_order(p_host uuid,p_key text,p_company text,p_product text,p_plan text,p_currency text,p_amount bigint,p_locale text,p_promotion jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v jsonb; v_id uuid; v_old jsonb; v_checkout text;
begin
 if p_promotion is null or jsonb_typeof(p_promotion)<>'object' or
  not(p_promotion ?& array['id','code','baseAmountMinor','discountMinor','percent']) then raise exception 'BUD_INVALID_LIVE_ORDER'; end if;
 -- Existing create_order checks commerce controls, keys, identity, amount and locks the row.
 v:=public.bud_live_create_order(p_host,p_key,p_company,p_product,p_plan,p_currency,p_amount,p_locale);
 v_id:=(v->>'orderId')::uuid;
 select promotion,checkout_id into v_old,v_checkout from bud_platform.live_orders where id=v_id for update;
 if v_old is null and v_checkout is null then
  update bud_platform.live_orders set promotion=p_promotion where id=v_id;
 elsif v_old is distinct from p_promotion then raise exception 'BUD_KEY_REUSED'; end if;
 return bud_platform.live_order(v_id);
end;
$$;
revoke all on function public.bud_live_create_promo_order(uuid,text,text,text,text,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.bud_live_create_promo_order(uuid,text,text,text,text,text,bigint,text,jsonb) to service_role;
create table bud_platform.promo_operations (
 actor uuid not null references auth.users(id),operation_id uuid not null,kind text not null,
 request jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor,operation_id)
);
alter table bud_platform.promo_operations enable row level security;
revoke all on bud_platform.promo_operations from public,anon,authenticated,service_role;
grant select,insert on bud_platform.promo_operations to service_role;
create function public.bud_owner_promo_operation(p_actor uuid,p_discord text,p_operation uuid,p_kind text,p_request jsonb,p_result jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v bud_platform.promo_operations; a bud_platform.owner_audit;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_operation is null or p_kind not in ('promoCreate','promoPause','promoResume') or p_request is null
 or length(trim(p_request->>'reason')) not between 3 and 300 then raise exception 'BUD_INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_operation::text,27));
 insert into bud_platform.promo_operations(actor,operation_id,kind,request) values(p_actor,p_operation,p_kind,p_request) on conflict do nothing;
 select * into v from bud_platform.promo_operations where actor=p_actor and operation_id=p_operation;
 if v.kind<>p_kind or v.request is distinct from p_request then raise exception 'BUD_KEY_REUSED'; end if;
 select * into a from bud_platform.owner_audit where actor=p_actor and operation_id=p_operation;
 if found then
  if a.kind<>p_kind or a.outcome->'request' is distinct from p_request then raise exception 'BUD_KEY_REUSED'; end if;
  return (a.outcome-'request')||jsonb_build_object('replayed',true);
 end if;
 if p_result is null then return jsonb_build_object('prepared',true); end if;
 if p_result->>'id' !~ '^promo_[A-Za-z0-9]{5,80}$' then raise exception 'BUD_INVALID_REQUEST'; end if;
 insert into bud_platform.owner_audit(actor,operation_id,kind,subject,reason,outcome)
 values(p_actor,p_operation,p_kind,p_result->>'id',trim(p_request->>'reason'),p_result||jsonb_build_object('request',p_request));
 return p_result||jsonb_build_object('replayed',false);
end;
$$;
revoke all on function public.bud_owner_promo_operation(uuid,text,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.bud_owner_promo_operation(uuid,text,uuid,text,jsonb,jsonb) to service_role;
commit;
