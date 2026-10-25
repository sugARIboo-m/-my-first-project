import {createMorrowCloudClient} from './client.js';
import {createGardenStore} from '../eras/store.js';
import {createErasSync} from './sync.js';
import {CLOUD_MESSAGES} from './messages.js';

export function mountMorrowCloud({getLanguage}) {
  const client=createMorrowCloudClient(),session=client.getSession();
  // Login/logout reloads before changing namespaces. No guest/account auto-merge.
  const store=createGardenStore({name:client.getDatabaseName()});
  const t=key=>CLOUD_MESSAGES[getLanguage()][key]??CLOUD_MESSAGES[getLanguage()].cloudRequestFailed;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const host=document.createElement('section');host.id='morrow-cloud';host.className='morrow-cloud panel';
  document.querySelector('.dashboard-grid').before(host);
  const modal=document.createElement('dialog');modal.className='garden-dialog';modal.id='cloud-auth-dialog';document.body.append(modal);
  let status=session?'cloudDisabled':'local',enabled=false,busy=false,sync,conflict=false,copies=null,notice=null,consentApproved=false,backupsConfirmed=false;
  const settings=document.createElement('a');settings.className='garden-button';settings.href='#morrow-cloud';
  document.querySelector('#settings-dialog .settings-info').before(settings);
  settings.onclick=()=>document.querySelector('#settings-dialog').close();
  function render(){
    settings.textContent=t('subtitle');
    host.innerHTML=`<div class="cloud-heading"><div><span class="garden-eyebrow">${t('subtitle')}</span><h2>${t('title')}</h2></div><p class="cloud-status" role="status">${esc(t(status))}</p></div><p class="cloud-help">${t('scope')}</p><p class="cloud-help">${t('guestNote')}</p>
      ${session?`<p class="cloud-help">${t('account')} · ${esc(session.user.email??'')}</p>${!enabled?`<label class="garden-checkbox"><input id="cloud-consent" type="checkbox" ${consentApproved?'checked':''}><span>${t('consent')}</span></label>`:''}<div class="cloud-actions"><button class="garden-button" data-cloud="${enabled?'pause':'enable'}">${t(enabled?'pause':'enable')}</button><button class="garden-button" data-cloud="retry" ${!enabled?'disabled':''}>${t('retry')}</button><button class="garden-button" data-cloud="logout">${t('logout')}</button></div>`:`<div class="cloud-actions"><button class="garden-button" data-cloud="login">${t('login')}</button><button class="garden-button" data-cloud="signup">${t('signup')}</button></div>`}
      ${conflict?`<div class="cloud-conflict"><p>${t('conflictHelp')}</p><button class="garden-button" data-cloud="copies">${t('copies')}</button><label class="garden-checkbox"><input type="checkbox" id="cloud-backups" ${backupsConfirmed?'checked':''} ${copies?'':'disabled'}><span>${t('backups')}</span></label><div class="cloud-actions"><button class="garden-button" data-cloud="local" ${copies?'':'disabled'}>${t('useLocal')}</button><button class="garden-button" data-cloud="remote" ${copies?'':'disabled'}>${t('useRemote')}</button></div></div>`:''}
      <p class="cloud-help">${t('privacy')}</p><a class="cloud-setup" href="https://github.com/sugARIboo-m/-my-first-project/blob/morrow/eras-delivery-20261018/morrow/SUPABASE_SETUP.md" target="_blank" rel="noopener">${t('setup')} ↗</a>${notice?`<p class="field-error" role="alert">${esc(t(notice))}</p>`:''}`;
  }
  host.onchange=event=>{if(event.target.id==='cloud-consent')consentApproved=event.target.checked;if(event.target.id==='cloud-backups')backupsConfirmed=event.target.checked;};
  function showAuth(kind){
    modal.innerHTML=`<form id="cloud-auth-form"><div class="dialog-title"><h2>${t(kind)}</h2><button type="button" data-cloud-close aria-label="${t('close')}">×</button></div><p class="dialog-help">${t('passwordHelp')}</p><div class="form-grid"><label class="full-width"><span>${t('email')}</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label><label class="full-width"><span>${t('password')}</span><input name="password" type="password" autocomplete="${kind==='login'?'current-password':'new-password'}" required ${kind==='signup'?'minlength="8"':''} maxlength="256"></label></div><p class="field-error" id="cloud-auth-error" role="alert" hidden></p><button class="primary form-submit">${t('submit')}</button></form>`;
    modal.querySelector('[data-cloud-close]').onclick=()=>modal.close();
    modal.querySelector('form').onsubmit=async event=>{
      event.preventDefault();if(busy)return;const form=event.target,submit=form.querySelector('.form-submit');busy=true;submit.disabled=true;
      try{
        const fields=Object.fromEntries(new FormData(form));
        if(kind==='login')await client.signIn(fields.email.trim(),fields.password);
        else await client.signUp(fields.email.trim(),fields.password);
        form.reset();
        if(client.getSession()){sync?.stop();location.reload();}
        else{modal.close();notice='checkEmail';render();}
      }catch(error){const p=form.querySelector('#cloud-auth-error');p.textContent=t(error.message);p.hidden=false;}
      finally{busy=false;submit.disabled=false;}
    };modal.showModal();modal.querySelector('[name=email]').focus();
  }
  function download(name,state){const url=URL.createObjectURL(new Blob([JSON.stringify({format:'morrow-garden',exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  host.onclick=async event=>{
    const control=event.target.closest('[data-cloud]');if(!control||control.disabled||busy)return;
    const action=control.dataset.cloud;notice=null;
    if(action==='login'||action==='signup'){showAuth(action);return;}
    if(action==='enable'&&!host.querySelector('#cloud-consent')?.checked){notice='consent';render();return;}
    if((action==='local'||action==='remote')&&(!copies||!host.querySelector('#cloud-backups')?.checked)){notice='backupFirst';render();return;}
    busy=true;control.disabled=true;
    try{
      if(action==='enable'){enabled=true;await sync.enable();}
      if(action==='pause'){enabled=false;await sync.disable();}
      if(action==='retry')sync.start();
      if(action==='logout'&&confirm(t('signoutHelp'))){sync?.stop();await client.signOut();location.reload();return;}
      if(action==='copies'){copies=await sync.conflictCopies();backupsConfirmed=false;download('Morrow-Conflict-Device.json',copies.local);download('Morrow-Conflict-Cloud.json',copies.remote);}
      if(action==='local'||action==='remote'){await sync.resolve(action,copies.generation);copies=null;conflict=false;}
    }catch(error){notice=error.message;if(error.message==='cloudLocalChanged')copies=null;}
    finally{busy=false;render();}
  };
  if(session){
    sync=createErasSync({store,client,onStatus:info=>{status=info.status;enabled=info.enabled;conflict=!!info.conflict;render();}});
    store.readCloud().then(local=>{enabled=local.meta.enabled;render();sync.start();}).catch(()=>{notice='cloudRequestFailed';render();});
  }
  // A different account in another tab must never use this tab's old namespace.
  window.addEventListener('storage',event=>{if(event.key===client.sessionKey){try{const next=JSON.parse(event.newValue);if(next?.user?.id!==session?.user?.id){sync?.stop();location.reload();}}catch{sync?.stop();location.reload();}}});
  window.addEventListener('morrow:language',()=>{if(modal.open)modal.close();render();});
  render();return {store};
}
