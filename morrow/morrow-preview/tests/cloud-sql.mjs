// Local PostgreSQL-WASM verification, NOT a hosted Supabase verification.
// Install @electric-sql/pglite outside the checkout and set MORROW_PGLITE_MODULE.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyGardenState} from '../eras/domain.js';
const {PGlite}=await import(process.env.MORROW_PGLITE_MODULE??'@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');`);
await db.exec(await readFile(new URL('../../supabase/migrations/202610180002_eras_snapshot_sync.sql',import.meta.url),'utf8'));
async function as(id,role='authenticated'){await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false);`);}
const read=async()=>(await db.query('select public.morrow_eras_read() as data')).rows[0].data;
const commit=async(id,version,payload)=>(await db.query('select public.morrow_eras_commit($1,$2,$3::jsonb) as data',[id,version,JSON.stringify(payload)])).rows[0].data;
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',request='11111111-1111-4111-8111-111111111111',state=emptyGardenState();
await as(a);assert.equal((await read()).version,0);
assert.deepEqual(await commit(request,0,state),{status:'ok',version:1});
assert.deepEqual(await commit(request,0,state),{status:'ok',version:1});
assert.equal((await db.query('select * from morrow_eras.sync_commits')).rows.length,1);
await assert.rejects(()=>commit(request,0,{...state,settings:{...state.settings,motion:'reduce'}}),/reused/);
const conflict=await commit('22222222-2222-4222-8222-222222222222',0,state);assert.equal(conflict.status,'conflict');assert.equal(conflict.version,1);
assert.equal((await read()).version,1);
await assert.rejects(()=>commit('33333333-3333-4333-8333-333333333333',1,{schemaVersion:2}),/Invalid document/);
await assert.rejects(()=>db.exec('delete from morrow_eras.sync_documents'),/permission denied/);
await as(b);assert.equal((await read()).version,0);
assert.equal((await db.query('select * from morrow_eras.sync_documents')).rows.length,0);
await commit(request,0,{...state,settings:{...state.settings,motion:'reduce'}});
assert.equal((await read()).payload.settings.motion,'reduce');
await as(a);assert.equal((await read()).payload.settings.motion,'system');
await as('', 'anon');await assert.rejects(read,/permission denied/);
await as('');await assert.rejects(read,/Authentication required/);
console.log('PASS: local PostgreSQL migration, owner isolation/RLS, anonymous RPC denial, blocked direct writes, atomic CAS conflict, durable idempotent retries, request-id reuse rejection, malformed payload rejection. Hosted Supabase remains unverified.');
await db.close();
