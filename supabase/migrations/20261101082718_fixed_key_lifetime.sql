-- Fixed lifetime for newly issued owner keys; existing keys and audit receipts remain unchanged.
create or replace function public.bud_owner_command(p_actor uuid,p_discord text,p_operation uuid,p_kind text,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_old bud_platform.owner_audit; v_result jsonb; v_id uuid; v_host uuid; v_reason text; v_code bud_platform.redeem_codes; v_created timestamptz;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_operation is null or p_body is null then raise exception 'BUD_INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_operation::text,27));
 select * into v_old from bud_platform.owner_audit where actor=p_actor and operation_id=p_operation;
 if found then
  if v_old.kind<>p_kind or v_old.outcome->'request' is distinct from (p_body-'digest') then raise exception 'BUD_KEY_REUSED'; end if;
  return (v_old.outcome-'request')||jsonb_build_object('replayed',true);
 end if;
 v_reason:=p_body->>'reason';
 if v_reason is null or length(trim(v_reason)) not between 3 and 300 then raise exception 'BUD_INVALID_REQUEST'; end if;
 case p_kind
 when 'createCode' then
  if (p_body->>'qty')::integer not between 1 and 100 or (p_body->>'maxUses')::integer not between 1 and 10000
   or p_body->>'qty' is null or p_body->>'maxUses' is null then raise exception 'BUD_INVALID_REQUEST'; end if;
  v_created:=clock_timestamp();
  insert into bud_platform.redeem_codes(digest,qty,max_uses,expires_at,created_by,operation_id,created_at)
   values(p_body->>'digest',(p_body->>'qty')::integer,(p_body->>'maxUses')::integer,((v_created at time zone 'UTC') + interval '3 months') at time zone 'UTC',p_actor,p_operation,v_created) returning id into v_id;
  v_result:=jsonb_build_object('id',v_id,'created',true);
 when 'suspendCode' then
  v_id:=(p_body->>'id')::uuid;
  select * into v_code from bud_platform.redeem_codes where id=v_id for update;
  if not found then raise exception 'BUD_RESOURCE_NOT_FOUND'; end if;
  update bud_platform.redeem_codes set suspended=true where id=v_id;
  v_result:=jsonb_build_object('id',v_id,'suspended',true);
 when 'grant' then
  v_host:=(p_body->>'hostId')::uuid;
  if (p_body->>'qty')::integer not between 1 and 100 then raise exception 'BUD_INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_host::text,26));
  insert into bud_platform.live_wallets(host_id,credits) values(v_host,0) on conflict do nothing;
  perform 1 from bud_platform.live_wallets where host_id=v_host for update;
  if exists(select 1 from bud_platform.user_restrictions where host_id=v_host and suspended) then raise exception 'BUD_ACCOUNT_RESTRICTED'; end if;
  if jsonb_array_length(bud_platform.owner_directory(p_actor,p_discord,v_host::text,0))<>1 then raise exception 'BUD_RESOURCE_NOT_FOUND'; end if;
  insert into bud_platform.bonus_ledger(host_id,source,actor,operation_id,qty,reason)
   values(v_host,'admin_grant',p_actor,p_operation,(p_body->>'qty')::integer,v_reason) returning id into v_id;
  insert into bud_platform.live_wallets(host_id,credits) values(v_host,(p_body->>'qty')::integer)
   on conflict(host_id) do update set credits=bud_platform.live_wallets.credits+excluded.credits;
  v_result:=jsonb_build_object('id',v_id,'hostId',v_host,'qty',(p_body->>'qty')::integer);
 when 'restrict' then
  v_host:=(p_body->>'hostId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(v_host::text,26));
  if v_host=p_actor or exists(select 1 from bud_platform.platform_owners where host_id=v_host) then raise exception 'BUD_INVALID_REQUEST'; end if;
  insert into bud_platform.live_wallets(host_id,credits) values(v_host,0) on conflict do nothing;
  perform 1 from bud_platform.live_wallets where host_id=v_host for update;
  insert into bud_platform.user_restrictions(host_id,suspended,reason,actor)
   values(v_host,(p_body->>'suspended')::boolean,v_reason,p_actor)
   on conflict(host_id) do update set suspended=excluded.suspended,reason=excluded.reason,actor=excluded.actor,updated_at=clock_timestamp();
  v_result:=jsonb_build_object('hostId',v_host,'suspended',(p_body->>'suspended')::boolean);
 when 'setting' then
  if p_body->>'name'<>'operations_note' or length(p_body->>'value')>500 then raise exception 'BUD_INVALID_REQUEST'; end if;
  insert into bud_platform.owner_settings(name,value) values(p_body->>'name',p_body->>'value') on conflict(name) do update set value=excluded.value;
  v_result:=jsonb_build_object('saved',true);
 when 'ack' then
  update bud_platform.owner_alerts set acknowledged_at=clock_timestamp(),acknowledged_by=p_actor where fingerprint=p_body->>'fingerprint' and active;
  if not found then raise exception 'BUD_RESOURCE_NOT_FOUND'; end if;
  v_result:=jsonb_build_object('acknowledged',true);
 else raise exception 'BUD_INVALID_REQUEST';
 end case;
 insert into bud_platform.owner_audit(actor,operation_id,kind,subject,reason,outcome)
  values(p_actor,p_operation,p_kind,coalesce(v_host::text,v_id::text,p_body->>'name',p_body->>'fingerprint',''),v_reason,
   v_result||jsonb_build_object('request',p_body-'digest'));
 return v_result||jsonb_build_object('replayed',false);
end;
$$;
