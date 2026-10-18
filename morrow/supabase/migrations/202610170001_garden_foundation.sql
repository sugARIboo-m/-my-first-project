-- Garden-only schema proposal for a future configured Supabase project.
-- NOT executed by the prototype. No Collection/Wrapped tables are introduced.
-- The repository has no pre-existing SQL/schema or hosted project binding.
-- Inspect the actual hosted database before applying this migration.
begin;
create schema morrow_eras;
grant usage on schema morrow_eras to authenticated;

create table morrow_eras.era_themes (
  id text primary key,
  name text not null,
  palette jsonb not null check(jsonb_typeof(palette)='array'),
  visual_config jsonb not null default '{}'::jsonb,
  version integer not null default 1 check(version>0)
);
insert into morrow_eras.era_themes(id,name,palette,visual_config) values
 ('eternal-bloom','Eternal Bloom','["#e9e3ed","#b9a8c8","#be98a7","#f4eef2"]','{"flower":"pearl"}'),
 ('pink-pony','Pink Pony Garden','["#eee1e6","#a7647e","#764455","#d6a7b6"]','{"flower":"star"}'),
 ('charm','Charm Garden','["#e7e8dc","#9baa84","#71816e","#f1e8d4"]','{"flower":"daisy"}'),
 ('blue-hour','Blue Hour Garden','["#dfe5ed","#8192aa","#af8c98","#d5c8bd"]','{"flower":"rose"}');

create table morrow_eras.savings_goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 80),
  currency text not null check(currency in ('CNY','USD','EUR','GBP')),
  target_amount bigint not null check(target_amount between 1 and 9007199254740991),
  current_saved bigint not null check(current_saved between 0 and 9007199254740991),
  funding_mode text not null check(funding_mode in ('manual','legacy-total')),
  target_date date,
  paused boolean not null default false,
  bloomed_at timestamptz,
  bloomed_theme_id text references morrow_eras.era_themes(id),
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  check((bloomed_at is null)=(bloomed_theme_id is null))
);
create table morrow_eras.goal_eras (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null unique,
  era_theme_id text not null references morrow_eras.era_themes(id),
  selected_at timestamptz not null default now(),
  foreign key(goal_id,user_id) references morrow_eras.savings_goals(id,user_id) on delete cascade
);
create table morrow_eras.garden_operations (
  id uuid primary key, -- stable client operation ID: retries cannot duplicate
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('goal.create','goal.update','goal.transfer','legacy.import')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index savings_goals_owner on morrow_eras.savings_goals(user_id);
create index goal_eras_owner on morrow_eras.goal_eras(user_id);
create index garden_operations_owner on morrow_eras.garden_operations(user_id,created_at);

alter table morrow_eras.era_themes enable row level security;
alter table morrow_eras.savings_goals enable row level security;
alter table morrow_eras.goal_eras enable row level security;
alter table morrow_eras.garden_operations enable row level security;
create policy themes_read on morrow_eras.era_themes for select to authenticated using(true);
create policy goals_owner on morrow_eras.savings_goals for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy goal_eras_owner on morrow_eras.goal_eras for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy operations_read on morrow_eras.garden_operations for select to authenticated
  using(user_id=(select auth.uid()));
create policy operations_insert on morrow_eras.garden_operations for insert to authenticated
  with check(user_id=(select auth.uid()));
grant select on morrow_eras.era_themes to authenticated;
grant select,insert,update,delete on morrow_eras.savings_goals,morrow_eras.goal_eras to authenticated;
grant select,insert on morrow_eras.garden_operations to authenticated;
revoke all on all tables in schema morrow_eras from anon;
commit;
-- Schema and owner isolation only. Production still needs authenticated sync,
-- transactional transfer/CAS RPCs, server validation, tombstones and conflict UI.
-- Do not expose service_role credentials or call this a working sync backend.
