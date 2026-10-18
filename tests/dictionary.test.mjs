import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupWord, normalizeTerm, DICTIONARIES, WORDNET } from '../dictionary.js';
const nativeFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = async url => {
  requests.push(String(url));
  const body = await readFile(new URL(url));
  return new Response(body, { status: 200 });
};
test.after(() => { globalThis.fetch = nativeFetch; });

test('official WordNet entry has the original definition, example, synonym and source ID', async () => {
  const r = await lookupWord('achieve');
  assert.equal(r.senses[0].definition, 'to gain with effort');
  assert.equal(r.senses[0].id, 'v:02526085');
  assert.deepEqual(r.senses[0].examples, ['she achieved her goal despite setbacks']);
  assert.ok(r.senses[0].synonyms.includes('accomplish'));
  assert.equal(WORDNET.entries, 147306);
  const shard = JSON.parse(await readFile(new URL('../dictionary/a.json', import.meta.url)));
  assert.match(shard._license, /Copyright 2006 by Princeton University/);
  assert.match(shard._license, /MAKES NO REPRESENTATIONS OR WARRANTIES/);
});
test('exact phrases and irregular forms resolve with explicit original-form reporting', async () => {
  assert.equal((await lookupWord('look_up')).lemma, 'look up');
  const went = await lookupWord('went');
  assert.equal(went.requested, 'went'); assert.equal(went.lemma, 'go'); assert.ok(went.senses.length);
  assert.equal((await lookupWord('studied')).lemma, 'studied'); // Exact adjective entries take precedence.
  assert.equal((await lookupWord('walked')).lemma, 'walk');
  assert.equal((await lookupWord('zznotawordzz')).senses.length, 0);
});
test('letter shards are reused without fetching the whole dictionary', async () => {
  requests = [];
  await lookupWord('abacus'); await lookupWord('achieve');
  assert.equal(requests.length, 0);
});
test('input is normalized safely and official URLs contain encoded terms only', () => {
  assert.equal(normalizeTerm('  LOOK   UP '), 'look up');
  assert.throws(() => normalizeTerm('<script>alert(1)</script>'));
  assert.throws(() => normalizeTerm('a'.repeat(81)));
  for (const d of DICTIONARIES) {
    const u = new URL(d.url('look up/#?'));
    assert.equal(u.protocol, 'https:'); assert.equal(u.hash, ''); assert.ok(!u.href.includes(' '));
  }
});
