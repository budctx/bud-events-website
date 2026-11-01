begin;
-- Preserve the legacy RPCs for rollback; text-only reviews use a separate contract.
alter table bud_platform.event_reviews alter column rating drop not null;
alter table bud_platform.event_reviews alter column publish_consent set default true;
alter table bud_platform.event_reviews add column avatar_url text constraint event_reviews_avatar_url_check check (
 avatar_url is null or (char_length(avatar_url)<=256 and avatar_url like 'https://cdn.discordapp.com/%')
);
create function public.bud_review_submit_text(p_host uuid,p_event uuid,p_comment text,p_name text,p_avatar text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v bud_platform.event_reviews;
begin
 if p_comment is null or char_length(btrim(p_comment)) not between 3 and 500
  or p_name is null or char_length(btrim(p_name)) not between 1 and 60
  or (p_avatar is not null and (char_length(p_avatar)>256 or p_avatar not like 'https://cdn.discordapp.com/%'))
 then raise exception 'BUD_INVALID_REQUEST';end if;
 -- Only the authenticated host of a debited event can submit; no local game state is uploaded.
 if not exists(select 1 from bud_platform.live_events e join bud_platform.live_event_debits d on d.event_id=e.id
  where e.id=p_event and e.host_id=p_host and d.host_id=p_host) then raise exception 'BUD_RESOURCE_NOT_FOUND';end if;
 insert into bud_platform.event_reviews(event_id,host_id,rating,comment,display_name,avatar_url,publish_consent,status)
 values(p_event,p_host,null,btrim(p_comment),btrim(p_name),p_avatar,true,'pending') on conflict(event_id) do nothing;
 select * into v from bud_platform.event_reviews where event_id=p_event;
 if v.host_id<>p_host or v.rating is not null or v.comment<>btrim(p_comment) or v.display_name<>btrim(p_name)
  or v.avatar_url is distinct from p_avatar or not v.publish_consent then raise exception 'BUD_KEY_REUSED';end if;
 return jsonb_build_object('received',true,'id',v.id);
end;
$$;
create function public.bud_reviews_owner_text(p_actor uuid,p_discord text,p_offset integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'BUD_INVALID_REQUEST';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(x),'[]'::jsonb) from
  (select id,event_id,host_id,comment,display_name,avatar_url,status,created_at from bud_platform.event_reviews
  order by created_at desc,id limit 50 offset p_offset)x));
end;
$$;
create function public.bud_reviews_public_text() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from
 (select id,comment,display_name as name,avatar_url as "avatarUrl" from bud_platform.event_reviews
  where status='published' and publish_consent order by moderated_at desc,id limit 12)x;
$$;
revoke all on function public.bud_review_submit_text(uuid,uuid,text,text,text),
 public.bud_reviews_owner_text(uuid,text,integer),public.bud_reviews_public_text() from public,anon,authenticated;
grant execute on function public.bud_review_submit_text(uuid,uuid,text,text,text),
 public.bud_reviews_owner_text(uuid,text,integer),public.bud_reviews_public_text() to service_role;
commit;
