export const DAY = 86400000;
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function emptyState() {
  return { version: 1, plan: { exam: '大学英语四级', month: '2027-06', date: '', goal: 20, target: 4500, minutes: 20 }, progress: {}, history: {}, favorites: [], customWords: [], materials: [
    { id: 'material-textbook', title: '新时代大学商务英语综合教程 2', type: 'textbook', url: '', updated: 0, wordIds: [] },
    { id: 'material-reading', title: 'Everything I Know About Love', type: 'reading', url: '', updated: 0, wordIds: [] },
  ] };
}
export function statusOf(progress) {
  return !progress ? 'new' : progress.interval >= 7 && progress.successes >= 3 ? 'mastered' : 'learning';
}
export function schedule(previous, rating, now = Date.now()) {
  if (![1,2,3,4].includes(rating)) throw new Error('Invalid rating');
  const p = previous || { interval: 0, successes: 0, lapses: 0 };
  const interval = rating === 1 ? 0 : rating === 2 ? 1 : rating === 3 ? (p.interval ? Math.max(3, Math.round(p.interval*2.2)) : 3) : (p.interval ? Math.max(7, Math.round(p.interval*3)) : 7);
  return { interval, due: now+(rating===1 ? 10*60000 : interval*DAY), successes: rating>=3 ? p.successes+1 : 0, lapses: p.lapses+(rating===1 ? 1 : 0), lastReviewed: now };
}
export function recordRating(state, id, rating, now=Date.now()) {
  const key = dayKey(new Date(now));
  const fresh = !state.progress[id];
  const h = state.history[key] ||= { attempts:0, correct:0, learned:[], reviewed:[] };
  h.attempts++;
  if(rating>=3) h.correct++;
  if(fresh && !h.learned.includes(id)) h.learned.push(id);
  if(!h.reviewed.includes(id)) h.reviewed.push(id);
  state.progress[id] = schedule(state.progress[id], rating, now);
}
export function makeQueue(words, state, now=Date.now(), reviewOnly=false) {
  const due = words.filter(w=>state.progress[w.id] && state.progress[w.id].due<=now).sort((a,b)=>state.progress[a.id].due-state.progress[b.id].due);
  if(reviewOnly) return due;
  const learned = state.history[dayKey(new Date(now))]?.learned.length || 0;
  return [...due, ...words.filter(w=>!state.progress[w.id]).slice(0, Math.max(0,state.plan.goal-learned))];
}
export function streak(history, now=new Date()) {
  let d = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(!history[dayKey(d)]?.attempts) d.setDate(d.getDate()-1);
  let n=0;
  while(history[dayKey(d)]?.attempts) {n++;d.setDate(d.getDate()-1);}
  return n;
}
export function daysUntil(date, now=new Date()) {
  if(!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if(Number.isNaN(target.getTime())) return null;
  return Math.ceil((target-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/DAY);
}
const STOP = new Set('a an the and or but so if as at by for from in into of on to with without is are was were be been being am do does did doing have has had having i you he she it we they me him her us them my your his its our their this that these those what which who whom whose how when where why not no yes can could will would shall should may might must than then too very just also only all each every some any other such one two more most less many much there here about after before over under out up down off through between during while because until once both either neither own same'.split(' '));
export function extractCandidates(text, knownWords, limit=80) {
  const known = new Map(knownWords.map(w=>[w.word.toLowerCase(),w]));
  const counts=new Map();
  const tokens=text.toLowerCase().match(/[a-z]+(?:[-'][a-z]+)*/g)||[];
  for(const token of tokens) if(token.length>=4 && token.length<=28 && !STOP.has(token)) counts.set(token,(counts.get(token)||0)+1);
  const normalized=text.replace(/\s+/g,' ');
  for(const [phrase] of known) if(phrase.includes(' ')){const matches=normalized.match(new RegExp(wordPattern(phrase),'gi'));if(matches?.length)counts.set(phrase,matches.length);}
  const sentences=text.replace(/\s+/g,' ').split(/(?<=[.!?。！？])\s+/).filter(s=>s.length>=8);
  return [...counts].sort((a,b)=>Number(known.has(b[0]))-Number(known.has(a[0])) || b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([word,count])=>({ word, count, known:known.get(word)||null, sentence:(sentences.find(s=>new RegExp(wordPattern(word),'i').test(s))||'').slice(0,350) }));
}
export function validateBackup(data) {
  if(!data || data.version!==1 || !data.plan || !Array.isArray(data.customWords) || !Array.isArray(data.materials) || !data.progress || !data.history || !Array.isArray(data.favorites)) throw new Error('这不是有效的词间备份文件');
  const safeText=(s,max=500)=>typeof s==='string' && s.length<=max;
  if(data.plan.month !== undefined && (typeof data.plan.month !== 'string' || (data.plan.month && !/^\d{4}-\d{2}$/.test(data.plan.month)))) throw new Error('备考月份格式不正确');
  if(!safeText(data.plan.exam,100) || !safeText(data.plan.date,10) || !Number.isInteger(data.plan.goal) || data.plan.goal<1 || data.plan.goal>100 || !Number.isInteger(data.plan.target) || data.plan.target<1 || data.plan.target>50000 || !Number.isInteger(data.plan.minutes) || data.plan.minutes<1 || data.plan.minutes>180) throw new Error('学习计划格式不正确');
  if(data.plan.date && (!/^\d{4}-\d{2}-\d{2}$/.test(data.plan.date) || daysUntil(data.plan.date)===null)) throw new Error('考试日期格式不正确');
  if(data.customWords.length>10000 || data.materials.length>100) throw new Error('备份内容过大');
  const ids=new Set();
  for(const w of data.customWords) {
    if(!safeText(w.id,120)||!w.id.startsWith('custom-')||ids.has(w.id)||!safeText(w.word,80)||!w.word.trim()||!safeText(w.meaning,500)||!w.meaning.trim()||!safeText(w.ipa,100)||!safeText(w.pos,30)||!safeText(w.example,1000)||!safeText(w.translation,1000)||w.deck!=='custom') throw new Error('自定义单词格式不正确');
    ids.add(w.id);
  }
  for(const m of data.materials) if(!safeText(m.id,100)||!safeText(m.title,100)||!['textbook','reading','exam'].includes(m.type)||!safeText(m.url,1000)||!Number.isFinite(m.updated)||!Array.isArray(m.wordIds)||m.wordIds.some(x=>!safeText(x,120))) throw new Error('学习资料格式不正确');
  for(const m of data.materials) if(m.contexts !== undefined && (!m.contexts || typeof m.contexts !== 'object' || Array.isArray(m.contexts) || Object.entries(m.contexts).some(([id,text])=>!m.wordIds.includes(id)||!safeText(text,1000)))) throw new Error('原文例句格式不正确');
  for (const m of data.materials) {
    if (m.activeChapter !== undefined && !safeText(m.activeChapter,500)) throw new Error('章节选择格式不正确');
    if (m.chapters !== undefined) {
      if (!m.chapters || Array.isArray(m.chapters) || typeof m.chapters !== 'object' || Object.keys(m.chapters).length>500) throw new Error('章节格式不正确');
      for (const [id,c] of Object.entries(m.chapters)) {
        if (!safeText(id,500) || !c || c.id!==id || !safeText(c.title,200) || !Array.isArray(c.wordIds) || c.wordIds.some(x=>!m.wordIds.includes(x)) || !c.contexts || typeof c.contexts!=='object' || Array.isArray(c.contexts) || Object.entries(c.contexts).some(([k,v])=>!c.wordIds.includes(k)||!safeText(v,1000))) throw new Error('章节词单格式不正确');
      }
      if (m.activeChapter && !Object.hasOwn(m.chapters,m.activeChapter)) throw new Error('找不到选定章节');
    }
  }
  if(data.courseImportVersions !== undefined && (!data.courseImportVersions || typeof data.courseImportVersions!=='object' || Array.isArray(data.courseImportVersions) || Object.entries(data.courseImportVersions).some(([k,v])=>!safeText(k,100)||!safeText(v,100)))) throw new Error('课堂同步记录格式不正确');
  if(data.courseTasks !== undefined && (!data.courseTasks || typeof data.courseTasks!=='object' || Array.isArray(data.courseTasks) || Object.entries(data.courseTasks).some(([k,v])=>!safeText(k,200)||typeof v!=='boolean'))) throw new Error('课堂任务记录格式不正确');
  const validId=id=> typeof id==='string' && id.length<=120 && !['__proto__','constructor','prototype'].includes(id);
  if (data.activities !== undefined) {
    const a=data.activities;
    if(!a || typeof a!=='object' || !a.days || !a.mistakes || typeof a.days!=='object' || typeof a.mistakes!=='object' || Array.isArray(a.days) || Array.isArray(a.mistakes) || Object.keys(a.days).length>3660 || Object.keys(a.mistakes).length>10000) throw new Error('探索练习记录格式不正确');
    for(const [date,d] of Object.entries(a.days)) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!d||!Number.isInteger(d.answered)||d.answered<0||!Number.isInteger(d.correct)||d.correct<0||d.correct>d.answered||!Array.isArray(d.rewarded)||d.rewarded.length>10000||d.rewarded.some(id=>!validId(id))||new Set(d.rewarded).size!==d.rewarded.length||d.rewarded.length>d.correct||!Array.isArray(d.completed)||d.completed.some(t=>!['daily','context','mistakes'].includes(t))||!Number.isInteger(d.dailyBest)||d.dailyBest<0||d.dailyBest>5) throw new Error('每日挑战记录格式不正确');
    }
    for(const [id,m] of Object.entries(a.mistakes)) if(!validId(id)||!m||!Number.isInteger(m.wrongCount)||m.wrongCount<1||!Number.isFinite(m.lastAt)||m.lastAt<0) throw new Error('错词记录格式不正确');
  }
  for(const w of data.customWords) if(w.dictionarySource!==undefined) {
    const d=w.dictionarySource;
    if(!d||d.name!=='WordNet'||d.version!=='3.0'||!safeText(d.lemma,80)||!safeText(d.definition,5000)||typeof d.synset!=='string'||!/^([nvars]):\d{8}$/.test(d.synset)) throw new Error('词典来源格式不正确');
  }
  for(const [id,p] of Object.entries(data.progress)) if(!validId(id)||!p||![p.interval,p.due,p.successes,p.lapses,p.lastReviewed].every(x=>Number.isFinite(x)&&x>=0)) throw new Error('学习进度格式不正确');
  for(const [key,h] of Object.entries(data.history)) if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!h||!Number.isInteger(h.attempts)||h.attempts<0||!Number.isInteger(h.correct)||h.correct<0||h.correct>h.attempts||!Array.isArray(h.learned)||!Array.isArray(h.reviewed)||[...h.learned,...h.reviewed].some(id=>!validId(id))) throw new Error('学习记录格式不正确');
  if(data.favorites.some(id=>!validId(id))) throw new Error('收藏格式不正确');
  return JSON.parse(JSON.stringify(data));
}

export function mergeMaterialChapter(material, chapter) {
  const chapters = { ...(material.chapters || {}), [chapter.id]: chapter };
  const all = Object.values(chapters);
  return { ...material, chapters, activeChapter: chapter.id,
    wordIds: [...new Set(all.flatMap(c=>c.wordIds))],
    contexts: Object.assign({}, ...all.map(c=>c.contexts)) };
}

export function wordPattern(word) {
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
  const variants={
    'bind':'(?:bind(?:s|ing)?|bound)',
    'herald':'herald(?:s|ed|ing)?',
    'leapfrog':'leapfrog(?:s|ged|ging)?',
    'flourish':'flourish(?:es|ed|ing)?',
    'flourishing':'flourish(?:es|ed|ing)?',
    'burgeoning':'burgeon(?:s|ed|ing)?',
    'coordinate':'co-?ordinat(?:e|es|ed|ing)',
    'coordinate with':'co-?ordinat(?:e|es|ed|ing)\\s+with',
    'initiate':'initiat(?:e|es|ed|ing)',
    'pitch in':'pitch(?:es|ed|ing)?\\s+in',
    'call the shots':'call(?:s|ed|ing)?\\s+the\\s+shots',
    'tap into':'tap(?:s|ped|ping)?\\s+into',
    'opt out of':'opt(?:s|ed|ing)?\\s+out\\s+of',
    'win over':'(?:win(?:s|ning)?|won)\\s+over',
    'excel at':'excel(?:s|led|ling)?\\s+at',
    'usher in':'usher(?:s|ed|ing)?\\s+in',
  };
  const key=word.toLowerCase();
  const body=variants[key]||(key.startsWith('be ')?'(?:am|is|are|was|were|be|been|being)\\s+'+escape(key.slice(3)):escape(word));
  return '\\b(?:'+body+')\\b';
}
