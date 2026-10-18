import { dayKey, streak, wordPattern } from './core.js';

const TYPES = ['daily', 'context', 'mistakes'];
function hash(text) {
  let value = 2166136261;
  for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return value >>> 0;
}
function ordered(values, seed, key = x => x.id) {
  return [...values].sort((a, b) => hash(seed + key(a)) - hash(seed + key(b)) || key(a).localeCompare(key(b)));
}

export function createQuiz(type, pool, allWords, now = Date.now()) {
  if (!TYPES.includes(type)) throw new Error('未知练习类型');
  const seed = dayKey(new Date(now)) + ':' + type;
  const seen = new Set();
  const candidates = pool.filter(w => {
    if (!w.word || !w.meaning || seen.has(w.word.toLowerCase()) || w.classTags?.includes('语法术语')) return false;
    seen.add(w.word.toLowerCase());
    return type !== 'context' || w.example && new RegExp(wordPattern(w.word), 'i').test(w.example);
  });
  const questions = [];
  for (const w of ordered(candidates, seed)) {
    const matched = type === 'context' ? w.example.match(new RegExp(wordPattern(w.word), 'i')) : null;
    const answer = matched ? matched[0] : w.meaning;
    const labels = new Set([answer.toLowerCase()]);
    const distractors = ordered(allWords.filter(x => x.word.toLowerCase() !== w.word.toLowerCase()), seed + w.id)
      .flatMap(x => {
        const label = type === 'context' ? x.word : x.meaning;
        if (!label || labels.has(label.toLowerCase())) return [];
        labels.add(label.toLowerCase());
        return [label];
      }).slice(0, 3);
    if (distractors.length < 3) continue;
    const options = ordered([answer, ...distractors].map((label, i) => ({ id: String(i), label })), seed + ':options:' + w.id);
    questions.push({ wordId: w.id, word: w.word, meaning: w.meaning, example: w.example || '',
      translation: w.translation || '', options: options.map(o => o.label), correctIndex: options.findIndex(o => o.id === '0'),
      prompt: matched ? w.example.replace(new RegExp(wordPattern(w.word), 'gi'), '________') : w.word });
    if (questions.length === (type === 'mistakes' ? 10 : 5)) break;
  }
  return { type, questions, answers: [], index: 0, startedAt: now, finishedSaved: false };
}

export function activityDay(state, now = Date.now()) {
  return state.activities?.days?.[dayKey(new Date(now))] || { answered: 0, correct: 0, rewarded: [], completed: [], dailyBest: 0 };
}
function writableDay(state, now) {
  state.activities ||= { days: {}, mistakes: {} };
  return state.activities.days[dayKey(new Date(now))] ||= { answered: 0, correct: 0, rewarded: [], completed: [], dailyBest: 0 };
}
export function recordQuizAnswer(state, question, correct, now = Date.now()) {
  const day = writableDay(state, now);
  day.answered++;
  if (correct) {
    day.correct++;
    if (!day.rewarded.includes(question.wordId)) day.rewarded.push(question.wordId);
    delete state.activities.mistakes[question.wordId];
  } else {
    const previous = state.activities.mistakes[question.wordId];
    state.activities.mistakes[question.wordId] = { wrongCount: (previous?.wrongCount || 0) + 1, lastAt: now };
  }
}
export function completeQuiz(state, quiz, now = Date.now()) {
  if (quiz.finishedSaved || !quiz.questions.length || quiz.answers.length !== quiz.questions.length) return false;
  const day = writableDay(state, now);
  if (!day.completed.includes(quiz.type)) day.completed.push(quiz.type);
  if (quiz.type === 'daily') day.dailyBest = Math.max(day.dailyBest, quiz.answers.filter(a => a.correct).length);
  quiz.finishedSaved = true;
  return true;
}
export function activityStats(state, now = Date.now()) {
  const days = state.activities?.days || {};
  const rated = Object.values(state.history).reduce((n, d) => n + d.reviewed.length, 0);
  const quizXp = Object.values(days).reduce((n, d) => n + d.rewarded.length * 3, 0);
  const xp = rated * 5 + quizXp;
  const combined = { ...state.history };
  for (const [date, d] of Object.entries(days)) if (d.answered) combined[date] = { attempts: 1 };
  return { xp, level: Math.floor(xp / 100) + 1, next: 100 - xp % 100, within: xp % 100,
    streak: streak(combined, new Date(now)), pending: Object.keys(state.activities?.mistakes || {}).length,
    correct: Object.values(days).reduce((n, d) => n + d.correct, 0), today: activityDay(state, now) };
}
export function achievements(state, now = Date.now()) {
  const progress = state.progress, days = Object.values(state.activities?.days || {});
  const studiedFrom = type => new Set(state.materials.filter(m => m.type === type).flatMap(m => m.wordIds).filter(id => progress[id])).size;
  const allDays = { ...state.history };
  for (const [date, d] of Object.entries(state.activities?.days || {})) if (d.answered) allDays[date] = { attempts: 1 };
  const longest = Math.max(0, ...Object.keys(allDays).map(date => streak(allDays, new Date(date + 'T12:00:00'))));
  return [
    ['first', '第一步', '学习并评分第一个单词', Object.keys(progress).length, 1, 'leaf'],
    ['challenge', '接受挑战', '完成一次每日五词挑战', days.filter(d => d.completed.includes('daily')).length, 1, 'target'],
    ['perfect', '漂亮的五连', '每日挑战一轮五题全部答对', Math.max(0, ...days.map(d => d.dailyBest)), 5, 'star'],
    ['classroom', '与课堂同行', '学习课本资料中的一个词', studiedFrom('textbook'), 1, 'graduation'],
    ['reading', '阅读拾光', '学习阅读资料中的一个词', studiedFrom('reading'), 1, 'coffee'],
    ['streak', '三日约定', '连续三天学习或参加练习', longest, 3, 'flame'],
    ['fifty', '渐入佳境', '累计学习并评分五十个词', Object.keys(progress).length, 50, 'book'],
  ].map(([id, title, description, value, goal, icon]) => ({ id, title, description, value, goal, icon, unlocked: value >= goal }));
}
