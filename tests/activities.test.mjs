import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data.js';
import { emptyState, recordRating, validateBackup } from '../core.js';
import { createQuiz, recordQuizAnswer, completeQuiz, activityStats, achievements } from '../activities.js';
const now = new Date('2026-10-18T12:00:00').getTime();

test('daily questions are stable within the day, unique and have distinct options', () => {
  const first = createQuiz('daily', WORDS, WORDS, now);
  assert.deepEqual(createQuiz('daily', [...WORDS].reverse(), WORDS, now + 60000).questions, first.questions);
  assert.equal(first.questions.length, 5);
  assert.equal(new Set(first.questions.map(q => q.wordId)).size, 5);
  for (const q of first.questions) {
    assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options[q.correctIndex], WORDS.find(w => w.id === q.wordId).meaning);
  }
  assert.notDeepEqual(createQuiz('daily', WORDS, WORDS, now + 86400000).questions, first.questions);
});
test('context questions preserve original wording, hide inflected answers and skip missing examples', () => {
  const pool = [{ id: 'custom-herald', word: 'herald', meaning: '预示', example: 'The technology heralded a new age.' },
    { id: 'custom-none', word: 'absent', meaning: '缺席的', example: '' }];
  const quiz = createQuiz('context', pool, WORDS, now);
  assert.equal(quiz.questions.length, 1);
  const q = quiz.questions[0];
  assert.equal(q.prompt, 'The technology ________ a new age.');
  assert.equal(q.options[q.correctIndex], 'heralded');
  assert.equal(q.example, pool[0].example);
});
test('wrong answers enter mistakes, correct answers resolve them and daily XP cannot be farmed', () => {
  const state = emptyState(), q = createQuiz('daily', WORDS, WORDS, now).questions[0];
  recordRating(state, WORDS[0].id, 3, now);
  const original = structuredClone(state.progress);
  recordQuizAnswer(state, q, false, now);
  assert.equal(state.activities.mistakes[q.wordId].wrongCount, 1);
  recordQuizAnswer(state, q, true, now);
  assert.equal(state.activities.mistakes[q.wordId], undefined);
  recordQuizAnswer(state, q, true, now);
  assert.equal(activityStats(state, now).xp, 8);
  assert.deepEqual(state.progress, original);
  assert.deepEqual(validateBackup(state), state);
});
test('completion requires all answers, is idempotent and unlocks real achievements', () => {
  const state = emptyState(), quiz = createQuiz('daily', WORDS, WORDS, now);
  assert.equal(completeQuiz(state, quiz, now), false);
  for (const q of quiz.questions) { recordQuizAnswer(state, q, true, now); quiz.answers.push({ choice: q.correctIndex, correct: true }); }
  assert.equal(completeQuiz(state, quiz, now), true);
  assert.equal(completeQuiz(state, quiz, now), false);
  const badges = achievements(state, now);
  assert.ok(badges.find(b => b.id === 'perfect').unlocked);
  assert.ok(badges.find(b => b.id === 'challenge').unlocked);
  assert.equal(badges.find(b => b.id === 'first').unlocked, false);
  assert.deepEqual(validateBackup(state), state);
});
test('old backups load unchanged while malformed practice records are rejected', () => {
  const old = emptyState(); assert.deepEqual(validateBackup(old), old);
  for (const malformed of [
    { days: { '2026-10-18': { answered: 0, correct: 1, rewarded: [], completed: [], dailyBest: 0 } }, mistakes: {} },
    { days: {}, mistakes: JSON.parse('{"__proto__":{"wrongCount":1,"lastAt":1}}') },
    { days: { '2026-10-18': { answered: 1, correct: 1, rewarded: ['a','a'], completed: [], dailyBest: 0 } }, mistakes: {} },
  ]) assert.throws(() => validateBackup({ ...old, activities: malformed }));
});
