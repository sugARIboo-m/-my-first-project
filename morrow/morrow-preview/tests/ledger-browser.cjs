// Real browser persistence against synthetic entries; no real financial records.
const {chromium}=require(process.env.MORROW_PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const base=(process.env.MORROW_PREVIEW_URL||'http://127.0.0.1:3010').replace(/\/$/,'');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.MORROW_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.waitForSelector('#quick-entry:not([hidden])');await page.waitForFunction(()=>!document.querySelector('.quick-submit').disabled);
  assert.equal(new URL(page.url()).hash,'#quick-entry');
  async function save(amount){await page.locator('#quick-amount').fill(amount);await page.locator('.quick-submit').click();await page.waitForFunction(()=>document.querySelector('#quick-amount').value===''&&!document.querySelector('.quick-submit').disabled);}
  await page.locator('[data-quick-preset=dining]').click();await save('25.80');assert.equal(await page.locator('.quick-record').count(),1);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('.quick-submit').disabled);assert.equal(await page.locator('#quick-form [name=category]').inputValue(),'dining');assert.equal(await page.locator('#quick-form [name=account]').inputValue(),'wechat');await save('10.20');assert.equal(await page.locator('.quick-record').count(),2);
  await page.locator('[data-quick-kind=refund]').click();await save('6');assert((await page.locator('#quick-summary').textContent()).includes('30.00'));
  await page.locator('[data-quick-kind=transfer]').click();await save('100');assert((await page.locator('#quick-summary').textContent()).includes('30.00'));
  await page.locator('[data-quick-kind=income]').click();await save('1000');assert((await page.locator('#quick-summary').textContent()).includes('970.00'));
  await page.locator('.quick-record').first().click();await page.locator('.quick-details summary').click();await page.locator('#quick-form [name=date]').fill('2025-01-02');await page.locator('#quick-amount').fill('900');await page.locator('.quick-submit').click();await page.waitForFunction(()=>document.querySelector('#quick-amount').value==='');assert.equal(await page.locator('#quick-month').inputValue(),'2025-01');
  await page.locator('.quick-record').first().click();await page.locator('#quick-delete').click();await page.locator('#quick-confirm-delete').click();await page.waitForFunction(()=>!document.querySelector('#quick-delete-dialog').open);assert.equal(await page.locator('.quick-record').count(),0);
  // Unsaved form data survives a remote/store notification.
  await page.locator('#quick-amount').fill('42.11');const other=await context.newPage();await other.goto(base+'/#quick-entry');await other.waitForFunction(()=>!document.querySelector('.quick-submit').disabled);await other.locator('#quick-amount').fill('1');await other.locator('.quick-submit').click();await other.waitForFunction(()=>document.querySelector('#quick-amount').value==='');await page.waitForTimeout(200);assert.equal(await page.locator('#quick-amount').inputValue(),'42.11');
  // Stale edit cannot overwrite another tab's newer version.
  await page.locator('#quick-month').fill(new Date().toISOString().slice(0,7));await page.locator('.quick-record').first().click();const id=await page.locator('.quick-record').first().getAttribute('data-quick-edit');
  await other.evaluate(async id=>{const {createGardenStore}=await import('/eras/store.js');const {saveQuickRecord}=await import('/ledger/domain.js');const store=createGardenStore();await store.update(state=>{const prior=state.ledger.records.find(r=>r.id===id);return saveQuickRecord(state,{...prior,amount:999},crypto.randomUUID(),new Date().toISOString(),prior.revision);});},id);
  await page.locator('#quick-amount').fill('8');await page.locator('.quick-submit').click();await page.waitForFunction(()=>document.querySelector('#quick-error').textContent.includes('changed'));assert.equal(await page.locator('#quick-amount').inputValue(),'8');await page.locator('#quick-cancel').click();
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'morrow-quick-'));const download=page.waitForEvent('download');await page.locator('.quick-backups summary').click();await page.locator('#quick-json').click();const file=await download;await file.saveAs(path.join(folder,'backup.json'));const backup=JSON.parse(fs.readFileSync(path.join(folder,'backup.json'),'utf8'));assert(backup.state.ledger.records.some(r=>r.deletedAt));assert.equal(backup.format,'morrow-garden');
  await page.locator('#quick-language').click();assert.equal(await page.locator('.quick-submit').textContent(),'保存这一笔');await page.reload();await page.waitForFunction(()=>!document.querySelector('.quick-submit').disabled);assert.equal(await page.locator('.quick-submit').textContent(),'保存这一笔');
  for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(folder,'quick-phone.png'),fullPage:true});
  // Exercise the visual-viewport handler without pretending to test iOS itself.
  await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>400});window.visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.locator('html').getAttribute('data-quick-keyboard'),'true');assert.equal(await page.locator('.quick-submit').evaluate(el=>getComputedStyle(el).position),'fixed');
  await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.locator('html').getAttribute('data-quick-keyboard'),'false');
  // An old Garden-only backup must not erase the new ledger.
  await page.evaluate(()=>location.hash='#eras-section');const oldBackup=structuredClone(backup);delete oldBackup.state.ledger;
  await page.locator('#garden-restore-file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldBackup))});await page.waitForSelector('#garden-import-dialog[open]');
  const beforeRestore=page.waitForEvent('download');await page.locator('#garden-before-backup').click();await beforeRestore;await page.locator('#garden-backup-confirmed').check();await page.locator('#garden-confirm-import').click();await page.waitForFunction(()=>document.querySelector('#garden-import-error').textContent.includes('当前账单已保留'));
  const blocked=await browser.newContext({viewport:{width:390,height:844}});await blocked.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:{open(){throw new DOMException('blocked','SecurityError');}}}));
  const blockedPage=await blocked.newPage();await blockedPage.goto(base+'/');await blockedPage.waitForFunction(()=>document.querySelector('#quick-error')?.textContent.includes('Local storage is unavailable'));
  assert(await blockedPage.locator('.quick-submit').isDisabled());await blocked.close();
  assert.deepEqual(errors,[]);console.log('PASS: phone default, amount-only save, remembered defaults, reload, refunds/transfers, month/type edits, tombstones, concurrent-draft preservation/stale-edit rejection, full backup/legacy-restore protection, storage-failure save disabled, viewport toolbar handler, EN/ZH persistence, responsive. Screenshot:',path.join(folder,'quick-phone.png'));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
