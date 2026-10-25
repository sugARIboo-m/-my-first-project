import {parseAmount,isCalendarDate} from '../domain.js';
import {ERA_THEMES,GARDEN_STAGES,GARDEN_CURRENCIES,goalProgress,emptyGardenState,validateGardenState,saveGardenGoal,transferGardenFunds,legacyGardenPreview,applyLegacyGarden} from './domain.js';
import {ERA_MESSAGES} from './messages.js';
import {renderGardenSvg} from './art.js';
import {createGardenStore} from './store.js';
import {renderErasExperiences} from './experiences.js';

export function mountEras({getLanguage,store=createGardenStore()}) {
  const query=selector=>document.querySelector(selector);
  const translate=key=>ERA_MESSAGES[getLanguage()][key]??key;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const format=(amount,currency='CNY')=>new Intl.NumberFormat(getLanguage()==='en'?'en-US':'zh-CN',{style:'currency',currency,currencyDisplay:'narrowSymbol',minimumFractionDigits:2,maximumFractionDigits:2}).format(amount/100);
  const identifier=()=>crypto.randomUUID();
  const now=()=>new Date().toISOString();
  let state=emptyGardenState(),ready=false,storageError=null,selectedTheme='eternal-bloom',sampleStage=2;
  let editingGoal=null,pendingImport=null,backupAcknowledged=false,busy=false,noticeTimer;
  let activeView='garden';const extraPreferences={};
  const container=document.createElement('section');container.id='eras-section';container.className='eras-section';
  query('main footer').before(container);
  const dashboard=document.createElement('section');dashboard.className='garden-dashboard panel';dashboard.id='garden-dashboard';
  query('.dashboard-grid').before(dashboard);
  const nav=document.createElement('a');nav.href='#eras-section';nav.className='eras-nav';nav.innerHTML='<svg aria-hidden="true"><use href="#leaf"/></svg><span>Eras</span>';
  query('.navigation').append(nav);
  const mobile=query('.tabbar a[href="#goals-section"]');mobile.href='#eras-section';mobile.classList.add('eras-nav');mobile.querySelector('span').removeAttribute('data-i');mobile.querySelector('span').textContent='Eras';
  const motionSetting=document.createElement('label');motionSetting.className='setting-row';motionSetting.id='garden-motion-setting';
  query('#settings-dialog .settings-info').before(motionSetting);
  const dialogs=document.createElement('div');dialogs.id='garden-dialogs';document.body.append(dialogs);
  const status=document.createElement('div');status.className='toast garden-toast';status.setAttribute('role','status');status.hidden=true;document.body.append(status);

  function announce(key){status.dataset.eraKey=key;status.textContent=translate(key);status.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>status.hidden=true,6500);}
  function dateText(value){return new Intl.DateTimeFormat(getLanguage()==='en'?'en-US':'zh-CN',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value.length===10?value+'T12:00:00Z':value));}
  function button(action,label,extra=''){return `<button class="garden-button" data-garden-action="${action}" ${extra}>${translate(label)}</button>`;}
  function themeOptions(value){return ERA_THEMES.map(theme=>`<option value="${theme.id}" ${theme.id===value?'selected':''}>${theme.name}</option>`).join('');}
  function goalOptions(value){return state.goals.filter(goal=>goal.fundingMode==='manual'&&!goal.paused).map(goal=>`<option value="${escape(goal.id)}" ${goal.id===value?'selected':''}>${escape(goal.name)} · ${goal.currency}</option>`).join('');}
  function goalCard(goal,index){
    const progress=goalProgress(goal.currentSaved,goal.targetAmount),theme=ERA_THEMES.find(item=>item.id===goal.themeId);
    return `<article class="saved-garden" data-goal-id="${escape(goal.id)}" style="--era-accent:${theme.palette[1]}">
      <div class="garden-art-wrap">${renderGardenSvg(theme.id,progress.stage,{prefix:'saved-'+goal.id,label:theme.name+' — '+translate(GARDEN_STAGES[progress.stage])})}<span class="garden-stage-tag">${translate(GARDEN_STAGES[progress.stage])}</span>${goal.paused?`<span class="garden-pause-tag">${translate('paused')}</span>`:''}</div>
      <div class="saved-garden-body"><div class="saved-garden-heading"><div><span class="garden-theme-name">${theme.name}</span><h3>${escape(goal.name)}</h3></div><button class="garden-edit" data-garden-action="edit" data-id="${escape(goal.id)}" aria-label="${translate('edit')}"><svg aria-hidden="true"><use href="#edit"/></svg></button></div>
      <div class="garden-amounts"><strong>${format(goal.currentSaved,goal.currency)}</strong><span>/ ${format(goal.targetAmount,goal.currency)}</span></div>
      <div class="garden-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" aria-label="${escape(goal.name)}"><span style="width:${progress.percent}%"></span></div>
      <div class="garden-progress-label"><span>${progress.percent.toLocaleString(getLanguage()==='en'?'en-US':'zh-CN',{maximumFractionDigits:2})}%</span><span>${progress.complete?translate('fullyFunded'):translate('remaining')+' '+format(goal.targetAmount-goal.currentSaved,goal.currency)}</span></div>
      <p class="garden-date" title="${translate('plannedDate')}">${goal.targetDate?translate('due')+' · '+dateText(goal.targetDate):translate('noDate')}</p><p class="garden-forecast">${translate('noForecast')}</p>
      ${goal.fundingMode==='legacy-total'?`<p class="garden-legacy">${translate('legacyMode')}</p>`:''}
      ${goal.bloomedAt?`<div class="garden-memory"><span>${translate('firstBloom')} · ${dateText(goal.bloomedAt)}</span>${button('memory','memory',`data-id="${escape(goal.id)}"`)}</div><p class="garden-memory-note">${translate('historicBloom')}</p>`:''}</div></article>`;
  }

  function render(){
    if(!status.hidden&&status.dataset.eraKey)status.textContent=translate(status.dataset.eraKey);
    const current=state.goals.find(goal=>!goal.paused)??state.goals[0];
    dashboard.innerHTML=current?`<a class="dashboard-garden-link" href="#eras-section"><div class="dashboard-garden-art">${renderGardenSvg(current.themeId,goalProgress(current.currentSaved,current.targetAmount).stage,{prefix:'dashboard',label:translate('currentEra')})}</div><div><span class="garden-eyebrow">${translate('currentEra')}</span><h2>${escape(current.name)}</h2><p>${ERA_THEMES.find(theme=>theme.id===current.themeId).name} · ${goalProgress(current.currentSaved,current.targetAmount).percent}%</p></div><span class="dashboard-garden-arrow">↗</span></a>`:
      `<div class="dashboard-garden-empty"><div><span class="garden-eyebrow">MORROW ERAS</span><h2>${translate('noGoals')}</h2><p>${translate('allLocal')}</p></div>${button('new','newGoal',!ready?'disabled':'')}</div>`;
    container.innerHTML=`<div class="eras-heading"><div><div class="garden-eyebrow">${translate('eyebrow')}</div><h2>${translate('title')}</h2><p>${translate('subtitle')}</p></div><div class="garden-local-status"><i></i>${translate(ready?'local':'loading')}</div></div>
      <nav class="eras-tabs" aria-label="Eras">${['garden','collection','wrapped'].map(view=>`<button type="button" data-era-view="${view}" aria-pressed="${view===activeView}" class="${view===activeView?'selected':''}">${translate(view)}</button>`).join('')}</nav>
      <p class="garden-boundary">${translate('localHelp')}</p>
      ${storageError?`<div class="garden-error" role="alert">${translate(storageError)} ${button('retry','retry')}</div>`:''}
      <div class="garden-section-title" id="garden-live"><div><h3>${translate('myGardens')}</h3><p>${translate('allocationNote')}</p></div><div class="garden-actions">${button('new','newGoal',!ready?'disabled':'')}${button('transfer','transfer',!ready||state.goals.filter(goal=>goal.fundingMode==='manual'&&!goal.paused).length<2?'disabled':'')}</div></div>
      <div class="saved-gardens">${state.goals.length?state.goals.map(goalCard).join(''):`<div class="garden-empty"><span class="garden-seed-mark">◦</span><h3>${translate('noGoals')}</h3><p>${translate('emptyHelp')}</p>${button('new','newGoal',!ready?'disabled':'')}</div>`}</div>
      <div class="garden-data-actions">${button('backup','backup',!ready?'disabled':'')}${button('pick-restore','restore',!ready?'disabled':'')}${button('pick-legacy','importLegacy',!ready?'disabled':'')}<span>${translate('pendingCloud')}</span></div>
      <section class="garden-studio"><div class="garden-section-title"><div><span class="garden-eyebrow">ERA ATELIER</span><h3>${translate('explore')}</h3><p>${translate('exploreHelp')}</p></div><span class="garden-sample-pill">${translate('sample')}</span></div>
      <div class="era-theme-picker" role="group" aria-label="${translate('theme')}">${ERA_THEMES.map(theme=>`<button class="era-theme-option ${selectedTheme===theme.id?'selected':''}" data-garden-action="sample-theme" data-theme="${theme.id}" aria-pressed="${selectedTheme===theme.id}"><span class="era-theme-swatch" style="background:linear-gradient(135deg,${theme.palette[0]},${theme.palette[1]})"></span><span>${theme.name}</span></button>`).join('')}</div>
      <div class="garden-studio-scene"><div class="garden-studio-art">${renderGardenSvg(selectedTheme,sampleStage,{prefix:'studio',label:ERA_THEMES.find(theme=>theme.id===selectedTheme).name+' — '+translate(GARDEN_STAGES[sampleStage])})}</div><div class="garden-studio-copy"><span class="garden-eyebrow">${translate('sample')}</span><h3>${ERA_THEMES.find(theme=>theme.id===selectedTheme).name}</h3><p>${translate(ERA_THEMES.find(theme=>theme.id===selectedTheme).descriptionKey)}</p><div class="garden-stage-number">0${sampleStage+1}<span>/ 05</span></div><b>${translate(GARDEN_STAGES[sampleStage])}</b></div></div>
      <div class="garden-stage-picker" role="group" aria-label="${translate('showcase')}">${GARDEN_STAGES.map((stage,index)=>`<button data-garden-action="sample-stage" data-stage="${index}" class="${sampleStage===index?'selected':''}" aria-pressed="${sampleStage===index}"><span>0${index+1}</span><b>${translate(stage)}</b><small>${['0–24%','25–49%','50–74%','75–99%','100%'][index]}</small></button>`).join('')}</div></section>
      <details class="garden-contact-sheet" open><summary>${translate('showcase')}</summary><p>${translate('showcaseHelp')}</p><div class="garden-matrix">${ERA_THEMES.map(theme=>`<div class="garden-matrix-row"><h4>${theme.name}</h4><div class="garden-matrix-stages">${GARDEN_STAGES.map((stage,index)=>`<figure>${renderGardenSvg(theme.id,index,{prefix:'matrix-'+theme.id+'-'+index,label:theme.name+' — '+translate(stage)})}<figcaption>${translate(stage)} <span>${['0–24%','25–49%','50–74%','75–99%','100%'][index]}</span></figcaption></figure>`).join('')}</div></div>`).join('')}</div></details>
      <input type="file" id="garden-legacy-file" accept=".json,application/json" hidden><input type="file" id="garden-restore-file" accept=".json,application/json" hidden>`;
    motionSetting.innerHTML=`<span>${translate('motion')}</span><select id="garden-motion"><option value="system">${translate('system')}</option><option value="reduce">${translate('reduce')}</option></select>`;
    query('#garden-motion').value=state.settings.motion;
    query('#garden-motion').onchange=async event=>{try{state=await store.update(current=>({...current,settings:{...current.settings,motion:event.target.value}}));document.documentElement.dataset.gardenMotion=state.settings.motion;}catch(error){announce(error.message);}};
    document.documentElement.dataset.gardenMotion=state.settings.motion;
    query('#garden-legacy-file').onchange=event=>loadImport(event.target.files[0],'legacy');
    query('#garden-restore-file').onchange=event=>loadImport(event.target.files[0],'restore');
    if(activeView!=='garden'){
      [...container.children].filter(element=>!element.classList.contains('eras-heading')&&!element.classList.contains('eras-tabs')).forEach(element=>element.hidden=true);
      renderErasExperiences({host:container,state,store,getLanguage,view:activeView,preferences:extraPreferences,onState:updated=>{state=updated;render();}});
    }
    queryAllDialogTranslations();
  }

  function queryAllDialogTranslations(){
    dialogs.querySelectorAll('[data-era-i]').forEach(element=>element.textContent=translate(element.dataset.eraI));
  }
  function openGoal(id=null){
    if(!ready)return;editingGoal=state.goals.find(goal=>goal.id===id)??null;
    const goal=editingGoal??{name:'',targetAmount:0,currentSaved:0,currency:'CNY',themeId:selectedTheme,targetDate:'',paused:false};
    dialogs.innerHTML=`<dialog id="garden-goal-dialog" class="garden-dialog"><form id="garden-goal-form" novalidate><div class="dialog-title"><h2>${translate(editingGoal?'editGoal':'newGoal')}</h2><button type="button" data-garden-close aria-label="${translate('close')}">×</button></div><p class="dialog-help">${translate('allocationNote')}</p><div class="form-grid"><label class="full-width"><span>${translate('goalName')}</span><input name="name" required maxlength="80" value="${escape(goal.name)}"></label><label><span>${translate('targetAmount')}</span><input name="target" inputmode="decimal" maxlength="24" required value="${goal.targetAmount?(goal.targetAmount/100).toFixed(2):''}" placeholder="0.00"></label><label><span>${translate('currentSaved')}</span><input name="saved" inputmode="decimal" maxlength="24" required value="${(goal.currentSaved/100).toFixed(2)}" ${goal.fundingMode==='legacy-total'?'readonly':''}></label><label><span>${translate('currency')}</span><select name="currency">${GARDEN_CURRENCIES.map(currency=>`<option ${currency===goal.currency?'selected':''}>${currency}</option>`).join('')}</select></label><label><span>${translate('targetDate')}</span><input type="date" name="date" min="1900-01-01" max="9999-12-31" value="${goal.targetDate??''}"></label><label class="full-width"><span>${translate('theme')}</span><select name="theme">${themeOptions(goal.themeId)}</select></label></div><label class="garden-checkbox"><input type="checkbox" name="paused" ${goal.paused?'checked':''}><span>${translate('pause')}</span></label><p class="dialog-help">${translate(goal.fundingMode==='legacy-total'?'legacyHint':'pauseHelp')}</p><p id="garden-form-error" role="alert" class="field-error" hidden></p><button class="primary form-submit">${translate('save')}</button></form></dialog>`;
    const form=query('#garden-goal-form');
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;
      try{
        const fields=Object.fromEntries(new FormData(form));const at=now();
        const saved=/^0(?:\.0{1,2})?$/.test(fields.saved.trim())?0:parseAmount(fields.saved);
        const candidate={id:editingGoal?.id??identifier(),name:fields.name.trim(),targetAmount:parseAmount(fields.target),currentSaved:saved,
          currency:fields.currency,themeId:fields.theme,targetDate:fields.date||null,paused:fields.paused==='on',fundingMode:editingGoal?.fundingMode??'manual',
          createdAt:editingGoal?.createdAt??at,updatedAt:at,revision:editingGoal?.revision??1,bloomedAt:editingGoal?.bloomedAt??null,bloomedThemeId:editingGoal?.bloomedThemeId??null};
        if(editingGoal&&editingGoal.currency!==candidate.currency&&editingGoal.currentSaved>0)throw new Error('gardenCurrencyLocked');
        const operationId=identifier();busy=true;form.querySelector('[type="submit"],.form-submit').disabled=true;
        const oldStage=editingGoal?goalProgress(editingGoal.currentSaved,editingGoal.targetAmount).stage:0;
        state=await store.update(current=>saveGardenGoal(current,candidate,operationId,at,editingGoal?.revision??0));
        const newStage=goalProgress(candidate.currentSaved,candidate.targetAmount).stage;
        query('#garden-goal-dialog').close();render();announce(newStage>oldStage?'stageChanged':'saved');
        if(newStage>oldStage){const card=container.querySelector(`[data-goal-id="${candidate.id}"]`);card?.classList.add('garden-milestone');}
      }catch(error){query('#garden-form-error').textContent=translate(error.message==='invalidAmount'?'gardenInvalidAmount':error.message);query('#garden-form-error').hidden=false;}
      finally{busy=false;form.querySelector('.form-submit').disabled=false;}
    };
    bindClose();query('#garden-goal-dialog').showModal();form.elements.name.focus();
  }

  function openTransfer(){
    dialogs.innerHTML=`<dialog id="garden-transfer-dialog" class="garden-dialog"><form id="garden-transfer-form"><div class="dialog-title"><h2>${translate('transfer')}</h2><button type="button" data-garden-close aria-label="${translate('close')}">×</button></div><p class="dialog-help">${translate('transferHelp')}</p><div class="form-grid"><label class="full-width"><span>${translate('from')}</span><select name="from">${goalOptions()}</select></label><label class="full-width"><span>${translate('to')}</span><select name="to">${goalOptions()}</select></label><label class="full-width"><span>${translate('amount')}</span><input name="amount" required inputmode="decimal" maxlength="24"></label></div><p class="field-error" id="garden-transfer-error" role="alert" hidden></p><button class="primary form-submit">${translate('move')}</button></form></dialog>`;
    query('#garden-transfer-form').elements.to.selectedIndex=1;
    query('#garden-transfer-form').onsubmit=async event=>{
      event.preventDefault();if(busy)return;const form=event.target;
      try{busy=true;form.querySelector('.form-submit').disabled=true;const fields=Object.fromEntries(new FormData(form)),amount=parseAmount(fields.amount),operationId=identifier(),at=now();
        state=await store.update(current=>transferGardenFunds(current,fields.from,fields.to,amount,operationId,at));query('#garden-transfer-dialog').close();render();announce('moved');
      }catch(error){query('#garden-transfer-error').textContent=translate(error.message==='invalidAmount'?'gardenInvalidTransfer':error.message);query('#garden-transfer-error').hidden=false;}
      finally{busy=false;form.querySelector('.form-submit').disabled=false;}
    };bindClose();query('#garden-transfer-dialog').showModal();
  }

  function download(name,content,type){
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function backup(){const current=await store.read();download('Morrow-Garden-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'morrow-garden',exportedAt:now(),state:current},null,2),'application/json');return current;}
  async function loadImport(file,kind){
    if(!file)return;
    try{
      if(file.size>(kind==='legacy'?2000000:8000000))throw new Error(kind==='legacy'?'gardenInvalidLegacy':'gardenInvalidBackup');
      const raw=await file.text();let preview,digest;
      if(kind==='legacy'){
        preview=legacyGardenPreview(raw);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));digest=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(state.receipts.some(receipt=>receipt.digest===digest)){announce('alreadyImported');return;}
      }else{let envelope;try{envelope=JSON.parse(raw);}catch{throw new Error('gardenInvalidBackup');}if(envelope.format!=='morrow-garden')throw new Error('gardenInvalidBackup');preview=validateGardenState(envelope.state);}
      pendingImport={kind,raw,preview,digest};backupAcknowledged=false;let backupSnapshot=null;
      dialogs.innerHTML=`<dialog id="garden-import-dialog" class="garden-dialog"><div class="dialog-title"><h2>${translate(kind==='legacy'?'importTitle':'restoreTitle')}</h2><button data-garden-close aria-label="${translate('close')}">×</button></div><p class="dialog-help">${translate(kind==='legacy'?'importHelp':'restoreHelp')}</p>${kind==='legacy'?`<dl class="garden-import-summary"><div><dt>${translate('sourceGoal')}</dt><dd>${escape(preview.name)}</dd></div><div><dt>${translate('sourceBalance')}</dt><dd>${format(preview.currentSaved)}</dd></div><div><dt>${translate('sourceAccounts')}</dt><dd>${preview.accountCount}</dd></div><div><dt>${translate('sourceTransactions')}</dt><dd>${preview.transactionCount}</dd></div></dl>`:`<p class="dialog-help">${preview.goals.length} · ${translate('myGardens')} · ${preview.ledger?.records.filter(r=>!r.deletedAt).length??0} · ${translate('sourceTransactions')}</p>`}<button id="garden-before-backup" class="garden-button">${translate('beforeImport')}</button><label class="garden-checkbox"><input id="garden-backup-confirmed" type="checkbox" disabled><span>${translate('confirmBackup')}</span></label><button id="garden-confirm-import" class="primary form-submit" disabled>${translate(kind==='legacy'?'confirmImport':'confirmRestore')}</button><p id="garden-import-error" class="field-error" role="alert" hidden></p></dialog>`;
      query('#garden-before-backup').onclick=async()=>{try{backupSnapshot=JSON.stringify(await backup());query('#garden-backup-confirmed').disabled=false;backupAcknowledged=true;}catch(error){announce(error.message);}};
      query('#garden-backup-confirmed').onchange=event=>query('#garden-confirm-import').disabled=!event.target.checked;
      query('#garden-confirm-import').onclick=async()=>{
        if(busy||!backupAcknowledged||!query('#garden-backup-confirmed').checked)return;busy=true;query('#garden-confirm-import').disabled=true;
        try{
          const operationId=identifier(),at=now(),goalId=identifier();
          state=await store.update(current=>{if(kind==='restore'){if(backupSnapshot!==JSON.stringify(current))throw new Error('gardenConflict');if(current.ledger?.records.length&&!preview.ledger)throw new Error('quickBackupMissingLedger');}return kind==='legacy'?applyLegacyGarden(current,raw,digest,operationId,at,goalId):preview;},{recovery:true});
          query('#garden-import-dialog').close();render();announce(kind==='legacy'?'imported':'saved');pendingImport=null;
        }catch(error){query('#garden-import-error').textContent=translate(error.message);query('#garden-import-error').hidden=false;query('#garden-confirm-import').disabled=false;}
        finally{busy=false;}
      };
      bindClose();query('#garden-import-dialog').showModal();
    }catch(error){announce(error.message);}
  }

  async function memoryCard(id){
    const goal=state.goals.find(item=>item.id===id);if(!goal?.bloomedAt)return;
    const theme=ERA_THEMES.find(item=>item.id===(goal.bloomedThemeId??goal.themeId));
    const content=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000"><rect width="1200" height="1000" fill="#f4f0ed"/><text x="90" y="105" fill="#68768c" font-family="sans-serif" font-size="20" letter-spacing="5">MORROW ERAS · A LITTLE VICTORY</text><svg x="60" y="150" width="1080" height="648">${renderGardenSvg(theme.id,4,{prefix:'keepsake',label:theme.name})}</svg><text x="90" y="870" fill="#343a46" font-family="sans-serif" font-size="42">${theme.name}</text><text x="90" y="920" fill="#68768c" font-family="sans-serif" font-size="23">${escape(translate('firstBloom'))} · ${dateText(goal.bloomedAt)}</text><text x="90" y="964" fill="#68768c" font-family="sans-serif" font-size="18">${escape(translate('memoryCaption'))}</text></svg>`;
    const url=URL.createObjectURL(new Blob([content],{type:'image/svg+xml'}));
    try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1000;canvas.getContext('2d').drawImage(image,0,0);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error();download('Morrow-Era-Memory.png',png,'image/png');}
    catch{announce('gardenExportFailed');}finally{URL.revokeObjectURL(url);}
  }
  function bindClose(){dialogs.querySelectorAll('[data-garden-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());}
  function actions(event){
    const view=event.target.closest('[data-era-view]');if(view){activeView=view.dataset.eraView;render();return;}
    const control=event.target.closest('[data-garden-action]');if(!control||control.disabled)return;
    const action=control.dataset.gardenAction;
    if(action==='new')openGoal();else if(action==='edit')openGoal(control.dataset.id);
    else if(action==='sample-theme'){selectedTheme=control.dataset.theme;render();}
    else if(action==='sample-stage'){sampleStage=Number(control.dataset.stage);render();}
    else if(action==='transfer')openTransfer();else if(action==='memory')memoryCard(control.dataset.id);
    else if(action==='backup')backup().then(()=>announce('backupDone')).catch(error=>announce(error.message));
    else if(action==='pick-legacy')query('#garden-legacy-file').click();else if(action==='pick-restore')query('#garden-restore-file').click();
    else if(action==='retry')load();
  }
  container.onclick=actions;dashboard.onclick=actions;
  async function load(){try{state=await store.update(current=>current);ready=true;storageError=null;}catch(error){storageError=error.message;ready=false;}render();}
  store.onchange(load);window.addEventListener('focus',load);window.addEventListener('morrow:language',render);
  render();load();
  return {render};
}
