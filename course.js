import { mergeMaterialChapter } from './core.js';
/** Apply a new personal course pack once; never overwrite remembered progress or user edits. */
export function syncCoursePack(state,pack,builtins,force=false){
  if(!pack?.id||!pack?.revision||!Array.isArray(pack.words)||!Array.isArray(pack.lessons))throw new Error('课堂资料包格式不正确');
  if(!force && state.courseImportVersions?.[pack.id]===pack.revision)return false;
  const known=new Map([...builtins,...state.customWords].map(w=>[w.word.toLowerCase(),w]));
  const map=new Map();
  for(const w of pack.words){
    let existing=known.get(w.word.toLowerCase());
    if(!existing){existing={...w};state.customWords.push(existing);known.set(w.word.toLowerCase(),existing);}
    map.set(w.id,existing.id);
  }
  let material=state.materials.find(m=>m.id==='material-textbook')||{id:'material-textbook',title:'新时代大学商务英语综合教程 2',type:'textbook',url:'',updated:0,wordIds:[]};
  if(material.wordIds.length && !material.chapters) {
    material=mergeMaterialChapter(material,{id:'previous-user-import',title:'此前自行导入的资料',wordIds:[...material.wordIds],contexts:{...(material.contexts||{})}});
  }
  const previousActive=material.activeChapter;
  for(const lesson of pack.lessons){
    const ids=lesson.wordIds.map(id=>map.get(id)).filter(Boolean);
    const remap=obj=>Object.fromEntries(Object.entries(obj||{}).filter(([id])=>map.has(id)).map(([id,value])=>[map.get(id),value]));
    material=mergeMaterialChapter(material,{id:lesson.id,title:lesson.title,wordIds:[...new Set(ids)],contexts:remap(lesson.contexts),translations:remap(lesson.translations),evidence:remap(lesson.evidence)});
  }
  material.activeChapter=Object.hasOwn(material.chapters,previousActive||'')?previousActive:pack.lessons[0]?.id||'';
  material.updated=Date.now();
  state.materials=state.materials.filter(m=>m.id!==material.id).concat(material);
  state.courseImportVersions={...state.courseImportVersions,[pack.id]:pack.revision};
  state.courseTasks||={};
  return true;
}
