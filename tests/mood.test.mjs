import test from 'node:test';
import assert from 'node:assert/strict';
import { works } from '../cike/catalog.js';
import { eligibleWorks, recommendWorks, languageNames } from '../cike/recommendations.js';

test('curated catalogue has 100 unique complete works, 42 arthouse movies and 45 foreign songs',()=>{
  assert.equal(works.length,100);
  assert.equal(new Set(works.map(w=>w.id)).size,100);
  assert.equal(works.filter(w=>w.type==='movie').length,50);
  assert.equal(works.filter(w=>w.type==='song').length,50);
  assert.equal(works.filter(w=>w.collections?.includes('arthouse')).length,42);
  assert.equal(works.filter(w=>w.type==='song'&&w.language!=='zh').length,45);
  for(const w of works){
    for(const key of ['title','creator','year','reason','en'])assert.ok(w[key]?.trim(),w.id+' '+key);
    assert.match(w.year,/^\d{4}$/);
    assert.ok(w.tags.length&&w.moods.length);
    for(const mood of w.moods)assert.ok(['sad','love','hope','tired','happy'].includes(mood));
    if(w.type==='song')assert.ok(languageNames[w.language]);
    else assert.ok(Array.isArray(w.collections));
  }
  for(const id of ['walter','slow','soul','rice','loveletter','later','forest','ordinary','amelie','sun','intouchables','wind'])assert.ok(works.some(w=>w.id===id));
});

test('language and collection preferences constrain browsing and recommendations',()=>{
  for(const language of Object.keys(languageNames)){
    const result=recommendWorks('我很想念一个人',{language});
    assert.ok(result.items.some(w=>w.type==='song'));
    assert.ok(result.items.filter(w=>w.type==='song').every(w=>w.language===language));
    assert.ok(result.items.filter(w=>w.type==='movie').every(w=>w.collections.includes('arthouse')));
  }
  const classics=eligibleWorks({movieCollection:'classic',language:'foreign'});
  assert.ok(classics.filter(w=>w.type==='movie').every(w=>w.collections.includes('classic')));
  assert.ok(classics.filter(w=>w.type==='song').every(w=>w.language!=='zh'));
  assert.equal(eligibleWorks({movieCollection:'all',language:'all'}).length,100);
});

test('recommendations keep mood relevance and rotate through distinct works',()=>{
  for(const [text,mood] of [['想念一个人','love'],['很难过','sad'],['今天很累','tired'],['想重新出发','hope'],['今天很开心','happy']]){
    const first=recommendWorks(text);
    assert.equal(first.mood,mood);
    assert.ok(first.items.every(w=>w.moods.includes(mood)));
    assert.equal(first.items.length,4);
    const songs=first.items.filter(w=>w.type==='song');
    assert.equal(new Set(songs.map(w=>w.language)).size,2);
    assert.equal(new Set(first.items.map(w=>w.id)).size,4);
    const next=recommendWorks(text,{round:1});
    assert.notDeepEqual(next.items.map(w=>w.id),first.items.map(w=>w.id));
    assert.ok(next.items.every(w=>w.moods.includes(mood)));
  }
});

test('uplift excludes sad works; sparse language selections and unmatched thoughts stay usable',()=>{
  const uplifting=recommendWorks('我很孤独难过',{intent:'uplift'});
  assert.ok(uplifting.items.every(w=>!w.moods.includes('sad')));
  assert.ok(uplifting.items.every(w=>w.moods.some(m=>['happy','hope'].includes(m))));
  const sparse=recommendWorks('我想念一个人',{language:'it'});
  assert.equal(sparse.items.filter(w=>w.type==='song').length,1);
  assert.equal(sparse.usedFallback,true);
  const unknown=recommendWorks('窗外有一只猫');
  assert.equal(unknown.matched,false);
  assert.equal(unknown.items.length,4);
});
