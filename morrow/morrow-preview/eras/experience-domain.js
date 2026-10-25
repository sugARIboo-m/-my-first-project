import {quickLocalDate} from '../ledger/domain.js';

export const ACHIEVEMENT_DEFINITIONS = [
  ['save-1','saving','First little reserve','第一份小小的储备','Reach your first configurable savings threshold.','达到你设置的第一档储蓄门槛。','beginning'],
  ['save-2','saving','A little more room','再多一点余地','Reach your second configurable savings threshold.','达到你设置的第二档储蓄门槛。','story'],
  ['save-3','saving','Tomorrow, taking shape','明天慢慢成形','Reach your third configurable savings threshold.','达到你设置的第三档储蓄门槛。','keepsake'],
  ['goal-1','saving','A dream in full bloom','一个愿望，盛放了','Complete one actual savings goal.','完成一个实际储蓄目标。','keepsake'],
  ['goal-3','saving','Three little victories','三次小小的胜利','Complete three distinct actual savings goals.','完成三个不同的实际储蓄目标。','keepsake'],
  ['transaction-1','tracking','The opening note','生活的第一笔','Record or explicitly import your first actual transaction.','记录或明确导入第一笔实际账单。','beginning'],
  ['week-1','tracking','Seven days of noticing','看见生活的一周','Have a transaction on each of seven consecutive calendar days. No streak can be lost.','连续七个日期都有账单；已获纪念不会因中断清零。','story'],
  ['review-1','tracking','A moment of clarity','一次清楚的回望','Review a month with actual financial records.','复盘一个有实际财务记录的月份。','beginning'],
  ['tracker','tracking','A rhythm of your own','找到自己的节奏','Record on 20 distinct days within any 30-day window; no daily streak required.','在任意 30 天内的 20 个不同日期记录，无需每天连续。','story'],
  ['budget-1','awareness','An intention, set','为生活设一个方向','Create an actual budget. The demo budget does not qualify.','建立实际预算，首页演示预算不计入。','beginning'],
  ['budget-review','awareness','Room to reflect','留一点反思的空间','Review an actual saved budget.','复盘实际保存的预算。','story'],
  ['wishlist','awareness','A thoughtful pause','想清楚，再决定','Finish a real wishlist cooldown before reviewing it.','实际愿望清单冷静期结束后再复盘。','story'],
  ['allocation','awareness','A place for tomorrow','给明天安排一个位置','Record a positive manual savings allocation. Transfers do not create extra savings.','记录一次正的储蓄分配；目标间转移不增加储蓄。','beginning'],
  ['era-1','eras','Your first era','属于你的第一个 Era','Choose a theme for an actual saved goal.','为实际保存的目标选择主题。','beginning'],
  ['bloom-1','eras','A bloom to remember','值得记住的盛放','Reach Full Bloom with an actual goal.','实际目标达到盛放阶段。','keepsake'],
  ['eras-4','eras','Every shade of you','每一种颜色，都是你','Use all four themes on actual saved goals; studio samples do not count.','在实际目标上使用过四种主题，视觉展台不计入。','story'],
  ['wrapped-1','eras','Your money era','你的财务时代','Generate a yearly story with actual records or milestones.','使用实际记录或里程碑生成年度回顾。','keepsake']
].map(([code,group,en,zh,descriptionEn,descriptionZh,rarity])=>({id:code,code,group,name:{en,zh},description:{en:descriptionEn,zh:descriptionZh},rarity,version:1}));

export function actualLedger(state) {
  const receipt=state.receipts.find(item=>item.raw);
  let imported=[];if(receipt){try{imported=JSON.parse(receipt.raw).transactions.map(item=>({...item,id:'legacy:'+item.id,currency:'CNY'}));}catch{/* Validation rejects malformed backups before storage. */}}
  const manual=(state.ledger?.records??[]).filter(r=>!r.deletedAt).map(r=>({...r,type:r.kind}));
  return {available:!!receipt||!!state.ledger,transactions:[...imported,...manual],currencies:[...new Set([...(receipt?['CNY']:[]),...(state.ledger?[state.ledger.preferences.currency]:[]),...(state.ledger?.records??[]).map(r=>r.currency)])]};
}

function safeSum(values){const amount=values.reduce((sum,value)=>sum+BigInt(value),0n);if(amount>BigInt(Number.MAX_SAFE_INTEGER)||amount<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('totalOverflow');return Number(amount);}
function activeDayWindows(records){
  const days=[...new Set(records.map(record=>record.date))].sort();
  const numbers=days.map(day=>Math.floor(Date.parse(day+'T12:00:00Z')/86400000));
  let consecutive=0,bestConsecutive=0,bestThirty=0,left=0;
  numbers.forEach((day,index)=>{consecutive=index&&day===numbers[index-1]+1?consecutive+1:1;bestConsecutive=Math.max(bestConsecutive,consecutive);while(day-numbers[left]>29)left++;bestThirty=Math.max(bestThirty,index-left+1);});
  return {days:days.length,bestConsecutive,bestThirty};
}

export function monthlyActualSummary(state,month,at,currency='CNY') {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return {recordCount:0,income:null,spending:null};
  const records=actualLedger(state).transactions.filter(record=>record.currency===currency&&record.date.startsWith(month)&&record.date<=quickLocalDate(at));
  return {recordCount:records.length,income:safeSum(records.filter(record=>record.type==='income').map(record=>record.amount)),spending:safeSum(records.filter(record=>['expense','refund'].includes(record.type)).map(record=>record.type==='refund'?-record.amount:record.amount))};
}

export function achievementConditions(state,at) {
  const today=quickLocalDate(at),records=actualLedger(state).transactions.filter(record=>record.date<=today);
  const windows=activeDayWindows(records),currency=state.settings.milestoneCurrency??'CNY';
  const thresholds=state.settings.milestoneThresholds??[10000,50000,100000];
  // Use a single goal's current allocation, never sum potentially overlapping
  // imported total-savings snapshots and individually allocated goals.
  const largest=Math.max(0,...state.goals.filter(goal=>goal.currency===currency).map(goal=>goal.currentSaved));
  const currentComplete=state.goals.filter(goal=>goal.currentSaved>=goal.targetAmount).length;
  const themes=new Set([...state.goals.map(goal=>goal.themeId),...state.operations.filter(operation=>operation.themeId).map(operation=>operation.themeId)]);
  return {
    'save-1':{current:largest,target:thresholds[0],currency},'save-2':{current:largest,target:thresholds[1],currency},'save-3':{current:largest,target:thresholds[2],currency},
    'goal-1':{current:currentComplete,target:1},'goal-3':{current:currentComplete,target:3},
    'transaction-1':{current:records.length,target:1},'week-1':{current:windows.bestConsecutive,target:7},
    'review-1':{current:state.reviews.filter(review=>review.kind==='monthly').length,target:1},'tracker':{current:windows.bestThirty,target:20},
    'budget-1':{current:(state.budgets??[]).length,target:1,upstream:true},
    'budget-review':{current:state.reviews.filter(review=>review.kind==='budget').length,target:1,upstream:true},
    'wishlist':{current:(state.wishlist??[]).filter(item=>item.reviewedAt&&item.reviewedAt>=item.cooldownUntil).length,target:1,upstream:true},
    'allocation':{current:state.operations.filter(operation=>['goal.create','goal.update'].includes(operation.kind)&&operation.after>operation.before&&operation.fundingMode!=='legacy-total').length,target:1},
    'era-1':{current:state.goals.length,target:1},'bloom-1':{current:currentComplete,target:1},'eras-4':{current:themes.size,target:4},
    'wrapped-1':{current:state.wrappedSnapshots.length,target:1}
  };
}

export function reconcileAchievements(state,at) {
  const existing=new Set(state.achievements.map(item=>item.code));const conditions=achievementConditions(state,at);
  const theme=state.goals.at(-1)?.themeId??'eternal-bloom';
  const additions=ACHIEVEMENT_DEFINITIONS.filter(definition=>!existing.has(definition.code)&&conditions[definition.code].current>=conditions[definition.code].target)
    .map(definition=>({id:definition.code,code:definition.code,unlockedAt:at,themeId:theme,
      metadata:{version:definition.version,conditionAtUnlock:conditions[definition.code],observedFromImport:state.receipts.length>0}}));
  return additions.length?{...state,achievements:[...state.achievements,...additions]}:state;
}

export function annualGardenSummary(state,year,currency,at) {
  if(!Number.isInteger(year)||year<1900||year>9999)throw new Error('invalidDate');
  const source=actualLedger(state),records=source.transactions.filter(record=>record.currency===currency&&record.date.startsWith(year+'-')&&record.date<=quickLocalDate(at));
  const hasLedger=source.available&&source.currencies.includes(currency);
  const income=hasLedger?safeSum(records.filter(record=>record.type==='income').map(record=>record.amount)):null;
  const spending=hasLedger?safeSum(records.filter(record=>['expense','refund'].includes(record.type)).map(record=>record.type==='refund'?-record.amount:record.amount)):null;
  const expenses=records.filter(record=>['expense','refund'].includes(record.type));const categoryAmounts=new Map(),categoryCounts=new Map();
  for(const record of expenses){categoryAmounts.set(record.category,safeSum([categoryAmounts.get(record.category)??0,record.type==='refund'?-record.amount:record.amount]));if(record.type==='expense')categoryCounts.set(record.category,(categoryCounts.get(record.category)??0)+1);}
  const operations=state.operations.filter(operation=>operation.at.startsWith(year+'-')&&operation.currency===currency);
  // Initial balances/imported snapshots have no known original savings date.
  // Only subsequent, explicitly recorded allocation adjustments enter this sum.
  const adjustments=operations.filter(operation=>operation.kind==='goal.update'&&operation.fundingMode!=='legacy-total');
  const allocated=adjustments.length?safeSum(adjustments.map(operation=>operation.after-operation.before)):null;
  const completed=state.goals.filter(goal=>goal.currency===currency&&goal.fundingMode!=='legacy-total'&&goal.bloomedAt?.startsWith(year+'-'));
  const largest=completed.sort((a,b)=>a.bloomedAt.localeCompare(b.bloomedAt))[0];
  return {schemaVersion:1,year,currency,hasLedger,recordCount:records.length,income,spending,
    netCashFlow:hasLedger?safeSum([income,-spending]):null,savingsRate:income>0?(income-spending)/income*100:null,
    recordedAllocations:allocated,activeDays:new Set(records.map(record=>record.date)).size,
    frequentCategory:[...categoryCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null,
    topCategories:[...categoryAmounts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount})),
    goalsCompleted:completed.length,favoriteMilestone:largest?{kind:'goal.bloom',at:largest.bloomedAt,themeId:largest.bloomedThemeId}:null,
    hasAnyData:records.length>0||adjustments.length>0||completed.length>0};
}
