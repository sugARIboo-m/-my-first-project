import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, recordRating, validateBackup } from '../core.js';
import { profileOf, lemmaOf, commonRank, exclusionReason, learningWords, markKnowledge, assessmentQuestions, assessmentResult, applyAssessment } from '../level.js';
import { analyzeSections, MAX_BOOK_CHARACTERS } from '../selection.js';
import { WORDS } from '../data.js';
import { SELECTION_LEXICON } from '../selection-lexicon.js';

test('common words and their inflections are excluded, rare words and idioms remain',()=>{
 const state=emptyState();
 for(const [term,lemma]of [['children','child'],['studied','study'],['running','run'],['memories','memory']]){
  assert.equal(lemmaOf(term),lemma);assert.ok(exclusionReason(term,state));
 }
 assert.equal(exclusionReason('serendipity',state),'');assert.equal(exclusionReason('take up',state),'');
 assert.equal(profileOf(state).cutoff,3500);assert.ok(commonRank('memory')<=3500);
});
test('personal unfamiliar words override the commonness cutoff; explicit known words also leave reviews',()=>{
 const state=emptyState(),word=WORDS.find(w=>w.word==='memory');recordRating(state,word.id,3);
 const original=structuredClone(state.progress);
 assert.ok(learningWords([word],state).length); // Existing reviews survive the automatic cutoff.
 markKnowledge(state,'memories',true);assert.equal(learningWords([word],state).length,0);
 markKnowledge(state,'memory',false);assert.equal(learningWords([word],state).length,1);
 assert.deepEqual(state.progress,original);assert.deepEqual(validateBackup(state),state);
});
test('assessment samples six distinct families per band, stable in a saved session and with distinct choices',()=>{
 const questions=assessmentQuestions('session-a');assert.equal(questions.length,30);
 assert.equal(new Set(questions.map(q=>q.lemma)).size,30);
 for(const q of questions){assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct],q.meaning);}
 assert.deepEqual(assessmentQuestions('session-a'),questions);
 assert.notDeepEqual(assessmentQuestions('session-b'),questions);
 for(const band of new Set(questions.map(q=>q.band)))assert.equal(questions.filter(q=>q.band===band).length,6);
});
test('recommendations require consecutive strong bands and preserve every wrong/uncertain word',()=>{
 const seed='assessment-fixture',questions=assessmentQuestions(seed),all=questions.map(q=>q.correct);
 assert.equal(assessmentResult(seed,all).cutoff,6000);
 const firstWeak=all.map((answer,i)=>i<2?4:answer);
 assert.equal(assessmentResult(seed,firstWeak).cutoff,0);
 const answers=all.map((answer,i)=>i>=24?4:answer),state=emptyState();
 state.learningProfile={...profileOf(state),result:assessmentResult(seed,answers)};
 applyAssessment(state);
 assert.equal(state.learningProfile.cutoff,6000);
 assert.equal(state.learningProfile.unknown.length,6);
 for(const word of state.learningProfile.unknown)assert.equal(exclusionReason(word,state),'');
 assert.deepEqual(validateBackup(state),state);
 assert.throws(()=>assessmentResult(seed,answers.slice(1)));
});
test('old backups remain compatible and malformed profiles cannot wipe good data silently',()=>{
 const old=emptyState();assert.deepEqual(validateBackup(old),old);
 markKnowledge(old,'constructor',true);assert.deepEqual(validateBackup(old),old); // Terms live in arrays, not object keys.
 for(const profile of [{enabled:true,cutoff:4500,known:[],unknown:[]},{enabled:true,cutoff:3500,known:['memory'],unknown:['memory']},{enabled:true,cutoff:3500,known:[],unknown:[],draft:{seed:'a',answers:[9]}}])assert.throws(()=>validateBackup({...old,learningProfile:profile}));
});
test('whole-book analysis merges inflections, filters before selection and retains per-section original contexts',async()=>{
 const state=emptyState(),sections=[{id:'one',title:'One',text:'Children remember their memories. Meticulous readers cherish serendipity.'},{id:'two',title:'Two',text:'A meticulous reader can cherish these memories. Serendipity brings unexpected discoveries.'}];
 const results=await analyzeSections(sections,WORDS,state,SELECTION_LEXICON);
 const memories=results.find(c=>c.lemma==='memory');assert.equal(memories.count,2);assert.ok(memories.reason);
 const meticulous=results.find(c=>c.lemma==='meticulous');assert.equal(meticulous.count,2);assert.equal(meticulous.reason,'');assert.equal(meticulous.known.dictionarySource.name,'WordNet');
 assert.equal(Object.keys(meticulous.contexts).length,2);
 markKnowledge(state,'meticulous',false);const personalized=await analyzeSections(sections,WORDS,state,SELECTION_LEXICON);assert.equal(personalized[0].lemma,'meticulous');
 for(const c of results)for(const [id,text]of Object.entries(c.contexts))assert.ok(sections.find(s=>s.id===id).text.includes(text));
 markKnowledge(state,'meticulous',true);const filtered=await analyzeSections(sections,WORDS,state,SELECTION_LEXICON);assert.equal(filtered.find(c=>c.lemma==='meticulous').reason,'你标记已认识');
});
test('long sections are processed beyond the old preview cap, and oversized batches fail instead of truncating',async()=>{
 const long='A memory remains. '.repeat(8000)+' Meticulous work requires serendipity.';
 assert.ok(long.length>120000);
 const results=await analyzeSections([{id:'long',title:'Long',text:long}],WORDS,emptyState(),SELECTION_LEXICON);
 assert.ok(results.some(c=>c.lemma==='meticulous'));
 await assert.rejects(analyzeSections([{id:'large',title:'Too large',text:'a'.repeat(MAX_BOOK_CHARACTERS+1)}],WORDS,emptyState(),SELECTION_LEXICON),/分批/);
});
test('capitalized-only names with dictionary meanings are flagged rather than treated as automatically useful vocabulary',async()=>{
 const results=await analyzeSections([{id:'story',title:'Story',text:'Belle met Belle in the city. A meticulous reader examined the story.'}],WORDS,emptyState(),SELECTION_LEXICON);
 assert.equal(results.find(c=>c.word==='belle').likelyName,true);
 assert.equal(results.find(c=>c.word==='meticulous').likelyName,false);
});
