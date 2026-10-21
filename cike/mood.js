import { works } from './catalog.js';
import { eligibleWorks, interleave, languageNames, moodNames, recommendWorks } from './recommendations.js';

const $=s=>document.querySelector(s);
let intent='understand', filter='all', view='recommend', round=0, visibleCount=12, lastThought='';
let current=['perfect-days','dreams','chungking','la-vie'].map(id=>works.find(w=>w.id===id));
let saved=new Set();
try {
  const value=JSON.parse(localStorage.getItem('moment-fm.favorites')||'[]');
  if(Array.isArray(value)) saved=new Set(value.filter(id=>works.some(w=>w.id===id)));
} catch {}
const preferences=()=>({ movieCollection:$('#movie-collection').value, language:$('#song-language').value });

function visibleWorks() {
  if(view==='saved') return works.filter(w=>saved.has(w.id));
  if(view==='library') {
    const list=eligibleWorks(preferences());
    return interleave(list.filter(w=>w.type==='movie'),list.filter(w=>w.type==='song'));
  }
  return current;
}
function render() {
  $('#saved-count').textContent=saved.size;
  $('#saved-toggle span').textContent=view==='saved'?'返回推荐':'我的收藏';
  $('#library-toggle').textContent=view==='library'?'返回推荐':'逛逛完整片单 ↗';
  $('#library-toggle').setAttribute('aria-pressed',view==='library');
  $('#preferences').hidden=view==='saved';
  $('#shuffle').hidden=view!=='recommend';
  const list=visibleWorks().filter(w=>filter==='all'||w.type===filter);
  const shown=view==='library'?list.slice(0,visibleCount):list;
  $('#load-more').hidden=view!=='library'||shown.length>=list.length;
  if(view==='library') {
    $('#result-title').textContent='慢慢逛，总有一部懂你';
    $('#result-subtitle').textContent=`精选 50 部电影 · 50 首歌，按你的偏好慢慢挑选。`;
    $('#status').textContent=`当前筛选 ${list.length} 部作品 · 已展示 ${shown.length} 部`;
  } else if(view==='saved') {
    $('#result-title').textContent='留住的那些回声';
    $('#result-subtitle').textContent='喜欢的故事和旋律，下次还能再遇见。';
  }
  $('#cards').replaceChildren();
  if(!shown.length) {
    const el=document.createElement('div');el.className='empty';
    el.textContent=view==='saved'?'这里还没有收藏，点击作品上的 ♡，留住喜欢的回声。':'这个分类暂时没有作品，试试「全部」或放宽筛选。';
    $('#cards').append(el);
  }
  for(const w of shown) {
    const el=document.createElement('article');el.className='card';el.dataset.id=w.id;
    el.innerHTML=`<div class="art" style="--bg:${w.bg};--hill:${w.hill||'#567367'};--label:${w.label||'#c1bd91'}"><span class="type">${w.type==='movie'?'↗ 电影':'♫ '+languageNames[w.language]}</span><button class="save" aria-label="${saved.has(w.id)?'取消收藏':'收藏'}${w.title}" aria-pressed="${saved.has(w.id)}">${saved.has(w.id)?'♥':'♡'}</button>${w.type==='movie'?'<div class="sun"></div><div class="hills"></div>':'<div class="record"></div>'}<a class="art-title" target="_blank" rel="noopener noreferrer"></a></div><h3><a target="_blank" rel="noopener noreferrer"></a></h3><div class="meta"></div><p class="reason"></p><div class="tags"></div>`;
    // Titles, artist names and notes remain text even as the catalogue grows.
    el.querySelector('.art-title').append(document.createTextNode(w.title));
    const sub=document.createElement('small');sub.textContent=w.en;el.querySelector('.art-title').append(sub);
    el.querySelector('h3 a').textContent=w.title+' ↗';
    el.querySelector('.meta').textContent=w.creator+' · '+w.year;
    el.querySelector('.reason').textContent=w.reason;
    const tags=[...(w.type==='movie'&&w.collections.includes('arthouse')?['文艺片']:[]),...w.tags];
    tags.forEach(tag=>{const span=document.createElement('span');span.textContent=tag;el.querySelector('.tags').append(span);});
    const url=w.type==='movie'
      ?`https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(w.title+' '+w.creator)}`
      :`https://music.163.com/#/search/m/?s=${encodeURIComponent(w.title+' '+w.creator)}&type=1`;
    el.querySelectorAll('a').forEach(a=>a.href=url);
    el.querySelector('.save').onclick=()=>{
      saved.has(w.id)?saved.delete(w.id):saved.add(w.id);
      render();
      try {
        localStorage.setItem('moment-fm.favorites',JSON.stringify([...saved]));
        $('#status').textContent=saved.has(w.id)?'已收藏，可以在「我的收藏」中找到。':'已取消收藏。';
      } catch { $('#status').textContent='浏览器无法保存收藏，当前收藏仅在本次页面停留期间有效。'; }
    };
    $('#cards').append(el);
  }
}
function recommend({shuffle=false,allowEmpty=false}={}) {
  const text=$('#thought').value.trim();
  if(!text&&!allowEmpty) {
    $('#thought').setCustomValidity('写下一点想法，再寻找你的回声吧。');$('#thought').reportValidity();return;
  }
  round=shuffle?round+1:0;lastThought=text;view='recommend';
  const result=recommendWorks(text,{intent,...preferences(),round});current=result.items;
  $('#result-title').textContent=text?'给此刻的你，一点回声':'先从这些美好开始';
  $('#result-subtitle').textContent=!text?'不必等到特别的心情，也值得遇见好故事。':intent==='uplift'
    ?'想换个心情？让温暖和明亮陪你走一小段。'
    :result.matched?`从你的文字里，找到了关于「${moodNames[result.mood]}」的线索。`
    :'还没找到明确的心情词，先送你一些关于生活与希望的作品。';
  const movieCount=current.filter(w=>w.type==='movie').length;
  const songCount=current.filter(w=>w.type==='song').length;
  $('#status').textContent=`已为你选出 ${movieCount} 部电影与 ${songCount} 首歌。`+(result.usedFallback?'当前偏好下匹配较少，补充了其他主题作品。':'');
  $('#shuffle').disabled=!result.hasAlternatives;
  render();
}
$('#thought').oninput=()=>{$('#counter').textContent=`${$('#thought').value.length} / 500`;$('#thought').setCustomValidity('');};
$('#mood-form').onsubmit=e=>{e.preventDefault();recommend();};
const examples=['今天心情有点低落，想找一个懂我的故事。','有点想念一个人，那些回忆又涌了上来。','最近有些迷茫，但想鼓起勇气重新出发。','今天很开心，想把这份快乐再延长一点！'];
document.querySelectorAll('.prompts button').forEach((b,i)=>b.onclick=()=>{
  $('#thought').value=examples[i];$('#thought').dispatchEvent(new Event('input'));recommend();
});
document.querySelectorAll('[data-intent]').forEach(b=>b.onclick=()=>{
  intent=b.dataset.intent;
  document.querySelectorAll('[data-intent]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});
  if(lastThought&&$('#thought').value.trim())recommend();
});
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{
  filter=b.dataset.filter;visibleCount=12;
  document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});render();
});
$('#saved-toggle').onclick=()=>{
  if(view==='saved')recommend({allowEmpty:true});
  else {view='saved';$('#status').textContent='';render();}
  $('.discover').scrollIntoView({behavior:'smooth',block:'start'});
};
$('#library-toggle').onclick=()=>{
  if(view==='library')recommend({allowEmpty:true});
  else {view='library';visibleCount=12;render();}
};
$('#shuffle').onclick=()=>recommend({shuffle:true,allowEmpty:true});
$('#load-more').onclick=()=>{visibleCount+=12;render();};
for(const id of ['movie-collection','song-language']) $('#'+id).onchange=()=>{
  visibleCount=12;if(view==='library')render();else recommend({allowEmpty:true});
};
render();
