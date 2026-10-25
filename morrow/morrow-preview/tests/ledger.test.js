import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {emptyGardenState,validateGardenState} from '../eras/domain.js';
import {reconcileAchievements,annualGardenSummary,monthlyActualSummary} from '../eras/experience-domain.js';
import {saveQuickRecord,deleteQuickRecord,quickDefaults,quickMonthSummary,quickAmountText,quickMoney,quickCsv} from '../ledger/domain.js';
const at='2026-10-25T12:00:00Z';
function record(id='entry',values={}){return {id,kind:'expense',amount:2580,currency:'CNY',category:'dining',account:'wechat',toAccount:null,date:'2026-10-25',note:'',createdAt:at,updatedAt:at,revision:1,deletedAt:null,...values};}
function add(state,r,id=r.id){return saveQuickRecord(state,r,'op-'+id,at,0);}
test('ledger extension preserves old snapshot shape and never changes manual savings goals',()=>{
  const old=emptyGardenState();assert(!Object.hasOwn(validateGardenState(old),'ledger'));
  const next=add(old,record());assert.deepEqual(next.goals,old.goals);assert.deepEqual(next.receipts,old.receipts);
  assert.deepEqual(saveQuickRecord(next,record(),'op-entry',at,0),next);
  assert.equal(quickDefaults(next.ledger).category,'dining');assert.equal(quickDefaults(next.ledger).account,'wechat');
  assert.equal(validateGardenState(JSON.parse(JSON.stringify(next))).ledger.records[0].amount,2580);
});
test('editing dates/types reconciles months; stale edits and deleted-entry resurrection fail closed',()=>{
  let state=add(emptyGardenState(),record());
  state=saveQuickRecord(state,record('entry',{kind:'income',date:'2026-09-30',amount:4000}),'edit',at,1);
  assert.equal(quickMonthSummary(state.ledger.records,'2026-10','CNY').count,0);
  assert.equal(quickMonthSummary(state.ledger.records,'2026-09','CNY').income,4000);
  assert.throws(()=>saveQuickRecord(state,record(),'stale',at,1),/quickConflict/);
  state=deleteQuickRecord(state,'entry','delete',at,2);
  assert.equal(state.ledger.records[0].deletedAt,at);assert.equal(quickMonthSummary(state.ledger.records,'2026-09','CNY').income,0);
  assert.deepEqual(deleteQuickRecord(state,'entry','delete',at,2),state);
  assert.throws(()=>saveQuickRecord(state,record(),'resurrect',at,3),/quickConflict/);
});
test('refunds offset spending on their own dates and transfers never create income/expenses',()=>{
  let state=add(emptyGardenState(),record());state=add(state,record('refund',{kind:'refund',amount:580}));
  state=add(state,record('income',{kind:'income',amount:10000}));state=add(state,record('move',{kind:'transfer',toAccount:'alipay',amount:900000}));
  assert.deepEqual(quickMonthSummary(state.ledger.records,'2026-10','CNY'),{income:10000,gross:2580,refunds:580,spending:2000,net:8000,count:4});
  const annual=annualGardenSummary(state,2026,'CNY',at);assert.equal(annual.income,10000);assert.equal(annual.spending,2000);assert.equal(annual.netCashFlow,8000);
  const nextMonth=add(state,record('laterRefund',{kind:'refund',amount:3000,date:'2026-11-01'}));
  assert.equal(quickMonthSummary(nextMonth.ledger.records,'2026-11','CNY').spending,-3000);
});
test('currencies do not mix in actual monthly or Wrapped summaries',()=>{
  let state=add(emptyGardenState(),record());state=add(state,record('usd',{kind:'income',currency:'USD',amount:500}));
  assert.equal(quickMonthSummary(state.ledger.records,'2026-10','CNY').income,0);
  assert.equal(monthlyActualSummary(state,'2026-10',at,'USD').income,500);
  assert.equal(monthlyActualSummary(state,'2026-10',at).spending,2580);
  assert.equal(annualGardenSummary(state,2026,'USD',at).income,500);
  assert.equal(annualGardenSummary(state,2026,'GBP',at).income,null);
});
test('actual ledger activity unlocks tracking once; deleting recomputes current data and keeps historical memories',()=>{
  let state=reconcileAchievements(add(emptyGardenState(),record()),at);
  assert.equal(state.achievements.filter(a=>a.code==='transaction-1').length,1);
  state=reconcileAchievements(deleteQuickRecord(state,'entry','delete',at,1),at);
  assert.equal(state.achievements.filter(a=>a.code==='transaction-1').length,1);
  assert.equal(annualGardenSummary(state,2026,'CNY',at).recordCount,0);
});
test('unsafe/invalid money, dates, duplicate IDs and same-account transfers reject without mutation',()=>{
  const empty=emptyGardenState();
  for(const values of [{amount:0},{amount:-1},{amount:1.1},{amount:Number.MAX_SAFE_INTEGER+1},{date:'2026-02-30'},{kind:'transfer',toAccount:'wechat'}])assert.throws(()=>add(empty,record('bad',values)));
  const state=add(empty,record());const duplicate=structuredClone(state);duplicate.ledger.records.push({...duplicate.ledger.records[0]});assert.throws(()=>validateGardenState(duplicate),/quickInvalidRecord/);
  let large=add(empty,record('max',{amount:Number.MAX_SAFE_INTEGER}));large=add(large,record('more',{amount:1}));assert.throws(()=>quickMonthSummary(large.ledger.records,'2026-10','CNY'),/totalOverflow/);
});
test('editing/export retains every minor unit at safe integer limits and CSV neutralizes formula notes',()=>{
  assert.equal(quickAmountText(Number.MAX_SAFE_INTEGER),'90071992547409.91');
  assert(quickMoney(Number.MAX_SAFE_INTEGER,'CNY','en-US').endsWith('409.91'));assert(quickMoney(-1,'CNY','en-US').includes('-'));assert(quickMoney(-1,'CNY','en-US').endsWith('0.01'));
  const csv=quickCsv([record('max',{amount:Number.MAX_SAFE_INTEGER,note:'=1+1'}),record('deleted',{deletedAt:at})]);
  assert(csv.includes('90071992547409.91'));assert(csv.includes("'=1+1"));assert(!csv.includes('"deleted"'));
});
test('default transaction dates follow device calendar across UTC midnight',()=>{
  const moduleURL=new URL('../ledger/domain.js',import.meta.url).href;
  const code=`import {quickLocalDate} from ${JSON.stringify(moduleURL)};process.stdout.write(quickLocalDate('2026-10-25T17:30:00Z'));`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:'Asia/Shanghai'}}).toString(),'2026-10-26');
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:'America/Los_Angeles'}}).toString(),'2026-10-25');
});
