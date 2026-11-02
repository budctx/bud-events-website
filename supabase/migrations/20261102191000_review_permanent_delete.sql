-- Permanently delete an owner-selected review from live content while retaining a minimal audit record.
-- Only the service-role backend can execute this RPC after owner session verification.
grant delete on bud_platform.event_reviews to service_role;

create function public.bud_review_delete(p_actor uuid,p_discord text,p_operation uuid,p_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare
 a bud_platform.owner_audit;
 q jsonb;
 result jsonb;
 deleted_id uuid;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_operation is null or p_id is null or p_reason is null
  or char_length(btrim(p_reason)) not between 3 and 300 then
  raise exception 'BUD_INVALID_REQUEST';
 end if;
 q:=jsonb_build_object('id',p_id,'reason',btrim(p_reason));
 -- Serialize with the existing homepage feature selection transaction.
 perform pg_advisory_xact_lock(91311986);
 select * into a from bud_platform.owner_audit
  where actor=p_actor and operation_id=p_operation;
 if found then
  if a.kind<>'reviewDelete' or a.outcome->'request' is distinct from q then
   raise exception 'BUD_KEY_REUSED';
  end if;
  return (a.outcome-'request')||jsonb_build_object('replayed',true);
 end if;
 delete from bud_platform.event_reviews where id=p_id returning id into deleted_id;
 if deleted_id is null then raise exception 'BUD_RESOURCE_NOT_FOUND'; end if;
 result:=jsonb_build_object('id',deleted_id,'deleted',true);
 insert into bud_platform.owner_audit(actor,operation_id,kind,subject,reason,outcome)
 values(p_actor,p_operation,'reviewDelete',deleted_id::text,btrim(p_reason),
  result||jsonb_build_object('request',q));
 return result||jsonb_build_object('replayed',false);
end;
$function$;
revoke all on function public.bud_review_delete(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.bud_review_delete(uuid,text,uuid,uuid,text) to service_role;
