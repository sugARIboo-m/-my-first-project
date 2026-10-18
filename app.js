import { DECKS, WORDS } from './data.js';
import { profileOf, learningWords, exclusionReason, lemmaOf, markKnowledge, assessmentQuestions, assessmentResult, applyAssessment, validateLearningProfile } from './level.js';
import { levelBanner, profileMarkup, assessmentMarkup, resultMarkup, cutoffOptions } from './level-ui.js';
import { analyzeSections } from './selection.js';
import { createQuiz, recordQuizAnswer, completeQuiz, activityStats } from './activities.js';
import { lookupWord, normalizeTerm } from './dictionary.js';
import { discoveryStrip, explorePage, dictionaryPage } from './features.js';
import { READING_GLOSSARY } from './glossary.js';
import { syncCoursePack } from './course.js';
import { DAY, dayKey, emptyState, statusOf, recordRating, makeQueue, streak, daysUntil, extractCandidates, validateBackup, mergeMaterialChapter, wordPattern } from './core.js';
const paths={
 leaf:'M20 4C10 3 3 7 4 14c1 6 9 8 13 3 3-4 3-9 3-13ZM5 20l10-10',
 home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
 book:'M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z',
 repeat:'m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
 chart:'M4 3v18h17M8 16v-5m5 5V7m5 9V4',
 folder:'M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
 sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5V1m0 22v-2M3 12H1m22 0h-2M5 5 3 3m18 18-2-2M5 19l-2 2M21 3l-2 2',
 graduation:'m2 9 10-5 10 5-10 5ZM6 11v6c4 3 8 3 12 0v-6m4-2v8',
 briefcase:'M8 7V4h8v3M3 8h18v12H3Zm0 5c5 3 13 3 18 0m-10 1h2v3h-2Z',
 arrow:'M4 12h16m-6-6 6 6-6 6', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', plus:'M12 5v14M5 12h14',
 volume:'m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
 star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
 flame:'M13 2c2 7-5 7-2 12 1-3 3-4 5-6 6 7 3 14-4 14S1 13 7 7c0 4 2 4 2 4 1-4 4-5 4-9Z',
 check:'m5 12 4 4L19 6', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 2-1 4-4 3-3-2-4-1-3-4 2-3 1-4Z',
 search:'M20 20l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z', close:'m6 6 12 12M18 6 6 18',
 upload:'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7', download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
 target:'M22 12a10 10 0 1 1-10-10m0 5a5 5 0 1 0 5 5m-5 0 9-9m-5 0h5v5',
 calendar:'M4 5h16v16H4ZM8 2v6m8-6v6M4 11h16', file:'M5 3h9l5 5v13H5Zm9 0v6h5M8 13h8m-8 4h5',
 sparkle:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z', trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
 coffee:'M4 5h12v9a6 6 0 0 1-12 0Zm12 1h2a4 4 0 0 1 0 8h-2M2 22h18', shield:'m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 10 3 3 5-6',
};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='wordlane.v1';
let state=emptyState(), storageError=false;
try { const raw=localStorage.getItem(KEY); if(raw) state=validateBackup(JSON.parse(raw)); } catch { storageError=true; }
let view='home', selectedSource='cet4', session=null, filter='all', query='', mode='card', draft=null, editingMaterial=null, lastFocus=null, epubState=null, readingBook=null, courseLibrary=null, selectedLesson='unit1-source-1', courseFilter='all';
let quiz=null, practiceSource='all', dictionaryTerm='', dictionaryResult=null, dictionaryStatus='idle', dictionaryError='', dictionaryVisible=12, lookupRequest=0;
let selectionTicket=0, buildingCandidates=false;
const app=document.querySelector('#app'), modal=document.querySelector('#modal');
function words(){return [...WORDS,...state.customWords];}
function sourceWords(source=selectedSource){if(source==='all')return words();const material=state.materials.find(m=>m.id===source);if(material){const chapter=material.chapters?.[material.activeChapter];const ids=chapter?.wordIds||material.wordIds,contexts=chapter?.contexts||material.contexts;return words().filter(w=>ids.includes(w.id)).map(w=>chapter?.id.startsWith('unit1-source-')?{...w,example:contexts?.[w.id]||'',translation:chapter.translations?.[w.id]||'',sourceEvidence:chapter.evidence?.[w.id]}:contexts?.[w.id]?{...w,example:contexts[w.id],translation:chapter?.translations?.[w.id]||''}:w);}return words().filter(w=>w.deck===source);}
function learningSourceWords(source=selectedSource){return learningWords(sourceWords(source),state);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageError=false;return true;}catch{storageError=true;toast('浏览器未能保存数据，请导出备份后检查存储空间');return false;}}
let toastTimer;
function toast(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),4200);}
function today(){return state.history[dayKey()]||{attempts:0,correct:0,learned:[],reviewed:[]};}
function totals(){const list=words();return {total:list.length, learned:list.filter(w=>state.progress[w.id]).length, mastered:list.filter(w=>statusOf(state.progress[w.id])==='mastered').length, due:learningWords(list,state).filter(w=>state.progress[w.id]?.due<=Date.now()).length};}
function sourceOptions(selected=selectedSource,all=true){return `${all?`<option value="all" ${selected==='all'?'selected':''}>全部单词</option>`:''}${DECKS.map(d=>`<option value="${d.id}" ${selected===d.id?'selected':''}>${d.name}</option>`).join('')}${state.materials.map(m=>`<option value="${esc(m.id)}" ${selected===m.id?'selected':''}>${esc(m.title)}</option>`).join('')}<option value="custom" ${selected==='custom'?'selected':''}>自建单词</option>`;}
function sourceName(){return DECKS.find(d=>d.id===selectedSource)?.name||state.materials.find(m=>m.id===selectedSource)?.title||(selectedSource==='all'?'全部单词':'自建单词');}
const nav=[['home','home','今日学习'],['explore','sparkle','探索练习'],['dictionary','search','词典资料馆'],['course','graduation','课堂同步'],['review','repeat','温故知新'],['materials','folder','我的学习资料'],['library','book','我的词库'],['stats','chart','学习足迹']];
function render(){
 const t=totals();
 app.innerHTML=`<aside class="sidebar"><a class="brand" href="#" data-action="nav" data-view="home"><img src="/icon.svg" alt=""><span>词间<span class="brand-en">WORDLANE</span></span></a><div class="sidebar-label">你的英语小天地</div><nav aria-label="主导航">${nav.map(([id,i,label])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}" aria-label="${label}" title="${label}" ${view===id?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${id==='review'&&t.due?`<span class="nav-count">${t.due}</span>`:''}</button>`).join('')}<button class="nav-item mobile-more ${!['home','explore','review','dictionary'].includes(view)?'active':''}" data-action="more" aria-label="更多学习模块">${icon('folder')}<span>更多</span></button></nav><div class="sidebar-bottom"><div class="sidebar-note"><div class="mini-leaf">${icon('leaf')}</div><p>慢慢来，<br>每一步都算数。</p><span>A little, every day.</span></div><button class="nav-item" data-action="settings" aria-label="学习设置">${icon('settings')}<span>学习设置</span></button><div class="profile"><span class="avatar">S</span><div>英语学习者<small>正在成为更好的自己</small></div><span class="online-dot" title="本地学习模式"></span></div></div></aside><div class="workspace"><header class="topbar"><span>${({home:'今日学习',review:'温故知新',materials:'我的学习资料',library:'我的词库',stats:'学习足迹',course:'课堂同步',explore:'探索练习',dictionary:'词典资料馆'})[view]}</span><div class="topbar-right"><span class="local-badge">${icon('shield')} 本地保存 · 无需登录</span><button class="streak-pill" data-action="nav" data-view="stats">${icon('flame')}<strong>${streak(state.history)}</strong> 天连续学习</button><span class="top-avatar">S</span></div></header><main id="main">${storageError?'<div class="storage-warning" role="alert">当前浏览器的数据保存不可用或旧数据无法读取，请及时导出备份。</div>':''}${view==='home'?home():view==='explore'?explorePage({state,quiz,sourceOptions:sourceOptions(practiceSource),icon}):view==='dictionary'?dictionaryPage({term:dictionaryTerm,result:dictionaryResult,status:dictionaryStatus,error:dictionaryError,localEntry:words().find(w=>w.word.toLowerCase()===dictionaryResult?.lemma),visibleSenses:dictionaryVisible,icon}):view==='review'?review():view==='library'?library():view==='materials'?materials():view==='course'?coursePage():stats()}</main><footer class="page-footer"><span>词间 · 让每一个单词，都走进生活</span><span>Small steps. Lasting words.</span></footer></div>`;
 if(session && !session.revealed && mode==='spell') setTimeout(()=>document.querySelector('#spelling')?.focus(),0);
}
function home(){
 const h=today(), t=totals(), percent=Math.min(100,Math.round(h.learned.length/state.plan.goal*100));
 const hour=new Date().getHours(), greeting=hour<12?'早上好':hour<18?'下午好':'晚上好';
 return `<section class="greeting"><div><span class="eyebrow">MAKE ROOM FOR A LITTLE ENGLISH</span><h1>${greeting}，今天也一起进步<span class="heading-spark">✦</span></h1><p>不必一口气走很远，每天记住一点，就很好。</p></div><div class="date-chip">${icon('calendar')}<span>${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span></div></section><section class="daily-banner"><div class="banner-copy"><span class="pill light">${icon('sparkle')} 每日一点，积少成多</span><h2>给英语一点日常。<br>让成长，自然而然。</h2><p>从 ${state.plan.goal} 个单词开始，收获今天的小小成就。</p><button class="button dark" data-action="start">${session?'继续学习':'开启今日学习'} ${icon('arrow')}</button></div><div class="banner-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><span class="art-star star-one">✦</span><span class="art-star star-two">✦</span><div class="floating-note note-one">hello, new day <span>☀</span></div><div class="book-art"><div class="book-left"><span>one<br>word<br>at a time.</span><i></i><i></i><i></i></div><div class="book-right"><div class="plant"><b></b><b></b><b></b><b></b><em></em></div><span>keep growing</span></div></div><div class="floating-note note-two">${icon('check')} a little progress</div></div></section>${discoveryStrip(icon)}${levelBanner(state,icon)}<div class="home-grid"><div class="study-column"><section class="section study-section"><div class="section-heading"><h2>${icon('book')} 今天，记住这些</h2><div class="segmented" aria-label="练习模式"><button data-action="mode" data-mode="card" class="${mode==='card'?'selected':''}">单词卡</button><button data-action="mode" data-mode="spell" class="${mode==='spell'?'selected':''}">拼写练习</button></div></div><div class="study-meta"><label>学习词源 <select id="study-source" aria-label="学习词源">${sourceOptions()}</select></label><span>${session?`${Math.min(session.index+1,session.queue.length)} / ${session.queue.length}`:`${learningSourceWords().length} 个单词，等待相遇`}</span></div>${studyCard()}</section><section class="section decks-section"><div class="section-heading"><h2>选一本，慢慢学</h2><button class="text-button" data-action="nav" data-view="materials">导入我的课本 ${icon('arrow')}</button></div><div class="deck-grid">${DECKS.map(d=>{const ws=words().filter(w=>w.deck===d.id),n=ws.filter(w=>state.progress[w.id]).length;return `<button class="deck-card ${d.color} ${selectedSource===d.id?'deck-selected':''}" data-action="deck" data-id="${d.id}"><span class="deck-icon">${icon(d.icon)}</span><span class="deck-name">${d.name}</span><span class="deck-en">${d.en}</span><span class="deck-bottom">${n} / ${ws.length} 词 <span>${Math.round(n/ws.length*100)}%</span></span><span class="tiny-progress"><i style="width:${n/ws.length*100}%"></i></span></button>`;}).join('')}</div></section></div><aside class="right-column"><section class="panel daily-panel"><div class="section-heading"><h2>今日小目标</h2><button class="icon-button" aria-label="修改每日目标" data-action="settings">${icon('settings')}</button></div><div class="goal-ring" style="--percent:${percent}%"><div><strong>${h.learned.length}<span> / ${state.plan.goal}</span></strong><small>新词已学习</small></div></div><p class="goal-caption">${percent>=100?'今日目标达成，给自己一个赞！':'一点一滴，都是向前的痕迹'}</p><div class="mini-stats"><div><span class="stat-icon sage">${icon('check')}</span><div><strong>${h.reviewed.length}</strong><small>今日学习词数</small></div></div><div><span class="stat-icon peach">${icon('repeat')}</span><div><strong>${t.due}</strong><small>到期复习</small></div></div></div></section>${planPanel()}<section class="quote-card"><span class="quote-mark">“</span><p>A little progress<br>each day adds up<br>to big results.</p><span>每天进步一点点，<br>终会遇见更好的自己。</span><div class="quote-flower" aria-hidden="true">✦</div></section></aside></div>`;
}
function planPanel(){const days=daysUntil(state.plan.date), t=totals(); return `<section class="panel plan-panel"><div class="section-heading"><h2>${icon('target')} 我的备考计划</h2><button class="text-button" data-action="settings">${state.plan.exam?'调整':'设置'} ${icon('chevron')}</button></div>${state.plan.exam?`<strong class="exam-name">${esc(state.plan.exam)}</strong><div class="exam-count">${days!==null&&days>=0?`<b>${days}</b> 天后见证成长`:days!==null?'已到考试日期，保持学习节奏':'具体考试日期待确认'}</div><p>${state.plan.month?`备考月份 ${esc(state.plan.month.replace('-', ' 年 '))} 月<br>`:''}目标 ${state.plan.target} 词 · 每天 ${state.plan.minutes} 分钟</p>${days>0?`<div class="plan-tip">按目标还需每天掌握约 <strong>${Math.ceil(Math.max(0,state.plan.target-t.mastered)/days)}</strong> 词。${state.plan.target>t.total?`当前词库 ${t.total} 词，可继续导入资料。`:''}</div>`:''}`:'<p class="muted">考试、课本、最近读的书，<br>让你的学习有自己的方向。</p><button class="button pale full" data-action="settings">定制我的计划 '+icon('arrow')+'</button>'}</section>`;}
function currentWord(){return session?.queue[session.index]||null;}
function sourcesFor(w){return state.materials.filter(m=>m.wordIds.includes(w.id)).map(m=>m.title);}
function studyCard(){
 if(session&&session.index>=session.queue.length) return `<div class="word-card complete-card"><span class="completion-icon">${icon('check')}</span><span class="eyebrow">A LITTLE WIN FOR TODAY</span><h2>这一轮，做得很棒！</h2><p>完成 ${session.queue.length} 次练习，认识的单词又多了一点。</p><div class="completion-stats"><span><strong>${session.correct}</strong> 次熟悉</span><span><strong>${session.again}</strong> 次需要再巩固</span></div><button class="button dark" data-action="finish">回到今日学习 ${icon('arrow')}</button><button class="text-button" data-action="nav" data-view="stats">看看我的成长</button></div>`;
 const w=currentWord()||learningSourceWords()[0];
 if(!w) return `<div class="word-card empty-state">${icon('book')}<h3>当前筛选下暂无待学词</h3><p>常见基础词与认识清单已过滤。可导入更有挑战的资料，或调整筛选范围。</p><button class="button pale" data-action="level-profile">调整筛选</button><button class="button dark" data-action="import">导入学习资料 ${icon('plus')}</button></div>`;
 const reveal=Boolean(session?.revealed), favorite=state.favorites.includes(w.id), sources=sourcesFor(w), active=Boolean(session);
 const hideWord=mode==='spell'&&active;
 return `<article class="word-card ${reveal?'revealed':''}"><div class="card-top"><span class="source-tag">${icon('book')} ${esc(state.materials.find(m=>m.id===selectedSource)?.title||sources[0]||DECKS.find(d=>d.id===w.deck)?.name||'我的词库')}</span><button class="icon-button favorite ${favorite?'is-favorite':''}" data-action="favorite" data-id="${esc(w.id)}" aria-label="${favorite?'取消收藏':'收藏'} ${esc(w.word)}" aria-pressed="${favorite}">${icon('star')}</button></div><div class="word-center"><span class="word-label">${hideWord?'用英文写下这个意思':'TODAY’S LITTLE DISCOVERY'}</span><h2 class="main-word ${hideWord?'spelling-meaning':''}">${hideWord?esc(w.meaning):esc(w.word)}</h2>${hideWord?`<form id="spell-form"><label class="sr-only" for="spelling">输入英文单词</label><input id="spelling" name="spelling" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入你的答案…" ${reveal?'disabled':''}><button type="submit" class="button dark" ${reveal?'disabled':''}>检查 ${icon('arrow')}</button></form>${session.spellResult?`<div class="spell-result ${session.spellCorrect?'correct':'incorrect'}">${esc(session.spellResult)}</div>`:''}`:`<div class="pronunciation"><span>${esc(w.ipa||'点击右侧听发音')}</span><button class="sound-button" data-action="speak" data-id="${esc(w.id)}" aria-label="播放 ${esc(w.word)} 的发音">${icon('volume')}</button></div>`}<div class="meaning ${reveal?'show-meaning':''}">${reveal?`<span class="part-of-speech">${esc(w.pos)}</span><strong>${esc(hideWord?w.word:w.meaning)}</strong>`:`<span class="meaning-placeholder">先想一想，它的意思是？</span>`}</div></div><div class="example-box"><span class="example-label">${icon('sparkle')} ${w.classTags?'课堂里的词句':'在语境里，遇见单词'}</span><p class="example-en">${highlight(w.example||'添加一条例句，让这个单词更好记。',w.word,hideWord&&!reveal)}</p><p class="example-zh ${reveal?'':'hidden-translation'}">${reveal?esc(w.translation||(w.example&&state.materials.some(m=>m.id===selectedSource)?'来自你的资料原文 · 试着自己理解这句话。':'这份资料没有提供该词的例句，可稍后补充。')):'回想它在句子里的意思，再揭晓答案。'}</p>${sentenceCredit(w)}<button class="text-button dictionary-mini" data-action="lookup-word" data-word="${esc(w.word)}">${icon('search')} 查词义与用法</button><button class="text-button dictionary-mini" data-action="word-known" data-word="${esc(w.word)}">${icon('check')} 已认识，跳过这个词</button>${reveal&&w.studyNote?`<p class="usage-note">学习提示：${esc(w.studyNote)}</p>`:''}</div><div class="card-actions">${reveal?`<span class="rating-label">这一次，记得怎么样？</span><div class="rating-buttons">${[[1,'再学一次','10 分钟'],[2,'有点模糊','1 天'],[3,'记住了',`${w&&state.progress[w.id]?.interval?Math.max(3,Math.round(state.progress[w.id].interval*2.2)):3} 天`],[4,'很熟悉',`${w&&state.progress[w.id]?.interval?Math.max(7,Math.round(state.progress[w.id].interval*3)):7} 天`]].map(([n,label,when])=>`<button data-action="rate" data-rating="${n}" class="rating rating-${n}"><span>${label}</span><small>${when}后复习</small><kbd>${n}</kbd></button>`).join('')}</div>`:`<button class="button reveal-button" data-action="reveal">${icon('sparkle')} ${hideWord?'直接看答案':'揭晓释义'} <kbd>空格</kbd></button><small class="card-hint">${active?'先主动回忆，再查看答案，记忆会更牢固。':'点击「开启今日学习」，让今天的积累开始。'}</small>`}</div></article>`;
}
function highlight(text,word,hide=false){if(!word)return esc(text);const regex=new RegExp(wordPattern(word),'gi');let out='',last=0;for(const match of text.matchAll(regex)){out+=esc(text.slice(last,match.index))+(hide?'<span class="cloze">________</span>':'<mark>'+esc(match[0])+'</mark>');last=match.index+match[0].length;}return out+esc(text.slice(last));}
function pageHeading(eyebrow,title,desc,button=''){return `<section class="greeting inner-greeting"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${desc}</p></div>${button}</section>`;}
function review(){const t=totals(),due=learningWords(words(),state).filter(w=>state.progress[w.id]?.due<=Date.now()),upcoming=learningWords(words(),state).filter(w=>state.progress[w.id]?.due>Date.now()).sort((a,b)=>state.progress[a.id].due-state.progress[b.id].due);return `${pageHeading('MAKE IT STICK','温故，才能知新。','在恰好的时间再见一次，让单词真正留下来。')}<div class="review-banner"><div class="review-art">${icon('repeat')}</div><div><span class="eyebrow">YOUR MEMORY GARDEN</span><h2>${t.due?`${t.due} 个单词，等你再见一面`:'现在没有到期的复习词'}</h2><p>${t.due?'忘记很正常，再想起一次，就是新的进步。':'你可以先学习新词，系统会安排下一次相遇。'}</p></div><button class="button dark" data-action="review-start" ${!due.length?'disabled':''}>开始复习 ${icon('arrow')}</button></div><section class="panel"><div class="section-heading"><h2>${due.length?'待复习单词':'接下来的复习'}</h2><span class="muted">间隔复习，长久记住</span></div>${wordRows(due.length?due:upcoming.slice(0,10),true)}</section>`;}
function wordRows(list,showDue=false){return list.length?`<div class="word-table"><div class="table-head"><span>单词 / WORD</span><span>释义</span><span>${showDue?'复习时间':'学习状态'}</span><span>操作</span></div>${list.map(w=>{const p=state.progress[w.id],status=statusOf(p);return `<div class="word-row"><div><button class="word-title" data-action="detail" data-id="${esc(w.id)}">${esc(w.word)}</button><small>${esc(w.ipa)}</small></div><span class="table-meaning">${esc(w.meaning)}</span><span class="status ${status}">${showDue&&p?(p.due<=Date.now()?'现在复习':new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric'}).format(new Date(p.due))):({new:'未学习',learning:'巩固中',mastered:'已掌握'})[status]}</span><div class="row-actions"><button class="icon-button" data-action="speak" data-id="${esc(w.id)}" aria-label="播放 ${esc(w.word)} 的发音">${icon('volume')}</button><button class="icon-button favorite ${state.favorites.includes(w.id)?'is-favorite':''}" data-action="favorite" data-id="${esc(w.id)}" aria-label="收藏 ${esc(w.word)}" aria-pressed="${state.favorites.includes(w.id)}">${icon('star')}</button></div></div>`;}).join('')}</div>`:'<div class="empty-state compact">'+icon('book')+'<h3>还没有单词</h3><p>导入资料或开启今日学习，慢慢建立你的记忆花园。</p></div>';}
function library(){let list=sourceWords().filter(w=>(filter==='all'||filter==='favorites'&&state.favorites.includes(w.id)||statusOf(state.progress[w.id])===filter)&&`${w.word} ${w.meaning}`.toLowerCase().includes(query.toLowerCase()));return `${pageHeading('WORDS THAT BELONG TO YOU','每个单词，都有来处。','收藏阅读里的心动表达，也记下备考途中需要的词。',`<button class="button dark" data-action="add-word">${icon('plus')} 添加单词</button>`)}<section class="panel library-panel"><div class="library-tools"><div class="search-field">${icon('search')}<input id="word-search" aria-label="搜索单词或释义" placeholder="搜索单词或中文释义…" value="${esc(query)}"></div><select id="library-source" aria-label="筛选单词来源">${sourceOptions()}</select></div><div class="filter-row">${[['all','全部'],['new','未学习'],['learning','巩固中'],['mastered','已掌握'],['favorites','我的收藏']].map(([id,label])=>`<button data-action="filter" data-filter="${id}" class="filter-chip ${id===filter?'selected':''}">${label}</button>`).join('')}<span class="result-count">共 ${list.length} 个单词</span></div>${wordRows(list)}</section>`;}
function materials(){return `${pageHeading('YOUR BOOKS. YOUR WORDS.','把正在读的，变成记得的。','课本、备考资料、最近的书与杂志，都可以成为你的专属词库。',`<button class="button dark" data-action="import">${icon('plus')} 导入学习资料</button>`)}<section class="material-hero"><div class="material-illustration">${icon('folder')}<span>your reading corner</span></div><div><span class="eyebrow">LEARN FROM WHAT YOU LOVE</span><h2>学习不必从零开始，<br>就从你手边的那一页开始。</h2><p>导入 EPUB / PDF / TXT，或粘贴文章 → 选择想学的词 → 自动加入学习与复习。</p><span class="privacy-note">${icon('shield')} 文件在浏览器中解析，无需上传服务器</span></div></section><div class="section-heading material-heading"><h2>我的资料架 <span class="count-badge">${state.materials.length}</span></h2><span class="muted">重新导入同一资料，可更新词单；学习进度会保留</span></div><div class="materials-grid">${state.materials.map(m=>`<article class="material-card"><div class="material-cover ${m.type==='reading'?'peach':m.type==='exam'?'lilac':'sage'}">${icon(m.type==='reading'?'coffee':m.type==='exam'?'graduation':'book')}<span>${({textbook:'TEXTBOOK',reading:'READING',exam:'EXAM PREP'})[m.type]}</span></div><div class="material-card-body"><span class="source-tag">${({textbook:'我的课本',reading:'近期阅读',exam:'备考资料'})[m.type]}</span><h3>${esc(m.title)}</h3><p>${m.updated?`${m.wordIds.length} 个学习词 · ${new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric'}).format(new Date(m.updated))}更新`:'已按你的阅读计划添加 · 待导入正文'}</p>${m.id==='material-textbook'&&courseLibrary?`<button class="button pale full" data-action="nav" data-view="course">${icon('graduation')} Unit 1 · 课堂资料与例句</button>`:''}<div class="chapter-source">${m.chapters?`<label>学习章节<select data-material-chapter="${esc(m.id)}" aria-label="${esc(m.title)} 的学习章节"><option value="">全部已导入章节</option>${Object.values(m.chapters).map(c=>`<option value="${esc(c.id)}" ${m.activeChapter===c.id?'selected':''}>${esc(c.title)} · ${c.wordIds.length} 词</option>`).join('')}</select></label>`:''}</div>${readingBook&&m.id==='material-reading'?`<button class="button pale full" data-action="read-book">${icon('book')} 整本书 / 自选章节 · ${readingBook.chapters.length} 部分</button>`:''}<div class="material-actions"><button class="text-button" data-action="${m.wordIds.length?'material-study':'reimport'}" data-id="${esc(m.id)}">${m.wordIds.length?'开始学习':'导入章节'} ${icon('arrow')}</button><button class="icon-button" data-action="reimport" data-id="${esc(m.id)}" aria-label="更新 ${esc(m.title)}">${icon('upload')}</button><button class="icon-button danger" data-action="delete-material" data-id="${esc(m.id)}" aria-label="移除 ${esc(m.title)}">${icon('trash')}</button></div>${safeUrl(m.url)?`<a class="source-link" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">打开原文 ↗</a>`:''}</div></article>`).join('')}<button class="material-card add-material" data-action="import"><span>${icon('plus')}</span><h3>给资料架添一本</h3><p>一本课本，一篇好文章，<br>都是学习的新起点。</p></button></div><div class="sync-note">${icon('repeat')}<div><strong>关于“同步”</strong><p>导入后的单词会关联原资料，并进入同一份学习计划。资料内容更新后需重新导入；暂不自动连接学校平台、网盘或杂志账号。跨设备可以通过设置中的备份导入 / 导出迁移。</p></div></div>`;}
function safeUrl(s){try{return ['http:','https:'].includes(new URL(s).protocol);}catch{return false;}}
function stats(){const t=totals(),keys=Object.keys(state.history).filter(k=>state.history[k].attempts),attempts=Object.values(state.history).reduce((s,h)=>s+h.attempts,0),correct=Object.values(state.history).reduce((s,h)=>s+h.correct,0);const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {key:dayKey(d),name:new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(d),count:state.history[dayKey(d)]?.reviewed.length||0};});const max=Math.max(5,...days.map(d=>d.count));return `${pageHeading('LOOK HOW FAR YOU’VE COME','每一点坚持，都有回响。','这些小小的数字，记录着你走过的每一步。')}<div class="stats-grid">${[[t.learned,'累计学习单词','book','sage'],[t.mastered,'达到掌握标准','check','peach'],[streak(state.history),'连续学习天数','flame','lilac'],[attempts?Math.round(correct/attempts*100)+'%':'—','自评熟悉率','target','sage']].map(([n,l,i,c])=>`<section class="panel stat-tile"><span class="stat-icon ${c}">${icon(i)}</span><strong>${n}</strong><span>${l}</span></section>`).join('')}</div><div class="stats-two"><section class="panel chart-panel"><div class="section-heading"><h2>这一周的脚步</h2><span class="muted">每天学习的不同单词数</span></div><div class="bar-chart">${days.map(d=>`<div class="bar-column"><span>${d.count}</span><div class="bar-track"><i style="height:${d.count/max*100}%" class="${d.key===dayKey()?'today-bar':''}"></i></div><small>${d.name}</small></div>`).join('')}</div></section><section class="panel"><div class="section-heading"><h2>记忆花园</h2>${icon('leaf')}</div><div class="mastery-number"><strong>${t.total?Math.round(t.mastered/t.total*100):0}%</strong><span>词库掌握率</span></div><div class="mastery-bar"><i style="width:${t.mastered/t.total*100}%"></i><b style="width:${(t.learned-t.mastered)/t.total*100}%"></b></div><div class="mastery-legend"><span><i class="green-dot"></i> 已掌握 ${t.mastered}</span><span><i class="yellow-dot"></i> 巩固中 ${t.learned-t.mastered}</span><span><i class="gray-dot"></i> 未学习 ${t.total-t.learned}</span></div><p class="stats-note">累计学习 ${keys.length} 天 · 练习 ${attempts} 次<br>连续 3 次自评记住，且复习间隔达到 7 天，标为已掌握。自评熟悉率来自你的记忆评分。</p></section></div>`;}
function start(reviewOnly=false, explicit=null){if(reviewOnly)selectedSource='all';const list=explicit||makeQueue(learningSourceWords(reviewOnly?'all':selectedSource),state,Date.now(),reviewOnly);if(!list.length){toast(reviewOnly?'现在没有到期单词，可以先学习新词':'当前词源没有待复习词，或今日新词目标已完成。可换一个词源或在词库中单独练习。');return;}session={queue:list,index:0,revealed:false,correct:0,again:0,retries:{},spellResult:'',spellCorrect:false};view='home';render();document.querySelector('.study-section')?.scrollIntoView({behavior:'smooth',block:'start'});}
function reveal(){if(!session){const list=makeQueue(learningSourceWords(),state);if(!list.length){toast('今日任务已完成，或当前词源暂无待学单词');return;}session={queue:list,index:0,revealed:false,correct:0,again:0,retries:{},spellResult:'',spellCorrect:false};}session.revealed=true;render();}
function rate(rating){const w=currentWord();if(!w||!session.revealed)return;recordRating(state,w.id,rating);if(rating<3)markKnowledge(state,w.word,false);if(rating>=3)session.correct++;if(rating===1){session.again++;const n=session.retries[w.id]||0;if(n<1){session.retries[w.id]=n+1;session.queue.push(w);}}save();session.index++;session.revealed=false;session.spellResult='';session.spellCorrect=false;render();}
function speak(id,text=null){const w=words().find(w=>w.id===id);const spoken=text||w?.word;if(!spoken)return;if(!('speechSynthesis'in window)){toast('当前浏览器不支持发音，请尝试 Chrome、Edge 或 Safari');return;}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(spoken);u.lang='en-GB';u.rate=.85;const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>v.lang==='en-GB')||voices.find(v=>v.lang.startsWith('en'));if(voice)u.voice=voice;u.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))toast('发音暂时不可用，请检查设备的英语语音包或网络');};window.speechSynthesis.speak(u);}
function openModal(content,wide=false){lastFocus=document.activeElement;modal.className=wide?'wide-modal':'';modal.innerHTML=`<button class="modal-close icon-button" data-action="close-modal" aria-label="关闭弹窗">${icon('close')}</button>${content}`;if(!modal.open)modal.showModal();setTimeout(()=>modal.querySelector('input:not([type=file]), textarea, select, button:not(.modal-close)')?.focus(),0);}
function closeModal(){modal.close();lastFocus?.focus();}
function settings(){openModal(`<span class="eyebrow">MAKE IT YOURS</span><h2 id="modal-title">按你的节奏，安排学习</h2><p class="modal-intro">把考试日期、目标和每天能留给英语的时间记下来。</p><form data-form="settings"><label>考试 / 学习目标<input name="exam" maxlength="100" placeholder="例如：大学英语四级、雅思 6.5、提升阅读" value="${esc(state.plan.exam)}"></label><div class="form-two"><label>备考月份<input name="month" type="month" value="${esc(state.plan.month||'')}"></label><label>目标词汇量<input name="target" type="number" min="1" max="50000" value="${state.plan.target}" required></label></div><label>具体考试日期（公布后填写，可选）<input name="date" type="date" value="${esc(state.plan.date)}"></label><div class="form-two"><label>每日新词<input name="goal" type="number" min="1" max="100" value="${state.plan.goal}" required></label><label>每日学习时间 / 分钟<input name="minutes" type="number" min="1" max="180" value="${state.plan.minutes}" required></label></div><p class="field-hint">新词按每日目标分配；到期复习会优先加入。考试倒计时建议根据目标词汇量计算。学习时间用于计划提醒，不限制练习。</p><button class="button dark full" type="submit">保存我的计划 ${icon('check')}</button></form><div class="backup-section"><h3>学习数据备份</h3><p>进度保存在当前浏览器，不会自动跨设备同步。换设备前，请先导出备份。</p><div class="backup-buttons"><button class="button outline" data-action="export">${icon('download')} 导出备份</button><button class="button outline" data-action="import-backup">${icon('upload')} 恢复备份</button></div><button class="button pale full" data-action="level-profile">词汇水平与基础词过滤</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div>`);}
function wordForm(id=null,prefill=null){const w=id?words().find(w=>w.id===id):null, values=w||prefill, dictSource=values?.dictionarySource;const custom=w?.deck==='custom';openModal(`<span class="eyebrow">A WORD WORTH KEEPING</span><h2 id="modal-title">${w?'单词详情':'收下一个新单词'}</h2><form data-form="word" data-id="${esc(w?.id||'')}"><div class="form-two"><label>英文单词<input name="word" required maxlength="80" value="${esc(values?.word||'')}" ${w&&!custom?'readonly':''}></label><label>音标（可选）<input name="ipa" maxlength="100" value="${esc(values?.ipa||'')}" ${w&&!custom?'readonly':''}></label></div><div class="form-two"><label>词性<input name="pos" maxlength="30" placeholder="例如：n. / v." value="${esc(values?.pos||'')}" ${w&&!custom?'readonly':''}></label><label>释义<input name="meaning" required maxlength="500" value="${esc(values?.meaning||'')}" ${w&&!custom?'readonly':''}></label></div><label>例句<textarea name="example" maxlength="1000" rows="2" ${w&&!custom?'readonly':''}>${esc(values?.example||'')}</textarea></label><label>例句翻译<textarea name="translation" maxlength="1000" rows="2" ${w&&!custom?'readonly':''}>${esc(values?.translation||'')}</textarea></label>${w?`<p class="field-hint">来源：${esc([...sourcesFor(w),DECKS.find(d=>d.id===w.deck)?.name||'自建词库'].join(' · '))}</p><button type="button" class="button pale full" data-action="single-study" data-id="${esc(w.id)}">单独练习这个词 ${icon('arrow')}</button>`:''}${!w||custom?`<button class="button dark full" type="submit">${w?'保存修改':'加入我的词库'} ${icon('check')}</button>`:''}${dictSource?`<div class="dictionary-source">收词来源：WordNet 3.0 · ${esc(dictSource.lemma)} · ${esc(dictSource.synset)}<br>当前学习释义由你确认，可改成适合自己的中文或英文。<input type="hidden" name="dictionaryLemma" value="${esc(dictSource.lemma)}"><input type="hidden" name="dictionarySynset" value="${esc(dictSource.synset)}"><input type="hidden" name="dictionaryDefinition" value="${esc(dictSource.definition)}"></div>`:''}</form>${w?`<button class="text-button dictionary-mini" data-action="lookup-word" data-word="${esc(w.word)}">${icon('search')} 打开词典查用法</button>`:''}${w?`<div class="word-knowledge-actions"><button type="button" class="button pale" data-action="word-known" data-word="${esc(w.word)}">这个词我已认识，不再推荐</button><button type="button" class="button outline" data-action="word-unknown" data-word="${esc(w.word)}">还不熟，保留学习</button></div>`:''}${w?exampleDetails(w):''}`);}
function importMaterial(id=null){
 editingMaterial=id;draft=null;epubState=null;selectionTicket++;
 const m=state.materials.find(m=>m.id===id);
 openModal(`<span class="eyebrow">BRING YOUR OWN READING</span><h2 id="modal-title">${m?'更新学习资料':'给学习，带一点自己的内容'}</h2><p class="modal-intro">整本EPUB、多个章节或课件页面，可以统一筛词；词汇保留各章节的原句。</p><form data-form="material-extract"><label>资料名称<input name="title" required maxlength="100" value="${esc(m?.title||'')}" placeholder="例如：Everything I Know About Love"></label><div class="form-two"><label>资料类型<select name="type">${[['textbook','课本'],['exam','备考资料'],['reading','书籍 / 杂志 / 文章']].map(([key,label])=>`<option value="${key}" ${m?.type===key?'selected':''}>${label}</option>`).join('')}</select></label><label>原文网址（可选）<input type="url" name="url" maxlength="1000" value="${esc(m?.url||'')}"></label></div><label class="upload-box">${icon('upload')}<strong>选择整本EPUB、PDF、课件或Word</strong><span>PPTX / DOCX / EPUB / PDF / TXT / MD，最大20MB</span><input type="file" id="material-file" accept=".pptx,.docx,.epub,.pdf,.txt,.md"></label><div id="file-status" class="field-hint" role="status"></div><div id="chapter-picker"></div><label>正文 / 章节预览<textarea name="text" id="material-text" rows="6" placeholder="也可以粘贴英文文章…"></textarea></label><p class="field-hint">整本/多章在浏览器逐章统计，不拼入预览框。每轮最多500部分、300万字符，超出会提示分批选择。当前过滤：${profileOf(state).enabled?profileOf(state).cutoff+' 常用词头':'仅认识清单'}；答错或标记不熟的词优先保留。</p><button type="submit" id="extract-button" class="button dark full">智能筛选我要学的词 ${icon('arrow')}</button></form>`,true);
}
function syncCandidateInputs(){
 if(!draft?.selected)return;
 for(const input of modal.querySelectorAll('[name=candidate]')){const i=Number(input.value);input.checked?draft.selected.add(i):draft.selected.delete(i);}
 for(const input of modal.querySelectorAll('[data-candidate-meaning]'))draft.meanings[Number(input.dataset.candidateMeaning)]=input.value;
}
function recommendCandidates(){
 draft.selected=new Set();
 for(let i=0;i<draft.candidates.length;i++){const c=draft.candidates[i];c.reason=exclusionReason(c.known||c.word,state);if(!c.reason&&c.known&&(!c.likelyName||profileOf(state).unknown.includes(c.lemma))&&draft.selected.size<80)draft.selected.add(i);}
}
function candidateModal(){
 const eligible=draft.candidates.filter(c=>!c.reason).length;
 const visible=draft.candidates.map((c,i)=>({c,i})).filter(({c})=>(draft.showExcluded||!c.reason)&&(!draft.search||c.word.toLowerCase().includes(draft.search.toLowerCase())));
 const pages=Math.max(1,Math.ceil(visible.length/80));draft.page=Math.min(draft.page,pages-1);
 const page=visible.slice(draft.page*80,draft.page*80+80);
 openModal(`<span class="eyebrow">YOUR LEVEL. YOUR NEXT WORDS.</span><h2 id="modal-title">从「${esc(draft.title)}」里，收下更适合的词</h2><p class="modal-intro">${draft.sections.length} 个文字部分已完整参与统计；所有章节共享词条，分别保留原句。默认选中前80个匹配释义且未被过滤的词，可自行调整。</p><form data-form="material-save"><div class="smart-filter-bar"><label>基础词过滤<select id="candidate-cutoff">${cutoffOptions(profileOf(state).enabled?profileOf(state).cutoff:0)}</select></label><p class="smart-filter-summary">归并后共 ${draft.candidates.length} 个候选词族 · 过滤 ${draft.candidates.length-eligible} 个 · 可选 ${eligible} 个。词频只参与未过滤词的排序，不再优先勾选简单词。修改范围会重算默认选择。</p></div><div class="candidate-view-tools"><button type="button" class="text-button" data-action="select-matched">智能选择前80词</button><button type="button" class="text-button" data-action="candidate-clear">清空选择</button><label class="inline-check"><input type="checkbox" id="candidate-show-excluded" ${draft.showExcluded?'checked':''}> 查看被过滤词，可手动加回</label></div><label class="sr-only" for="candidate-search">查找本书候选词</label><input class="candidate-search" id="candidate-search" placeholder="搜索候选词，包含所有章节…" value="${esc(draft.search)}"><div class="candidate-list smart-candidates">${page.length?page.map(({c,i})=>`<div class="candidate-row"><input type="checkbox" name="candidate" value="${i}" aria-label="选择 ${esc(c.word)}" ${draft.selected.has(i)?'checked':''}><div><strong>${esc(c.word)}</strong><small>出现 ${c.count} 次 · ${Object.keys(c.contexts).length} 个部分${c.rank?' · 常用度 '+c.rank:''}</small><small class="candidate-source ${c.reason?'candidate-reason':''}">${esc(c.reason||(c.personalWeak?'个人不熟词 · '+c.source:c.likelyName?'疑似专名（默认不选）':c.source))}${c.known?' · 已匹配释义':''}</small></div><input data-candidate-meaning="${i}" name="meaning-${i}" aria-label="${esc(c.word)} 的释义" maxlength="500" placeholder="补充释义后勾选" value="${esc(draft.meanings[i]||'')}" ${c.known&&(!c.known.dictionarySource||words().some(w=>w.id===c.known.id))?'readonly':''}><button type="button" class="candidate-known" data-action="candidate-known" data-index="${i}" title="标记已认识并排除">会了</button></div>`).join(''):'<p class="dictionary-message">当前筛选下没有候选词。可降低过滤范围，或查看被过滤词并加回不熟的词。</p>'}</div><div class="candidate-pager"><button type="button" class="button outline" data-action="candidate-page" data-direction="-1" ${draft.page===0?'disabled':''}>上一页</button><span>${draft.page+1} / ${pages} 页 · ${visible.length} 词</span><button type="button" class="button outline" data-action="candidate-page" data-direction="1" ${draft.page+1>=pages?'disabled':''}>下一页</button></div><p class="candidate-selected-count" id="selection-count">已选 ${draft.selected.size} 个词（包含其他页的选择）</p><p class="field-hint">WordNet提供英文义项，可能与当前原句的词义不同，可修改或到词典核对。手动加回的过滤词会标为“不熟”，继续进入学习；认识清单可在首页调整。</p><p id="candidate-error" class="form-error" role="alert"></p><button class="button dark full" type="submit">保存到资料架，并加入学习 ${icon('check')}</button></form>`,true);
}

async function readMaterial(file){
 const status=document.querySelector('#file-status'),button=document.querySelector('#extract-button');
 if(file.size>20*1024*1024){status.textContent='文件超过20MB，请拆分文件。';return;}
 button.disabled=true;status.textContent='正在读取文件…';epubState=null;document.querySelector('#chapter-picker').innerHTML='';document.querySelector('#material-text').readOnly=false;
 try{
  if(/\.(pptx|docx)$/i.test(file.name)){
   const {parseOffice}=await import('./office.js'),doc=parseOffice(await file.arrayBuffer(),file.name);doc.type='textbook';
   if(doc.chapters.length>1||doc.chapters[0].text.length>120000){setupChapterPicker(doc);return;}
   document.querySelector('#material-text').value=doc.chapters[0].text;status.textContent=doc.note+' 已读取文字，可直接统一筛词。';
  }else if(/\.epub$/i.test(file.name)){
   const {parseEpub}=await import('./epub.js');setupChapterPicker(await parseEpub(await file.arrayBuffer()));return;
  }else if(/\.pdf$/i.test(file.name)){
   const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';
   const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
   const chapters=[];let characters=0;
   try{
    if(pdf.numPages>200)throw new Error('PDF超过200页，请分批拆分后导入。');
    for(let i=1;i<=pdf.numPages;i++){
     status.textContent=`正在读取PDF，第${i}/${pdf.numPages}页…`;
     const page=await pdf.getPage(i),content=await page.getTextContent(),text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();
     characters+=text.length;if(characters>3000000)throw new Error('PDF文字超过300万字符，请拆分文件。');
     if(text.length)chapters.push({id:'pdf-page-'+i,title:'第 '+i+' 页',text});
    }
   }finally{await pdf.destroy();}
   if(characters<20)throw new Error('未提取到足够文字。这可能是扫描件，请先OCR。');
   if(chapters.length>1||characters>120000){setupChapterPicker({title:file.name.replace(/\.pdf$/i,''),type:modal.querySelector('[name=type]').value,chapters,note:'PDF按页面保留文字，可全选或多选。'});return;}
   document.querySelector('#material-text').value=chapters[0].text;status.textContent=`已读取${characters.toLocaleString()}个字符，可直接筛词。`;
  }else if(/\.(txt|md)$/i.test(file.name)){
   const text=await file.text();if(text.length>3000000)throw new Error('文本超过300万字符，请分批导入。');
   if(text.length>120000){const chunks=[];let cursor=0;while(cursor<text.length){let end=Math.min(text.length,cursor+60000);if(end<text.length){const boundary=Math.max(text.lastIndexOf(' ',end),text.lastIndexOf('\n',end));if(boundary>cursor)end=boundary+1;}chunks.push({id:'text-part-'+chunks.length,title:'文字部分 '+(chunks.length+1),text:text.slice(cursor,end)});cursor=end;}setupChapterPicker({title:file.name.replace(/\.[^.]+$/,''),type:modal.querySelector('[name=type]').value,chapters:chunks});return;}
   document.querySelector('#material-text').value=text;status.textContent=`已读取${text.length.toLocaleString()}个字符。`;
  }else throw new Error('请选择PPTX、DOCX、EPUB、PDF、TXT或MD文件。');
  const title=modal.querySelector('[name=title]');if(!title.value)title.value=file.name.replace(/\.[^.]+$/,'').slice(0,100);
 }catch(error){status.textContent=error.message.includes('password')?'PDF需要密码，请提供解锁后的文件。':`读取失败：${error.message}`;}
 finally{button.disabled=false;}
}

function downloadBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wordlane-backup-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已发起备份下载，请保管好下载的 JSON 文件');}
async function restoreBackup(file){try{if(file.size>8*1024*1024)throw new Error('备份文件过大');const restored=validateBackup(JSON.parse(await file.text()));openModal(`<h2 id="modal-title">恢复这份学习备份？</h2><p class="modal-intro">备份中有 ${restored.customWords.length} 个自建单词、${restored.materials.length} 份资料。恢复会替换当前浏览器的全部学习数据。建议先导出当前备份。</p><button class="button outline full" data-action="export">${icon('download')} 先导出当前备份</button><button id="confirm-restore" class="button dark full">确认替换并恢复</button>`);document.querySelector('#confirm-restore').onclick=()=>{state=restored;save();session=null;quiz=null;selectedSource='cet4';closeModal();render();toast('学习备份已恢复');};}catch(e){toast(`无法导入：${e.message}`);}}

async function extractSmartCandidates(fd){
 if(buildingCandidates)return;buildingCandidates=true;const ticket=++selectionTicket;
 const button=document.querySelector('#extract-button'),status=document.querySelector('#file-status');button.disabled=true;
 try{
  const title=String(fd.get('title')||'').trim(),url=String(fd.get('url')||'').trim();
  if(!title)throw new Error('请填写资料名称');if(url&&!safeUrl(url))throw new Error('网址须以http://或https://开头');
  const sections=epubState?epubState.selected.map(i=>epubState.book.chapters[i]):[{id:'pasted-text',title:'正文',text:String(fd.get('text')||'').trim()}];
  if(!sections.length||sections.every(s=>s.text.trim().length<20))throw new Error('请勾选至少一个有效部分，或提供至少20个字符的正文');
  status.textContent='正在加载选词词表，并按你的水平筛选…';
  let lexicon={};try{lexicon=(await import('./selection-lexicon.js')).SELECTION_LEXICON;}catch{if(ticket===selectionTicket)toast('选词词表未能加载，本轮匹配已有释义，其余可手动补充');}
  const existing=words(),known=[...existing,...(courseLibrary?.words||[]).filter(g=>!existing.some(w=>w.word.toLowerCase()===g.word)),...READING_GLOSSARY.filter(g=>!existing.some(w=>w.word.toLowerCase()===g.word))];
  const candidates=await analyzeSections(sections,known,state,lexicon,(done,total)=>{if(ticket===selectionTicket)status.textContent=`正在逐部分统计 ${done} / ${total}，已归并词形、排除常见词与认识清单…`;});
  if(ticket!==selectionTicket||!modal.open)return;
  if(!candidates.length)throw new Error('没有找到可筛选的英文词，请检查正文');
  draft={title,type:fd.get('type'),url,candidates,sections,sectioned:Boolean(epubState),batch:Boolean(epubState?.batch),page:0,search:'',showExcluded:false,meanings:Object.fromEntries(candidates.map((c,i)=>[i,c.known?.meaning||'']))};
  recommendCandidates();candidateModal();
 }catch(error){if(ticket===selectionTicket){status.textContent=error.message;toast(error.message);}}
 finally{buildingCandidates=false;if(ticket===selectionTicket&&document.querySelector('#extract-button'))document.querySelector('#extract-button').disabled=false;}
}
function saveSmartCandidates(){
 syncCandidateInputs();const selected=[...draft.selected],error=document.querySelector('#candidate-error');
 if(!selected.length){error.textContent='请至少选择一个想学的单词。';return;}
 if(selected.length>500){error.textContent='每轮最多保存500词，请分批选择。';return;}
 if(selected.some(i=>!draft.meanings[i]?.trim())){error.textContent='请为所有勾选的单词补充释义，或取消勾选。';return;}
 const newWords=[],chosen=[];
 for(const i of selected){const c=draft.candidates[i],existing=words().concat(newWords).find(w=>w.word.toLowerCase()===c.word.toLowerCase());
  const w=existing||{...(c.known||{}),id:c.known?.id||`custom-${crypto.randomUUID()}`,deck:'custom',word:c.word,ipa:c.known?.ipa||'',pos:c.known?.pos||'',meaning:draft.meanings[i].trim(),example:c.sentence,translation:c.known?.example===c.sentence?c.known.translation||'':''};
  if(!existing)newWords.push(w);chosen.push({c,w});
 }
 if(state.customWords.length+newWords.length>10000){error.textContent='自建词库最多10000词，请先整理词库。';return;}
 const previous=state.materials.find(m=>m.id===editingMaterial);
 let m={...previous,id:editingMaterial||`material-${crypto.randomUUID()}`,title:draft.title,type:draft.type,url:draft.url,updated:Date.now(),wordIds:chosen.map(x=>x.w.id),contexts:Object.fromEntries(chosen.map(x=>[x.w.id,x.c.sentence]))};
 if(!draft.sectioned){delete m.chapters;delete m.activeChapter;}
 if(draft.sectioned){
  m={...m,chapters:previous?.chapters||{}};
  for(const section of draft.sections){const local=chosen.filter(x=>x.c.contexts[section.id]);const old=m.chapters[section.id];
   m=mergeMaterialChapter(m,{id:section.id,title:section.title,wordIds:[...new Set([...(old?.wordIds||[]),...local.map(x=>x.w.id)])],contexts:{...old?.contexts,...Object.fromEntries(local.map(x=>[x.w.id,x.c.contexts[section.id]]))}});
  }
  if(Object.keys(m.chapters).length>500){error.textContent='同一资料最多500部分，请另建一份资料。';return;}
  if(draft.batch)m.activeChapter='';
 }
 state.customWords.push(...newWords);for(const {c}of chosen)if(c.reason)markKnowledge(state,c.word,false);
 state.materials=state.materials.filter(x=>x.id!==m.id).concat(m);save();selectedSource=m.id;session=null;view='materials';closeModal();draft=null;epubState=null;render();toast(`已关联 ${m.wordIds.length} 个词，章节原句与原学习记录均已保留`);
}

document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const {action,id}=el.dataset;if(el.disabled)return;
 if(action==='nav'){e.preventDefault();if(modal.open)closeModal();view=el.dataset.view;query='';render();window.scrollTo({top:0,behavior:'smooth'});}
 else if(action==='more')openModal(`<h2 id="modal-title">我的学习空间</h2><p class="modal-intro">课本、阅读、词库与成长，都在这里。</p><div class="more-menu">${nav.map(([id,i,label])=>`<button data-action="nav" data-view="${id}">${icon(i)} ${label} ${icon('chevron')}</button>`).join('')}<button data-action="settings">${icon('settings')} 学习设置与备份 ${icon('chevron')}</button></div>`);
 else if(action==='lookup-word'){if(modal.open)closeModal();searchDictionary(el.dataset.word);window.scrollTo({top:0,behavior:'smooth'});}
 else if(action==='dictionary-retry')searchDictionary(dictionaryTerm);
 else if(action==='dictionary-more'){dictionaryVisible=dictionaryResult.senses.length;render();}
 else if(action==='dictionary-speak')speak(null,dictionaryResult?.lemma||dictionaryTerm);
 else if(action==='dictionary-add'){
  const sense=dictionaryResult?.senses[Number(el.dataset.sense)];if(!sense)return;
  const existing=words().find(w=>w.word.toLowerCase()===dictionaryResult.lemma.toLowerCase());
  if(existing){toast('这个词已在词库里，可以查看或编辑自己的释义');wordForm(existing.id);}
  else wordForm(null,{word:dictionaryResult.lemma,meaning:sense.definition.slice(0,500),ipa:'',pos:({n:'n.',v:'v.',a:'adj.',s:'adj.',r:'adv.'})[sense.pos]||'',example:sense.examples[0]?.slice(0,1000)||'',translation:'',dictionarySource:{name:'WordNet',version:'3.0',lemma:dictionaryResult.lemma,synset:sense.id,definition:sense.definition}});
 }
 else if(action==='quiz-start'){
  const type=el.dataset.type,pool=type==='daily'?learningWords(words(),state):type==='mistakes'?words().filter(w=>state.activities?.mistakes?.[w.id]):learningWords(sourceWords(practiceSource),state);
  const next=createQuiz(type,pool,words());
  if(!next.questions.length){toast(type==='context'?'这份词源暂时没有适合出题的原句，可先导入资料或换一个词源':'暂无可练习的词，请先积累词汇');return;}
  quiz={...next,startXp:activityStats(state).xp};render();document.querySelector('#active-quiz')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 else if(action==='quiz-answer'){
  const q=quiz?.questions[quiz.index],choice=Number(el.dataset.option);if(!q||quiz.answers[quiz.index]||!Number.isInteger(choice)||choice<0||choice>=q.options.length)return;
  const correct=choice===q.correctIndex;quiz.answers.push({choice,correct});recordQuizAnswer(state,q,correct);if(!correct)markKnowledge(state,q.word,false);completeQuiz(state,quiz);save();render();
 }
 else if(action==='quiz-next'){if(!quiz?.answers[quiz.index])return;quiz.index++;render();document.querySelector('#active-quiz')?.scrollIntoView({behavior:'smooth',block:'start'});}
 else if(action==='quiz-close'){quiz=null;render();}
 else if(action==='start')session&&session.index<session.queue.length?(document.querySelector('.study-section')?.scrollIntoView({behavior:'smooth'})):start();
 else if(action==='review-start')start(true);
 else if(action==='finish'){session=null;render();}
 else if(action==='deck'){selectedSource=id;session=null;render();}
 else if(action==='mode'){mode=el.dataset.mode;if(session){session.revealed=false;session.spellResult='';}render();}
 else if(action==='reveal')reveal();
 else if(action==='rate')rate(Number(el.dataset.rating));
 else if(action==='speak')speak(id);
 else if(action==='favorite'){state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();render();}
 else if(action==='level-profile')openModal(profileMarkup(state),true);
 else if(action==='level-result')openModal(resultMarkup(state),true);
 else if(action==='level-start'||action==='level-restart'){
  const p=profileOf(state);if(!p.draft||action==='level-restart'){p.draft={seed:crypto.randomUUID(),answers:[]};state.learningProfile=p;save();}openModal(assessmentMarkup(state),true);
 }
 else if(action==='level-answer'){
  const p=profileOf(state),choice=Number(el.dataset.choice);if(!p.draft||!Number.isInteger(choice)||choice<0||choice>4)return;
  p.draft.answers.push(choice);if(p.draft.answers.length===30){p.result=assessmentResult(p.draft.seed,p.draft.answers);delete p.draft;state.learningProfile=p;save();openModal(resultMarkup(state),true);}else{state.learningProfile=p;save();openModal(assessmentMarkup(state),true);}
 }
 else if(action==='level-apply'){applyAssessment(state);save();session=null;quiz=null;closeModal();render();toast('已应用测评建议，答错与不确定词会保留学习');}
 else if(action==='word-known'||action==='word-unknown'){
  markKnowledge(state,el.dataset.word,action==='word-known');save();if(modal.open)closeModal();if(session&&currentWord()?.word===el.dataset.word){session.index++;session.revealed=false;}render();toast(action==='word-known'?'已加入认识清单，不再自动推荐；可在筛选设置恢复':'已标记不熟，继续保留在学习范围');
 }
 else if(action==='batch-all'||action==='batch-toggle'){
  if(!epubState)return;epubState.batch=true;document.querySelector('#batch-chapters').hidden=false;
  if(action==='batch-all'){epubState.selected=epubState.book.chapters.map((_,i)=>i);document.querySelectorAll('[data-batch-chapter]').forEach(c=>c.checked=true);}updateBatchStatus();
 }
 else if(action==='batch-single'){if(!epubState)return;epubState.batch=false;epubState.selected=[epubState.index];document.querySelector('#batch-chapters').hidden=true;document.querySelectorAll('[data-batch-chapter]').forEach(c=>c.checked=Number(c.dataset.batchChapter)===epubState.index);updateBatchStatus();}
 else if(action==='batch-paste'){epubState=null;document.querySelector('#chapter-picker').innerHTML='';document.querySelector('#material-text').readOnly=false;document.querySelector('#extract-button').textContent='智能筛选粘贴文字';}
 else if(action==='candidate-page'){syncCandidateInputs();draft.page=Math.max(0,draft.page+Number(el.dataset.direction));candidateModal();}
 else if(action==='candidate-clear'){syncCandidateInputs();draft.selected.clear();candidateModal();}
 else if(action==='candidate-known'){syncCandidateInputs();const c=draft.candidates[Number(el.dataset.index)];if(!c)return;markKnowledge(state,c.word,true);save();draft.selected.delete(Number(el.dataset.index));for(const row of draft.candidates)row.reason=exclusionReason(row.known||row.word,state);candidateModal();}
 else if(action==='settings')settings();
 else if(action==='close-modal'){if(modal.querySelector('[data-form=material-extract]'))selectionTicket++;closeModal();}
 else if(action==='add-word')wordForm();
 else if(action==='detail')wordForm(id);
 else if(action==='single-study'){closeModal();start(false,[words().find(w=>w.id===id)]);}
 else if(action==='filter'){filter=el.dataset.filter;render();}
 else if(action==='import')importMaterial();
 else if(action==='reimport')importMaterial(id);
 else if(action==='course-lesson'){selectedLesson=id;courseFilter='all';render();}
 else if(action==='course-filter'){courseFilter=el.dataset.filter;render();}
 else if(action==='course-practice'){selectedSource='material-textbook';const m=state.materials.find(m=>m.id===selectedSource);if(m?.chapters?.[selectedLesson]){m.activeChapter=selectedLesson;save();start();}else toast('先点击重新同步课堂资料');}
 else if(action==='course-sync'){if(courseLibrary){syncCoursePack(state,courseLibrary,WORDS,true);save();render();toast('课堂资料已同步，已有学习进度保持不变');}}
 else if(action==='read-book'){importMaterial('material-reading');setupChapterPicker(readingBook);}
 else if(action==='material-study'){selectedSource=id;start();}
 else if(action==='delete-material'){const m=state.materials.find(m=>m.id===id);openModal(`<h2 id="modal-title">移除「${esc(m.title)}」？</h2><p class="modal-intro">仅移除资料关联，单词、收藏和学习进度会继续保留在词库中。</p><button class="button dark full" id="confirm-delete">确认移除</button>`);document.querySelector('#confirm-delete').onclick=()=>{state.materials=state.materials.filter(m=>m.id!==id);if(selectedSource===id)selectedSource='cet4';save();closeModal();render();toast('已移除资料，单词和进度已保留');};}
 else if(action==='select-matched'){syncCandidateInputs();recommendCandidates();candidateModal();}
 else if(action==='export')downloadBackup();
 else if(action==='import-backup')document.querySelector('#backup-file').click();
});
document.addEventListener('change',e=>{
 if(e.target.dataset.batchChapter!==undefined&&epubState){epubState.batch=true;epubState.selected=[...modal.querySelectorAll('[data-batch-chapter]:checked')].map(c=>Number(c.dataset.batchChapter));updateBatchStatus();}
 if(e.target.name==='candidate'){syncCandidateInputs();document.querySelector('#selection-count').textContent=`已选 ${draft.selected.size} 个词（包含其他页的选择）`;}
 if(e.target.id==='candidate-cutoff'){syncCandidateInputs();state.learningProfile={...profileOf(state),enabled:Number(e.target.value)!==0,cutoff:Number(e.target.value)};save();session=null;recommendCandidates();candidateModal();}
 if(e.target.id==='candidate-show-excluded'){syncCandidateInputs();draft.showExcluded=e.target.checked;draft.page=0;candidateModal();}
if(e.target.id==='practice-source')practiceSource=e.target.value;if(e.target.dataset.courseTask){state.courseTasks||={};state.courseTasks[e.target.dataset.courseTask]=e.target.checked;save();}if(e.target.id==='epub-chapter')selectEpubChapter(Number(e.target.value));if(e.target.dataset.materialChapter){const m=state.materials.find(m=>m.id===e.target.dataset.materialChapter);m.activeChapter=e.target.value;save();session=null;render();}if(['study-source','library-source'].includes(e.target.id)){selectedSource=e.target.value;session=null;render();}if(e.target.id==='material-file'&&e.target.files[0])readMaterial(e.target.files[0]);if(e.target.id==='backup-file'&&e.target.files[0])restoreBackup(e.target.files[0]);});
document.addEventListener('input',e=>{
 if(e.target.id==='candidate-search'){const pos=e.target.selectionStart;syncCandidateInputs();draft.search=e.target.value;draft.page=0;candidateModal();const input=document.querySelector('#candidate-search');input.focus();input.setSelectionRange(pos,pos);}
if(e.target.id==='word-search'){const pos=e.target.selectionStart;query=e.target.value;render();const input=document.querySelector('#word-search');input.focus();input.setSelectionRange(pos,pos);}});
document.addEventListener('submit',async e=>{const form=e.target;if(form.id==='spell-form'){e.preventDefault();const w=currentWord(),value=new FormData(form).get('spelling').trim();if(!w||!value){toast('先试着输入单词吧');return;}session.spellCorrect=value.toLowerCase()===w.word.toLowerCase();session.spellResult=session.spellCorrect?'拼对了！再给自己的记忆打个分。':`差一点，正确拼写是 ${w.word}。`;session.revealed=true;render();return;}if(!form.dataset.form)return;e.preventDefault();const fd=new FormData(form);
 if(form.dataset.form==='dictionary'){searchDictionary(fd.get('term'));return;}
 if(form.dataset.form==='learning-profile'){
  const parse=value=>[...new Set(String(value).split(/[\n,，;；]+/).map(w=>lemmaOf(w)).filter(Boolean))];
  const unknown=parse(fd.get('unknown')),known=parse(fd.get('known')).filter(w=>!unknown.includes(w));
  const p={...profileOf(state),enabled:fd.has('enabled'),cutoff:Number(fd.get('cutoff')),known,unknown};
  try{validateLearningProfile(p);}catch(error){toast(error.message);return;}
  state.learningProfile=p;save();session=null;quiz=null;closeModal();render();toast('筛选范围已更新，原学习记录保留');return;
 }
 if(form.dataset.form==='settings'){state.plan={exam:fd.get('exam').trim(),date:fd.get('date'),month:fd.get('month'),target:Number(fd.get('target')),goal:Number(fd.get('goal')),minutes:Number(fd.get('minutes'))};save();session=null;closeModal();render();toast('学习计划已更新');}
 if(form.dataset.form==='word'){const word=fd.get('word').trim(),meaning=fd.get('meaning').trim();if(!word||!meaning){toast('请填写单词和释义');return;}const existing=words().find(w=>w.word.toLowerCase()===word.toLowerCase()&&w.id!==form.dataset.id);if(existing){toast('词库中已有这个单词，可以搜索后查看或练习');return;}const id=form.dataset.id||`custom-${crypto.randomUUID()}`;const w={...(state.customWords.find(x=>x.id===id)||{}),id,deck:'custom',word,meaning,ipa:fd.get('ipa').trim(),pos:fd.get('pos').trim(),example:fd.get('example').trim(),translation:fd.get('translation').trim()};if(fd.get('dictionaryLemma'))w.dictionarySource={name:'WordNet',version:'3.0',lemma:fd.get('dictionaryLemma'),synset:fd.get('dictionarySynset'),definition:fd.get('dictionaryDefinition')};state.customWords=state.customWords.filter(x=>x.id!==id).concat(w);if(!form.dataset.id)markKnowledge(state,word,false);save();closeModal();render();toast('单词已保存到自建词库');}
 if(form.dataset.form==='material-extract'){await extractSmartCandidates(fd);return;}
 if(form.dataset.form==='material-save'){saveSmartCandidates();return;}
});
document.addEventListener('keydown',e=>{if(modal.open||['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(document.activeElement?.tagName)||view!=='home')return;if(e.code==='Space'){e.preventDefault();if(!session?.revealed)reveal();}if(session?.revealed&&['1','2','3','4'].includes(e.key))rate(Number(e.key));});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
window.addEventListener('online',()=>toast('网络已恢复，继续学习吧'));

function setupChapterPicker(book){
 if(book.chapters.length>500)throw new Error('文件超过500个文字部分，请拆分后导入');
 epubState={book,index:0,selected:[0],batch:false};
 const title=modal.querySelector('[name=title]');if(!editingMaterial||!title.value)title.value=book.title.slice(0,100);
 modal.querySelector('[name=type]').value=book.type||'reading';
 document.querySelector('#chapter-picker').innerHTML=`<label>预览章节 / 页面<select id="epub-chapter">${book.note?'<option value="-1">整份课件文字</option>':''}${book.chapters.map((c,i)=>`<option value="${i}">${i+1}. ${esc(c.title)}</option>`).join('')}</select></label><div class="batch-actions"><button type="button" class="button pale" data-action="batch-all">${icon('book')} 整本 / 全部部分筛词</button><button type="button" class="button outline" data-action="batch-toggle">多选章节 / 页面</button><button type="button" class="text-button" data-action="batch-single">仅当前部分</button><button type="button" class="text-button" data-action="batch-paste">改用粘贴文字</button></div><fieldset id="batch-chapters" hidden><legend>勾选要统一筛词的部分</legend>${book.chapters.map((c,i)=>`<label><input type="checkbox" data-batch-chapter="${i}" ${i===0?'checked':''}>${i+1}. ${esc(c.title)}</label>`).join('')}</fieldset><p class="batch-notice" id="batch-status"></p>`;
 document.querySelector('#material-text').readOnly=true;selectEpubChapter(0);
}
function updateBatchStatus(){
 if(!epubState)return;
 const selected=epubState.selected,characters=selected.reduce((n,i)=>n+epubState.book.chapters[i].text.length,0);
 document.querySelector('#batch-status').textContent=`筛词范围：${selected.length} / ${epubState.book.chapters.length} 部分 · ${characters.toLocaleString()} 字符。下方仅为预览；筛词使用勾选部分的完整文字。`;
 document.querySelector('#extract-button').textContent=epubState.batch?`统一筛选 ${selected.length} 个部分的词汇`:'智能筛选当前部分的词汇';
}
function selectEpubChapter(index){
 if(!epubState)return;
 if(index===-1){epubState.batch=true;epubState.selected=epubState.book.chapters.map((_,i)=>i);document.querySelectorAll('[data-batch-chapter]').forEach(c=>c.checked=true);document.querySelector('#batch-chapters').hidden=false;index=0;}
 if(!epubState.book.chapters[index])return;
 epubState.index=index;if(!epubState.batch)epubState.selected=[index];
 const chapter=epubState.book.chapters[index];
 document.querySelector('#material-text').value=chapter.text.slice(0,120000);
 document.querySelector('#file-status').textContent=`预览「${chapter.title}」 · ${chapter.text.length.toLocaleString()} 字符${chapter.text.length>120000?'，预览仅显示前12万字符，筛词仍读取全文':''}。`;
 updateBatchStatus();
}
async function loadReadingLibrary(){
  try{
    const response=await fetch('/reading-library.json');if(!response.ok)return;
    const book=await response.json();if(!Array.isArray(book.chapters)||!book.chapters.length)return;
    readingBook=book;
    const material=state.materials.find(m=>m.id==='material-reading');
    if(material&&!material.updated&&!material.wordIds.length&&!state.readingLibraryImported){
      const first=book.chapters[0],known=[...words(),...READING_GLOSSARY.filter(g=>!words().some(w=>w.word===g.word))];
      const candidates=extractCandidates(first.text,known).filter(c=>c.known&&!exclusionReason(c.known,state));
      const ids=[],contexts={};
      for(const c of candidates){if(!words().some(w=>w.id===c.known.id))state.customWords.push({...c.known,example:c.sentence});ids.push(c.known.id);contexts[c.known.id]=c.sentence;}
      const updated=mergeMaterialChapter({...material,updated:Date.now()},{id:first.id,title:first.title,wordIds:ids,contexts});
      state.materials=state.materials.map(m=>m.id===material.id?updated:m);state.readingLibraryImported=true;save();
    }
    if(!modal.open&&!session)render();
  }catch{/* Personal library is optional; the app still supports normal file import. */}
}


function sentenceCredit(w){
 const e=w.sourceEvidence||(w.examples?.[0]?.text===w.example?{source:w.examples[0].source,translationOrigin:w.examples[0].translationOrigin}:null);
 if(!e?.source||!w.example)return '';
 return `<p class="sentence-credit">原句：${esc(e.source.file)} · ${esc(e.source.location)}${e.translationOrigin&&w.translation?' · '+esc(e.translationOrigin):''}</p>`;
}
function exampleDetails(w){
 const entries=w.examples||[];
 return `${w.classTags?.length?`<p class="word-category">${w.classTags.map(t=>`<span>${esc(t)}</span>`).join('')}</p>`:''}${w.studyNote?`<div class="course-note">${esc(w.studyNote)}</div>`:''}${entries.length?`<details class="source-examples"><summary>老师资料中的例句 / 语境（${entries.length} 条）</summary>${entries.map(e=>`<article><p>${highlight(e.text,w.word)}</p>${e.translation?`<small>${esc(e.translation)} <em>${esc(e.translationOrigin)}</em></small>`:''}<span>${esc(e.source.file)} · ${esc(e.source.location)}</span></article>`).join('')}</details>`:''}`;
}
function coursePage(){
 if(!courseLibrary)return `${pageHeading('CLASSROOM TO EVERYDAY','课堂里的每个词，都值得记住。','把老师每节课的资料，变成你的学习计划。')}<div class="panel empty-state">${icon('graduation')}<h3>课堂资料正在等待接入</h3><p>可以先在资料架导入老师发来的 PPTX、Word 或文字。</p><button class="button dark" data-action="import">${icon('upload')} 导入老师资料</button></div>`;
 const lesson=courseLibrary.lessons.find(l=>l.id===selectedLesson)||courseLibrary.lessons[0];
 const byId=new Map(words().map(w=>[w.word.toLowerCase(),w]));
 const list=courseLibrary.words.filter(w=>lesson.wordIds.includes(w.id)&&(courseFilter==='all'||courseFilter==='phrases'&&w.word.includes(' ')&&!w.classTags.includes('语法术语')||courseFilter==='grammar'&&w.classTags.includes('语法术语')||courseFilter==='vocabulary'&&!w.word.includes(' ')&&!w.classTags.includes('语法术语'))).map(w=>byId.get(w.word.toLowerCase())).filter(Boolean);
 const total=courseLibrary.words.length;
 return `${pageHeading('FROM YOUR CLASSROOM','这节课，学到心里去。','Unit 1 · Brands｜老师资料按课次整理，词汇、短语、语法和练习各有来处。',`<button class="button outline" data-action="course-sync">${icon('repeat')} 重新同步资料</button>`)}<section class="classroom-overview"><div><span class="eyebrow">YOUR PERSONAL COURSE COMPANION</span><h2>跟上课堂，也为四级积累。</h2><p>五份老师资料，${total} 个去重词条。中文释义为整理内容，原句、资料原译和整理译文分别标注。</p><div class="classroom-counts"><span>${icon('folder')} 5 份资料</span><span>${icon('file')} 92 页课件</span><span>${icon('book')} ${total} 词 / 短语 / 术语</span></div></div><div class="classroom-emblem">${icon('graduation')}</div></section><div class="lesson-tabs" role="group" aria-label="选择课堂资料">${courseLibrary.lessons.map(l=>`<button data-action="course-lesson" data-id="${esc(l.id)}" class="${l.id===lesson.id?'selected':''}">${esc(l.title)}<small>${l.wordIds.length} 个关联词条</small></button>`).join('')}</div><section class="panel lesson-panel"><div class="section-heading"><div><h2>${esc(lesson.title)}</h2><p class="lesson-summary">${esc(lesson.summary)}</p><span class="lesson-filename">${icon('file')} ${esc(lesson.file)}</span></div><button class="button dark" data-action="course-practice">开始本课学习 ${icon('arrow')}</button></div><div class="filter-row">${[['all','本课全部'],['vocabulary','单词'],['phrases','短语'],['grammar','语法术语']].map(([id,label])=>`<button class="filter-chip ${courseFilter===id?'selected':''}" data-action="course-filter" data-filter="${id}">${label}</button>`).join('')}<span class="result-count">${list.length} 个词条 · 跨课次共享进度</span></div>${wordRows(list)}</section><div class="course-bottom"><section class="panel"><div class="section-heading"><h2>${icon('check')} 本课练习清单</h2><span class="muted">由你完成后勾选</span></div><div class="course-tasks">${lesson.tasks.map((task,i)=>{const id=lesson.id+':'+i;return `<label><input type="checkbox" data-course-task="${id}" ${state.courseTasks?.[id]?'checked':''}><span>${esc(task)}</span></label>`;}).join('')}</div><p class="field-hint">清单只记录学习任务，不代表练习已自动完成。提到的外部视频、Text 2 和教材页正文尚未提供。</p></section><section class="panel"><div class="section-heading"><h2>${icon('sparkle')} 核对与学习提醒</h2></div>${courseLibrary.issues.map(issue=>`<details class="course-issue"><summary>${esc(issue.title)}</summary><p>${esc(issue.note)}</p><small>${esc(issue.source)}</small></details>`).join('')}</section></div><details class="panel source-text"><summary>查看本课资料原文 · ${lesson.parts.length} 个文字部分</summary><p class="field-hint">以下是原资料文字，保留原写法；图片与版式不在这里重现。这里的练习要求作为学习内容展示，不会自动执行。</p>${lesson.parts.map(part=>`<section><h3>${esc(part.location)}</h3>${part.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('')}</details>`;
}
async function loadCourseLibrary(){
 try{const response=await fetch('/course-library.json');if(!response.ok)return;const pack=await response.json();
 if(!Array.isArray(pack.words)||!Array.isArray(pack.lessons))return;courseLibrary=pack;
 if(syncCoursePack(state,pack,WORDS))save();if(!modal.open&&!session)render();
 }catch{toast('课堂资料暂未加载，可稍后刷新；已有学习记录保持不变');}
}


async function searchDictionary(value){
 const request=++lookupRequest;dictionaryTerm=String(value||'').trim();dictionaryResult=null;dictionaryError='';dictionaryVisible=12;view='dictionary';
 try{dictionaryTerm=normalizeTerm(dictionaryTerm);}catch(error){dictionaryStatus='error';dictionaryError=error.message;render();return;}
 dictionaryStatus='loading';render();
 try{const result=await lookupWord(dictionaryTerm);if(request!==lookupRequest)return;dictionaryResult=result;dictionaryStatus='ready';}
 catch(error){if(request!==lookupRequest)return;dictionaryStatus='error';dictionaryError=error.message.includes('词典')?error.message:'词典分区暂时无法加载，请检查网络后重试。';}
 if(view==='dictionary')render();
}

render();
loadReadingLibrary();
loadCourseLibrary();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
