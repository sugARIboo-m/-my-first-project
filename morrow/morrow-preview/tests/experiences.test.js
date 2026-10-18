import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyGardenState,saveGardenGoal,validateGardenState} from '../eras/domain.js';
import {ACHIEVEMENT_DEFINITIONS,achievementConditions,reconcileAchievements,annualGardenSummary} from '../eras/experience-domain.js';
const at='2026-10-18T10:00:00.000Z';
function goal(saved=0){return {id:'actual',name:'Actual goal',targetAmount:100000,currentSaved:saved,currency:'CNY',themeId:'charm',targetDate:null,paused:false,fundingMode:'manual',createdAt:at,updatedAt:at,revision:1,bloomedAt:null,bloomedThemeId:null};}
function ledgerState(records){return {...emptyGardenState(),receipts:[{digest:'source',at,raw:JSON.stringify({accounts:[],transactions:records,goal:{name:'Old goal',amount:10000}})}]};}
const record=(id,type,amount,date,category='Food')=>({id,type,amount,date,category,account:'Cash',note:''});
test('all 17 definitions are unique and empty actual data earns nothing',()=>{
  assert.equal(ACHIEVEMENT_DEFINITIONS.length,17);assert.equal(new Set(ACHIEVEMENT_DEFINITIONS.map(item=>item.code)).size,17);
  assert.equal(reconcileAchievements(emptyGardenState(),at).achievements.length,0);
  assert.equal(annualGardenSummary(emptyGardenState(),2026,'CNY',at).hasAnyData,false);
});
test('actual saved goals unlock once and historical memories survive lower balances',()=>{
  let state=reconcileAchievements(saveGardenGoal(emptyGardenState(),goal(100000),'create',at,0),at);
  assert(state.achievements.some(item=>item.code==='bloom-1'));
  const first=state.achievements.find(item=>item.code==='save-1');
  assert.deepEqual(reconcileAchievements(state,'2026-10-19T10:00:00Z').achievements,state.achievements);
  state=reconcileAchievements(saveGardenGoal(state,{...state.goals[0],currentSaved:0},'lower',at,1),at);
  assert.equal(achievementConditions(state,at)['save-1'].current,0);
  assert.deepEqual(state.achievements.find(item=>item.code==='save-1'),first);
});
test('savings thresholds never double-count overlapping goals and currencies',()=>{
  const state={...emptyGardenState(),goals:[goal(6000),{...goal(6000),id:'second'},{...goal(100000),id:'usd',currency:'USD'}]};
  assert.equal(achievementConditions(state,at)['save-1'].current,6000);
  assert(!reconcileAchievements(state,at).achievements.some(item=>item.code==='save-1'));
});
test('history import can unlock real tracking habits without creating original timestamps',()=>{
  const records=Array.from({length:7},(_,i)=>record('t'+i,'expense',100,`2026-10-${String(i+1).padStart(2,'0')}`));
  const state=reconcileAchievements(ledgerState(records),at);
  assert.equal(state.achievements.find(item=>item.code==='week-1').unlockedAt,at);
  assert(state.achievements.find(item=>item.code==='transaction-1').metadata.observedFromImport);
});
test('consistent tracking allows gaps; future records and demo budgets never qualify',()=>{
  const records=Array.from({length:20},(_,i)=>record('t'+i,'expense',100,`2026-09-${String(i+1).padStart(2,'0')}`));
  records.push(record('future','expense',100,'2027-01-01'));
  const conditions=achievementConditions(ledgerState(records),at);
  assert.equal(conditions.tracker.current,20);assert.equal(conditions['transaction-1'].current,20);
  assert.equal(conditions['budget-1'].current,0);assert.equal(conditions['wishlist'].current,0);
});
test('annual totals come only from actual source, keep precise cents and ignore transfers',()=>{
  const state=ledgerState([record('i','income',100029,'2026-01-01'),record('e1','expense',20000,'2026-01-02'),record('e2','expense',10000,'2026-01-03'),record('x','transfer',90000,'2026-01-03'),record('old','income',999999,'2025-12-31')]);
  const summary=annualGardenSummary(state,2026,'CNY',at);
  assert.equal(summary.income,100029);assert.equal(summary.spending,30000);assert.equal(summary.netCashFlow,70029);
  assert.equal(summary.frequentCategory,'Food');assert.equal(summary.topCategories[0].amount,30000);
  assert.equal(annualGardenSummary(state,2026,'USD',at).income,null);
});
test('unknown income is distinct from zero and zero income never creates infinite savings rate',()=>{
  const unknown=annualGardenSummary(emptyGardenState(),2026,'CNY',at);assert.equal(unknown.income,null);assert.equal(unknown.savingsRate,null);
  const zero=annualGardenSummary(ledgerState([record('e','expense',100,'2026-02-01')]),2026,'CNY',at);
  assert.equal(zero.income,0);assert.equal(zero.netCashFlow,-100);assert.equal(zero.savingsRate,null);
});
test('opening balances and goal transfers are excluded from annual savings adjustments',()=>{
  let state=saveGardenGoal(emptyGardenState(),goal(20000),'opening',at,0);
  assert.equal(annualGardenSummary(state,2026,'CNY',at).recordedAllocations,null);
  state=saveGardenGoal(state,{...state.goals[0],currentSaved:22550},'adjust',at,1);
  state.operations.push({id:'move',kind:'goal.transfer',at,currency:'CNY',amount:10000});
  assert.equal(annualGardenSummary(state,2026,'CNY',at).recordedAllocations,2550);
});
test('imported already-complete snapshots do not invent this-year original goal completions',()=>{
  const state={...emptyGardenState(),goals:[{...goal(100000),fundingMode:'legacy-total',bloomedAt:at,bloomedThemeId:'charm'}]};
  assert.equal(annualGardenSummary(state,2026,'CNY',at).goalsCompleted,0);
});
test('version-one Garden normalization preserves monetary data and adds metadata only',()=>{
  const old={schemaVersion:1,goals:[goal(12345)],operations:[],receipts:[],settings:{motion:'system'}};
  const migrated=validateGardenState(old);assert.equal(migrated.schemaVersion,2);
  assert.deepEqual(migrated.goals,old.goals);assert.deepEqual(migrated.operations,old.operations);assert.deepEqual(migrated.achievements,[]);
  assert.equal(old.schemaVersion,1);
});
