-- Restore the approved text-only feedback contract without deleting historical reviews.
-- Keep legacy rating values in storage for audit/history, but do not require, expose,
-- or create new star ratings. Explicit public consent is retained.
begin;

create or replace function public.bud_review_submit_comment(
 p_host uuid,p_comment text,p_name text,p_avatar text,p_consent boolean
) returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v bud_platform.event_reviews;
begin
 if p_host is null or p_comment is null or char_length(btrim(p_comment)) not between 3 and 500
  or p_name is null or char_length(btrim(p_name)) not between 1 and 60
  or p_consent is null
  or (p_avatar is not null and (char_length(p_avatar)>256 or p_avatar not like 'https://cdn.discordapp.com/%'))
 then raise exception 'BUD_INVALID_REQUEST';end if;

 insert into bud_platform.event_reviews(host_id,rating,comment,display_name,avatar_url,publish_consent,status)
 values(p_host,null,btrim(p_comment),btrim(p_name),p_avatar,p_consent,
  case when p_consent then 'published' else 'pending' end)
 on conflict(host_id) do update set
  comment=excluded.comment,display_name=excluded.display_name,
  avatar_url=excluded.avatar_url,publish_consent=excluded.publish_consent,
  updated_at=clock_timestamp(),
  status=case when excluded.publish_consent then 'published' else 'pending' end,
  featured_rank=case when not excluded.publish_consent
   or bud_platform.event_reviews.comment is distinct from excluded.comment
   or bud_platform.event_reviews.display_name is distinct from excluded.display_name
   or bud_platform.event_reviews.avatar_url is distinct from excluded.avatar_url
   then null else bud_platform.event_reviews.featured_rank end
 returning * into v;

 return jsonb_build_object('received',true,'id',v.id,'status',v.status,'publishConsent',v.publish_consent);
end;
$function$;

create or replace function public.bud_review_mine(p_host uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce((select jsonb_build_object(
  'comment',comment,'publishConsent',publish_consent,'status',status
 ) from bud_platform.event_reviews where host_id=p_host), '{}'::jsonb);
$$;

create or replace function public.bud_reviews_latest_text(p_offset integer default 0,p_limit integer default 12)
returns jsonb language plpgsql stable security invoker set search_path=''
as $function$
declare answer jsonb;
begin
 if p_offset is null or p_offset<0 or p_offset>10000
  or p_limit is null or p_limit<1 or p_limit>12 then raise exception 'BUD_INVALID_REQUEST';end if;
 select jsonb_build_object(
  'items',coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'name',q.display_name,'comment',q.comment,
   'avatarUrl',q.avatar_url,'publishedAt',q.updated_at
  ) order by q.updated_at desc,q.id desc) filter(where q.page_row<=p_limit),'[]'::jsonb),
  'hasMore',count(*)>p_limit
 ) into answer from (
  select page.*,row_number() over(order by page.updated_at desc,page.id desc) page_row from (
   select id,display_name,comment,avatar_url,updated_at
   from bud_platform.event_reviews
   where status='published' and publish_consent=true
   order by updated_at desc,id desc limit p_limit+1 offset p_offset
  ) page
 ) q;
 return answer;
end;
$function$;

create or replace function public.bud_reviews_public_text() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select id,comment,display_name as name,avatar_url as "avatarUrl"
  from bud_platform.event_reviews
  where status='published' and publish_consent=true and featured_rank between 1 and 5
  order by featured_rank asc limit 5
 ) x;
$$;

create or replace function public.bud_reviews_owner(p_actor uuid,p_discord text,p_offset integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $function$
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'BUD_INVALID_REQUEST';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select id,host_id,comment,display_name,avatar_url,publish_consent,status,featured_rank,created_at,updated_at
  from bud_platform.event_reviews order by featured_rank asc nulls last,updated_at desc,id limit 50 offset p_offset
 ) x));
end;
$function$;

revoke all on function public.bud_review_submit_comment(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.bud_review_submit_comment(uuid,text,text,text,boolean) to service_role;

-- The previous rated submission function is deliberately retained for rollback
-- during cutover. The app no longer calls it; old rating data remains untouched.
commit;
