-- Owner-managed partners: no sample identities and no public write access.
begin;
create table if not exists bud_platform.site_partners (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 2 and 80),
 logo_url text not null check (length(logo_url) between 12 and 500),
 website_url text not null default '' check (length(website_url) <= 500),
 sort_order integer not null default 0 check (sort_order between 0 and 999),
 visible boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index if not exists site_partners_visible_order on bud_platform.site_partners(visible,sort_order,id);
alter table bud_platform.site_partners enable row level security;
revoke all on bud_platform.site_partners from public,anon,authenticated;
grant select,insert,update,delete on bud_platform.site_partners to service_role;
create function public.bud_site_partners_public() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'logoUrl',logo_url,'websiteUrl',website_url) order by sort_order,name),'[]'::jsonb)
 from bud_platform.site_partners where visible;
$$;
create function public.bud_site_partners_owner(p_actor uuid,p_discord text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'logoUrl',logo_url,'websiteUrl',website_url,'sortOrder',sort_order,'visible',visible) order by sort_order,name),'[]'::jsonb) from bud_platform.site_partners);
end;
$$;
create function public.bud_site_partner_command(p_actor uuid,p_discord text,p_operation uuid,p_kind text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_prior bud_platform.owner_audit; v_id uuid; v_name text; v_logo text; v_url text; v_sort integer; v_visible boolean; v_reason text; v_result jsonb;
begin
 perform bud_platform.require_owner(p_actor,p_discord);
 if p_actor is null or p_operation is null or p_kind not in ('partnerSave','partnerDelete') or p_body is null or jsonb_typeof(p_body)<>'object' then raise exception 'BUD_INVALID_REQUEST'; end if;
 v_reason:=nullif(btrim(p_body->>'reason'),'');
 if v_reason is null or length(v_reason)<3 or length(v_reason)>300 then raise exception 'BUD_INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_operation::text,27));
 select * into v_prior from bud_platform.owner_audit where actor=p_actor and operation_id=p_operation;
 if found then
  if v_prior.kind<>p_kind then raise exception 'BUD_KEY_REUSED'; end if;
  return v_prior.outcome||jsonb_build_object('replayed',true);
 end if;
 if p_kind='partnerSave' then
  if (select count(*) from bud_platform.site_partners)>=30 and nullif(p_body->>'id','') is null then raise exception 'BUD_INVALID_REQUEST'; end if;
  if (p_body ? 'id') and (p_body->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'BUD_INVALID_REQUEST'; end if;
  v_name:=btrim(p_body->>'name');v_logo:=p_body->>'logoUrl';v_url:=coalesce(p_body->>'websiteUrl','');
  if v_name is null or length(v_name) not between 2 and 80 or v_logo is null or length(v_logo)>500 or
     v_logo !~* '^https://[^/?#[:space:]]+/.+\.(png|jpg|jpeg|webp)(\?[^#[:space:]]*)?$' or
     length(v_url)>500 or (v_url<>'' and v_url !~* '^https://[^/?#[:space:]]+(/[^#[:space:]]*)?$') or
     (p_body->>'sortOrder') !~ '^[0-9]{1,3}$' or
     (p_body->>'visible') not in ('true','false') then raise exception 'BUD_INVALID_REQUEST'; end if;
  v_sort:=(p_body->>'sortOrder')::integer;v_visible:=(p_body->>'visible')::boolean;
  if v_sort>999 then raise exception 'BUD_INVALID_REQUEST'; end if;
  if nullif(p_body->>'id','') is not null then
   v_id:=(p_body->>'id')::uuid;
   update bud_platform.site_partners set name=v_name,logo_url=v_logo,website_url=v_url,sort_order=v_sort,visible=v_visible,updated_at=clock_timestamp() where id=v_id;
   if not found then raise exception 'BUD_RESOURCE_NOT_FOUND'; end if;
  else
   insert into bud_platform.site_partners(name,logo_url,website_url,sort_order,visible)
     values(v_name,v_logo,v_url,v_sort,v_visible) returning id into v_id;
  end if;
  v_result:=jsonb_build_object('id',v_id,'saved',true,'visible',v_visible,'replayed',false);
 else
  if (p_body->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'BUD_INVALID_REQUEST'; end if;
  v_id:=(p_body->>'id')::uuid;
  delete from bud_platform.site_partners where id=v_id;
  if not found then raise exception 'BUD_RESOURCE_NOT_FOUND'; end if;
  v_result:=jsonb_build_object('id',v_id,'deleted',true,'replayed',false);
 end if;
 insert into bud_platform.owner_audit(actor,operation_id,kind,subject,reason,outcome)
 values(p_actor,p_operation,p_kind,v_id::text,v_reason,v_result);
 return v_result;
end;
$$;
revoke all on function public.bud_site_partners_public(),public.bud_site_partners_owner(uuid,text),public.bud_site_partner_command(uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.bud_site_partners_public(),public.bud_site_partners_owner(uuid,text),public.bud_site_partner_command(uuid,text,uuid,text,jsonb) to service_role;
commit;
