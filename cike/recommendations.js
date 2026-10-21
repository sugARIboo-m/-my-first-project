import { works } from './catalog.js';

export const languageNames = { zh:'中文', en:'英语', fr:'法语', ja:'日语', ko:'韩语', es:'西班牙语', pt:'葡萄牙语', it:'意大利语' };
export const moodNames = { sad:'低落', love:'想念', hope:'出发', tired:'疲惫', happy:'快乐' };
const dictionary = {
  sad:['难过','低落','伤心','孤独','孤单','失落','哭','分手','焦虑','烦','崩溃','sad','alone'],
  love:['想念','喜欢','爱','思念','想他','想她','恋','回忆','miss','love'],
  hope:['重新','出发','未来','改变','梦想','迷茫','方向','勇气','开始','希望'],
  tired:['累','疲惫','下班','工作','压力','忙','躺','休息','加班','tired'],
  happy:['开心','快乐','高兴','幸福','成功','庆祝','好消息','happy']
};

export function eligibleWorks({ movieCollection='arthouse', language='foreign' }={}) {
  return works.filter(w => w.type==='movie'
    ? movieCollection==='all' || w.collections.includes(movieCollection)
    : language==='all' || (language==='foreign' ? w.language!=='zh' : w.language===language));
}

export function interleave(movies,songs) {
  return Array.from({length:Math.max(movies.length,songs.length)},(_,i)=>[movies[i],songs[i]]).flat().filter(Boolean);
}

export function recommendWorks(text, { intent='understand', movieCollection='arthouse', language='foreign', round=0 }={}) {
  const lower=text.toLowerCase();
  const scores=Object.fromEntries(Object.entries(dictionary).map(([m,words])=>[m,words.filter(word=>lower.includes(word)).length]));
  const mood=Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];
  const matched=scores[mood]>0;
  const target=intent==='uplift' ? ['happy','hope'] : matched ? [mood] : ['tired','hope'];
  const candidates=eligibleWorks({movieCollection,language});
  let usedFallback=false;
  const pools=['movie','song'].map(type=>{
    const scored=candidates.filter(w=>w.type===type).map((w,index)=>({
      w,index,
      relevant:w.moods.some(m=>target.includes(m)) && (intent!=='uplift' || !w.moods.includes('sad')),
      score:w.moods.reduce((n,m)=>n+(target.includes(m)?6:0)+(intent==='understand'?scores[m]:0),0)
        +w.tags.filter(tag=>lower.includes(tag)).length*4
    }));
    let relevant=scored.filter(x=>x.relevant);
    if (!relevant.length) { relevant=scored; usedFallback=true; }
    relevant.sort((a,b)=>b.score-a.score||a.index-b.index);
    return relevant.map(x=>x.w);
  });
  const chosen=pools.map(pool=>{
    if(pool.length<2)return pool.slice();
    const offset=(round*2)%pool.length;
    const rotated=[...pool.slice(offset),...pool.slice(0,offset)];
    const first=rotated[0];
    // When possible, pair different directors and different song languages.
    const diverse=rotated.slice(1).find(w=>first.type==='movie'
      ? w.creator!==first.creator
      : ['foreign','all'].includes(language) && w.language!==first.language);
    return [first,diverse||rotated[1]];
  });
  return { items:interleave(...chosen), matched, mood, usedFallback, hasAlternatives:pools.some(pool=>pool.length>2) };
}
