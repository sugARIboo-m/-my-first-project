import { unzipSync, strFromU8 } from '/vendor/fflate.js';
const NS={a:'http://schemas.openxmlformats.org/drawingml/2006/main',w:'http://schemas.openxmlformats.org/wordprocessingml/2006/main',r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships'};
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('Office 文件中的文字 XML 无法解析');return doc;}
export function parseOffice(buffer,filename){
  let expanded=0;
  const files=unzipSync(new Uint8Array(buffer),{filter:f=>{
    if(!/^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels)$/.test(f.name))return false;
    expanded+=f.originalSize;
    if(expanded>20*1024*1024||f.originalSize>5*1024*1024)throw new Error('Office 文本内容过大，请分段导入');
    return true;
  }});
  const read=name=>{if(!files[name])throw new Error('文件缺少必要的文档内容');return xml(strFromU8(files[name]));};
  const paragraphs=(doc,ns)=>[...doc.getElementsByTagNameNS(ns,'p')].map(p=>[...p.getElementsByTagNameNS(ns,'t')].map(t=>t.textContent).join('')).map(s=>s.trim()).filter(Boolean);
  const name=filename.replace(/\.(docx|pptx)$/i,'');
  if(/\.docx$/i.test(filename)){
    const doc=read('word/document.xml'),lines=paragraphs(doc,NS.w);
    if(!lines.length)throw new Error('Word 中未提取到文字，图片中的文字需先 OCR');
    return {title:name,chapters:[{id:'document',title:name,text:lines.join('\n\n')}],note:'已提取 Word 正文和表格文字；图片、公式图和批注不作 OCR。'};
  }
  if(!/\.pptx$/i.test(filename))throw new Error('请选择 DOCX 或 PPTX 文件');
  let slides=Object.keys(files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/(\d+)\.xml$/)[1])-Number(b.match(/(\d+)\.xml$/)[1]));
  if(files['ppt/presentation.xml']&&files['ppt/_rels/presentation.xml.rels']){
    const rels=new Map([...read('ppt/_rels/presentation.xml.rels').documentElement.children].map(e=>[e.getAttribute('Id'),e.getAttribute('Target')]));
    const ordered=[...read('ppt/presentation.xml').getElementsByTagNameNS('*','sldId')].map(e=>rels.get(e.getAttributeNS(NS.r,'id'))).filter(Boolean).map(t=>t.startsWith('/')?t.slice(1):'ppt/'+t.replace(/^\.\//,''));
    if(ordered.length&&ordered.every(n=>files[n]))slides=ordered;
  }
  if(slides.length>300)throw new Error('课件超过 300 页，请分课次导入');
  const chapters=slides.map((path,i)=>{const lines=paragraphs(read(path),NS.a);return {id:path,title:`第 ${i+1} 页${lines[0]?' · '+lines[0].slice(0,65):''}`,text:lines.join('\n\n')};}).filter(c=>c.text.length>0);
  if(!chapters.length)throw new Error('课件中未提取到文字，可能为图片课件，请先 OCR');
  return {title:name,chapters,note:'已按演示顺序提取幻灯片文字；插图、视频、备注中的文字未解析。'};
}
