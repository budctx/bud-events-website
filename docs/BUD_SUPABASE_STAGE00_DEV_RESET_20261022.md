# BU'D Stage 00 — Development Supabase reset (2026-10-22)

Status: **EXECUTED + VERIFIED (development environment only)**. Owner explicitly requested cleaning the premature database setup before the formal S07/S08 design.

## Environment and safe boundaries

- Supabase project: `BU'D Discord Events — Development`, `cepmvqqrjcvhyzszqand`, `ap-south-1`. Existing project preserved.
- Zero rows in all 12 application tables beforehand; no registered auth users; no Storage objects; no deployed Edge Functions; Vercel website project had zero configured environment variables.
- **Dropped:** 6 historical tables under `bud_private`, 6 unfinished tables under `bud_platform`, and 4 `public.bud_*` draft RPCs. No Supabase auth/storage/system schemas removed.
- Applied migration reference: `20261022113143_stage00_reset_legacy_dev_schemas`.
- Historical Supabase migration `20261022093928_bud_manual_commerce_contract` intentionally stays in the remote migration ledger to preserve traceability. A reset migration is not a reason to modify auth/storage/managed migration metadata manually.
- Post-checks: application schema tables empty, public.bud_* RPC query empty; Supabase ACTIVE_HEALTHY; 0 Supabase security advisor notices; database has normal PostgreSQL catalog overhead (~11 MB) even when application schemas are removed.
- Notion record: https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c

## Exact applied development migration

```sql
BEGIN;
DO $guard$
DECLARE r record; row_count bigint;
BEGIN
  FOR r IN SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('bud_private','bud_platform') AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I',r.schema_name,r.table_name) INTO row_count;
    IF row_count > 0 THEN
      RAISE EXCEPTION 'BU_D_RESET_ABORT: %.% has % rows',r.schema_name,r.table_name,row_count;
    END IF;
  END LOOP;
END
$guard$;
DROP FUNCTION IF EXISTS public.bud_credit_verified_purchase(uuid,text,text,text,text,bigint,text,text);
DROP FUNCTION IF EXISTS public.bud_resume_event(uuid,uuid);
DROP FUNCTION IF EXISTS public.bud_slot_balance(uuid);
DROP FUNCTION IF EXISTS public.bud_start_event(uuid,text,text);
DROP SCHEMA IF EXISTS bud_platform CASCADE;
DROP SCHEMA IF EXISTS bud_private CASCADE;
COMMIT;
```

## Upcoming S07/S08 work (NOT implemented)

1. Freeze Stage 00 owner policy and approve data model: Session Manager (4h/max and free resume), Timer Manager singleton, indefinite Game History record with winner/prize copy-summary, verified Slots/payment authority, deletion/privacy handling.
2. Reconcile GitHub's historical and **code-only draft migration** under `supabase/migrations/20261022084336_bud_manual_commerce_contract.sql` with the actual remote migration versions above **before any CLI db push or new environment bootstrap**. Do **NOT** reapply the obsolete participant/commerce designs.
3. Stage S07 owns ERD, safe schema, RLS, idempotency and public/private API. S08 owns migration discipline, least-privilege env configuration, isolation, backups and CI/testing. Both remain NOT VERIFIED / OPEN.
4. Do not connect Discord OAuth, Whop payment, deploy commercial backend or modify Vercel production on the basis of this reset. Frontend remains unchanged.

**No data deletion outside the two scoped development application schemas and four public app functions was authorized or attempted.**
