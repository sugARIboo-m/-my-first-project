import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState,validateBackup,recordRating } from '../core.js';
import { syncCoursePack } from '../course.js';
const word={id:'custom-course-test',deck:'custom',word:'herald',meaning:'预示',ipa:'',pos:'v.',example:'The technology heralded a new age.',translation:'技术预示新时代。'};
const pack={id:'unit-test',revision:'r1',words:[word],lessons:[{id:'unit1-source-1',title:'Lesson One',wordIds:[word.id],contexts:{[word.id]:'The technology heralded a new age.'},translations:{[word.id]:'技术预示新时代。'},evidence:{[word.id]:{source:{file:'class.pptx',location:'第2页'},translationOrigin:'整理译文'}}},{id:'unit1-source-2',title:'Lesson Two',wordIds:[word.id],contexts:{[word.id]:'Spring heralds longer days.'},translations:{},evidence:{}}]};
test('course imports deduplicate terms across lessons and preserve different original contexts',()=>{
 const s=emptyState();assert.equal(syncCoursePack(s,pack,[]),true);assert.equal(s.customWords.length,1);
 const m=s.materials.find(m=>m.id==='material-textbook');assert.equal(Object.keys(m.chapters).length,2);assert.equal(m.wordIds.length,1);
 assert.notEqual(m.chapters['unit1-source-1'].contexts[word.id],m.chapters['unit1-source-2'].contexts[word.id]);
 assert.deepEqual(validateBackup(s),s);
});
test('refresh is idempotent and keeps user learning, edits and reading intact',()=>{
 const s=emptyState();syncCoursePack(s,pack,[]);recordRating(s,word.id,3);s.customWords[0].meaning='我的笔记';s.courseTasks['unit1-source-1:0']=true;
 const reading=structuredClone(s.materials.find(m=>m.id==='material-reading'));const progress=structuredClone(s.progress);
 assert.equal(syncCoursePack(s,pack,[]),false);assert.equal(syncCoursePack(s,pack,[],true),true);
 assert.deepEqual(s.progress,progress);assert.equal(s.customWords[0].meaning,'我的笔记');assert.equal(s.customWords.length,1);assert.deepEqual(s.materials.find(m=>m.id==='material-reading'),reading);assert.equal(s.courseTasks['unit1-source-1:0'],true);
});
test('pre-existing manually imported textbook vocabulary is retained',()=>{
 const s=emptyState();const m=s.materials.find(m=>m.id==='material-textbook');m.wordIds=['daily-memory'];m.contexts={'daily-memory':'An earlier sentence.'};
 syncCoursePack(s,pack,[]);const updated=s.materials.find(m=>m.id==='material-textbook');assert.ok(updated.wordIds.includes('daily-memory'));assert.equal(updated.chapters['previous-user-import'].contexts['daily-memory'],'An earlier sentence.');
});
test('an existing built-in word is reused, not duplicated into custom words',()=>{
 const s=emptyState();syncCoursePack(s,pack,[{...word,id:'builtin-herald'}]);assert.equal(s.customWords.length,0);assert.deepEqual(s.materials.find(m=>m.id==='material-textbook').wordIds,['builtin-herald']);
});
