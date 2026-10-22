-- BU'D / Discord Events SaaS — Stage 07 private development foundation
-- 2026-10-22 | DEV ONLY | NO WEB API ACCESS | NO PAYMENT OPERATIONS
-- Supersedes no approved PRD. The game engine is not yet connected to these tables.
-- Never change the configured service schema until Stage 07/10 security testing.
begin;
create schema if not exists bud_private;
revoke all on schema bud_private from public, anon, authenticated;
create table if not exists bud_private.host_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  verified_discord_id text not null unique
    check (verified_discord_id ~ '^[0-9]{17,20}$'),
  created_at timestamptz not null default now()
);
create table if not exists bud_private.events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references bud_private.host_identities(auth_user_id),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  game_kind text not null default 'question_condition' check (game_kind = 'question_condition'),
  phase text not null default 'setup' check (phase in ('setup','live','prizes','closing','completed')),
  attempts_allowed smallint not null default 1 check (attempts_allowed between 1 and 3),
  challenge_seconds smallint not null default 5 check (challenge_seconds in (5,7,10)),
  timer_enabled boolean not null default false,
  prize_count smallint not null default 0 check (prize_count between 0 and 50),
  generation integer not null default 1 check (generation >= 1),
  row_version bigint not null default 0 check (row_version >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (phase <> 'completed' or completed_at is not null),
  check (completed_at is null or started_at is not null)
);
create index if not exists bud_events_owner_idx
  on bud_private.events(owner_user_id,created_at desc);
create table if not exists bud_private.participants (
  event_id uuid not null references bud_private.events(id) on delete cascade,
  discord_id text not null check (discord_id ~ '^[0-9]{17,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  status text not null default 'never_played'
    check (status in ('never_played','lost','qualified')),
  qualification_order integer check (qualification_order >= 1),
  joined_at timestamptz not null default now(),
  primary key (event_id,discord_id),
  unique (event_id,qualification_order),
  check ((status = 'qualified') = (qualification_order is not null))
);
create table if not exists bud_private.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  round_number integer not null check (round_number >= 1),
  participant_discord_id text not null,
  outcome text not null check (outcome in ('in_progress','lost','qualified','no_winner')),
  attempts_used smallint not null default 0 check (attempts_used between 0 and 3),
  created_at timestamptz not null default now(),
  unique (event_id,round_number),
  foreign key (event_id,participant_discord_id)
    references bud_private.participants(event_id,discord_id)
);
create table if not exists bud_private.prizes (
  event_id uuid not null references bud_private.events(id) on delete cascade,
  prize_number smallint not null check (prize_number between 1 and 50),
  prize_name text not null check (char_length(btrim(prize_name)) between 1 and 100),
  state text not null default 'unopened'
    check (state in ('unopened','opened_unassigned','assigned')),
  winner_discord_id text,
  opened_at timestamptz,
  primary key (event_id,prize_number),
  unique (event_id,winner_discord_id),
  foreign key (event_id,winner_discord_id)
    references bud_private.participants(event_id,discord_id),
  check ((state = 'assigned') = (winner_discord_id is not null)),
  check ((state = 'unopened') = (opened_at is null))
);
create table if not exists bud_private.event_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null references bud_private.events(id) on delete cascade,
  actor_user_id uuid not null references bud_private.host_identities(auth_user_id),
  action text not null check (action in ('start','reveal','judge','round_end','prize_open','closing','complete','restart')),
  generation integer not null check (generation >= 1),
  event_version bigint not null check (event_version >= 0),
  occurred_at timestamptz not null default now()
);
-- RLS is on even though this schema is unexposed. No web/API policies are granted.
alter table bud_private.host_identities enable row level security;
alter table bud_private.events enable row level security;
alter table bud_private.participants enable row level security;
alter table bud_private.rounds enable row level security;
alter table bud_private.prizes enable row level security;
alter table bud_private.event_audit enable row level security;
revoke all on all tables in schema bud_private from public, anon, authenticated;
revoke all on all sequences in schema bud_private from public, anon, authenticated;
commit;

-- Engineering gates before connecting runtime:
-- * Discord OAuth binding + auth.uid(), tenant authorization, controller lease/fencing
-- * transactionally safe draw-cycle uniqueness, awarded-winner validity, capacity locks
-- * minimal 7-day results and purge; immutable completion and reset concurrency
-- * entitlement, 240-minute sessions, Whop reconciliation and idempotency
-- * no service secrets in Vite/browser and no PII in logs
