import {isCalendarDate} from '../domain.js';

export const QUICK_KINDS=['expense','income','refund','transfer'];
export const QUICK_CATEGORIES=['other','dining','shopping','transport','housing','entertainment','health','salary'];
export const QUICK_ACCOUNTS=['wechat','alipay','bank','cash','other'];
export const QUICK_CURRENCIES=['CNY','USD','EUR','GBP'];
export function quickLocalDate(value=new Date()) {
  const d=value instanceof Date?value:new Date(value);
  return String(d.getFullYear()).padStart(4,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
export function emptyQuickLedger(){return {version:1,records:[],preferences:{currency:'CNY',byKind:{}}};}
export function quickDefaults(ledger,kind='expense') {
  return {kind,category:kind==='income'?'salary':'other',account:kind==='income'?'bank':'wechat',toAccount:'alipay',currency:ledger?.preferences.currency??'CNY',...ledger?.preferences.byKind[kind]};
}
export function validateQuickRecord(record) {
  if(!record||typeof record.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(record.id)||!QUICK_KINDS.includes(record.kind))throw new Error('quickInvalidRecord');
  if(!Number.isSafeInteger(record.amount)||record.amount<=0)throw new Error('invalidAmount');
  if(!QUICK_CURRENCIES.includes(record.currency)||!QUICK_CATEGORIES.includes(record.category)||!QUICK_ACCOUNTS.includes(record.account))throw new Error('quickInvalidRecord');
  if(record.kind==='transfer'&&(!QUICK_ACCOUNTS.includes(record.toAccount)||record.toAccount===record.account))throw new Error('quickInvalidTransfer');
  if(record.kind!=='transfer'&&record.toAccount!==null)throw new Error('quickInvalidRecord');
  if(!isCalendarDate(record.date))throw new Error('invalidDate');
  if(typeof record.note!=='string'||record.note.length>160||!Number.isSafeInteger(record.revision)||record.revision<1)throw new Error('quickInvalidRecord');
  for(const key of ['createdAt','updatedAt'])if(typeof record[key]!=='string'||!Number.isFinite(Date.parse(record[key])))throw new Error('quickInvalidRecord');
  if(record.deletedAt!==null&&(typeof record.deletedAt!=='string'||!Number.isFinite(Date.parse(record.deletedAt))))throw new Error('quickInvalidRecord');
  return record;
}
export function validateQuickLedger(ledger) {
  if(!ledger||ledger.version!==1||!Array.isArray(ledger.records)||!ledger.preferences||!QUICK_CURRENCIES.includes(ledger.preferences.currency)||!ledger.preferences.byKind||typeof ledger.preferences.byKind!=='object'||Array.isArray(ledger.preferences.byKind))throw new Error('quickInvalidRecord');
  const ids=new Set();
  for(const record of ledger.records){validateQuickRecord(record);if(ids.has(record.id))throw new Error('quickInvalidRecord');ids.add(record.id);}
  for(const [kind,pref] of Object.entries(ledger.preferences.byKind)){
    if(!QUICK_KINDS.includes(kind)||!pref||!QUICK_CATEGORIES.includes(pref.category)||!QUICK_ACCOUNTS.includes(pref.account)||!QUICK_ACCOUNTS.includes(pref.toAccount))throw new Error('quickInvalidRecord');
  }
  return ledger;
}
export function saveQuickRecord(state,candidate,operationId,at,expectedRevision=0) {
  if(state.operations.some(op=>op.id===operationId))return state;
  validateQuickRecord(candidate);
  const ledger=state.ledger??emptyQuickLedger(),prior=ledger.records.find(r=>r.id===candidate.id);
  if(prior?.deletedAt||(prior?.revision??0)!==expectedRevision)throw new Error('quickConflict');
  const record={...candidate,createdAt:prior?.createdAt??at,updatedAt:at,revision:(prior?.revision??0)+1,deletedAt:null};
  const preferences={currency:record.currency,byKind:{...ledger.preferences.byKind,[record.kind]:{category:record.category,account:record.account,toAccount:record.toAccount??'alipay'}}};
  return {...state,ledger:{...ledger,preferences,records:prior?ledger.records.map(r=>r.id===record.id?record:r):[...ledger.records,record]},
    operations:[...state.operations,{id:operationId,kind:prior?'ledger.update':'ledger.create',at,recordId:record.id}]};
}
export function deleteQuickRecord(state,id,operationId,at,expectedRevision) {
  if(state.operations.some(op=>op.id===operationId))return state;
  const prior=state.ledger?.records.find(r=>r.id===id);
  if(!prior||prior.deletedAt||prior.revision!==expectedRevision)throw new Error('quickConflict');
  return {...state,ledger:{...state.ledger,records:state.ledger.records.map(r=>r.id===id?{...r,deletedAt:at,updatedAt:at,revision:r.revision+1}:r)},operations:[...state.operations,{id:operationId,kind:'ledger.delete',at,recordId:id}]};
}
function quickSum(values){const amount=values.reduce((sum,n)=>sum+BigInt(n),0n);if(amount>BigInt(Number.MAX_SAFE_INTEGER)||amount<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('totalOverflow');return Number(amount);}
export function quickMonthSummary(records,month,currency) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!QUICK_CURRENCIES.includes(currency))throw new Error('invalidDate');
  const selected=records.filter(r=>!r.deletedAt&&r.date.startsWith(month)&&r.currency===currency);
  const income=quickSum(selected.filter(r=>r.kind==='income').map(r=>r.amount));
  const gross=quickSum(selected.filter(r=>r.kind==='expense').map(r=>r.amount));
  const refunds=quickSum(selected.filter(r=>r.kind==='refund').map(r=>r.amount));
  const spending=quickSum([gross,-refunds]);
  return {income,gross,refunds,spending,net:quickSum([income,-spending]),count:selected.length};
}
export function quickAmountText(amount){const n=BigInt(amount);return (n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');}
export function quickMoney(amount,currency,locale) {
  const n=BigInt(amount),absolute=n<0n?-n:n;
  const units=n<0n&&absolute<100n?-0:n/100n;
  return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(units).map(part=>part.type==='fraction'?(absolute%100n).toString().padStart(2,'0'):part.value).join('');
}
export function quickCsv(records) {
  const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const rows=[['id','type','amount','currency','date','category','account','to_account','note'],...records.filter(r=>!r.deletedAt).map(r=>[r.id,r.kind,(BigInt(r.amount)/100n).toString()+'.'+(BigInt(r.amount)%100n).toString().padStart(2,'0'),r.currency,r.date,r.category,r.account,r.toAccount,r.note])];
  return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
