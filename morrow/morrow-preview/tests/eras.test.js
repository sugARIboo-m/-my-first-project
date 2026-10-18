import test from 'node:test';
import assert from 'node:assert/strict';
import {ERA_THEMES,goalProgress,emptyGardenState,validateGardenState,saveGardenGoal,transferGardenFunds,legacyGardenPreview,applyLegacyGarden} from '../eras/domain.js';
import {renderGardenSvg} from '../eras/art.js';
const at='2026-10-17T10:00:00.000Z';
const nextAt='2026-10-18T10:00:00.000Z';
function makeGoal(id='one',saved=0,themeId='eternal-bloom'){
  return {id,name:'Test goal',targetAmount:10000,currentSaved:saved,currency:'CNY',themeId,targetDate:null,paused:false,fundingMode:'manual',createdAt:at,updatedAt:at,revision:1,bloomedAt:null,bloomedThemeId:null};
}
test('Garden stages follow all exact threshold boundaries and clamp progress',()=>{
  for(const [saved,stage] of [[0,0],[2499,0],[2500,1],[4999,1],[5000,2],[7499,2],[7500,3],[9999,3],[10000,4],[12000,4]]){
    const result=goalProgress(saved,10000);assert.equal(result.stage,stage);assert(result.percent>=0&&result.percent<=100);
  }
  assert.equal(goalProgress(-5,10000).percent,0);
});
test('zero, missing, NaN and unsafe targets cannot produce invalid percentages',()=>{
  for(const target of [0,-1,NaN,undefined,Number.MAX_SAFE_INTEGER+1]){
    assert.equal(goalProgress(500,target).valid,false);assert.equal(goalProgress(500,target).percent,0);
  }
  assert.equal(goalProgress(1,3).percent,33.33);
  assert.equal(goalProgress(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER).stage,4);
});
test('save retries are idempotent; withdrawals retain the first full-bloom memory and theme',()=>{
  const full=saveGardenGoal(emptyGardenState(),makeGoal('one',10000),'create',at,0);
  assert.equal(full.goals[0].bloomedAt,at);assert.equal(full.goals[0].bloomedThemeId,'eternal-bloom');
  assert.deepEqual(saveGardenGoal(full,makeGoal('one',10000),'create',at,0),full);
  const lower=saveGardenGoal(full,{...full.goals[0],currentSaved:1000,themeId:'charm'},'withdraw',nextAt,1);
  assert.equal(goalProgress(lower.goals[0].currentSaved,10000).stage,0);
  assert.equal(lower.goals[0].bloomedAt,at);assert.equal(lower.goals[0].bloomedThemeId,'eternal-bloom');
});
test('cross-tab stale edits reject instead of overwriting a newer revision',()=>{
  const created=saveGardenGoal(emptyGardenState(),makeGoal(),'op1',at,0);
  const changed=saveGardenGoal(created,{...created.goals[0],currentSaved:100},'op2',nextAt,1);
  assert.throws(()=>saveGardenGoal(changed,created.goals[0],'op3',nextAt,1),/gardenConflict/);
  assert.equal(changed.goals[0].currentSaved,100);
});
test('goal allocation transfer is atomic, conserves totals and cannot count as income',()=>{
  let state=saveGardenGoal(emptyGardenState(),makeGoal('a',10000),'a',at,0);
  state=saveGardenGoal(state,makeGoal('b',2500,'charm'),'b',at,0);
  const moved=transferGardenFunds(state,'a','b',7500,'transfer',nextAt);
  assert.equal(moved.goals.reduce((sum,goal)=>sum+goal.currentSaved,0),12500);
  assert.equal(moved.goals[0].currentSaved,2500);assert.equal(moved.goals[1].currentSaved,10000);
  assert.equal(moved.operations.at(-1).kind,'goal.transfer');
  assert.deepEqual(transferGardenFunds(moved,'a','b',7500,'transfer',nextAt),moved);
  assert.equal(moved.goals[1].bloomedAt,nextAt);
});
test('invalid, overdraft, same-goal, paused and cross-currency transfers are rejected',()=>{
  const state={...emptyGardenState(),goals:[makeGoal('a',1000),makeGoal('b',0)]};
  for(const amount of [0,-1,1001,1.2])assert.throws(()=>transferGardenFunds(state,'a','b',amount,'x',at));
  assert.throws(()=>transferGardenFunds(state,'a','a',1,'x',at));
  assert.throws(()=>transferGardenFunds({...state,goals:[state.goals[0],{...state.goals[1],currency:'USD'}]},'a','b',1,'x',at));
  assert.throws(()=>transferGardenFunds({...state,goals:[{...state.goals[0],paused:true},state.goals[1]]},'a','b',1,'x',at));
});
test('funded goals cannot be relabeled as a different currency',()=>{
  const state=saveGardenGoal(emptyGardenState(),makeGoal('a',100),'a',at,0);
  assert.throws(()=>saveGardenGoal(state,{...state.goals[0],currency:'USD'},'b',at,1),/gardenCurrencyLocked/);
});
const legacy=JSON.stringify({accounts:[{id:'bank',name:'Bank',amount:12000,updated:'2026-10-17'},{id:'cash',name:'Cash',amount:30000,updated:'2026-10-17'}],transactions:[{id:'t',type:'expense',amount:300,date:'2026-10-17',category:'Food',account:'Cash',note:''}],goal:{name:'Original goal',amount:40000}});
test('legacy import preserves total-savings semantics without replaying transactions or duplicate goals',()=>{
  const preview=legacyGardenPreview(legacy);assert.equal(preview.currentSaved,42000);assert.equal(preview.transactionCount,1);
  const state=applyLegacyGarden(emptyGardenState(),legacy,'digest','op',at,'legacy');
  assert.equal(state.goals[0].fundingMode,'legacy-total');assert.equal(state.goals[0].currentSaved,42000);
  assert.equal(state.receipts[0].raw,legacy);
  assert.deepEqual(applyLegacyGarden(state,legacy,'digest','op2',nextAt,'legacy2'),state);
  assert.throws(()=>applyLegacyGarden(state,legacy,'different','op3',nextAt,'legacy3'),/gardenLegacyAlreadyImported/);
  assert.throws(()=>saveGardenGoal(state,{...state.goals[0],currentSaved:0},'edit',at,1),/gardenLegacyLocked/);
});
test('invalid legacy dates and zero targets stop migration rather than silently changing data',()=>{
  assert.throws(()=>legacyGardenPreview(legacy.replace('2026-10-17','2026-02-30')));
  const invalid=JSON.parse(legacy);invalid.goal.amount=0;assert.throws(()=>legacyGardenPreview(JSON.stringify(invalid)));
});
test('restore validates the schema and rejects duplicate goal IDs',()=>{
  assert.equal(validateGardenState(emptyGardenState()).schemaVersion,2);
  assert.throws(()=>validateGardenState({...emptyGardenState(),goals:[makeGoal(),makeGoal()]}));
  assert.throws(()=>validateGardenState({...emptyGardenState(),settings:{motion:'invalid'}}));
});
test('all twenty SVG assets are generated without external media or unescaped labels',()=>{
  const assets=[];
  for(const theme of ERA_THEMES)for(let stage=0;stage<5;stage++){
    const svg=renderGardenSvg(theme.id,stage,{prefix:theme.id+'-'+stage,label:'<script>unsafe</script>'});
    assert(svg.includes('viewBox="0 0 600 360"'));assert(!svg.includes('<script>'));
    assert(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(svg));assets.push(svg);
  }
  assert.equal(new Set(assets).size,20);
});
