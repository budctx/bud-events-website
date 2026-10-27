-- Read-only, service-only inspection of a single exhausted payment job.
-- No credit, claim, retry or financial-state mutation is possible from this RPC.
create or replace function public.bud_live_review_candidate()
returns jsonb language sql stable set search_path to ''
as $$
  select (
    select jsonb_build_object('paymentId', j.payment_id)
    from bud_platform.live_payment_jobs j
    where j.status = 'review'
    order by j.updated_at desc, j.created_at desc
    limit 1
  );
$$;
revoke all on function public.bud_live_review_candidate() from public, anon, authenticated;
grant execute on function public.bud_live_review_candidate() to service_role;
