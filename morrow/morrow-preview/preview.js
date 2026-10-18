import {parseAmount, isCalendarDate, monthWindow, summarize, upsertRecord} from './domain.js';
import {messages} from './messages.js';
import {mountEras} from './eras/ui.js';
import {mountMorrowCloud} from './cloud/ui.js';

const $ = selector => document.querySelector(selector);
let language = 'en', appearance = 'system', selectedMonth = '2026-10';
let editingId = null, deletingId = null, errorKey = null, toastTimer, sequence = 0;
const media = matchMedia('(prefers-color-scheme: dark)');
const locale = () => language === 'en' ? 'en-US' : 'zh-CN';
const t = key => messages[language][key] ?? key;
const money = (amount, digits = 2) => '¥' + (amount / 100).toLocaleString(locale(), {
  minimumFractionDigits: digits, maximumFractionDigits: digits
});
const esc = value => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));
const categories = ['housing', 'dining', 'shopping', 'transport', 'other', 'salaryCategory'];
const accountKeys = ['cash', 'wechat', 'alipay', 'bank'];
const colors = ['#7f8ca3', '#c1a3ab', '#a9b698', '#d3c9c2', '#dce0e7', '#b0a9ac'];
const accountData = [['savingsAccount',3600000], ['alipayPocket',1480000], ['wechat',742076], ['cash',20000]];
let transactions = [
  {id:'demo-1',label:'coffee',category:'dining',account:'wechat',amount:3200,type:'expense',date:'2026-10-17',icon:'food',note:''},
  {id:'demo-2',label:'groceries',category:'shopping',account:'alipay',amount:18650,type:'expense',date:'2026-10-17',icon:'bag',note:''},
  {id:'demo-3',label:'metro',category:'transport',account:'wechat',amount:600,type:'expense',date:'2026-10-16',icon:'train',note:''},
  {id:'demo-4',label:'salary',category:'salaryCategory',account:'bank',amount:1800000,type:'income',date:'2026-10-16',icon:'wallet',note:''},
  {id:'demo-5',label:'rental',category:'housing',account:'bank',amount:320000,type:'expense',date:'2026-10-16',icon:'home',note:''},
  {id:'demo-6',label:'coffee',category:'dining',account:'wechat',amount:2800,type:'expense',date:'2026-09-17',icon:'food',note:''},
  {id:'demo-7',label:'groceries',category:'shopping',account:'alipay',amount:15000,type:'expense',date:'2026-09-16',icon:'bag',note:''}
];

// The overview includes fictional earlier entries in addition to the recent rows.
// Subtract recent rows from the fixture once, then derive every edit from records.
// This avoids mutation-by-delta bugs when changing dates, types or categories.
const base = {};
for (const [month, income, expense] of [
  ['2026-04',1400000,870000], ['2026-05',1500000,820000],
  ['2026-06',1650000,690000], ['2026-07',1500000,950000],
  ['2026-08',1750000,780000], ['2026-09',1650000,712000],
  ['2026-10',1800000,628450]
]) {
  const amounts = month === '2026-10' ? [320000,125000,100000,40000,43450]
    : [42,24,16,10].map(percent => Math.floor(expense * percent / 100));
  if (amounts.length === 4) amounts.push(expense - amounts.reduce((sum,n) => sum+n,0));
  base[month] = {income,expense,categories:Object.fromEntries(categories.slice(0,5).map((key,i)=>[key,amounts[i]]))};
}
for (const record of transactions) {
  const snapshot = base[record.date.slice(0,7)];
  snapshot[record.type] -= record.amount;
  if(record.type === 'expense') snapshot.categories[record.category] -= record.amount;
}

const knownMonths = new Set(Object.keys(base));

function dateLabel(date) {
  return new Intl.DateTimeFormat(locale(), {month:'short',day:'numeric',timeZone:'UTC'})
    .format(new Date(date + 'T12:00:00Z'));
}
function monthLabel(month) {
  return new Intl.DateTimeFormat(locale(), {year:'numeric',month:'long',timeZone:'UTC'})
    .format(new Date(month + '-15T12:00:00Z'));
}
function nameOf(record) { return record.customName ?? t(record.label); }

function applyTheme() {
  const effective = appearance === 'system' ? (media.matches ? 'dark' : 'light') : appearance;
  document.documentElement.dataset.theme = effective;
  $('#theme').setAttribute('aria-label',t('appearance') + ': ' + t(effective));
  $('meta[name="theme-color"]').content = effective === 'dark' ? '#20232b' : '#f5f5f7';
}
media.addEventListener('change',applyTheme);

function renderLedger() {
  const search = $('#search').value.trim().toLocaleLowerCase(locale());
  const type = $('#transaction-filter').value, category = $('#category-filter').value;
  const rows = transactions.filter(record => {
    const searchable = [nameOf(record),record.note,t(record.category),t(record.account)].join(' ').toLocaleLowerCase(locale());
    return record.date.startsWith(selectedMonth) && (type === 'all' || record.type === type) &&
      (category === 'all' || record.category === category) && (!search || searchable.includes(search));
  }).sort((a,b) => b.date.localeCompare(a.date));
  $('#transaction-rows').innerHTML = rows.map(record => `
    <tr><td><div class="transaction-name"><span class="transaction-icon"><svg aria-hidden="true"><use href="#${record.icon}"/></svg></span>
    <div><b>${esc(nameOf(record))}</b><small>${dateLabel(record.date)}${record.note ? ' · ' + esc(record.note) : ''}</small></div></div></td>
    <td><span class="category-pill">${esc(t(record.category))}</span></td><td class="account-text">${t(record.account)}</td>
    <td class="transaction-amount ${record.type}">${record.type === 'income' ? '+' : '−'}${money(record.amount)}</td>
    <td class="row-actions"><button class="edit-entry" data-edit="${record.id}" aria-label="${esc(t('editTransaction') + ': ' + nameOf(record))}"><svg aria-hidden="true"><use href="#edit"/></svg></button></td></tr>`).join('');
  $('#empty-state').hidden = rows.length !== 0;
  $('#empty-state').textContent = t('noTransactions') + ' ' + t('clearSearch');
  $('#result-count').textContent = t('results').replace('{count}',String(rows.length));
  $('#clear-filters').hidden = !(search || type !== 'all' || category !== 'all');
}

function render() {
  const filter = $('#category-filter').value || 'all';
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.title = language === 'en' ? 'Morrow — Interface preview' : 'Morrow 马马记账 — 界面预览';
  document.querySelectorAll('[data-i]').forEach(element => element.textContent = t(element.dataset.i));
  document.querySelectorAll('[data-placeholder]').forEach(element => element.placeholder = t(element.dataset.placeholder));
  $('#language').textContent = language === 'en' ? '中文' : 'EN';
  $('#language-setting').value = language; $('#appearance').value = appearance;
  knownMonths.add(selectedMonth);
  transactions.forEach(record=>knownMonths.add(record.date.slice(0,7)));
  const available = [...knownMonths].sort().reverse();
  $('#month').innerHTML = available.map(month=>`<option value="${month}">${monthLabel(month)}</option>`).join('');
  $('#month').value = selectedMonth;
  ['allTransactions','onlyExpenses','onlyIncome'].forEach((key,i) => $('#transaction-filter').options[i].textContent = t(key));
  $('#category-filter').innerHTML = `<option value="all">${t('allCategories')}</option>` + categories.map(key=>`<option value="${key}">${t(key)}</option>`).join('');
  $('#category-filter').value = filter;
  $('#month').setAttribute('aria-label',t('monthLabel')); $('#search').setAttribute('aria-label',t('searchLabel'));
  $('#category-filter').setAttribute('aria-label',t('category')); $('#transaction-filter').setAttribute('aria-label',t('type'));
  $('#mobile-add').setAttribute('aria-label',t('addTransaction')); $('#language').setAttribute('aria-label',t('language'));
  document.querySelectorAll('[data-close]').forEach(button=>button.setAttribute('aria-label',t('close')));
  document.querySelectorAll('[data-dialog="accounts"]').forEach(button=>button.setAttribute('aria-label',t('accountSummary')));
  $('#entry-form h2').textContent = t(editingId ? 'editTransaction' : 'addTransaction');
  $('.form-submit span').textContent = t(editingId ? 'updatePreview' : 'addToPreview');
  if(errorKey) $('#entry-error').textContent = t(errorKey);
  renderDeletePreview();

  const data = summarize(base,transactions,selectedMonth);
  $('#balance-value').textContent = money(accountData.reduce((sum,account)=>sum+account[1],0));
  $('#income-value').textContent = money(data.income); $('#expense-value').textContent = money(data.expense);
  $('#remaining-value').textContent = money(900000-data.expense);
  $('#remaining-value').classList.toggle('over-budget',data.expense>900000);
  $('#expense-note').textContent = (data.expense/900000*100).toFixed(1)+'%';
  $('.budget-line span').style.width = Math.min(100,data.expense/900000*100)+'%';
  $('.budget-line').setAttribute('role','meter'); $('.budget-line').setAttribute('aria-label',t('monthBudget'));
  $('.budget-line').setAttribute('aria-valuemin','0'); $('.budget-line').setAttribute('aria-valuemax','9000');
  $('.budget-line').setAttribute('aria-valuenow',String(Math.min(data.expense,900000)/100));
  $('.budget-line').setAttribute('aria-valuetext',money(data.expense)+' / '+money(900000));
  $('#donut-value').textContent = money(data.expense,0);
  $('.chart-insight p').textContent = t(data.expense>900000?'overBudget':'insight');

  const history = monthWindow(selectedMonth).map(month=>({month,...summarize(base,transactions,month)}));
  const ceiling = Math.max(20000,...history.flatMap(month=>[month.income/100,month.expense/100]));
  document.querySelectorAll('.axis-labels span').forEach((element,i)=>element.textContent = i===4?'0':Math.round(ceiling*(4-i)/4/1000)+'k');
  $('#bars').innerHTML = history.map(month=>`<div class="bar-group"><i style="height:${month.income/100/ceiling*100}%" title="${t('income')}: ${money(month.income)}"></i><i style="height:${month.expense/100/ceiling*100}%" title="${t('expenses')}: ${money(month.expense)}"></i><span>${new Intl.DateTimeFormat(locale(),{month:'short',timeZone:'UTC'}).format(new Date(month.month+'-15T12:00:00Z'))}</span></div>`).join('');
  $('#bar-chart').setAttribute('aria-label',t('chartSummary')+' '+history.map(month=>monthLabel(month.month)+': '+t('income')+' '+money(month.income)+', '+t('expenses')+' '+money(month.expense)).join('; '));

  const breakdown = [...data.categories.entries()].filter(([,amount])=>amount>0).sort((a,b)=>b[1]-a[1]);
  let cursor = 0;
  const stops = breakdown.map(([,amount],index)=>{const from=cursor;cursor+=amount/data.expense*100;return `${colors[index%colors.length]} ${from}% ${cursor}%`;});
  $('.donut').style.background = data.expense ? `conic-gradient(${stops.join(',')})` : 'var(--blue-soft)';
  $('#category-list').innerHTML = breakdown.map(([key,amount],index)=>`<div class="category-row"><i class="category-dot" style="background:${colors[index%colors.length]}"></i><span class="category-name">${t(key)}</span><span class="category-value">${money(amount,0)}</span><small>${Math.round(amount/data.expense*100)}%</small></div>`).join('') || `<p class="dialog-help">${t('noSpending')}</p>`;
  $('#account-list').innerHTML = accountData.map(([name,amount])=>`<div class="account-row"><svg aria-hidden="true"><use href="#wallet"/></svg><div><b>${t(name)}</b><small>${t('manualBalance')}</small></div><strong>${money(amount)}</strong></div>`).join('');
  $('#accounts-dialog .dialog-help').textContent = t('manualAccounts')+' '+t('manualBalanceHint');
  renderLedger(); applyTheme();
  window.dispatchEvent(new Event('morrow:language'));
}

function setError(key,field) {
  errorKey = key; $('#entry-error').textContent = t(key); $('#entry-error').hidden = false;
  $('#entry-form').elements[field]?.setAttribute('aria-invalid','true');
  $('#entry-form').elements[field]?.setAttribute('aria-describedby','entry-error');
  $('#entry-form').elements[field]?.focus();
}
function clearError() {
  errorKey = null; $('#entry-error').hidden = true;
  $('#entry-form').querySelectorAll('[aria-invalid]').forEach(field=>{field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');});
}
function openEntry(id=null) {
  const form = $('#entry-form'); form.reset(); clearError(); editingId = id;
  const record = transactions.find(record=>record.id===id);
  if(record) {
    form.elements.type.value=record.type; form.elements.amount.value=(record.amount/100).toFixed(2);
    form.elements.name.value=nameOf(record); form.elements.category.value=record.category;
    form.elements.date.value=record.date; form.elements.account.value=record.account; form.elements.note.value=record.note;
  } else {
    const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    form.elements.date.value=today.startsWith(selectedMonth)?today:selectedMonth+'-01';
  }
  render(); $('#entry-dialog').showModal(); form.elements.amount.focus();
}
function renderDeletePreview() {
  const record=transactions.find(record=>record.id===deletingId);
  $('#delete-preview').textContent=record?nameOf(record)+' · '+dateLabel(record.date)+' · '+money(record.amount):'';
}
function requestDelete(id) {
  deletingId=id;renderDeletePreview();$('#delete-dialog').showModal();
  $('#delete-dialog [data-close]').focus();
}
function toast(key) {
  $('#toast').textContent=t(key);$('#toast').hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);
}

$('#entry-form').onsubmit = event => {
  event.preventDefault(); clearError(); const fields=Object.fromEntries(new FormData(event.target));
  let amount;
  try {amount=parseAmount(fields.amount);} catch {setError('invalidAmount','amount');return;}
  if(!fields.name.trim()) {setError('invalidName','name');return;}
  if(fields.name.trim().length>60) {setError('nameTooLong','name');return;}
  if(!isCalendarDate(fields.date)) {setError('invalidDate','date');return;}
  if(!accountKeys.includes(fields.account)) {setError('invalidAccount','account');return;}
  if(!categories.includes(fields.category)) {setError('invalidCategory','category');return;}
  if(!['income','expense'].includes(fields.type)) {setError('invalidType','type');return;}
  if(fields.note.length>160) {setError('noteTooLong','note');return;}
  const prior=transactions.find(record=>record.id===editingId);
  const next={id:editingId??'preview-'+(++sequence),customName:fields.name.trim(),category:fields.category,
    account:fields.account,amount,type:fields.type,date:fields.date,icon:prior?.icon??'wallet',note:fields.note.trim()};
  // Keep translated sample names translated unless the user actually renames one.
  if(prior?.label && fields.name.trim()===nameOf(prior)) {delete next.customName;next.label=prior.label;}
  let updated;
  try {
    updated=upsertRecord(transactions,next);
    for(const month of new Set([next.date.slice(0,7),prior?.date.slice(0,7)].filter(Boolean))) summarize(base,updated,month);
  } catch(error) {setError(error.message,'amount');return;}
  const edited=Boolean(editingId);transactions=updated;selectedMonth=next.date.slice(0,7);
  $('#transaction-filter').value='all';$('#category-filter').value='all';$('#search').value='';
  $('#entry-dialog').close();render();toast(edited?'updated':'saved');
};

// Add delete as an explicit secondary action in the edit form, with a safe confirmation.
const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.className='delete-from-form';
deleteButton.dataset.i='deleteTransaction';$('#entry-form').append(deleteButton);
deleteButton.onclick=()=>{if(editingId){$('#entry-dialog').close();requestDelete(editingId);}};
$('#entry-dialog').addEventListener('close',()=>clearError());
$('#delete-dialog').addEventListener('close',()=>{
  // Cancelling deletion returns to the same draft, including unsaved edits.
  if(deletingId){deletingId=null;$('#entry-dialog').showModal();}
});
function showEntry(id=null){openEntry(id);deleteButton.hidden=!id;}
$('#confirm-delete').onclick=()=>{
  if(!deletingId)return;
  transactions=transactions.filter(record=>record.id!==deletingId);deletingId=null;
  $('#delete-dialog').close();render();toast('removed');$('#search').focus({preventScroll:true});
};
$('#transaction-rows').onclick=event=>{const button=event.target.closest('[data-edit]');if(button)showEntry(button.dataset.edit);};
$('#language').onclick=()=>{language=language==='en'?'zh':'en';render();};
$('#language-setting').onchange=event=>{language=event.target.value;render();};
$('#appearance').onchange=event=>{appearance=event.target.value;applyTheme();};
$('#theme').onclick=()=>$('#settings-dialog').showModal();
document.querySelectorAll('[data-dialog]').forEach(button=>button.onclick=()=>$('#'+button.dataset.dialog+'-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('#add').onclick=()=>showEntry();$('#mobile-add').onclick=()=>showEntry();
$('#month').onchange=event=>{selectedMonth=event.target.value;render();};
$('#transaction-filter').onchange=renderLedger;$('#category-filter').onchange=renderLedger;$('#search').oninput=renderLedger;
$('#clear-filters').onclick=()=>{$('#transaction-filter').value='all';$('#category-filter').value='all';$('#search').value='';renderLedger();$('#search').focus();};
document.addEventListener('keydown',event=>{
  const typing=event.target.closest('input,textarea,select');
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    if(document.querySelector('dialog[open]'))return;event.preventDefault();showEntry();
  } else if(event.key==='/'&&!typing&&!document.querySelector('dialog[open]')){
    event.preventDefault();$('#search').scrollIntoView({block:'center'});$('#search').focus();
  }
});
function activeSection(id) {
  document.querySelectorAll('.navigation a,.tabbar a').forEach(link=>{
    const active=link.getAttribute('href')==='#'+id;link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  });
}
document.querySelectorAll('.navigation a,.tabbar a,.brand').forEach(link=>link.addEventListener('click',()=>activeSection(link.hash.slice(1))));
let scrollFrame;
window.addEventListener('scroll',()=>{
  if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{
    scrollFrame=null;let current='dashboard-section';
    for(const id of ['transactions-section','goals-section','eras-section']) if($('#'+id).getBoundingClientRect().top<window.innerHeight*.45)current=id;
    activeSection(current);
  });
},{passive:true});
const cloudApp = mountMorrowCloud({getLanguage:()=>language});
const erasApp = mountEras({getLanguage:()=>language,store:cloudApp.store});
activeSection('dashboard-section');render();
