export function cents(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) throw new Error('金额请填写正数，最多两位小数');
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('金额超出范围或为零');
  return result;
}
export function totals(items) {
  return items.reduce((r, t) => { r[t.type] += t.amount; return r; }, {income:0,expense:0});
}
export function parseCSV(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted) throw new Error('CSV 引号未闭合');
  row.push(field);if(row.some(Boolean))rows.push(row);
  const header=rows.shift()?.map(x=>x.trim().replace(/^\uFEFF/,''));
  if(header?.join(',')!=='日期,类型,分类,金额,账户,备注')throw new Error('请使用模板表头：日期,类型,分类,金额,账户,备注。平台原始账单需先转换为此格式。');
  return rows.map((r,i)=>{
    const [date,type,category,amount,account,note]=r.map(x=>x.trim());
    if(r.length!==6||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!['收入','支出'].includes(type)||!category)throw new Error(`第 ${i+2} 行格式错误`);
    return {date,type:type==='收入'?'income':'expense',category,amount:cents(amount),account:account||'其他',note};
  });
}
