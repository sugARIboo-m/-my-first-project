import {isCalendarDate} from '../domain.js';
import {ACHIEVEMENT_DEFINITIONS} from './experience-domain.js';

export const ERA_THEMES = [
  {id:'eternal-bloom',name:'Eternal Bloom',descriptionKey:'eternalDescription',palette:['#e9e3ed','#b9a8c8','#be98a7','#f4eef2'],flower:'pearl'},
  {id:'pink-pony',name:'Pink Pony Garden',descriptionKey:'ponyDescription',palette:['#eee1e6','#a7647e','#764455','#d6a7b6'],flower:'star'},
  {id:'charm',name:'Charm Garden',descriptionKey:'charmDescription',palette:['#e7e8dc','#9baa84','#71816e','#f1e8d4'],flower:'daisy'},
  {id:'blue-hour',name:'Blue Hour Garden',descriptionKey:'blueDescription',palette:['#dfe5ed','#8192aa','#af8c98','#d5c8bd'],flower:'rose'}
];
export const GARDEN_STAGES = ['seed','sprout','growing','blooming','fullBloom'];
export const GARDEN_CURRENCIES = ['CNY','USD','EUR','GBP'];
const gardenMinor = value => Number.isSafeInteger(value) && value >= 0;

export function goalProgress(saved,target) {
  if(!Number.isSafeInteger(saved)||!Number.isSafeInteger(target)||target<=0) return {valid:false,percent:0,stage:0,complete:false};
  const current=BigInt(Math.max(0,saved)), total=BigInt(target);
  const basisPoints=current>=total?10000n:current*10000n/total;
  const percent=Number(basisPoints)/100;
  const stage=current>=total?4:current*4n>=total*3n?3:current*2n>=total?2:current*4n>=total?1:0;
  return {valid:true,percent,stage,complete:current>=total};
}

export function emptyGardenState() {
  return {schemaVersion:2,goals:[],operations:[],receipts:[],achievements:[],reviews:[],wrappedSnapshots:[],settings:{motion:'system',milestoneCurrency:'CNY',milestoneThresholds:[10000,50000,100000]}};
}

export function validateGardenGoal(goal) {
  if(!goal||typeof goal.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(goal.id)||typeof goal.name!=='string'||!goal.name.trim()||goal.name.length>80) throw new Error('gardenInvalidName');
  if(!gardenMinor(goal.targetAmount)||goal.targetAmount===0||!gardenMinor(goal.currentSaved)) throw new Error('gardenInvalidAmount');
  if(!GARDEN_CURRENCIES.includes(goal.currency)) throw new Error('gardenInvalidCurrency');
  if(!ERA_THEMES.some(theme=>theme.id===goal.themeId)) throw new Error('gardenInvalidTheme');
  if(goal.targetDate!==null&&!isCalendarDate(goal.targetDate)) throw new Error('invalidDate');
  if(typeof goal.paused!=='boolean'||!['manual','legacy-total'].includes(goal.fundingMode)) throw new Error('gardenInvalidBackup');
  if(!Number.isSafeInteger(goal.revision)||goal.revision<1)throw new Error('gardenInvalidBackup');
  for(const key of ['createdAt','updatedAt']) if(typeof goal[key]!=='string'||!Number.isFinite(Date.parse(goal[key]))) throw new Error('gardenInvalidBackup');
  if(goal.bloomedAt!==null&&(typeof goal.bloomedAt!=='string'||!Number.isFinite(Date.parse(goal.bloomedAt)))) throw new Error('gardenInvalidBackup');
  if(goal.bloomedAt!==null&&!ERA_THEMES.some(theme=>theme.id===goal.bloomedThemeId))throw new Error('gardenInvalidBackup');
  return goal;
}

export function validateGardenState(state) {
  if(!state||![1,2].includes(state.schemaVersion)||!Array.isArray(state.goals)||!Array.isArray(state.operations)||!Array.isArray(state.receipts)) throw new Error('gardenInvalidBackup');
  const normalized={...state,schemaVersion:2,achievements:state.achievements??[],reviews:state.reviews??[],wrappedSnapshots:state.wrappedSnapshots??[],settings:{milestoneCurrency:'CNY',milestoneThresholds:[10000,50000,100000],...state.settings}};
  if(!Array.isArray(normalized.achievements)||!Array.isArray(normalized.reviews)||!Array.isArray(normalized.wrappedSnapshots))throw new Error('gardenInvalidBackup');
  const ids=new Set();
  for(const goal of state.goals){validateGardenGoal(goal);if(ids.has(goal.id))throw new Error('gardenInvalidBackup');ids.add(goal.id);}
  const operations=new Set();
  for(const operation of state.operations){
    if(!operation||typeof operation.id!=='string'||operations.has(operation.id)||typeof operation.kind!=='string'||typeof operation.at!=='string'||!Number.isFinite(Date.parse(operation.at)))throw new Error('gardenInvalidBackup');
    operations.add(operation.id);
  }
  for(const receipt of state.receipts){if(!receipt||typeof receipt.digest!=='string'||typeof receipt.raw!=='string'||typeof receipt.at!=='string')throw new Error('gardenInvalidBackup');legacyGardenPreview(receipt.raw);}
  if(!state.settings||!['system','reduce'].includes(state.settings.motion)) throw new Error('gardenInvalidBackup');
  const achievementCodes=new Set();
  for(const achievement of normalized.achievements){if(!achievement||!ACHIEVEMENT_DEFINITIONS.some(definition=>definition.code===achievement.code)||achievementCodes.has(achievement.code)||!Number.isFinite(Date.parse(achievement.unlockedAt))||!ERA_THEMES.some(theme=>theme.id===achievement.themeId))throw new Error('gardenInvalidBackup');achievementCodes.add(achievement.code);}
  for(const review of normalized.reviews)if(!review||!['monthly','budget'].includes(review.kind)||typeof review.period!=='string'||!Number.isFinite(Date.parse(review.at)))throw new Error('gardenInvalidBackup');
  const snapshotIds=new Set();
  for(const snapshot of normalized.wrappedSnapshots){
    if(!snapshot||typeof snapshot.id!=='string'||snapshotIds.has(snapshot.id)||!Number.isFinite(Date.parse(snapshot.generatedAt))||!snapshot.summary||!Number.isInteger(snapshot.year)||snapshot.year<1900||snapshot.year>9999||snapshot.summary.year!==snapshot.year||!GARDEN_CURRENCIES.includes(snapshot.summary.currency)||!snapshot.summary.hasAnyData)throw new Error('gardenInvalidBackup');
    snapshotIds.add(snapshot.id);
  }
  const thresholds=normalized.settings.milestoneThresholds;
  if(!GARDEN_CURRENCIES.includes(normalized.settings.milestoneCurrency)||!Array.isArray(thresholds)||thresholds.length!==3||thresholds.some((value,index)=>!gardenMinor(value)||value===0||(index>0&&value<=thresholds[index-1])))throw new Error('gardenInvalidBackup');
  return normalized;
}

export function saveGardenGoal(state,candidate,operationId,at,expectedRevision) {
  if(state.operations.some(operation=>operation.id===operationId))return state;
  validateGardenGoal(candidate);
  const prior=state.goals.find(goal=>goal.id===candidate.id);
  if(expectedRevision!==undefined&&(prior?.revision??0)!==expectedRevision)throw new Error('gardenConflict');
  if(prior&&prior.currency!==candidate.currency&&prior.currentSaved>0)throw new Error('gardenCurrencyLocked');
  if(prior?.fundingMode==='legacy-total'&&candidate.currentSaved!==prior.currentSaved)throw new Error('gardenLegacyLocked');
  const goal={...candidate,createdAt:prior?.createdAt??candidate.createdAt,updatedAt:at,
    revision:(prior?.revision??0)+1,
    bloomedAt:prior?.bloomedAt??(goalProgress(candidate.currentSaved,candidate.targetAmount).complete?at:null),
    bloomedThemeId:prior?.bloomedThemeId??(goalProgress(candidate.currentSaved,candidate.targetAmount).complete?candidate.themeId:null)};
  return {...state,goals:prior?state.goals.map(item=>item.id===goal.id?goal:item):[...state.goals,goal],
    operations:[...state.operations,{id:operationId,kind:prior?'goal.update':'goal.create',at,goalId:goal.id,
      before:prior?.currentSaved??0,after:goal.currentSaved,currency:goal.currency,fundingMode:goal.fundingMode,themeId:goal.themeId,targetBefore:prior?.targetAmount??null,targetAfter:goal.targetAmount}]};
}

export function transferGardenFunds(state,fromId,toId,amount,operationId,at) {
  if(state.operations.some(operation=>operation.id===operationId))return state;
  const from=state.goals.find(goal=>goal.id===fromId),to=state.goals.find(goal=>goal.id===toId);
  if(!from||!to||fromId===toId||from.currency!==to.currency)throw new Error('gardenInvalidTransfer');
  if(from.paused||to.paused)throw new Error('gardenPausedTransfer');
  if(from.fundingMode!=='manual'||to.fundingMode!=='manual')throw new Error('gardenLegacyLocked');
  if(!gardenMinor(amount)||amount===0||amount>from.currentSaved||!Number.isSafeInteger(to.currentSaved+amount))throw new Error('gardenInvalidTransfer');
  const goals=state.goals.map(goal=>goal.id===fromId?{...goal,currentSaved:goal.currentSaved-amount,updatedAt:at,revision:goal.revision+1}:
    goal.id===toId?{...goal,currentSaved:goal.currentSaved+amount,updatedAt:at,revision:goal.revision+1,
      bloomedAt:goal.bloomedAt??(goalProgress(goal.currentSaved+amount,goal.targetAmount).complete?at:null),
      bloomedThemeId:goal.bloomedThemeId??(goalProgress(goal.currentSaved+amount,goal.targetAmount).complete?goal.themeId:null)}:goal);
  return {...state,goals,operations:[...state.operations,{id:operationId,kind:'goal.transfer',at,fromId,toId,amount,currency:from.currency}]};
}

export function legacyGardenPreview(raw) {
  let legacy;
  try{legacy=JSON.parse(raw);}catch{throw new Error('gardenInvalidLegacy');}
  if(!legacy||!Array.isArray(legacy.accounts)||!Array.isArray(legacy.transactions)||!legacy.goal)throw new Error('gardenInvalidLegacy');
  let total=0;
  for(const account of legacy.accounts){
    if(!account||!gardenMinor(account.amount)||typeof account.id!=='string'||typeof account.name!=='string'||!isCalendarDate(account.updated))throw new Error('gardenInvalidLegacy');
    total+=account.amount;if(!Number.isSafeInteger(total))throw new Error('gardenInvalidLegacy');
  }
  for(const transaction of legacy.transactions){
    if(!transaction||!gardenMinor(transaction.amount)||!isCalendarDate(transaction.date)||!['income','expense'].includes(transaction.type)||
       ['id','category','account','note'].some(key=>typeof transaction[key]!=='string'))throw new Error('gardenInvalidLegacy');
  }
  if(typeof legacy.goal.name!=='string'||!legacy.goal.name.trim()||!gardenMinor(legacy.goal.amount)||legacy.goal.amount===0)throw new Error('gardenInvalidLegacy');
  return {name:legacy.goal.name,targetAmount:legacy.goal.amount,currentSaved:total,accountCount:legacy.accounts.length,transactionCount:legacy.transactions.length};
}

export function applyLegacyGarden(state,raw,digest,operationId,at,goalId) {
  if(state.receipts.some(receipt=>receipt.digest===digest))return state;
  const source=legacyGardenPreview(raw),prior=state.goals.find(goal=>goal.fundingMode==='legacy-total');
  if(prior)throw new Error('gardenLegacyAlreadyImported');
  const goal={id:goalId,name:source.name,targetAmount:source.targetAmount,currentSaved:source.currentSaved,
    themeId:'eternal-bloom',currency:'CNY',targetDate:null,paused:false,fundingMode:'legacy-total',
    createdAt:at,updatedAt:at,revision:1,bloomedAt:goalProgress(source.currentSaved,source.targetAmount).complete?at:null,
    bloomedThemeId:goalProgress(source.currentSaved,source.targetAmount).complete?'eternal-bloom':null};
  validateGardenGoal(goal);
  return {...state,goals:[...state.goals,goal],operations:[...state.operations,{id:operationId,kind:'legacy.import',goalId,at}],
    receipts:[...state.receipts,{digest,raw,at,goalId}]};
}
