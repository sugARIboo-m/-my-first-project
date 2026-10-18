"""Verify the uploaded personal book plus normal local EPUB import."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
source=os.environ.get('EPUB_PATH')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':1050})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('APP_URL','http://127.0.0.1:3000'),wait_until='networkidle')
    page.wait_for_function("JSON.parse(localStorage.getItem('wordlane.v1')||'{}').readingLibraryImported===true")
    state=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    m=next(m for m in state['materials'] if m['id']=='material-reading')
    assert m['wordIds'] and len(m['chapters'])==1
    first=m['activeChapter'];first_contexts=m['chapters'][first]['contexts']
    print('First chapter seeded with',len(m['wordIds']),'matched study words')
    page.locator('nav [data-view=materials]').click()
    page.locator('[data-action=read-book]').click()
    assert page.locator('#epub-chapter option').count()==43
    page.locator('#epub-chapter').select_option('1')
    expect(page.locator('#file-status')).to_contain_text('Boys')
    page.locator('#extract-button').click()
    count=page.locator('[name=candidate]:checked').count()
    assert count>0
    page.locator('[data-form=material-save] button[type=submit]').click()
    state=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    m=next(m for m in state['materials'] if m['id']=='material-reading')
    assert len(m['chapters'])==2
    assert m['chapters'][first]['contexts']==first_contexts
    assert m['activeChapter']!=first
    print('Second chapter imported with',count,'matched words; first chapter retained')
    page.locator('[data-material-chapter=material-reading]').select_option(first)
    page.locator('[data-action=material-study][data-id=material-reading]').click()
    expected_contexts=set(first_contexts.values())
    assert page.locator('.example-en').inner_text() in expected_contexts
    page.locator('[data-action=reveal]').click()
    page.locator('[data-rating="3"]').click()
    page.reload(wait_until='networkidle')
    state=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
    m=next(m for m in state['materials'] if m['id']=='material-reading')
    assert len(m['chapters'])==2 and m['activeChapter']==first
    assert state['progress']
    page.locator('nav [data-view=materials]').click()
    page.screenshot(path=str(ROOT/'.test-artifacts/reading-epub.png'),full_page=True)
    # The standalone EPUB input must also work, not just the preloaded library.
    if source:
        page.locator('[data-action=import]').first.click()
        page.locator('#material-file').set_input_files(source)
        expect(page.locator('#epub-chapter')).to_be_visible(timeout=30000)
        assert page.locator('#epub-chapter option').count()==43
        expect(page.locator('[name=title]')).to_have_value('Everything I Know About Love')
        page.locator('#epub-chapter').select_option('41')
        expect(page.locator('#material-text')).not_to_be_empty()
        page.locator('#extract-button').click()
        assert page.locator('[name=candidate]:checked').count()>0
    assert not errors,errors
    print('PASS: real EPUB parsing, 43 reading sections, auto first-chapter import, chapter merge, source-specific sentences, learning, progress on reload and standalone EPUB file input.')
    b.close()
