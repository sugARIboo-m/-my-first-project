// Pure preview-domain helpers. They never read or write browser storage.
export function parseAmount(input) {
  const text = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('invalidAmount');
  const [whole, fraction = ''] = text.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('invalidAmount');
  return Number(amount);
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function monthWindow(month) {
  const [year, number] = month.split('-').map(Number);
  return Array.from({length: 6}, (_, index) => {
    const date = new Date(Date.UTC(year, number - 6 + index, 15));
    return date.toISOString().slice(0, 7);
  });
}

function add(a, b) {
  const value = a + b;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('totalOverflow');
  return value;
}

export function summarize(base, records, month) {
  const initial = base[month] ?? {income: 0, expense: 0, categories: {}};
  const result = {
    income: initial.income,
    expense: initial.expense,
    categories: new Map(Object.entries(initial.categories))
  };
  for (const record of records) {
    if (record.date.slice(0, 7) !== month) continue;
    result[record.type] = add(result[record.type], record.amount);
    if (record.type === 'expense') {
      result.categories.set(record.category, add(result.categories.get(record.category) ?? 0, record.amount));
    }
  }
  return result;
}

export function upsertRecord(records, next) {
  if (!isCalendarDate(next.date)) throw new Error('invalidDate');
  if (!['income', 'expense'].includes(next.type)) throw new Error('invalidType');
  if (!Number.isSafeInteger(next.amount) || next.amount <= 0) throw new Error('invalidAmount');
  const position = records.findIndex(record => record.id === next.id);
  return position === -1
    ? [next, ...records]
    : records.map((record, index) => index === position ? next : record);
}
