import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudCanonical,cloudMetadata,cloudPrepare,cloudAcknowledge,cloudStateEqual} from '../cloud/state.js';
import {createMorrowCloudClient} from '../cloud/client.js';

test('cloud comparison tolerates PostgreSQL JSONB key ordering without changing array order',()=>{
  assert(cloudStateEqual({b:2,a:[{d:4,c:3}]},{a:[{c:3,d:4}],b:2}));
  assert(!cloudStateEqual([1,2],[2,1]));assert.equal(cloudCanonical(null),'null');
});
test('durable pending snapshot reuses its request id and payload after further local changes',()=>{
  const state={balance:100},meta=cloudPrepare(state,cloudMetadata({generation:1,dirty:true}),'op1');
  const again=cloudPrepare({balance:200},{...meta,generation:2},'op2');
  assert.equal(again.pending.id,'op1');assert.deepEqual(again.pending.payload,state);
});
test('acknowledgement only clears dirty if the exact submitted generation is still current',()=>{
  const state={balance:100},meta=cloudPrepare(state,cloudMetadata({generation:1,dirty:true}),'op1');
  assert.equal(cloudAcknowledge(state,meta,{version:1},'op1').dirty,false);
  const updated=cloudAcknowledge({balance:200},{...meta,generation:2},{version:1},'op1');
  assert.equal(updated.dirty,true);assert.equal(updated.remoteVersion,1);assert.equal(updated.pending,null);
});
test('late acknowledgements from another tab cannot clear a newer pending request',()=>{
  const meta=cloudPrepare({balance:100},cloudMetadata({dirty:true}),'new');
  assert.deepEqual(cloudAcknowledge({balance:100},meta,{version:1},'old'),meta);
  assert.throws(()=>cloudAcknowledge({balance:100},meta,{version:0},'new'),/cloudInvalidResponse/);
});
function memoryStorage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
test('switching projects preserves old sessions and isolates databases even for the same user ID',async()=>{
  const storage=memoryStorage(),oldConfig={url:'https://old-project.supabase.co',publishableKey:'sb_publishable_old'},newConfig={url:'https://new-project.supabase.co',publishableKey:'sb_publishable_new'};
  const session={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}};
  const fetcher=async()=>({ok:true,json:async()=>session});
  const oldClient=createMorrowCloudClient({config:oldConfig,storage,fetcher});await oldClient.signIn('test@example.test','synthetic-password');
  const before=storage.getItem(oldClient.sessionKey),next=createMorrowCloudClient({config:newConfig,storage,fetcher});
  assert.equal(next.getSession(),null);assert.equal(next.getDatabaseName(),'morrow-garden-v1');
  await next.signIn('test@example.test','synthetic-password');
  assert.notEqual(next.getDatabaseName(),oldClient.getDatabaseName());assert.equal(storage.getItem(oldClient.sessionKey),before);
  assert(next.getDatabaseName().includes('new-project.supabase.co'));
});
test('public key goes in apikey; RPC uses the authenticated access token and normalizes failures',async()=>{
  const calls=[],storage=memoryStorage(),config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
  const session={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}};
  const client=createMorrowCloudClient({config,storage,fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/token?')?session:{version:0}};}});
  await client.signIn('test@example.test','synthetic-password');await client.rpc('morrow_eras_read');
  assert.equal(calls[1].options.headers.apikey,config.publishableKey);assert.equal(calls[1].options.headers.Authorization,'Bearer synthetic-access');
  assert.equal(client.getSession().user.id,session.user.id);
  const missing=createMorrowCloudClient({config,storage,fetcher:async()=>({ok:false,status:404,json:async()=>({code:'PGRST202',message:'Do not echo sensitive details'})})});
  await assert.rejects(()=>missing.rpc('morrow_eras_read'),/cloudSchemaRequired/);
});
test('network errors never expose request contents, and signed-out clients cannot call RPC',async()=>{
  const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
  const client=createMorrowCloudClient({config,storage:memoryStorage(),fetcher:async()=>{throw new Error('untrusted server detail');}});
  await assert.rejects(()=>client.signIn('test@example.test','private'),/^Error: cloudNetworkError$/);
  await assert.rejects(()=>client.rpc('morrow_eras_read'),/cloudAuthRequired/);
});
test('authentication distinguishes invalid credentials, pending confirmation and email delivery limits',async()=>{
  const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
  for(const [status,code,expected] of [[400,'invalid_credentials','cloudInvalidCredentials'],[400,'email_not_confirmed','cloudEmailNotConfirmed'],[429,'over_email_send_rate_limit','cloudEmailRateLimit']]){
    const client=createMorrowCloudClient({config,storage:memoryStorage(),fetcher:async()=>({ok:false,status,json:async()=>({error_code:code,message:'sensitive internal details'})})});
    await assert.rejects(()=>client.signIn('test@example.test','synthetic-password'),error=>error.message===expected);
    assert.equal(client.getSession(),null);
  }
});
test('an unknown authentication error never exposes server text or mislabels a missing database schema',async()=>{
  const client=createMorrowCloudClient({config:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},storage:memoryStorage(),fetcher:async()=>({ok:false,status:404,json:async()=>({code:'unknown',message:'private server contents'})})});
  await assert.rejects(()=>client.signUp('test@example.test','synthetic-password'),error=>error.message==='cloudRequestFailed');
});
