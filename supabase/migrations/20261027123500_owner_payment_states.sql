-- W-03: owner-only read model. An unfulfilled checkout does NOT prove Whop was paid.
-- Existing role grants, SECURITY INVOKER and ownership verification are retained.
-- No financial data, ledger, payment job, wallet or administrative receipt is mutated.
begin;
create or replace function public.bud_owner_view(p_actor uuid,p_discord text,p_section text,p_search text default '',p_offset integer default 0) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_rows jsonb; v_secondary jsonb:='[]'::jsonb; v_user uuid;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_search is null or length(p_search)>80 or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'BUD_INVALID_REQUEST'; end if;
 case p_section
 when 'overview' then
  return jsonb_build_object('users',bud_platform.owner_user_count(p_actor,p_discord),'wallets',(select count(*) from bud_platform.live_wallets),'slots',(select coalesce(sum(credits),0) from bud_platform.live_wallets),
   'orders',(select count(*) from bud_platform.live_orders),'pendingOrders',(select count(*) from bud_platform.live_orders where fulfilled_at is null),
   'checkoutNotStarted',(select count(*) from bud_platform.live_orders where fulfilled_at is null and checkout_id is null),
   'checkoutUnverified',(select count(*) from bud_platform.live_orders where fulfilled_at is null and checkout_id is not null),
   'events',(select count(*) from bud_platform.live_events),'codes',(select count(*) from bud_platform.redeem_codes),
   'redemptions',(select count(*) from bud_platform.bonus_ledger where source='redeem'),'health',public.bud_live_operations_health(),
   'alerts',(select coalesce(jsonb_agg(a order by severity,last_seen desc),'[]'::jsonb) from bud_platform.owner_alerts a where active));
 when 'users' then
  v_rows:=bud_platform.owner_directory(p_actor,p_discord,p_search,p_offset);
 when 'user' then
  if p_search !~ '^[a-fA-F0-9-]{36}$' then raise exception 'BUD_INVALID_REQUEST'; end if;
  v_user:=p_search::uuid;
  return jsonb_build_object('user',(select x from jsonb_array_elements(bud_platform.owner_directory(p_actor,p_discord,p_search,0)) x where x->>'id'=p_search),
   'credits',coalesce((select credits from bud_platform.live_wallets where host_id=v_user),0),
   'restriction',(select to_jsonb(r)-'actor' from bud_platform.user_restrictions r where host_id=v_user),
   'orders',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(select id,amount_minor,currency,created_at,fulfilled_at from bud_platform.live_orders where host_id=v_user order by created_at desc limit 50)x),
   'grants',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(select id,source,qty,created_at from bud_platform.bonus_ledger where host_id=v_user order by created_at desc limit 50)x),
   'events',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(select id,title,phase,started_at,updated_at from bud_platform.live_events where host_id=v_user order by started_at desc limit 50)x));
 when 'keys' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_rows from(select id,qty,max_uses,uses,expires_at,suspended,created_at from bud_platform.redeem_codes
   where p_search='' or position(p_search in id::text)>0 order by created_at desc,id limit 50 offset p_offset)x;
 when 'payments' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_rows from(select o.id,o.host_id,o.amount_minor,o.currency,o.created_at,o.fulfilled_at,
    case when r.state in ('review','refunded','disputed') then r.state
         when o.fulfilled_at is not null then 'confirmed'
         when o.checkout_id is null then 'checkout_not_started'
         else 'checkout_unverified' end as state
   from bud_platform.live_orders o left join bud_platform.live_reconciliation r on r.order_id=o.id
   where p_search='' or position(p_search in o.id::text)>0 order by o.created_at desc,o.id limit 50 offset p_offset)x;
 when 'events' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_rows from(select id,host_id,title,phase,started_at,updated_at
   from bud_platform.live_events where p_search='' or position(lower(p_search) in lower(id::text||' '||title))>0 order by started_at desc,id limit 50 offset p_offset)x;
 when 'audit' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_rows from(select * from bud_platform.owner_audit
   where p_search='' or position(lower(p_search) in lower(subject||' '||kind))>0 order by created_at desc,id limit 50 offset p_offset)x;
 when 'health' then
  return jsonb_build_object('database','ok','payments',public.bud_live_operations_health(),'discord','unknown','whop','unknown','vercel','unknown');
 when 'settings' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_rows from(select name,value from bud_platform.owner_settings)x;
 when 'search' then
  if length(trim(p_search))<2 then raise exception 'BUD_INVALID_REQUEST'; end if;
  return jsonb_build_object('users',public.bud_owner_view(p_actor,p_discord,'users',p_search,p_offset),
   'payments',public.bud_owner_view(p_actor,p_discord,'payments',p_search,p_offset),
   'events',public.bud_owner_view(p_actor,p_discord,'events',p_search,p_offset),
   'keys',public.bud_owner_view(p_actor,p_discord,'keys',p_search,p_offset));
 else raise exception 'BUD_INVALID_REQUEST';
 end case;
 if p_section='keys' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_secondary from
   (select id,host_id,source,code_id,qty,created_at from bud_platform.bonus_ledger
    where p_search='' or position(lower(p_search) in lower(id::text||' '||host_id::text||' '||source||' '||coalesce(code_id::text,'')))>0
    order by created_at desc,id limit 50 offset p_offset)x;
 elsif p_section='audit' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_secondary from
   (select id,actor,kind,created_at from bud_platform.owner_access_events
    where p_search='' or position(lower(p_search) in lower(id::text||' '||coalesce(actor::text,'')||' '||kind))>0
    order by created_at desc,id limit 50 offset p_offset)x;
 end if;
 return jsonb_build_object('rows',v_rows,'offset',p_offset,'pageSize',50,'mayHaveMore',jsonb_array_length(v_rows)=50 or jsonb_array_length(v_secondary)=50)
  ||case when p_section='keys' then jsonb_build_object('history',v_secondary) when p_section='audit' then jsonb_build_object('accessEvents',v_secondary) else '{}'::jsonb end;
end;
$$;
commit;
