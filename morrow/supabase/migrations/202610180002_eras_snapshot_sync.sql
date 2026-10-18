-- RUN THIS FILE ONLY for the current snapshot-sync client.
-- The earlier two files are normalized-schema proposals, not prerequisites.
-- This script does not read, replace or drop any existing finance table.
begin;
create schema if not exists morrow_eras;

-- Fail closed if these names already exist: inspect their structure first.
create table morrow_eras.sync_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null check(version between 1 and 9007199254740991),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  updated_at timestamptz not null default now()
);
create table morrow_eras.sync_commits (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  version bigint not null,
  payload jsonb not null,
  committed_at timestamptz not null default now(),
  primary key(user_id,request_id),
  unique(user_id,version)
);
alter table morrow_eras.sync_documents enable row level security;
alter table morrow_eras.sync_commits enable row level security;
create policy sync_document_owner_read on morrow_eras.sync_documents
  for select to authenticated using(user_id=(select auth.uid()));
create policy sync_history_owner_read on morrow_eras.sync_commits
  for select to authenticated using(user_id=(select auth.uid()));
revoke all on morrow_eras.sync_documents,morrow_eras.sync_commits from public,anon,authenticated;
grant usage on schema morrow_eras to authenticated;
grant select on morrow_eras.sync_documents,morrow_eras.sync_commits to authenticated;

create function public.morrow_eras_read()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare owner_id uuid := auth.uid(); document morrow_eras.sync_documents%rowtype;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into document from morrow_eras.sync_documents where user_id=owner_id;
  if found then return jsonb_build_object('version',document.version,'payload',document.payload); end if;
  return jsonb_build_object('version',0,'payload',jsonb_build_object(
    'schemaVersion',2,'goals','[]'::jsonb,'operations','[]'::jsonb,'receipts','[]'::jsonb,
    'achievements','[]'::jsonb,'reviews','[]'::jsonb,'wrappedSnapshots','[]'::jsonb,
    'settings',jsonb_build_object('motion','system','milestoneCurrency','CNY','milestoneThresholds','[10000,50000,100000]'::jsonb)));
end $$;

create function public.morrow_eras_commit(p_request_id uuid,p_expected_version bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare owner_id uuid := auth.uid(); current_version bigint; next_version bigint;
  document morrow_eras.sync_documents%rowtype; prior morrow_eras.sync_commits%rowtype;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or p_expected_version is null or p_expected_version<0
    or p_expected_version>=9007199254740991 then raise exception 'Invalid request'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8388608
    or (p_payload->>'schemaVersion') is distinct from '2'
    or jsonb_typeof(p_payload->'settings') is distinct from 'object'
    or jsonb_typeof(p_payload->'goals') is distinct from 'array'
    or jsonb_typeof(p_payload->'operations') is distinct from 'array'
    or jsonb_typeof(p_payload->'receipts') is distinct from 'array'
    or jsonb_typeof(p_payload->'achievements') is distinct from 'array'
    or jsonb_typeof(p_payload->'reviews') is distinct from 'array'
    or jsonb_typeof(p_payload->'wrappedSnapshots') is distinct from 'array'
    then raise exception 'Invalid document'; end if;
  -- Personal snapshots preserve client-calculated keepsakes. They are NOT
  -- server-certified awards or a financial ledger validated by the server.
  -- Serialize per owner, including first insert; never lock another user's row.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  select * into prior from morrow_eras.sync_commits where user_id=owner_id and request_id=p_request_id;
  if found then
    if prior.payload<>p_payload then raise exception 'Request ID reused for different data'; end if;
    return jsonb_build_object('status','ok','version',prior.version);
  end if;
  select * into document from morrow_eras.sync_documents where user_id=owner_id;
  current_version := coalesce(document.version,0);
  if current_version<>p_expected_version then
    return jsonb_build_object('status','conflict','version',current_version,'payload',document.payload);
  end if;
  next_version := current_version+1;
  insert into morrow_eras.sync_documents(user_id,version,payload)
    values(owner_id,next_version,p_payload)
    on conflict(user_id) do update set version=excluded.version,payload=excluded.payload,updated_at=now();
  insert into morrow_eras.sync_commits(user_id,request_id,version,payload) values(owner_id,p_request_id,next_version,p_payload);
  return jsonb_build_object('status','ok','version',next_version);
end $$;
revoke all on function public.morrow_eras_read() from public,anon;
revoke all on function public.morrow_eras_commit(uuid,bigint,jsonb) from public,anon;
grant execute on function public.morrow_eras_read() to authenticated;
grant execute on function public.morrow_eras_commit(uuid,bigint,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
