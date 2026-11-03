-- Mini Games event type: one shared credit for any event, no new checkout product.
-- Draft feature remains disabled at the HTTP layer until explicitly enabled and reviewed.
-- Never uploads game progress, winner names or prize configuration to Supabase.
begin;

alter table bud_platform.live_events
 add column if not exists event_kind text not null default 'question-condition'
 check(event_kind in ('question-condition','mini-games'));
-- Question & Condition records retain their original content_version and pair_order.
-- Mini Games has its own static local catalog and does not require a QC pair catalog.
alter table bud_platform.live_events alter column content_version drop not null;
alter table bud_platform.live_events alter column pair_order drop not null;
create index if not exists bud_live_events_kind on bud_platform.live_events(event_kind);

-- Preserve the Question & Condition receipt rendering, while ensuring Mini Games
-- never reads card data from another event's catalog.
create or replace function bud_platform.live_host_event(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when e.event_kind='mini-games' then
  jsonb_build_object('eventId',e.id,'title',e.title,'phase',e.phase,
   'version',e.version,'state',e.state,'kind','mini-games','storage','browser-v2',
   'updatedAt',e.updated_at,'serverNow',floor(extract(epoch from statement_timestamp())*1000))
 else
  jsonb_build_object('eventId',e.id,'title',e.title,'phase',e.phase,'version',e.version,
   'state',e.state,'updatedAt',e.updated_at,
   'serverNow',floor(extract(epoch from statement_timestamp())*1000),
   'cards',jsonb_build_object('question',c.questions->pos.q_idx->>'ar',
     'condition',c.conditions->pos.c_idx->>'ar'),
   'cardsEn',jsonb_build_object('question',c.questions->pos.q_idx->>'en',
     'condition',c.conditions->pos.c_idx->>'en'))
 end
 from bud_platform.live_events e
 left join bud_platform.content_versions c on c.id=e.content_version
 cross join lateral (
  select
   case when e.event_kind='mini-games' then null::int
        when e.state ? 'activityDraw' then (e.state #>> '{activityDraw,current,pair,0}')::int
        else coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)
          / jsonb_array_length(c.conditions) end as q_idx,
   case when e.event_kind='mini-games' then null::int
        when e.state ? 'activityDraw' then (e.state #>> '{activityDraw,current,pair,1}')::int
        else coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)
          % jsonb_array_length(c.conditions) end as c_idx
 ) pos
 where e.id=p_event;
$$;
revoke all on function bud_platform.live_host_event(uuid) from public,anon,authenticated;
grant execute on function bud_platform.live_host_event(uuid) to service_role;

-- Dedicated paid start uses the exact same shared live_wallets balance and live_event_debits ledger.
-- A duplicate start key returns the original receipt before checking the balance again.
create function public.bud_live_host_mini_start(p_host uuid,p_key text,p_title text,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e bud_platform.live_events; credits integer;
begin
 if p_host is null or p_key is null or p_key !~ '^[A-Za-z0-9_-]{16,100}$'
    or p_title is null or char_length(btrim(p_title)) not between 1 and 100
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
 then raise exception 'BUD_INVALID_EVENT'; end if;
 insert into bud_platform.live_wallets(host_id) values(p_host) on conflict do nothing;
 select w.credits into credits from bud_platform.live_wallets w where w.host_id=p_host for update;
 perform bud_platform.expire_live_host_events(p_host);
 select * into e from bud_platform.live_events where host_id=p_host and start_key=p_key;
 if found then
  if e.start_fingerprint is distinct from p_fingerprint or e.event_kind<>'mini-games'
   then raise exception 'BUD_KEY_REUSED'; end if;
  return bud_platform.live_host_event(e.id);
 end if;
 if not coalesce((select host_enabled from bud_platform.live_commerce_control where singleton),false)
  then raise exception 'BUD_LIVE_HOST_DISABLED'; end if;
 if exists(select 1 from bud_platform.user_restrictions where host_id=p_host and suspended)
  then raise exception 'BUD_ACCOUNT_RESTRICTED'; end if;
 if exists(select 1 from bud_platform.live_events where host_id=p_host and phase<>'completed')
  then raise exception 'BUD_ACTIVE_EVENT'; end if;
 if credits<1 then raise exception 'BUD_NO_CREDIT'; end if;
 insert into bud_platform.live_events(host_id,title,start_key,phase,version,state,start_fingerprint,
  content_version,pair_order,event_kind)
 values(p_host,btrim(p_title),p_key,'live',1,
  '{"phase":"live","storage":"browser-v2","kind":"mini-games"}'::jsonb,
  p_fingerprint,null,null,'mini-games') returning * into e;
 insert into bud_platform.live_event_debits(event_id,host_id) values(e.id,p_host);
 update bud_platform.live_wallets set credits=credits-1 where host_id=p_host;
 return bud_platform.live_host_event(e.id);
end;
$$;

create function public.bud_live_host_mini_content(p_host uuid,p_event uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare e bud_platform.live_events;
begin
 select * into e from bud_platform.live_events where id=p_event and host_id=p_host and event_kind='mini-games';
 if not found then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 if e.phase='completed' or e.started_at+interval '4 hours'<=clock_timestamp() then
  raise exception 'BUD_EVENT_CLOSED'; end if;
 if exists(select 1 from bud_platform.user_restrictions where host_id=p_host and suspended)
  then raise exception 'BUD_ACCOUNT_RESTRICTED'; end if;
 return jsonb_build_object('ownerId',p_host,'eventId',e.id,'title',e.title,
  'kind','mini-games','storage','browser-v2','expiresAt',e.started_at+interval '4 hours');
end;
$$;

create function public.bud_live_host_mini_finish(p_host uuid,p_event uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 update bud_platform.live_events set phase='completed',
  updated_at=clock_timestamp(),version=version+1
 where id=p_event and host_id=p_host and event_kind='mini-games'
  and state->>'storage'='browser-v2' and phase<>'completed';
 if not exists(select 1 from bud_platform.live_events where id=p_event and host_id=p_host
  and event_kind='mini-games' and state->>'storage'='browser-v2')
  then raise exception 'BUD_EVENT_NOT_FOUND'; end if;
 return jsonb_build_object('closed',true);
end;
$$;
revoke all on function
 public.bud_live_host_mini_start(uuid,text,text,text),
 public.bud_live_host_mini_content(uuid,uuid),
 public.bud_live_host_mini_finish(uuid,uuid)
 from public,anon,authenticated;
grant execute on function
 public.bud_live_host_mini_start(uuid,text,text,text),
 public.bud_live_host_mini_content(uuid,uuid),
 public.bud_live_host_mini_finish(uuid,uuid)
 to service_role;

commit;
