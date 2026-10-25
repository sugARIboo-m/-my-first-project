// Synthetic authentication responses only; no real registration/emails.
const {chromium}=require(process.env.MORROW_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=(process.env.MORROW_PREVIEW_URL||'http://127.0.0.1:3010').replace(/\/$/,'');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.MORROW_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let authCode='invalid_credentials',signups=0;
  await page.route('https://*.supabase.co/**',async route=>{
    const request=route.request();
    if(request.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(request.url().includes('/signup')){signups++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}})});}
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error_code:authCode,message:'DO NOT DISPLAY INTERNAL DETAILS'})});
  });
  await page.goto(base+'/eras-review.html');await page.locator('[data-cloud=login]').click();
  await page.locator('#cloud-auth-form [name=email]').fill('synthetic@example.test');await page.locator('#cloud-auth-form [name=password]').fill('synthetic-password');await page.locator('#cloud-auth-form .form-submit').click();
  await page.waitForFunction(()=>document.querySelector('#cloud-auth-error')?.textContent.includes('does not match'));
  assert(!(await page.locator('#cloud-auth-error').textContent()).includes('INTERNAL'));
  await page.locator('#cloud-auth-switch').click();assert.equal(await page.locator('#cloud-auth-title').textContent(),'Create Morrow account');
  assert.equal(await page.locator('#cloud-auth-form [name=email]').inputValue(),'synthetic@example.test');assert.equal(await page.locator('#cloud-auth-form [name=password]').inputValue(),'');
  await page.locator('#cloud-auth-form [name=password]').fill('synthetic-password');await page.locator('#cloud-auth-form .form-submit').click();
  await page.waitForSelector('#cloud-confirm-signin');assert.equal(signups,1);assert.equal(await page.locator('#cloud-auth-title').textContent(),'Check your email');
  await page.locator('#cloud-confirm-signin').click();assert.equal(await page.locator('#cloud-auth-form [name=email]').inputValue(),'synthetic@example.test');
  authCode='email_not_confirmed';await page.locator('#cloud-auth-form [name=password]').fill('synthetic-password');await page.locator('#cloud-auth-form .form-submit').click();
  await page.waitForFunction(()=>document.querySelector('#cloud-auth-error')?.textContent.includes('Confirm your email'));
  await page.locator('[data-cloud-close]').click();await page.locator('#language').click();await page.locator('[data-cloud=login]').click();
  assert.equal(await page.locator('#cloud-auth-switch').textContent(),'还没有账户？创建账户');
  await page.locator('#cloud-auth-form [name=email]').fill('synthetic@example.test');await page.locator('#cloud-auth-form [name=password]').fill('synthetic-password');await page.locator('#cloud-auth-form .form-submit').click();
  await page.waitForFunction(()=>document.querySelector('#cloud-auth-error')?.textContent.includes('邮箱尚未确认'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS: clear login errors, in-dialog login/signup switch, email preserved/password cleared, confirmation step, bilingual/mobile; no real users or emails created.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
