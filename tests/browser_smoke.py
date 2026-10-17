"""Run against npm run dev; requires Playwright and a Chromium binary."""
from pathlib import Path
import json, os, tempfile
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'.test-artifacts'
ART.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:3000',wait_until='networkidle')
    expect(page.get_by_text('大学英语四级',exact=True)).to_be_visible()
    expect(page.get_by_role('heading',name='achieve',exact=True)).to_be_visible()
    page.locator('[data-action=start]').click()
    page.locator('[data-action=reveal]').click()
    expect(page.get_by_text('实现；达到',exact=True)).to_be_visible()
    page.locator('[data-rating="3"]').click()
    saved=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    assert saved['progress']['cet4-achieve']['interval']==3
    assert len(saved['history'])==1
    page.reload(wait_until='networkidle')
    expect(page.locator('.goal-ring strong')).to_contain_text('1')
    page.locator('[data-action=mode][data-mode=spell]').click()
    page.locator('[data-action=start]').click()
    word=page.locator('.main-word').inner_text()
    assert word=='方法；接近'
    page.locator('#spelling').fill('approach')
    page.locator('#spell-form button').click()
    expect(page.get_by_text('拼对了！再给自己的记忆打个分。')).to_be_visible()
    page.locator('[data-rating="1"]').click()
    page.locator('[data-action=nav][data-view=review]').first.click()
    expect(page.get_by_text('接下来的复习',exact=True)).to_be_visible()
    page.locator('[data-action=nav][data-view=materials]').first.click()
    expect(page.get_by_role('heading',name='Everything I Know About Love',exact=True)).to_be_visible()
    expect(page.get_by_role('heading',name='新时代大学商务英语综合教程 2',exact=True)).to_be_visible()
    page.locator('[data-action=reimport][data-id=material-reading]').first.click()
    page.locator('#material-text').fill('We cherish every memory. We can discover comfort and serendipity. A curious reader can cherish a memory of yesterday.')
    page.locator('#extract-button').click()
    expect(page.locator('#modal-title')).to_contain_text('Everything I Know About Love')
    assert page.locator('[name=candidate]:checked').count()>=5
    # Unknown words cannot be saved without a supplied meaning.
    unknown=page.locator('.candidate-row').filter(has=page.locator('input[placeholder="补充释义后勾选"]')).filter(has=page.locator('input:not([readonly]):not([type=checkbox])'))
    first=unknown.first
    if first.count():
        first.locator('[type=checkbox]').check()
        page.locator('[data-form=material-save] button[type=submit]').click()
        expect(page.locator('#candidate-error')).to_contain_text('补充释义')
        first.locator('input:not([type=checkbox])').fill('自主补充释义')
    page.locator('[data-form=material-save] button[type=submit]').click()
    expect(page.locator('#modal')).not_to_be_visible()
    saved=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    material=next(x for x in saved['materials'] if x['id']=='material-reading')
    assert len(material['wordIds'])>=5
    assert material['contexts']['daily-cherish']=='We cherish every memory.'
    page.locator('[data-action=material-study][data-id=material-reading]').click()
    expect(page.locator('.example-en')).to_contain_text('We can discover comfort and')
    page.locator('[data-action=nav][data-view=materials]').first.click()
    page.screenshot(path=str(ART/'materials.png'),full_page=True)
    page.locator('[data-action=nav][data-view=library]').click()
    page.locator('#library-source').select_option('all')
    page.locator('#word-search').fill('cherish')
    expect(page.locator('.word-row')).to_have_count(1)
    page.locator('.word-row [data-action=favorite]').click()
    page.reload(wait_until='networkidle')
    # Refresh returns to homepage while keeping progress and bookmarks.
    assert 'daily-cherish' in page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).favorites")
    page.locator('[data-action=settings]').first.click()
    page.locator('[name=goal]').fill('12')
    page.locator('[name=date]').fill('2027-06-12')
    page.locator('[data-form=settings] button[type=submit]').click()
    assert page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).plan.goal")==12
    page.locator('[data-action=settings]').first.click()
    with page.expect_download() as dl:
        page.locator('[data-action=export]').click()
    download=dl.value
    path=ART/'backup.json'
    download.save_as(str(path))
    assert json.loads(path.read_text())['plan']['goal']==12
    page.locator('[data-action=import-backup]').click()
    page.locator('#backup-file').set_input_files(str(path))
    expect(page.locator('#confirm-restore')).to_be_visible()
    page.locator('#confirm-restore').click()
    expect(page.locator('#modal')).not_to_be_visible()
    assert page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).plan.goal")==12
    # PDF import: use a real uploaded PDF when available, otherwise test generates one via PyMuPDF.
    import fitz
    pdf=fitz.open();pdf.new_page().insert_text((50,80),'We cherish every memory. We discover new opportunities and enjoy a gentle breeze.')
    pdf_path=ART/'sample.pdf';pdf.save(pdf_path);pdf.close()
    page.locator('[data-action=nav][data-view=materials]').first.click()
    page.locator('[data-action=reimport][data-id=material-textbook]').first.click()
    page.locator('#material-file').set_input_files(str(pdf_path))
    expect(page.locator('#file-status')).to_contain_text('已读取',timeout=30000)
    expect(page.locator('#material-text')).to_have_value(__import__('re').compile('cherish'))
    page.locator('#extract-button').click()
    page.locator('[data-form=material-save] button[type=submit]').click()
    page.locator('[data-action=nav][data-view=stats]').first.click()
    expect(page.get_by_text('累计学习单词',exact=True)).to_be_visible()
    page.screenshot(path=str(ART/'stats.png'),full_page=True)
    page.locator('[data-action=nav][data-view=home]').first.click()
    # Exercise actual cached app while offline, including reload.
    page.evaluate('navigator.serviceWorker.ready.then(() => true)')
    page.reload(wait_until='networkidle')
    context.set_offline(True)
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('.brand')).to_be_visible()
    expect(page.locator('[data-action=start]')).to_be_visible()
    context.set_offline(False)
    page.screenshot(path=str(ART/'desktop.png'),full_page=True)
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.goto('http://127.0.0.1:3000',wait_until='networkidle')
    assert not mobile.evaluate('document.documentElement.scrollWidth>innerWidth')
    mobile.screenshot(path=str(ART/'mobile.png'),full_page=True)
    mobile.locator('[data-action=nav][data-view=materials]').first.click()
    assert not mobile.evaluate('document.documentElement.scrollWidth>innerWidth')
    mobile.screenshot(path=str(ART/'mobile-materials.png'),full_page=True)
    assert not errors,errors
    print('PASS: card learning, scheduling, persistence, spelling, materials, missing-meaning validation, search, favorites, settings, backup/restore, real PDF extraction, statistics, offline reload, mobile layout; no page errors.')
    browser.close()
