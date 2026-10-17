import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data.js';
import { DAY,dayKey,emptyState,schedule,recordRating,makeQueue,streak,daysUntil,extractCandidates,validateBackup } from '../core.js';

test('90 unique entries and personalized plan without invented exam date',()=>{
 const s=emptyState();assert.equal(WORDS.length,90);assert.equal(new Set(WORDS.map(w=>w.id)).size,90);
 assert.equal(s.plan.month,'2027-06');assert.equal(s.plan.date,'');assert.equal(s.materials[1].title,'Everything I Know About Love');assert.deepEqual(s.materials[1].wordIds,[]);
 assert.deepEqual(validateBackup(s),s);
});
test('scheduling remembers again in ten minutes and grows correct intervals',()=>{
 const now=Date.now();const again=schedule(null,1,now);assert.equal(again.due,now+600000);assert.equal(again.lapses,1);
 let p=schedule(null,3,now);assert.equal(p.due,now+3*DAY);p=schedule(p,3,now);assert.equal(p.interval,7);p=schedule(p,3,now);assert.equal(p.interval,15);assert.equal(p.successes,3);assert.equal(schedule(p,2,now).successes,0);
 assert.throws(()=>schedule(null,5));
});
test('queue prioritizes due words and does not exceed global daily new-word allowance',()=>{
 const s=emptyState(),now=Date.now();s.plan.goal=2;
 recordRating(s,WORDS[0].id,3,now);s.progress[WORDS[1].id]=schedule(null,1,now-700000);
 assert.deepEqual(makeQueue(WORDS,s,now).map(w=>w.id),[WORDS[1].id,WORDS[2].id]);
 assert.deepEqual(makeQueue(WORDS,s,now,true).map(w=>w.id),[WORDS[1].id]);
});
test('repeated reviews count once per word per day and remember fresh words only once',()=>{
 const s=emptyState(),now=Date.now();recordRating(s,'x',1,now);recordRating(s,'x',3,now);const h=s.history[dayKey(new Date(now))];assert.equal(h.attempts,2);assert.equal(h.correct,1);assert.deepEqual(h.learned,['x']);assert.deepEqual(h.reviewed,['x']);
});
test('streak works when today is not started and breaks across missed days',()=>{
 const h={'2026-10-16':{attempts:1},'2026-10-15':{attempts:2}};assert.equal(streak(h,new Date('2026-10-17T12:00:00')),2);assert.equal(streak(h,new Date('2026-10-18T12:00:00')),0);assert.equal(daysUntil('',new Date()),null);
});
test('extracts English candidates, matches known meanings, preserves original sentence',()=>{
 const c=extractCandidates('We cherish each memory. A memory can comfort us. Serendipity brings unexpected joy.',WORDS);
 assert.equal(c.find(w=>w.word==='memory').count,2);assert.equal(c.find(w=>w.word==='cherish').known.meaning,'珍惜；珍爱');assert.ok(c.find(w=>w.word==='unexpected'));assert.ok(!c.find(w=>w.word==='each'));assert.equal(c.find(w=>w.word==='cherish').sentence,'We cherish each memory.');
});
test('backup validation rejects missing meanings, negative intervals and prototype ids',()=>{
 const s=emptyState();s.progress.x={interval:-1,due:1,successes:0,lapses:0,lastReviewed:0};assert.throws(()=>validateBackup(s));
 const t=emptyState();t.favorites=['__proto__'];assert.throws(()=>validateBackup(t));
 const u=emptyState();u.customWords=[{id:'custom-1',deck:'custom',word:'hi',meaning:'',ipa:'',pos:'',example:'',translation:''}];assert.throws(()=>validateBackup(u));
});

test('chapter imports accumulate word lists and preserve chapter-specific context', async()=>{
 const {mergeMaterialChapter}=await import('../core.js');
 const base={id:'material-reading',title:'My Book',type:'reading',url:'',updated:1,wordIds:[]};
 const one=mergeMaterialChapter(base,{id:'one',title:'Chapter One',wordIds:['daily-memory'],contexts:{'daily-memory':'The first memory.'}});
 const two=mergeMaterialChapter(one,{id:'two',title:'Chapter Two',wordIds:['daily-memory','daily-cherish'],contexts:{'daily-memory':'A different memory.','daily-cherish':'We cherish this.'}});
 assert.equal(two.activeChapter,'two');
 assert.deepEqual(two.wordIds,['daily-memory','daily-cherish']);
 assert.equal(two.chapters.one.contexts['daily-memory'],'The first memory.');
 assert.equal(two.chapters.two.contexts['daily-memory'],'A different memory.');
 const s=emptyState();s.materials=[two];assert.deepEqual(validateBackup(s),s);
 two.activeChapter='missing';assert.throws(()=>validateBackup(s));
});

test('phrase extraction and spelling cloze recognize taught inflections',async()=>{
 const {wordPattern}=await import('../core.js');
 assert.ok(new RegExp(wordPattern('be bound to'),'i').test('She is bound to succeed.'));
 assert.ok(new RegExp(wordPattern('bind'),'i').test('His hands were bound with rope.'));
 const known=[{id:'a',word:'pitch in'},{id:'b',word:'be supposed to'}];
 const candidates=extractCandidates('Everyone pitched in. We were supposed to have gone away this week.',known);
 assert.equal(candidates.find(c=>c.word==='pitch in').count,1);
 assert.equal(candidates.find(c=>c.word==='be supposed to').sentence,'We were supposed to have gone away this week.');
});
