import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount, isCalendarDate, monthWindow, summarize, upsertRecord} from '../domain.js';

const expense = {id:'1',type:'expense',amount:1234,date:'2026-10-17',category:'dining'};
test('decimal money stays exact up to safe integer limits', () => {
  assert.equal(parseAmount('0.29'),29);
  assert.equal(parseAmount('90071992547409.91'),Number.MAX_SAFE_INTEGER);
  for(const input of ['0','-1','1.234','1e4','90071992547409.92']) assert.throws(()=>parseAmount(input));
});
test('real calendar dates and six-month windows cross years without timezone shifts', () => {
  assert(isCalendarDate('2024-02-29'));
  assert(!isCalendarDate('2026-02-29'));
  assert(!isCalendarDate('2026-04-31'));
  assert.deepEqual(monthWindow('2027-02'),['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']);
});
test('editing an expense into another month and income reconciles both months', () => {
  const records=upsertRecord([expense],{...expense,type:'income',amount:5000,date:'2026-09-18'});
  assert.equal(records.length,1);
  assert.equal(summarize({},records,'2026-10').expense,0);
  assert.equal(summarize({},records,'2026-09').income,5000);
  assert.equal(summarize({},records,'2026-09').expense,0);
});
test('deleting changes totals once; category names cannot collide with object prototypes', () => {
  const record={...expense,category:'__proto__'};
  assert.equal(summarize({},[record],'2026-10').categories.get('__proto__'),1234);
  assert.equal(summarize({},[record].filter(r=>r.id!=='1'),'2026-10').expense,0);
});
test('background demo history is preserved without replaying manual account balances', () => {
  const base={'2026-10':{income:10000,expense:2000,categories:{dining:2000}}};
  const total=summarize(base,[expense],'2026-10');
  assert.equal(total.income,10000);assert.equal(total.expense,3234);
  assert.equal(total.categories.get('dining'),3234);assert.equal(base['2026-10'].expense,2000);
});
test('summary overflow rejects instead of losing precision', () => {
  const base={'2026-10':{income:0,expense:Number.MAX_SAFE_INTEGER,categories:{}}};
  assert.throws(()=>summarize(base,[expense],'2026-10'),/totalOverflow/);
});
