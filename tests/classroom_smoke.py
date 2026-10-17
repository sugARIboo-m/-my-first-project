"""Exercise the personal classroom pack and actual uploaded Office files."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
sources=json.loads((ROOT/'.local/teacher-sources.json').read_text())
pack=json.loads((ROOT/'.local/course-library.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1440,'height':1050});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3000',wait_until='networkidle')
 page.wait_for_function("JSON.parse(localStorage.getItem('wordlane.v1')||'{}').courseImportVersions!==undefined")
 before=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
 assert len([w for w in before['customWords'] if w['id'].startswith('custom-course-u1-')])==98
 book=next(m for m in before['materials'] if m['id']=='material-reading')
 assert book['wordIds']
 page.locator('nav [data-view=course]').click()
 expect(page.get_by_role('heading',name='这节课，学到心里去。')).to_be_visible()
 assert page.locator('[data-action=course-lesson]').count()==5
 page.locator('[data-action=course-filter][data-filter=grammar]').click()
 assert page.locator('.word-row').count()==40
 page.locator('[data-action=course-filter][data-filter=phrases]').click()
 assert page.locator('.word-row').count()>0
 assert '主语' not in page.locator('.word-table').inner_text()
 page.locator('[data-action=course-lesson][data-id=unit1-source-4]').click()
 page.get_by_role('button',name='herald',exact=True).click()
 page.locator('.source-examples summary').click()
 expect(page.locator('.source-examples')).to_contain_text('The technology heralded a new age of space exploration.')
 expect(page.locator('.source-examples')).to_contain_text('第22页')
 page.locator('[data-action=close-modal]').click()
 page.locator('[data-action=course-lesson][data-id=unit1-source-1]').click()
 page.locator('[data-course-task="unit1-source-1:0"]').check()
 page.locator('[data-action=course-practice]').click()
 expect(page.locator('#study-source')).to_have_value('material-textbook')
 page.locator('[data-action=reveal]').click();page.locator('[data-rating="3"]').click()
 learned=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
 assert learned['progress']
 page.reload(wait_until='networkidle')
 page.locator('nav [data-view=course]').click()
 expect(page.locator('[data-course-task="unit1-source-1:0"]')).to_be_checked()
 page.locator('[data-action=course-sync]').click()
 after=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
 assert after['progress']==learned['progress']
 assert next(m for m in after['materials'] if m['id']=='material-reading')==book
 assert len(after['customWords'])==len(learned['customWords'])
 # All prepared quote sources must point to a paragraph containing the actual original text.
 for w in pack['words']:
  for e in w.get('examples',[]):
   f=next(f for f in sources if f['filename']==e['source']['file'])
   if e['source']['location'].startswith('第') and e['source']['location'].endswith('页'):
    lines=next(part['paragraphs'] for part in f['parts'] if part['location']==e['source']['location'])
   else:
    i=int(e['source']['location'].split('第')[1].split('段')[0])-1;lines=[f['parts'][0]['paragraphs'][i]]
   assert any(e['text'] in line for line in lines),(w['word'],e['source'])
 # Open all five actual files through the browser reader.
 for f in sources:
  page.locator('[data-action=nav][data-view=materials]').first.click()
  page.locator('[data-action=import]').first.click()
  page.locator('#material-file').set_input_files(f['path'])
  if f['filename'].endswith('.pptx'):
   expect(page.locator('#epub-chapter')).to_be_visible(timeout=20000)
   assert page.locator('#epub-chapter option').count()==len(f['parts'])+1
   page.locator('#epub-chapter').select_option('-1')
   expect(page.locator('#material-text')).to_have_value(__import__('re').compile('brand',__import__('re').I))
  else:
   expect(page.locator('#file-status')).to_contain_text('已读取',timeout=20000)
   expect(page.locator('#material-text')).to_have_value(__import__('re').compile('herald'))
  page.locator('[data-action=close-modal]').click()
 page.locator('nav [data-view=course]').click()
 page.screenshot(path=str(ROOT/'.test-artifacts/classroom-desktop.png'),full_page=True)
 for width in [320,390,768,1024]:
  page.set_viewport_size({'width':width,'height':844})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(ROOT/'.test-artifacts/classroom-mobile.png'),full_page=True)
 assert not errors,errors
 print('PASS: 98 terms; 40 grammar entries; 5 lessons; all quote locations verified; real PPTX/DOCX import; practice; task and learning persistence; deduplication; prior book data retained; responsive classroom.')
 b.close()
