// Two isolated browser profiles against an intercepted synthetic Supabase API.
// No requests reach a real Supabase project; no real financial data is used.
const {chromium}=require(process.env.MORROW_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=(process.env.MORROW_PREVIEW_URL||'http://127.0.0.1:3010').replace(/\/$/,'');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner,email:'synthetic@example.test'}};
const empty=()=>({schemaVersion:2,goals:[],operations:[],receipts:[],achievements:[],reviews:[],wrappedSnapshots:[],settings:{motion:'system',milestoneCurrency:'CNY',milestoneThresholds:[10000,50000,100000]}});
let document={version:0,payload:empty()},loseNext=false,commitCalls=0;const commits=new Map();
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.MORROW_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const errors=[];
  async function profile(){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('https://*.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url());
      const respond=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
      if(request.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
      if(url.pathname==='/auth/v1/token')return respond(session);
      if(url.pathname==='/auth/v1/logout')return respond({});
      if(request.headers().authorization!=='Bearer '+session.access_token)return route.fulfill({status:401,body:'{}'});
      if(url.pathname.endsWith('/morrow_eras_read'))return respond(document);
      if(url.pathname.endsWith('/morrow_eras_commit')){
        commitCalls++;const body=request.postDataJSON();
        if(commits.has(body.p_request_id))return respond({status:'ok',version:commits.get(body.p_request_id)});
        if(body.p_expected_version!==document.version)return respond({...document,status:'conflict'});
        document={version:document.version+1,payload:body.p_payload};commits.set(body.p_request_id,document.version);
        if(loseNext){loseNext=false;return route.abort('failed');}
        return respond({status:'ok',version:document.version});
      }
      return route.fulfill({status:404,body:'{}'});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);
    await page.goto(base+'/eras-review.html');await page.waitForFunction(()=>document.querySelector('.garden-local-status').textContent.includes('Saved on'));
    return {context,page};
  }
  async function goal(page,name,saved='100'){
    await page.locator('#garden-live [data-garden-action=new]').click();
    const form=page.locator('#garden-goal-form');await form.locator('[name=name]').fill(name);await form.locator('[name=target]').fill('1000');await form.locator('[name=saved]').fill(saved);await form.locator('.form-submit').click();await page.waitForFunction(()=>!document.querySelector('#garden-goal-dialog').open);
  }
  async function edit(page,saved){await page.locator('.saved-garden [data-garden-action=edit]').first().click();await page.locator('#garden-goal-form [name=saved]').fill(saved);await page.locator('#garden-goal-form .form-submit').click();await page.waitForFunction(()=>!document.querySelector('#garden-goal-dialog').open);}
  async function login(page){await page.locator('[data-cloud=login]').click();await page.locator('#cloud-auth-form [name=email]').fill('synthetic@example.test');await page.locator('#cloud-auth-form [name=password]').fill('synthetic-password');await page.locator('#cloud-auth-form .form-submit').click();await page.waitForSelector('[data-cloud=enable]');}
  async function enable(page){await page.locator('#cloud-consent').check();await page.locator('[data-cloud=enable]').click();}
  async function synced(page){await page.waitForFunction(()=>document.querySelector('.cloud-status').textContent==='Eras is up to date');}
  const a=await profile();await goal(a.page,'Guest garden');await login(a.page);
  await a.page.waitForFunction(()=>document.querySelectorAll('.saved-garden').length===0);
  assert.equal(commitCalls,0,'sign-in does not imply upload consent');
  await enable(a.page);await synced(a.page);await goal(a.page,'Shared camera');await a.page.waitForFunction(()=>document.querySelector('.cloud-status').textContent==='Eras is up to date');
  assert.equal(document.payload.goals[0].name,'Shared camera');assert.equal(document.version,1);
  const b=await profile();await login(b.page);await enable(b.page);await b.page.waitForSelector('.saved-garden');await synced(b.page);assert.equal(await b.page.locator('.saved-garden h3').textContent(),'Shared camera');
  // Pause one device, edit both, then reconnect: no last-writer-wins loss.
  await b.page.locator('[data-cloud=pause]').click();await edit(b.page,'200');
  await edit(a.page,'300');await a.page.waitForFunction(()=>document.querySelector('.cloud-status').textContent==='Eras is up to date');assert.equal(document.version,2);
  await enable(b.page);await b.page.waitForSelector('.cloud-conflict');
  assert.equal(await b.page.locator('.garden-amounts strong').textContent(),'¥200.00');
  assert.equal(document.payload.goals[0].currentSaved,30000);
  const downloads=[];b.page.on('download',download=>downloads.push(download));
  await b.page.locator('[data-cloud=copies]').click();await b.page.waitForFunction(()=>!document.querySelector('[data-cloud=remote]').disabled);
  await b.page.locator('#cloud-backups').check();await b.page.locator('[data-cloud=remote]').click();await synced(b.page);
  await b.page.waitForFunction(()=>document.querySelector('.garden-amounts strong').textContent==='¥300.00');assert.equal(downloads.length,2);
  // A server commit succeeds, but its response is lost. Retry must not duplicate it.
  await a.page.locator('[data-cloud=pause]').click();await edit(a.page,'400');loseNext=true;
  await enable(a.page);await a.page.waitForFunction(()=>document.querySelector('.cloud-status').textContent.includes('Connection unavailable'));
  const committedVersion=document.version;assert.equal(committedVersion,3);await a.page.reload();await a.page.waitForSelector('[data-cloud=pause]');await synced(a.page);assert.equal(document.version,committedVersion);assert.equal(document.payload.goals[0].currentSaved,40000);
  // Offline writes survive a reload of an already served page and later sync.
  await a.page.locator('[data-cloud=pause]').click();await a.context.setOffline(true);await edit(a.page,'500');
  await enable(a.page);await a.page.waitForFunction(()=>document.querySelector('.cloud-status').textContent.includes('Offline'));
  await a.context.setOffline(false);await synced(a.page);assert.equal(document.payload.goals[0].currentSaved,50000);
  // Actual ledger entries use the same authenticated CAS envelope.
  await a.page.evaluate(()=>location.hash='#quick-entry');await a.page.waitForFunction(()=>!document.querySelector('.quick-submit').disabled);
  await a.page.locator('#quick-amount').fill('25.80');await a.page.locator('.quick-submit').click();await a.page.waitForFunction(()=>document.querySelector('#quick-amount').value==='');await synced(a.page);
  assert.equal(document.payload.ledger.records[0].amount,2580);assert.equal(document.payload.goals[0].currentSaved,50000);
  await b.page.locator('[data-cloud=retry]').click();await b.page.evaluate(()=>location.hash='#quick-entry');await b.page.waitForSelector('.quick-record');
  await b.page.locator('.quick-record').first().click();await b.page.locator('#quick-amount').fill('11.22');await b.page.locator('.quick-submit').click();await b.page.waitForFunction(()=>document.querySelector('#quick-amount').value==='');await synced(b.page);assert.equal(document.payload.ledger.records[0].amount,1122);
  await a.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.page.waitForFunction(()=>document.querySelector('.quick-record-amount')?.textContent.includes('11.22'));
  await a.page.locator('.quick-record').first().click();await a.page.locator('#quick-delete').click();await a.page.locator('#quick-confirm-delete').click();await a.page.waitForFunction(()=>!document.querySelector('#quick-delete-dialog').open);await synced(a.page);assert(document.payload.ledger.records[0].deletedAt);
  await b.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.page.waitForFunction(()=>document.querySelectorAll('.quick-record').length===0);assert.equal(document.payload.goals[0].currentSaved,50000);
  await a.page.evaluate(()=>location.hash='#morrow-cloud');
  // Responsive and bilingual cloud controls do not expose raw server errors.
  await a.page.locator('#language').click();assert((await a.page.locator('.cloud-status').textContent()).includes('最新'));
  for(const width of [360,390,768,1440]){await a.page.setViewportSize({width,height:900});assert(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  // Sign out returns to the untouched guest namespace.
  a.page.on('dialog',dialog=>dialog.accept());await a.page.locator('[data-cloud=logout]').click();await a.page.waitForSelector('[data-cloud=login]');await a.page.waitForFunction(()=>document.querySelector('.saved-garden h3')?.textContent==='Guest garden');
  assert.deepEqual(errors,[]);
  console.log('PASS: mocked two-profile ledger create/edit/delete sync, goal sync, explicit upload consent, guest/account isolation, CAS conflict with both backups, response-loss retry after reload, offline recovery, EN/ZH, 360/390/768/1440 layouts. This is not hosted Supabase verification.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
