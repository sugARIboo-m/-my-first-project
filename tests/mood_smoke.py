from pathlib import Path
(Path(__file__).resolve().parents[1]/'.test-artifacts').mkdir(exist_ok=True)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1200})
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(__import__('os').environ.get('APP_URL','http://127.0.0.1:3000/cike/'),wait_until='networkidle')
 assert page.locator('.card').count()==4
 page.locator('#thought').fill('我很想念一个人，回忆让我难过')
 page.locator('#submit').click()
 assert '想念' in page.locator('#result-subtitle').inner_text()
 titles=page.locator('.card h3').all_text_contents()
 assert any('情书' in t for t in titles)
 page.locator('.save').first.click()
 page.reload(wait_until='networkidle')
 assert page.locator('#saved-count').inner_text()=='1'
 page.locator('#saved-toggle').click()
 assert page.locator('.card').count()==1
 page.locator('#saved-toggle').click()
 page.locator('.prompts button').nth(0).click()
 sad=page.locator('.card h3').all_text_contents()
 page.locator('[data-intent=uplift]').click()
 assert page.locator('.card h3').all_text_contents()!=sad
 page.locator('[data-filter=movie]').click()
 assert page.locator('.card').count()==2
 page.locator('[data-filter=all]').click()
 # Screenshot output stays local and ignored.
 page.screenshot(path=str(__import__('pathlib').Path(__file__).resolve().parents[1]/'.test-artifacts/mood-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.screenshot(path=str(__import__('pathlib').Path(__file__).resolve().parents[1]/'.test-artifacts/mood-mobile.png'),full_page=True)
 assert not errors,errors
 print('PASS: recommendations respond to moods and intent; filters; favorite persistence; desktop/mobile layout; no page errors')
 b.close()
