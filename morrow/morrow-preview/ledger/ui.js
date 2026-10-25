import {parseAmount} from '../domain.js';
import {QUICK_KINDS,QUICK_CATEGORIES,QUICK_ACCOUNTS,QUICK_CURRENCIES,quickLocalDate,quickDefaults,saveQuickRecord,deleteQuickRecord,quickMonthSummary,quickCsv,quickAmountText,quickMoney} from './domain.js';
import {QUICK_MESSAGES} from './messages.js';
import {CLOUD_MESSAGES} from '../cloud/messages.js';

export function mountQuickLedger({store,getLanguage,cloud}) {
  const text=key=>QUICK_MESSAGES[getLanguage()][key]??QUICK_MESSAGES[getLanguage()].quickInvalidRecord;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(amount,currency)=>quickMoney(amount,currency,getLanguage()==='en'?'en-US':'zh-CN');
  const uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
  let state=null,ready=false,saving=false,editing=null,attempt=null,dirtyDraft=false,automaticDate=true,error=null,notice=null;
  let draft={...quickDefaults(),amount:'',date:quickLocalDate(),note:''},month=quickLocalDate().slice(0,7),search='',filter='all',cloudInfo=cloud.getStatus();
  const demo=document.getElementById('dashboard-section');
  const page=document.createElement('main');page.id='quick-entry';page.className='quick-page';page.hidden=true;demo.before(page);
  const nav=document.createElement('a');nav.className='quick-nav';nav.href='#quick-entry';nav.innerHTML='<svg aria-hidden="true"><use href="#plus"/></svg><span></span>';document.querySelector('.navigation').prepend(nav);
  const mobile=document.querySelector('.tabbar a[href="#dashboard-section"]');mobile.href='#quick-entry';mobile.removeAttribute('data-i');mobile.querySelector('span').removeAttribute('data-i');
  const ledgerLinks=[...document.querySelectorAll('a[href="#transactions-section"]')];ledgerLinks.forEach(a=>{a.href='#quick-history';a.querySelector('span')?.removeAttribute('data-i');});
  const demoLinks=[['.navigation a[href="#dashboard-section"]','overview'],['.navigation a[href="#goals-section"]','demoGoals'],['.navigation button[data-dialog="accounts"]','demoAccounts']];
  demoLinks.forEach(([selector])=>document.querySelector(selector)?.querySelector('span')?.removeAttribute('data-i'));
  const modal=document.createElement('dialog');modal.id='quick-delete-dialog';modal.className='garden-dialog';document.body.append(modal);
  function option(values,selected){return values.map(value=>`<option value="${value}" ${value===selected?'selected':''}>${QUICK_CURRENCIES.includes(value)?value:text(value)}</option>`).join('');}
  function readDraft(){
    const form=page.querySelector('#quick-form');if(!form)return;
    const fields=Object.fromEntries(new FormData(form));draft={...draft,...fields};
  }
  function render(){
    readDraft();nav.querySelector('span').textContent=text('nav');mobile.querySelector('span').textContent=text('nav');
    ledgerLinks.forEach(a=>{a.querySelector('span').textContent=text('recent');});demoLinks.forEach(([selector,key])=>{const span=document.querySelector(selector)?.querySelector('span');if(span)span.textContent=text(key);});
    page.innerHTML=`<div class="quick-top"><a class="quick-brand" href="#quick-entry"><span>m.</span> Morrow</a><div><button type="button" id="quick-language">${text('language')}</button><button type="button" id="quick-appearance" aria-label="${text('appearance')}"><svg aria-hidden="true"><use href="#sun"/></svg></button><a href="#morrow-cloud">${text('cloud')}</a></div></div>
      <header class="quick-heading"><span class="garden-eyebrow">${text('eyebrow')}</span><h1>${text('title')}</h1><p>${text('subtitle')}</p></header>
      <div class="quick-layout"><section class="quick-entry-card"><form id="quick-form" novalidate>
        <div class="quick-kind" role="group" aria-label="${text('scope')}">${QUICK_KINDS.map(kind=>`<button type="button" data-quick-kind="${kind}" aria-pressed="${draft.kind===kind}" class="${draft.kind===kind?'selected':''}">${text(kind)}</button>`).join('')}</div>
        ${editing?`<div class="quick-edit-label">${text('editing')}<button type="button" id="quick-cancel">${text('cancel')}</button></div>`:''}
        <label class="quick-amount-label" for="quick-amount">${text('amount')}</label><div class="quick-amount-wrap"><select name="currency" aria-label="${text('currency')}">${option(QUICK_CURRENCIES,draft.currency)}</select><input id="quick-amount" name="amount" inputmode="decimal" autocomplete="off" maxlength="24" placeholder="0.00" value="${escape(draft.amount)}" aria-label="${text('amount')}" required></div>
        <div class="quick-options"><label><span>${text('category')}</span><select name="category">${option(QUICK_CATEGORIES,draft.category)}</select></label><label><span>${text('account')}</span><select name="account">${option(QUICK_ACCOUNTS,draft.account)}</select></label>${draft.kind==='transfer'?`<label><span>${text('toAccount')}</span><select name="toAccount">${option(QUICK_ACCOUNTS,draft.toAccount)}</select></label>`:''}</div>
        <div class="quick-presets" role="group" aria-label="${text('presets')}">${[['dining','wechat','presetFood'],['shopping','alipay','presetShopping'],['transport','wechat','presetTransport']].map(([category,account,label])=>`<button type="button" data-quick-preset="${category}" data-account="${account}">${text(label)}</button>`).join('')}</div>
        <details class="quick-details" ${draft.date!==quickLocalDate()||draft.note?'open':''}><summary>${text('details')} <span>${draft.date===quickLocalDate()?text('today'):escape(draft.date)}</span></summary><div><label><span>${text('date')}</span><input type="date" name="date" min="1900-01-01" max="9999-12-31" value="${escape(draft.date)}"></label><label><span>${text('note')}</span><textarea name="note" rows="2" maxlength="160">${escape(draft.note)}</textarea></label></div></details>
        <p id="quick-error" class="field-error" role="alert" ${error?'':'hidden'}>${error?text(error):''}</p><button class="primary quick-submit" type="submit" ${!ready||saving?'disabled':''}>${text(saving?'saving':'save')}</button><p id="quick-notice" class="quick-notice" role="status">${notice?text(notice):''}</p>
        <div class="quick-sync" role="status"></div>${!ready?`<button class="garden-button" type="button" id="quick-retry">${text('storageRetry')}</button>`:''}
      </form><p class="quick-boundary">${text('boundary')}</p><p class="quick-boundary">${text('refundHelp')}</p><small class="quick-shortcuts">${text('shortcuts')}</small></section>
      <section class="quick-history" id="quick-history"><div class="quick-history-heading"><h2>${text('monthly')}</h2><input type="month" id="quick-month" aria-label="${text('month')}" value="${month}"></div><div class="quick-summary" id="quick-summary"></div><div class="quick-history-heading"><h2>${text('recent')}</h2><select id="quick-filter" aria-label="${text('all')}"><option value="all">${text('all')}</option>${option(QUICK_KINDS,filter)}</select></div><input type="search" id="quick-search" placeholder="${text('search')}" aria-label="${text('search')}" value="${escape(search)}"><p class="quick-count" id="quick-count"></p><div id="quick-records"></div><p class="quick-boundary">${text('imported')}</p><details class="quick-backups"><summary>${text('more')}</summary><p>${text('dataHelp')}</p><button class="garden-button" id="quick-json">${text('backup')}</button><button class="garden-button" id="quick-csv">${text('csv')}</button><a class="garden-button" href="#eras-section">${text('restore')}</a></details></section></div>
      <footer class="quick-footer"><a href="#eras-section">${text('eras')} ↗</a><a href="#dashboard-section">${text('overview')} ↗</a></footer>`;
    page.querySelector('#quick-filter').value=filter;
    page.querySelector('#quick-language').onclick=()=>document.getElementById('language').click();
    page.querySelector('#quick-appearance').onclick=()=>document.getElementById('theme').click();
    page.querySelector('#quick-form').onsubmit=submit;
    page.querySelector('#quick-form').oninput=event=>{readDraft();dirtyDraft=true;attempt=null;if(event.target.name==='date')automaticDate=false;};
    page.querySelector('#quick-form').onchange=event=>{readDraft();dirtyDraft=true;attempt=null;if(event.target.name==='date')automaticDate=false;if(event.target.name==='currency')renderSummary();};
    page.querySelector('#quick-month').onchange=event=>{month=event.target.value;renderSummary();};
    page.querySelector('#quick-filter').onchange=event=>{filter=event.target.value;renderSummary();};
    page.querySelector('#quick-search').oninput=event=>{search=event.target.value;renderSummary();};
    page.querySelector('#quick-cancel')?.addEventListener('click',reset);
    if(editing){const remove=document.createElement('button');remove.type='button';remove.id='quick-delete';remove.className='quick-delete';remove.textContent=text('remove');remove.onclick=()=>confirmDelete(editing);page.querySelector('#quick-form').append(remove);}
    page.querySelector('#quick-retry')?.addEventListener('click',()=>load(true));
    page.querySelector('#quick-json').onclick=async()=>{try{const value=await store.read();download('Morrow-Backup-'+quickLocalDate()+'.json',JSON.stringify({format:'morrow-garden',exportedAt:now(),state:value},null,2),'application/json');}catch(e){setError(e.message);}};
    page.querySelector('#quick-csv').onclick=async()=>{try{download('Morrow-Ledger-'+quickLocalDate()+'.csv',quickCsv((await store.read()).ledger?.records??[]),'text/csv;charset=utf-8');}catch(e){setError(e.message);}};
    renderSummary();renderStatus();
    if(saving)page.querySelectorAll('#quick-form input,#quick-form select,#quick-form textarea,#quick-form button').forEach(el=>el.disabled=true);
  }
  function renderStatus(){const el=page.querySelector('.quick-sync');if(el)el.innerHTML=`<span>${escape(!ready?text('loading'):cloudInfo.signedIn&&cloudInfo.enabled?CLOUD_MESSAGES[getLanguage()][cloudInfo.status]??text('local'):text('syncPaused'))}</span><a href="#morrow-cloud">${text('cloud')} ↗</a>`;}
  function renderSummary(){
    if(!page.querySelector('#quick-records'))return;
    const records=state?.ledger?.records??[],currency=draft.currency;
    try{
      const totals=quickMonthSummary(records,month,currency);
      page.querySelector('#quick-summary').innerHTML=[['spent',totals.spending],['earned',totals.income],['refunds',totals.refunds],['net',totals.net]].map(([label,amount])=>`<div><span>${text(label)}</span><strong>${money(amount,currency)}</strong></div>`).join('');
    }catch(e){page.querySelector('#quick-summary').textContent=text(e.message);}
    const needle=search.trim().toLocaleLowerCase();
    const selected=records.filter(r=>!r.deletedAt&&r.currency===currency&&r.date.startsWith(month)&&(filter==='all'||r.kind===filter)&&(!needle||[r.note,text(r.category),text(r.account),text(r.kind)].join(' ').toLocaleLowerCase().includes(needle))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
    page.querySelector('#quick-count').textContent=text('count').replace('{count}',selected.length);
    page.querySelector('#quick-records').innerHTML=selected.length?selected.map(r=>`<button class="quick-record" data-quick-edit="${escape(r.id)}"><span class="quick-record-icon">${r.kind==='expense'?'↗':r.kind==='transfer'?'⇄':'↙'}</span><span class="quick-record-copy"><b>${text(r.category)}</b><small>${escape(r.date)} · ${text(r.account)}${r.kind==='transfer'?' → '+text(r.toAccount):''}</small>${r.note?`<small>${escape(r.note)}</small>`:''}</span><span class="quick-record-amount ${r.kind}"><b>${r.kind==='expense'?'−':r.kind==='transfer'?'': '+'}${money(r.amount,r.currency)}</b><small>${text(r.kind)}</small></span></button>`).join(''):`<div class="quick-empty"><span>◦</span><h3>${text('empty')}</h3><p>${text('emptySub')}</p></div>`;
  }
  function setError(key){error=key;const el=page.querySelector('#quick-error');if(el){el.textContent=text(key);el.hidden=false;}}
  function reset(){editing=null;attempt=null;dirtyDraft=false;automaticDate=true;error=null;draft={...quickDefaults(state?.ledger),amount:'',date:quickLocalDate(),note:''};page.querySelector('#quick-form')?.remove();render();page.querySelector('#quick-amount').focus({preventScroll:true});}
  async function submit(event){
    event.preventDefault();if(!ready||saving)return;readDraft();
    try{
      const amount=parseAmount(draft.amount);if(!attempt)attempt={id:uuid(),recordId:editing?.id??uuid()};
      const mutation=attempt,expectedRevision=editing?.revision??0;
      const at=now(),candidate={id:mutation.recordId,kind:draft.kind,amount,currency:draft.currency,category:draft.category,account:draft.account,toAccount:draft.kind==='transfer'?draft.toAccount:null,date:draft.date,note:draft.note.trim(),createdAt:editing?.createdAt??at,updatedAt:at,revision:editing?.revision??1,deletedAt:null};
      saving=true;page.querySelectorAll('#quick-form input,#quick-form select,#quick-form textarea,#quick-form button').forEach(el=>el.disabled=true);page.querySelector('.quick-submit').textContent=text('saving');
      const updated=await store.update(current=>saveQuickRecord(current,candidate,mutation.id,at,expectedRevision));
      const wasEditing=!!editing;state=updated;month=candidate.date.slice(0,7);notice=wasEditing?'savedEdit':'saved';reset();
      if(!wasEditing){draft.currency=candidate.currency;page.querySelector('[name=currency]').value=candidate.currency;renderSummary();}
    }catch(e){setError(e.message);}
    finally{saving=false;page.querySelectorAll('#quick-form input,#quick-form select,#quick-form textarea,#quick-form button').forEach(el=>el.disabled=false);const button=page.querySelector('.quick-submit');if(button){button.disabled=!ready;button.textContent=text('save');}}
  }
  function openRecord(id){
    const record=state?.ledger?.records.find(r=>r.id===id&&!r.deletedAt);if(!record)return;
    editing={...record};dirtyDraft=true;automaticDate=false;attempt=null;error=null;notice=null;
    draft={...record,amount:quickAmountText(record.amount),toAccount:record.toAccount??'alipay'};
    page.querySelector('#quick-form')?.remove();render();
    page.querySelector('#quick-amount').focus();page.querySelector('#quick-amount').select();page.scrollIntoView({block:'start'});
  }
  function confirmDelete(record){
    modal.innerHTML=`<div class="dialog-title"><h2>${text('deleteTitle')}</h2><button type="button" data-quick-keep aria-label="${text('cancelDelete')}">×</button></div><p>${money(record.amount,record.currency)} · ${text(record.category)}</p><p class="dialog-help">${text('deleteHelp')}</p><p role="alert" class="field-error" id="quick-delete-error" hidden></p><div class="confirm-actions"><button class="garden-button" data-quick-keep>${text('cancelDelete')}</button><button class="danger-button" id="quick-confirm-delete">${text('confirmDelete')}</button></div>`;
    modal.querySelectorAll('[data-quick-keep]').forEach(el=>el.onclick=()=>modal.close());
    const operationId=uuid();modal.querySelector('#quick-confirm-delete').onclick=async event=>{
      if(saving)return;saving=true;event.target.disabled=true;
      try{state=await store.update(current=>deleteQuickRecord(current,record.id,operationId,now(),record.revision));modal.close();notice='deleted';reset();}
      catch(e){const el=modal.querySelector('#quick-delete-error');el.textContent=text(e.message);el.hidden=false;event.target.disabled=false;}
      finally{saving=false;page.querySelectorAll('#quick-form input,#quick-form select,#quick-form textarea,#quick-form button').forEach(el=>el.disabled=false);const button=page.querySelector('.quick-submit');if(button)button.disabled=!ready;}
    };modal.showModal();
  }
  page.onclick=event=>{
    if(saving)return;const type=event.target.closest('[data-quick-kind]'),preset=event.target.closest('[data-quick-preset]'),edit=event.target.closest('[data-quick-edit]');
    if(type){readDraft();const defaults=quickDefaults(state?.ledger,type.dataset.quickKind);draft={...draft,...defaults};dirtyDraft=true;attempt=null;page.querySelector('#quick-form').remove();render();}
    if(preset){readDraft();draft={...draft,kind:'expense',category:preset.dataset.quickPreset,account:preset.dataset.account};dirtyDraft=true;attempt=null;page.querySelector('#quick-form').remove();render();page.querySelector('#quick-amount').focus();}
    if(edit)openRecord(edit.dataset.quickEdit);
  };
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function load(initial=false){
    try{state=await store.read();ready=true;if(initial&&!dirtyDraft){draft={...quickDefaults(state.ledger),amount:'',date:quickLocalDate(),note:''};page.querySelector('#quick-form')?.remove();render();}else{renderSummary();renderStatus();const submit=page.querySelector('.quick-submit');if(submit&&!saving)submit.disabled=false;}}
    catch(e){ready=false;setError(e.message);renderStatus();const button=page.querySelector('.quick-submit');if(button)button.disabled=true;}
  }
  function route(){
    const historyView=location.hash==='#quick-history',active=location.hash==='#quick-entry'||historyView;page.hidden=!active;demo.hidden=active;document.documentElement.dataset.quickView=active?'true':'false';
    if(active){document.querySelectorAll('.navigation a,.tabbar a').forEach(a=>{const selected=a.hash===(historyView?'#quick-history':'#quick-entry')||(historyView&&a.classList.contains('quick-nav'));a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});if(historyView)requestAnimationFrame(()=>page.querySelector('#quick-history').scrollIntoView({block:'start',behavior:'auto'}));else window.scrollTo({top:0,behavior:'auto'});}
    else{const target=document.getElementById(location.hash.slice(1));if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'auto'}));}
    updateKeyboard();
  }
  function updateKeyboard(){
    const viewport=window.visualViewport;
    const inset=viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
    const shown=!page.hidden&&inset>120&&!document.querySelector('dialog[open]');
    document.documentElement.dataset.quickKeyboard=String(shown);
    document.documentElement.style.setProperty('--quick-keyboard-inset',shown?inset+'px':'0px');
  }
  window.visualViewport?.addEventListener('resize',updateKeyboard);
  window.visualViewport?.addEventListener('scroll',updateKeyboard);
  document.addEventListener('focusin',()=>requestAnimationFrame(updateKeyboard));
  document.addEventListener('focusout',()=>requestAnimationFrame(updateKeyboard));
  store.onchange(()=>load());
  window.addEventListener('morrow:cloud-status',event=>{cloudInfo=event.detail;renderStatus();});
  window.addEventListener('morrow:language',()=>{modal.close();render();});
  window.addEventListener('hashchange',route);
  window.addEventListener('focus',()=>{if(automaticDate&&!editing){draft.date=quickLocalDate();const field=page.querySelector('[name=date]');if(field)field.value=draft.date;}load();});
  document.addEventListener('keydown',event=>{if(!page.hidden&&(event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!document.querySelector('dialog[open]')){event.preventDefault();page.querySelector('#quick-form').requestSubmit();}});
  document.addEventListener('keydown',event=>{if(!page.hidden&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();page.querySelector('#quick-amount').focus();}},{capture:true});
  const oldAdd=document.getElementById('mobile-add');oldAdd.onclick=()=>{location.hash='#quick-entry';route();page.querySelector('#quick-amount').focus();};
  render();load(true);
  if(!location.hash&&!location.pathname.endsWith('eras-review.html')&&matchMedia('(max-width:800px)').matches)history.replaceState(null,'','#quick-entry');
  route();return {route};
}
