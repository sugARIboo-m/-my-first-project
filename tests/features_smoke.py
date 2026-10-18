"""Exercise the published static layout, real WordNet records and persistent practice data.

APP_URL may point at a local static build under a repository subpath.
"""
from pathlib import Path
import json
import os
import re
import subprocess
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('APP_URL', 'http://127.0.0.1:3010/-my-first-project/dist/')
ART = ROOT / '.test-artifacts'
ART.mkdir(exist_ok=True)
seed = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import {emptyState,recordRating} from './core.js';const s=emptyState();recordRating(s,'cet4-achieve',3);s.favorites=['daily-cherish'];console.log(JSON.stringify(s));"], cwd=ROOT, text=True))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440, 'height':1050}, accept_downloads=True)
    # This is an old-format backup with no activities field; initialize only once.
    context.add_init_script("if(!localStorage.getItem('wordlane.v1'))localStorage.setItem('wordlane.v1'," + json.dumps(json.dumps(seed)) + ");")
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    assert page.locator('.discovery-strip>button').count() == 2
    page.locator('nav [data-view=explore]').click()
    assert page.locator('.achievement').count() == 7
    assert page.locator('.achievement.unlocked').count() == 1
    page.locator('[data-action=quiz-start][data-type=daily]').click()
    first_wrong = None
    for i in range(5):
        word = page.locator('.quiz-prompt').inner_text()
        meaning = page.evaluate("async word=>(await import('./data.js')).WORDS.find(w=>w.word===word).meaning", word)
        options = page.locator('.quiz-option')
        correct = options.filter(has_text=re.compile(re.escape(meaning) + r'$'))
        if i == 0:
            first_wrong = word
            options.filter(has_not_text=re.compile(re.escape(meaning) + r'$')).first.click()
        else:
            correct.click()
        expect(page.locator('.quiz-feedback')).to_be_visible()
        assert page.locator('.quiz-option:not(:disabled)').count() == 0
        page.locator('[data-action=quiz-next]').click()
    expect(page.locator('.quiz-result')).to_contain_text('4 / 5')
    state = page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    assert len(state['activities']['mistakes']) == 1
    assert state['progress'] == seed['progress']
    assert state['favorites'] == seed['favorites']
    page.locator('[data-action=quiz-close]').click()
    page.locator('[data-action=quiz-start][data-type=mistakes]').click()
    meaning = page.evaluate("async word=>(await import('./data.js')).WORDS.find(w=>w.word===word).meaning", first_wrong)
    page.locator('.quiz-option').filter(has_text=re.compile(re.escape(meaning) + r'$')).click()
    page.locator('[data-action=quiz-next]').click()
    page.locator('[data-action=quiz-close]').click()
    assert not page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).activities.mistakes")
    page.locator('#practice-source').select_option('cet4')
    page.locator('[data-action=quiz-start][data-type=context]').click()
    expect(page.locator('.quiz-prompt')).to_contain_text('________')
    page.locator('.quiz-option').first.click()
    expect(page.locator('.quiz-feedback blockquote')).to_be_visible()
    page.locator('[data-action=quiz-close]').click()
    practice_state = page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    page.reload(wait_until='networkidle')
    assert page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).activities") == practice_state['activities']
    page.locator('nav [data-view=explore]').click()
    page.screenshot(path=str(ART / 'explore-desktop.png'), full_page=True)
    page.locator('nav [data-view=dictionary]').click()
    page.locator('#dictionary-search').fill('achieve')
    page.locator('[data-form=dictionary] button[type=submit]').click()
    expect(page.locator('.sense-definition').first).to_have_text('to gain with effort', timeout=30000)
    expect(page.locator('.sense-examples')).to_contain_text('she achieved her goal despite setbacks')
    expect(page.locator('.local-definition')).to_contain_text('整理内容')
    assert page.locator('.official-dictionary').count() == 3
    assert all('achieve' in a for a in page.locator('.official-dictionary').evaluate_all('(xs)=>xs.map(x=>x.href)'))
    page.screenshot(path=str(ART / 'dictionary-desktop.png'), full_page=True)
    page.locator('#dictionary-search').fill('went')
    page.locator('[data-form=dictionary] button[type=submit]').click()
    expect(page.locator('.dictionary-result-heading h2')).to_have_text('go', timeout=30000)
    expect(page.locator('.dictionary-result-heading')).to_contain_text('词形还原')
    page.locator('#dictionary-search').fill('abacus')
    page.locator('[data-form=dictionary] button[type=submit]').click()
    expect(page.locator('.dictionary-result-heading h2')).to_have_text('abacus', timeout=30000)
    original_definition = page.locator('.sense-definition').first.inner_text()
    page.locator('[data-action=dictionary-add]').first.click()
    expect(page.locator('#modal [name=word]')).to_have_value('abacus')
    page.locator('#modal [name=meaning]').fill('算盘（我的学习释义）')
    page.locator('[data-form=word] button[type=submit]').click()
    custom = next(w for w in page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).customWords") if w['word']=='abacus')
    assert custom['dictionarySource']['definition'] == original_definition
    assert custom['dictionarySource']['name'] == 'WordNet'
    # A second add opens the existing entry instead of inserting a duplicate.
    page.locator('[data-action=dictionary-add]').first.click()
    expect(page.locator('#modal-title')).to_have_text('单词详情')
    page.locator('[data-action=close-modal]').click()
    assert sum(w['word']=='abacus' for w in page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).customWords")) == 1
    # A network failure must offer a working retry, not claim the word is absent.
    context.route('**/dictionary/q.json', lambda route: route.fulfill(status=503, body='Unavailable'))
    page.locator('#dictionary-search').fill('quixotic')
    page.locator('[data-form=dictionary] button[type=submit]').click()
    expect(page.locator('.dictionary-message[role=alert]')).to_be_visible()
    context.unroute('**/dictionary/q.json')
    page.locator('[data-action=dictionary-retry]').click()
    expect(page.locator('.dictionary-result-heading h2')).to_have_text('quixotic', timeout=30000)
    for view in ['home', 'explore', 'dictionary']:
        page.set_viewport_size({'width':1440,'height':1050})
        page.locator(f'nav [data-view={view}]').click()
        for width in [1024,768,390,320]:
            page.set_viewport_size({'width':width,'height':844})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), (view,width)
    page.screenshot(path=str(ART/'dictionary-mobile.png'), full_page=True)
    assert page.locator('.sidebar nav>button:visible').count() == 5
    page.locator('[data-action=more]').click()
    page.locator('#modal [data-view=materials]').click()
    expect(page.locator('#modal')).not_to_be_visible()
    expect(page.get_by_role('heading', name='Everything I Know About Love', exact=True)).to_be_visible()
    page.locator('[data-action=more]').click()
    page.locator('#modal [data-action=settings]').click()
    with page.expect_download() as download:
        page.locator('[data-action=export]').click()
    backup = ART/'features-backup.json'
    download.value.save_as(str(backup))
    assert json.loads(backup.read_text())['activities']
    page.locator('[data-action=import-backup]').click()
    page.locator('#backup-file').set_input_files(str(backup))
    page.locator('#confirm-restore').click()
    restored = page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    assert restored['activities'] == json.loads(backup.read_text())['activities']
    # The queried letter shard, UI and new modules must survive an offline reload.
    page.wait_for_function('!!navigator.serviceWorker.controller')
    page.wait_for_function("caches.keys().then(async keys=>(await Promise.all(keys.map(k=>caches.open(k).then(c=>c.keys())))).flat().some(r=>r.url.endsWith('/dictionary/a.json')))")
    context.set_offline(True)
    page.reload(wait_until='networkidle')
    page.locator('nav [data-view=dictionary]').click()
    page.locator('#dictionary-search').fill('abacus')
    page.locator('[data-form=dictionary] button[type=submit]').click()
    expect(page.locator('.dictionary-result-heading h2')).to_have_text('abacus', timeout=15000)
    expect(page.locator('.sense-definition').first).to_have_text(original_definition)
    context.set_offline(False)
    assert not errors, errors
    print('PASS: old progress retained; daily challenge, wrong-word resolution, context quiz, achievements, real dictionary and morphology, source-aware save/dedup, retry, backup/restore, mobile more menu, responsive views and offline dictionary reload.')
    browser.close()
