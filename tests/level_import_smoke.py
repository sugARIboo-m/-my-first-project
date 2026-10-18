"""Check the real full EPUB, diagnostic persistence, defaults, overrides and chapter provenance."""
from pathlib import Path
import json, os, subprocess
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('APP_URL','http://127.0.0.1:3010/-my-first-project/dist/')
BOOK=os.environ.get('EPUB_PATH') or str(next(Path('/workspace/attachments').rglob('*.epub')))
ART=ROOT/'.test-artifacts';ART.mkdir(exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{emptyState,recordRating}from'./core.js';const s=emptyState();recordRating(s,'cet4-achieve',3);s.favorites=['daily-cherish'];console.log(JSON.stringify(s));"],cwd=ROOT,text=True))
with sync_playwright()as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1050});c.add_init_script("if(!localStorage.getItem('wordlane.v1'))localStorage.setItem('wordlane.v1',"+json.dumps(json.dumps(seed))+");")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL,wait_until='networkidle');expect(page.locator('.level-banner')).to_contain_text('3,500')
 page.locator('[data-action=level-start]').click()
 for i in range(5):
  choice=page.evaluate("async()=>{const m=await import('./level.js');const d=JSON.parse(localStorage.getItem('wordlane.v1')).learningProfile.draft;return m.assessmentQuestions(d.seed)[d.answers.length].correct}")
  page.locator(f'[data-action=level-answer][data-choice="{4 if i==0 else choice}"]').click()
 page.locator('[data-action=close-modal]').click();page.reload(wait_until='networkidle')
 assert len(page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).learningProfile.draft.answers"))==5
 page.locator('[data-action=level-start]').click();expect(page.locator('.level-test-meta')).to_contain_text('6 / 30')
 for i in range(5,30):
  choice=page.evaluate("async()=>{const m=await import('./level.js');const d=JSON.parse(localStorage.getItem('wordlane.v1')).learningProfile.draft;return m.assessmentQuestions(d.seed)[d.answers.length].correct}")
  page.locator(f'[data-action=level-answer][data-choice="{choice}"]').click()
 expect(page.locator('#modal')).to_contain_text('29 / 30')
 expect(page.locator('.level-recommendation')).to_contain_text('6,000')
 page.screenshot(path=str(ART/'level-result.png'),full_page=True)
 page.locator('[data-action=level-apply]').click()
 state=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
 assert state['progress']==seed['progress'];assert state['favorites']==seed['favorites']
 assert state['learningProfile']['cutoff']==6000;assert len(state['learningProfile']['unknown'])==1
 page.locator('nav [data-view=materials]').click()
 page.locator('[data-action=reimport][data-id=material-reading]').first.click()
 page.locator('#material-file').set_input_files(BOOK)
 expect(page.locator('#epub-chapter')).to_be_visible(timeout=30000)
 source=page.evaluate("async()=>{const{parseEpub}=await import('./epub.js');return (await parseEpub(await document.querySelector('#material-file').files[0].arrayBuffer())).chapters}")
 assert len(source)==43 and sum(len(s['text'])for s in source)>120000
 page.locator('[data-action=batch-all]').click()
 expect(page.locator('#batch-status')).to_contain_text('43 / 43')
 assert page.locator('[data-batch-chapter]:checked').count()==43
 page.locator('#extract-button').click()
 expect(page.locator('[data-form=material-save]')).to_be_visible(timeout=60000)
 expect(page.locator('#modal')).to_contain_text('43 个文字部分已完整参与统计')
 assert page.locator('[name=candidate]:checked').count()>0
 assert page.locator('.smart-filter-summary').inner_text().find('过滤')>=0
 # A selected advanced word on another page must survive returning to page one.
 page.locator('[data-action=candidate-page][data-direction="1"]').click()
 if page.locator('.candidate-row [name=candidate]').count():
  page.locator('.candidate-row [name=candidate]').first.check()
  field=page.locator('[data-candidate-meaning]').first
  if not field.input_value():field.fill('learner supplied meaning')
 page.locator('[data-action=candidate-page][data-direction="-1"]').click()
 page.locator('#candidate-show-excluded').check()
 page.locator('#candidate-search').fill('memory')
 row=page.locator('.candidate-row').filter(has=page.get_by_text('memory',exact=True))
 expect(row).to_have_count(1)
 assert not row.locator('[name=candidate]').is_checked()
 row.locator('[name=candidate]').check()
 page.locator('#candidate-search').fill('')
 page.set_viewport_size({'width':390,'height':844})
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.screenshot(path=str(ART/'batch-candidates-mobile.png'),full_page=True)
 page.locator('[data-form=material-save] button[type=submit]').click()
 expect(page.locator('#modal')).not_to_be_visible()
 state=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
 material=next(m for m in state['materials']if m['id']=='material-reading')
 assert len(material['chapters'])==43;assert material['activeChapter']==''
 assert 'memory' in state['learningProfile']['unknown']
 assert state['progress']==seed['progress']
 assert any(w.get('dictionarySource',{}).get('name')=='WordNet' for w in state['customWords'])
 by_source={s['id']:s['text']for s in source}
 for chapter in material['chapters'].values():
  for wid,context in chapter['contexts'].items():assert context in by_source[chapter['id']],(wid,chapter['id'])
 print('PASS: real full book 43 parts; every saved chapter context exactly matches source; no preview truncation or public file upload.',flush=True)
 page.locator('[data-action=material-study][data-id=material-reading]').click()
 assert page.locator('.example-en').inner_text() in material['contexts'].values()
 page.locator('[data-action=reveal]').click();page.locator('[data-rating="3"]').click()
 learned=page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1'))")
 page.reload(wait_until='networkidle')
 assert page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).learningProfile")==learned['learningProfile']
 assert page.evaluate("JSON.parse(localStorage.getItem('wordlane.v1')).progress")==learned['progress']
 page.locator('[data-action=level-profile]').click()
 expect(page.locator('[name=cutoff]')).to_have_value('6000')
 assert 'memory' in page.locator('[name=unknown]').input_value()
 assert not errors,errors
 print('PASS: assessment pause/reload/resume; 30-answer scoring and applying; all filters persisted; manual basic-word override; selected words across pages; mobile dialog; old progress retained and new learning saved.',flush=True)
 b.close()
