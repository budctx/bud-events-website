-- Question & Condition activity catalog and server-authoritative card lookup.
-- Additive to the sandbox host contract; no seed, entitlement or public policy changes.
begin;

alter table bud_platform.content_versions add column eligible_pairs jsonb
  check (eligible_pairs is null or
    case when jsonb_typeof(eligible_pairs) = 'array'
      then jsonb_array_length(eligible_pairs) between 1 and 20000
      else false end);

-- A published content version is immutable, including its curated pair eligibility.
create or replace function bud_platform.protect_content_version() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.status <> 'draft' and
   (new.id is distinct from old.id or new.questions is distinct from old.questions
   or new.conditions is distinct from old.conditions
   or new.eligible_pairs is distinct from old.eligible_pairs or new.status='draft') then
   raise exception 'BUD_IMMUTABLE_CONTENT';
 end if;
 if new.status = 'published' and new.eligible_pairs is null then
   raise exception 'BUD_CONTENT_NOT_READY';
 end if;
 return new;
end;
$$;

-- Only the backend service role can request an eligible catalog.
-- For a new event, return the published product version. For an existing event,
-- return its pinned version (never silently switch an active event).
create function public.bud_host_draw_catalog(p_host uuid,p_event uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_content bud_platform.content_versions;
begin
 if p_host is null then raise exception 'BUD_INVALID_EVENT'; end if;
 if p_event is null then
   select c.* into v_content from bud_platform.products p
   join bud_platform.content_versions c on c.id=p.content_version
   where p.id='question-condition' and p.status='published' and c.status='published';
 else
   select c.* into v_content from bud_platform.events e
   join bud_platform.content_versions c on c.id=e.content_version
   where e.id=p_event and e.host_id=p_host and e.state is not null;
 end if;
 if not found or v_content.eligible_pairs is null then raise exception 'BUD_CONTENT_NOT_READY'; end if;
 return jsonb_build_object('version',v_content.id,'pairs',v_content.eligible_pairs);
end;
$$;
revoke all on function public.bud_host_draw_catalog(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bud_host_draw_catalog(uuid,uuid) to service_role;

-- Render the persisted activity's card pair, not a client-selected pair or
-- pair_order modulo wraparound. Legacy events without activityDraw keep
-- their old rendering until explicitly retired.
create or replace function bud_platform.host_event(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'eventId',e.id,'title',e.title,'phase',e.phase,'version',e.version,'state',e.state,
  'updatedAt',e.updated_at,
  'serverNow',floor(extract(epoch from statement_timestamp())*1000),
  'cards',jsonb_build_object('question',c.questions->pos.q_idx->>'ar',
    'condition',c.conditions->pos.c_idx->>'ar'),
  'cardsEn',jsonb_build_object('question',c.questions->pos.q_idx->>'en',
    'condition',c.conditions->pos.c_idx->>'en')
 ) from bud_platform.events e
 join bud_platform.content_versions c on c.id=e.content_version
 cross join lateral (
  select
   case when e.state ? 'activityDraw'
      then (e.state #>> '{activityDraw,current,pair,0}')::int
      else coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)
        / jsonb_array_length(c.conditions) end as q_idx,
   case when e.state ? 'activityDraw'
      then (e.state #>> '{activityDraw,current,pair,1}')::int
      else coalesce((e.pair_order->>((e.state->>'round')::int % jsonb_array_length(e.pair_order)))::int,0)
        % jsonb_array_length(c.conditions) end as c_idx
 ) pos
 where e.id=p_event;
$$;
revoke all on function bud_platform.host_event(uuid) from public,anon,authenticated;
grant execute on function bud_platform.host_event(uuid) to service_role;

-- Transactional start: old wallet/idempotency semantics remain unchanged.
-- Pair chosen by the trusted server is checked against the approved pinned
-- catalog before spending a credit; any error rolls back the entire RPC.
create function public.bud_host_start_draw(
 p_host uuid,p_key text,p_title text,p_config jsonb,p_prize_text text,
 p_state jsonb,p_fingerprint text,p_content_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_content bud_platform.content_versions; v_started jsonb;
        v_pair jsonb; v_q integer; v_c integer;
begin
 select c.* into v_content from bud_platform.products p
 join bud_platform.content_versions c on c.id=p.content_version
 where p.id='question-condition' and p.status='published'
   and c.status='published' and c.id=p_content_id;
 if not found or v_content.eligible_pairs is null then raise exception 'BUD_CONTENT_NOT_READY'; end if;
 v_pair := p_state #> '{activityDraw,current,pair}';
 if jsonb_typeof(v_pair) <> 'array' or jsonb_array_length(v_pair) <> 2
    or jsonb_typeof(p_state #> '{activityDraw,draw,history}') <> 'array'
    or jsonb_array_length(p_state #> '{activityDraw,draw,history}') <> 1
    or (p_state #>> '{activityDraw,round}') <> '0'
    or (p_state #>> '{activityDraw,draw,cycle}') <> '1'
    or p_state->>'round' <> '0'
    or not (v_content.eligible_pairs @> jsonb_build_array(v_pair)) then
    raise exception 'BUD_INVALID_EVENT';
 end if;
 if v_pair->>0 !~ '^[0-9]{1,3}$' or v_pair->>1 !~ '^[0-9]{1,3}$' then
   raise exception 'BUD_INVALID_EVENT';
 end if;
 v_q := (v_pair->>0)::integer; v_c := (v_pair->>1)::integer;
 if v_q >= jsonb_array_length(v_content.questions) or
    v_c >= jsonb_array_length(v_content.conditions) then raise exception 'BUD_INVALID_EVENT'; end if;
 v_started:=public.bud_host_start(p_host,p_key,p_title,p_config,p_prize_text,p_state,p_fingerprint);
 if (v_started->>'eventId') is null then raise exception 'BUD_INVALID_EVENT'; end if;
 if not exists(select 1 from bud_platform.events where id=(v_started->>'eventId')::uuid
   and host_id=p_host and content_version=p_content_id) then raise exception 'BUD_CONTENT_NOT_READY'; end if;
 return bud_platform.host_event((v_started->>'eventId')::uuid);
end;
$$;
revoke all on function public.bud_host_start_draw(uuid,text,text,jsonb,text,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function public.bud_host_start_draw(uuid,text,text,jsonb,text,jsonb,text,text)
  to service_role;

commit;
