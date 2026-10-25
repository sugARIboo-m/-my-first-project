-- Read-only: run in the NEW project's SQL Editor before running any migration.
-- NULL = missing. If anything exists, inspect it before attempting CREATE.
select
  to_regclass('morrow_eras.sync_documents') as documents,
  to_regclass('morrow_eras.sync_commits') as commits,
  to_regprocedure('public.morrow_eras_read()') as read_function,
  to_regprocedure('public.morrow_eras_commit(uuid,bigint,jsonb)') as commit_function;
