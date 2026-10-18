import { COMMON_RANKS, MORPHOLOGY } from './frequency.js';
import { WORDS } from './data.js';
import { READING_GLOSSARY } from './glossary.js';

export const CUTOFFS = [0, 1000, 2000, 3500, 6000];
export const BANDS = [
  { id:'foundation', title:'高频基础', max:1000 },
  { id:'everyday', title:'常用表达', max:2000 },
  { id:'bridge', title:'基础拓展', max:3500 },
  { id:'study', title:'学习与阅读', max:6000 },
  { id:'advanced', title:'进阶阅读', max:20000 },
];
export function profileOf(state) {
  return { enabled:true, cutoff:3500, known:[], unknown:[], ...state.learningProfile };
}
export function lemmaOf(value) {
  const term=String(value).trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
  if(term.includes(' '))return term;
  const candidates=[term,...(Object.hasOwn(MORPHOLOGY,term)?MORPHOLOGY[term]:[])];
  if(term.endsWith('ies'))candidates.push(term.slice(0,-3)+'y');
  if(term.endsWith('s')&&!term.endsWith('ss'))candidates.push(term.slice(0,-1));
  if(term.endsWith('es'))candidates.push(term.slice(0,-2));
  for(const ending of ['ing','ed'])if(term.endsWith(ending)){
    const stem=term.slice(0,-ending.length);candidates.push(stem,stem+'e');
    if(/(.)\1$/.test(stem))candidates.push(stem.slice(0,-1));
    if(ending==='ed'&&stem.endsWith('i'))candidates.push(stem.slice(0,-1)+'y');
  }
  const ranked=candidates.filter(w=>Object.hasOwn(COMMON_RANKS,w)).sort((a,b)=>COMMON_RANKS[a]-COMMON_RANKS[b]);
  return ranked[0]||candidates[1]||term;
}
export function commonRank(value){const word=lemmaOf(value);return Object.hasOwn(COMMON_RANKS,word)?COMMON_RANKS[word]:null;}
export function exclusionReason(word,state,{preserveReviews=false}={}){
  const p=profileOf(state),lemma=lemmaOf(word.word||word),progress=word.id?state.progress?.[word.id]:null;
  if(p.unknown.includes(lemma))return '';
  if(p.known.includes(lemma))return '你标记已认识';
  if(preserveReviews&&progress)return '';
  if(progress?.interval>=7&&progress?.successes>=3)return '已达到掌握标准';
  const rank=commonRank(lemma);
  return p.enabled&&rank&&rank<=p.cutoff?'常见基础词（常用度近似）':'';
}
export function learningWords(list,state){return list.filter(w=>!exclusionReason(w,state,{preserveReviews:true}));}
export function markKnowledge(state,value,known){
  const p=profileOf(state),lemma=lemmaOf(value);
  p.known=p.known.filter(w=>w!==lemma);p.unknown=p.unknown.filter(w=>w!==lemma);
  p[known?'known':'unknown'].push(lemma);state.learningProfile=p;
}
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const bank=[...new Map([...WORDS,...READING_GLOSSARY].filter(w=>commonRank(w.word)&&w.meaning.length<180).map(w=>[lemmaOf(w.word),w])).values()];
export function assessmentQuestions(seed){
  let lower=0;const questions=[];
  for(const band of BANDS){
    const pool=bank.filter(w=>commonRank(w.word)>lower&&commonRank(w.word)<=band.max)
      .sort((a,b)=>hash(seed+a.word)-hash(seed+b.word)||a.word.localeCompare(b.word));
    for(const w of pool.slice(0,6)){
      const alternatives=[...new Set(bank.filter(x=>x.word!==w.word&&x.meaning!==w.meaning).sort((a,b)=>hash(seed+w.word+a.word)-hash(seed+w.word+b.word)).map(x=>x.meaning))].slice(0,3);
      const options=[w.meaning,...alternatives].sort((a,b)=>hash(w.word+a)-hash(w.word+b));
      questions.push({word:w.word,lemma:lemmaOf(w.word),band:band.id,meaning:w.meaning,options,correct:options.indexOf(w.meaning)});
    }
    lower=band.max;
  }
  return questions;
}
export function assessmentResult(seed,answers,now=Date.now()){
  const questions=assessmentQuestions(seed);if(questions.length!==30||answers.length!==30)throw new Error('请完成全部30题再查看筛选建议');
  const bands=BANDS.map(b=>({id:b.id,correct:questions.filter((q,i)=>q.band===b.id&&answers[i]===q.correct).length,total:6}));
  let cutoff=0;
  for(let i=0;i<bands.length;i++){if(bands[i].correct<5)break;cutoff=Math.min(BANDS[i].max,6000);}
  return {version:1,completedAt:now,correct:bands.reduce((n,b)=>n+b.correct,0),total:30,bands,cutoff,
    known:questions.filter((q,i)=>answers[i]===q.correct).map(q=>q.lemma),unknown:questions.filter((q,i)=>answers[i]!==q.correct).map(q=>q.lemma)};
}
export function applyAssessment(state){
  const result=state.learningProfile?.result;if(!result)throw new Error('请先完成测评');
  state.learningProfile={...profileOf(state),enabled:true,cutoff:result.cutoff};
  for(const word of result.known)markKnowledge(state,word,true);
  for(const word of result.unknown)markKnowledge(state,word,false);
}
export function validateLearningProfile(value){
  if(value===undefined)return;
  const text=s=>typeof s==='string'&&s.length>0&&s.length<=80;
  const list=x=>Array.isArray(x)&&x.length<=20000&&x.every(text)&&new Set(x).size===x.length;
  if(!value||typeof value.enabled!=='boolean'||!CUTOFFS.includes(value.cutoff)||!list(value.known)||!list(value.unknown)||value.known.some(w=>value.unknown.includes(w)))throw new Error('个人词汇筛选格式不正确');
  if(value.draft){const d=value.draft;if(typeof d.seed!=='string'||d.seed.length>100||!Array.isArray(d.answers)||d.answers.length>30||d.answers.some(a=>!Number.isInteger(a)||a<0||a>4))throw new Error('词汇测评进度格式不正确');}
  if(value.result){const r=value.result;if(r.version!==1||!Number.isFinite(r.completedAt)||r.completedAt<0||r.total!==30||!Number.isInteger(r.correct)||r.correct<0||r.correct>30||!CUTOFFS.includes(r.cutoff)||!list(r.known)||!list(r.unknown)||!Array.isArray(r.bands)||r.bands.length!==5||r.bands.some((b,i)=>b.id!==BANDS[i].id||b.total!==6||!Number.isInteger(b.correct)||b.correct<0||b.correct>6)||r.bands.reduce((n,b)=>n+b.correct,0)!==r.correct)throw new Error('词汇测评结果格式不正确');}
}
