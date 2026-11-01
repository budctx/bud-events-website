begin;
-- A single review per verified Discord account, whether reached from a shared link or a finished event.
alter table bud_platform.event_reviews alter column event_id drop not null;
alter table bud_platform.event_reviews alter column rating drop not null;
alter table bud_platform.event_reviews alter column publish_consent set default true;
alter table bud_platform.event_reviews add column avatar_url text
 constraint bud_review_avatar_url check(avatar_url is null or (char_length(avatar_url)<=256 and avatar_url like 'https://cdn.discordapp.com/%'));
alter table bud_platform.event_reviews add column featured_rank smallint
 constraint bud_review_featured_rank check(featured_rank between 1 and 5);
alter table bud_platform.event_reviews add column updated_at timestamptz not null default now();
create unique index bud_review_one_per_host on bud_platform.event_reviews(host_id);
create unique index bud_review_unique_feature on bud_platform.event_reviews(featured_rank) where featured_rank is not null;
alter table bud_platform.event_reviews add constraint bud_review_featured_published check(featured_rank is null or status='published');

create function public.bud_review_submit_text(p_host uuid,p_comment text,p_name text,p_avatar text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v bud_platform.event_reviews;
begin
 if p_host is null or p_comment is null or char_length(btrim(p_comment)) not between 3 and 500
 or p_name is null or char_length(btrim(p_name)) not between 1 and 60
 or (p_avatar is not null and (char_length(p_avatar)>256 or p_avatar not like 'https://cdn.discordapp.com/%'))
 then raise exception 'BUD_INVALID_REQUEST';end if;
 insert into bud_platform.event_reviews(host_id,rating,comment,display_name,avatar_url,publish_consent,status)
 values(p_host,null,btrim(p_comment),btrim(p_name),p_avatar,true,'pending')
 on conflict(host_id) do update set
  comment=excluded.comment,display_name=excluded.display_name,avatar_url=excluded.avatar_url,
  rating=null,publish_consent=true,updated_at=clock_timestamp(),
  status=case when bud_platform.event_reviews.comment is distinct from excluded.comment
                or bud_platform.event_reviews.display_name is distinct from excluded.display_name
                or bud_platform.event_reviews.avatar_url is distinct from excluded.avatar_url
              then 'pending' else bud_platform.event_reviews.status end,
  featured_rank=case when bud_platform.event_reviews.comment is distinct from excluded.comment
                or bud_platform.event_reviews.display_name is distinct from excluded.display_name
                or bud_platform.event_reviews.avatar_url is distinct from excluded.avatar_url
              then null else bud_platform.event_reviews.featured_rank end
 returning * into v;
 return jsonb_build_object('received',true,'id',v.id,'status',v.status);
end;
$$;

create function public.bud_review_mine(p_host uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce((select jsonb_build_object('comment',comment,'status',status)
 from bud_platform.event_reviews where host_id=p_host), '{}'::jsonb);
$$;

create or replace function public.bud_reviews_owner(p_actor uuid,p_discord text,p_offset integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'BUD_INVALID_REQUEST';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(x),'[]'::jsonb) from
 (select id,host_id,comment,display_name,avatar_url,status,featured_rank,created_at,updated_at
 from bud_platform.event_reviews order by featured_rank asc nulls last,updated_at desc,id limit 50 offset p_offset)x));
end;
$$;

create function public.bud_reviews_public_text() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from
 (select id,comment,display_name as name,avatar_url as "avatarUrl" from bud_platform.event_reviews
 where status='published' and featured_rank between 1 and 5 order by featured_rank asc limit 5)x;
$$;

create function public.bud_review_feature(p_actor uuid,p_discord text,p_operation uuid,p_id uuid,p_rank integer,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v bud_platform.event_reviews; old_rank integer; occupied uuid; a bud_platform.owner_audit;
 q jsonb; result jsonb;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_operation is null or p_id is null or (p_rank is not null and p_rank not between 1 and 5)
 or p_reason is null or char_length(btrim(p_reason)) not between 3 and 300 then raise exception 'BUD_INVALID_REQUEST';end if;
 q:=jsonb_build_object('id',p_id,'rank',p_rank,'reason',btrim(p_reason));
 perform pg_advisory_xact_lock(91311986);
 select * into a from bud_platform.owner_audit where actor=p_actor and operation_id=p_operation;
 if found then
  if a.kind<>'reviewFeature' or a.outcome->'request' is distinct from q then raise exception 'BUD_KEY_REUSED';end if;
  return (a.outcome-'request')||jsonb_build_object('replayed',true);
 end if;
 select * into v from bud_platform.event_reviews where id=p_id for update;
 if not found then raise exception 'BUD_RESOURCE_NOT_FOUND';end if;
 old_rank:=v.featured_rank;
 if p_rank is null then
  update bud_platform.event_reviews set featured_rank=null,status='hidden',moderated_at=clock_timestamp() where id=p_id;
 else
  select id into occupied from bud_platform.event_reviews where featured_rank=p_rank and id<>p_id;
  update bud_platform.event_reviews set featured_rank=null where id=p_id;
  if occupied is not null then
   update bud_platform.event_reviews set featured_rank=null,status='pending' where id=occupied;
  end if;
  update bud_platform.event_reviews set status='published',featured_rank=p_rank,moderated_at=clock_timestamp() where id=p_id;
  if occupied is not null and old_rank is not null and old_rank<>p_rank then
   update bud_platform.event_reviews set featured_rank=old_rank,status='published',moderated_at=clock_timestamp() where id=occupied;
  end if;
 end if;
 result:=jsonb_build_object('id',p_id,'rank',p_rank);
 insert into bud_platform.owner_audit(actor,operation_id,kind,subject,reason,outcome)
 values(p_actor,p_operation,'reviewFeature',p_id::text,btrim(p_reason),result||jsonb_build_object('request',q));
 return result||jsonb_build_object('replayed',false);
end;
$$;

revoke all on function public.bud_review_submit_text(uuid,text,text,text),public.bud_review_mine(uuid),
 public.bud_reviews_public_text(),public.bud_review_feature(uuid,text,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.bud_review_submit_text(uuid,text,text,text),public.bud_review_mine(uuid),
 public.bud_reviews_public_text(),public.bud_review_feature(uuid,text,uuid,uuid,integer,text) to service_role;
commit;
