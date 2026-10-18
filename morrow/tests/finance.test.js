import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,totals,parseCSV} from '../finance.js';
test('金额精确到分并拒绝无效金额',()=>{assert.equal(cents('0.29'),29);assert.equal(cents('102.50'),10250);for(const v of ['-1','0','1.234','NaN','1e3'])assert.throws(()=>cents(v));});
test('收支独立合计',()=>assert.deepEqual(totals([{type:'expense',amount:29},{type:'expense',amount:10},{type:'income',amount:500}]),{income:500,expense:39}));
test('解析带 BOM、逗号、换行和引号的中文账单',()=>{const rows=parseCSV('\uFEFF日期,类型,分类,金额,账户,备注\r\n2026-10-17,支出,餐饮,28.50,微信,"午餐,饮料\n""好喝"""');assert.equal(rows[0].amount,2850);assert.equal(rows[0].note,'午餐,饮料\n"好喝"');});
test('错误日期和平台原始账单拒绝导入',()=>{assert.throws(()=>parseCSV('平台原始账单'));assert.throws(()=>parseCSV('日期,类型,分类,金额,账户,备注\n2026-02-30,支出,餐饮,20,微信,午餐'));});
