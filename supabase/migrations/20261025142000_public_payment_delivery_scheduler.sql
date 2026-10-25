-- BU'D official production payments: frequent secure delivery scheduling.
-- Payment intake and public checkout are independently gated by env and SQL controls.
-- Vault holds the cron bearer secret; it is never embedded in repository code.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('bud-payment-delivery-minute','* * * * *',$$
select net.http_get(
 url:='https://bud-events-website.vercel.app/api/payment-worker',
 headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='bud_payment_worker_token')),
 timeout_milliseconds:=15000
);
$$);
select cron.schedule('bud-payment-reconcile-five-minutes','*/5 * * * *',$$
select net.http_get(
 url:='https://bud-events-website.vercel.app/api/payment-reconcile',
 headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='bud_payment_worker_token')),
 timeout_milliseconds:=15000
);
$$);
commit;
