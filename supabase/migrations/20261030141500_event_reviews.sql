begin;
create table bud_platform.event_reviews (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique references bud_platform.live_events(id),
 host_id uuid not null references auth.users(id), rating smallint not null check(rating between 1 and 5),
 comment text not null check(char_length(comment)<=500), display_name text not null check(char_length(display_name) between 1 and 60),
 publish_consent boolean not null, status text not null default 'pending' check(status in ('pending','published','hidden')),
 created_at timestamptz not null default clock_timestamp(),moderated_at timestamptz,
 check(status<>'published' or (publish_consent and char_length(btrim(comment))>=3))
);
create index bud_event_reviews_created on bud_platform.event_reviews(created_at desc);
alter table bud_platform.event_reviews enable row level security;
revoke all on bud_platform.event_reviews from public,anon,authenticated,service_role;
grant select,insert,update on bud_platform.event_reviews to service_role;
create function public.bud_review_submit(p_host uuid,p_event uuid,p_rating integer,p_comment text,p_name text,p_consent boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v bud_platform.event_reviews;
begin
 if p_rating is null or p_rating not between 1 and 5 or p_comment is null or char_length(p_comment)>500
 or p_name is null or char_length(btrim(p_name)) not between 1 and 60 or p_consent is null then raise exception 'BUD_INVALID_REQUEST';end if;
 -- Entitlement/ownership only: local game data and winner names never leave the browser.
 if not exists(select 1 from bud_platform.live_events e join bud_platform.live_event_debits d on d.event_id=e.id
  where e.id=p_event and e.host_id=p_host and d.host_id=p_host) then raise exception 'BUD_RESOURCE_NOT_FOUND';end if;
 insert into bud_platform.event_reviews(event_id,host_id,rating,comment,display_name,publish_consent)
 values(p_event,p_host,p_rating,btrim(p_comment),btrim(p_name),p_consent) on conflict(event_id) do nothing;
 select * into v from bud_platform.event_reviews where event_id=p_event;
 if v.host_id<>p_host or v.rating<>p_rating or v.comment<>btrim(p_comment) or v.display_name<>btrim(p_name) or v.publish_consent<>p_consent then raise exception 'BUD_KEY_REUSED';end if;
 return jsonb_build_object('received',true,'id',v.id);
end;
$$;
create function public.bud_reviews_owner(p_actor uuid,p_discord text,p_offset integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'BUD_INVALID_REQUEST';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(x),'[]'::jsonb) from
 (select id,event_id,host_id,rating,comment,display_name,publish_consent,status,created_at from bud_platform.event_reviews order by created_at desc,id limit 50 offset p_offset)x));
end;
$$;
create function public.bud_reviews_public() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from
 (select id,rating,comment,display_name as name from bud_platform.event_reviews where status='published' and publish_consent order by moderated_at desc,id limit 12)x;
$$;
create function public.bud_review_moderate(p_actor uuid,p_discord text,p_operation uuid,p_id uuid,p_status text,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v bud_platform.event_reviews; a bud_platform.owner_audit; r jsonb; q jsonb;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_operation is null or p_id is null or p_status is null or p_status not in ('published','hidden')
 or p_reason is null or length(trim(p_reason)) not between 3 and 300 then raise exception 'BUD_INVALID_REQUEST';end if;
 q:=jsonb_build_object('id',p_id,'status',p_status,'reason',trim(p_reason));
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_operation::text,27));
 select * into a from bud_platform.owner_audit where actor=p_actor and operation_id=p_operation;
 if found then
  if a.kind<>'reviewModerate' or a.outcome->'request' is distinct from q then raise exception 'BUD_KEY_REUSED';end if;
  return (a.outcome-'request')||jsonb_build_object('replayed',true);
 end if;
 select * into v from bud_platform.event_reviews where id=p_id for update;
 if not found then raise exception 'BUD_RESOURCE_NOT_FOUND';end if;
 if p_status='published' and (not v.publish_consent or char_length(btrim(v.comment))<3) then raise exception 'BUD_INVALID_REQUEST';end if;
 update bud_platform.event_reviews set status=p_status,moderated_at=clock_timestamp() where id=p_id;
 r:=jsonb_build_object('id',p_id,'status',p_status);
 insert into bud_platform.owner_audit(actor,operation_id,kind,subject,reason,outcome) values(p_actor,p_operation,'reviewModerate',p_id::text,trim(p_reason),r||jsonb_build_object('request',q));
 return r||jsonb_build_object('replayed',false);
end;
$$;
revoke all on function public.bud_review_submit(uuid,uuid,integer,text,text,boolean),public.bud_reviews_owner(uuid,text,integer),public.bud_reviews_public(),public.bud_review_moderate(uuid,text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bud_review_submit(uuid,uuid,integer,text,text,boolean),public.bud_reviews_owner(uuid,text,integer),public.bud_reviews_public(),public.bud_review_moderate(uuid,text,uuid,uuid,text,text) to service_role;
commit;
