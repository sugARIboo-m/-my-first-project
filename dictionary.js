import { WORDNET } from './dictionary/meta.js';
export { WORDNET };

export const DICTIONARIES = [
  { id: 'cambridge', name: '剑桥英汉词典', detail: '英汉释义 · 英美发音', url: word => 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/' + encodeURIComponent(word) },
  { id: 'oxford', name: '牛津学习词典', detail: '英文释义 · 用法与搭配', url: word => 'https://www.oxfordlearnersdictionaries.com/search/english/?q=' + encodeURIComponent(word) },
  { id: 'webster', name: 'Merriam-Webster 韦氏', detail: '美式英语 · 词义与词源', url: word => 'https://www.merriam-webster.com/dictionary/' + encodeURIComponent(word) },
];
const loaded = new Map();
async function load(filename) {
  if (!loaded.has(filename)) {
    const promise = fetch(new URL('dictionary/' + filename, import.meta.url)).then(response => {
      if (!response.ok) throw new Error('词典分区尚未缓存，请联网后重试。');
      return response.json();
    }).catch(error => { loaded.delete(filename); throw error; });
    loaded.set(filename, promise);
  }
  return loaded.get(filename);
}
export function normalizeTerm(value) {
  const term = String(value).trim().toLowerCase().replace(/[_\s]+/g, ' ').replace(/[’‘]/g, "'");
  if (!term || term.length > 80 || !/^[a-z0-9][a-z0-9 '\-.,()]*$/.test(term)) throw new Error('请输入英文单词或短语，最多 80 个字符。');
  return term;
}
async function exact(term) {
  const letter = /^[a-z]/.test(term) ? term[0] : '0';
  const shard = await load(letter + '.json');
  return Object.hasOwn(shard.entries, term) ? { lemma: term, senses: shard.entries[term] } : null;
}
export async function lookupWord(value) {
  const term = normalizeTerm(value);
  const found = await exact(term);
  if (found) return { ...found, requested: term };
  const { forms } = await load('exceptions.json');
  const candidates = Object.hasOwn(forms, term) ? [...forms[term]] : [];
  if (/ies$/.test(term)) candidates.push(term.slice(0, -3) + 'y');
  if (/s$/.test(term)) candidates.push(term.slice(0, -1));
  if (/es$/.test(term)) candidates.push(term.slice(0, -2));
  for (const ending of ['ing', 'ed']) if (term.endsWith(ending)) {
    const stem = term.slice(0, -ending.length);
    candidates.push(stem, stem + 'e');
    if (/(.)\1$/.test(stem)) candidates.push(stem.slice(0, -1));
    if (ending === 'ed' && stem.endsWith('i')) candidates.push(stem.slice(0, -1) + 'y');
  }
  for (const candidate of [...new Set(candidates)]) {
    const result = await exact(candidate);
    if (result) return { ...result, requested: term };
  }
  return { lemma: term, requested: term, senses: [] };
}
