-- Publish authenticated Discord reviews immediately; retain owner hide/feature workflows.
-- Existing pending/hidden reviews are not republished by this migration.
create or replace function public.bud_review_submit_text(p_host uuid, p_comment text, p_name text, p_avatar text)
returns jsonb language plpgsql set search_path to ''
as $function$
declare v bud_platform.event_reviews;
begin
 if p_host is null or p_comment is null or char_length(btrim(p_comment)) not between 3 and 500
 or p_name is null or char_length(btrim(p_name)) not between 1 and 60
 or (p_avatar is not null and (char_length(p_avatar)>256 or p_avatar not like 'https://cdn.discordapp.com/%'))
 then raise exception 'BUD_INVALID_REQUEST'; end if;
 insert into bud_platform.event_reviews(host_id,rating,comment,display_name,avatar_url,publish_consent,status)
 values(p_host,null,btrim(p_comment),btrim(p_name),p_avatar,true,'published')
 on conflict(host_id) do update set
  comment=excluded.comment,display_name=excluded.display_name,avatar_url=excluded.avatar_url,
  rating=null,publish_consent=true,updated_at=clock_timestamp(),status='published',
  featured_rank=case when bud_platform.event_reviews.comment is distinct from excluded.comment
     or bud_platform.event_reviews.display_name is distinct from excluded.display_name
     or bud_platform.event_reviews.avatar_url is distinct from excluded.avatar_url
     then null else bud_platform.event_reviews.featured_rank end
 returning * into v;
 return jsonb_build_object('received',true,'id',v.id,'status',v.status);
end;
$function$;

create or replace function public.bud_reviews_latest_text(p_offset integer default 0,p_limit integer default 12)
returns jsonb language plpgsql stable set search_path to ''
as $function$
declare answer jsonb;
begin
 if p_offset is null or p_offset<0 or p_offset>10000
 or p_limit is null or p_limit<1 or p_limit>12 then raise exception 'BUD_INVALID_REQUEST'; end if;
 select jsonb_build_object(
   'items',coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.display_name,'comment',q.comment,'avatarUrl',q.avatar_url,'publishedAt',q.updated_at)
       order by q.updated_at desc,q.id desc) filter(where q.rn<=p_limit),'[]'::jsonb),
   'hasMore',count(*)>p_limit)
 into answer from (
   select id,display_name,comment,avatar_url,updated_at,row_number() over(order by updated_at desc,id desc) rn
   from bud_platform.event_reviews
   where status='published' and publish_consent=true
   order by updated_at desc,id desc limit p_limit+1 offset p_offset
 ) q;
 return answer;
end;
$function$;
revoke all on function public.bud_reviews_latest_text(integer,integer) from public,anon,authenticated;
grant execute on function public.bud_reviews_latest_text(integer,integer) to service_role;
