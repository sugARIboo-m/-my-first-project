import { unzipSync, strFromU8 } from '/vendor/fflate.js';
const MAX_UNPACKED=40*1024*1024;
const parseXML=text=>{const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw new Error('EPUB 的目录文件无法解析');return d;};
const byName=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
function resolvePath(base,href){
  const clean=decodeURIComponent(href.split('#')[0]);
  if(/^[a-z][a-z0-9+.-]*:/i.test(clean))throw new Error('不支持 EPUB 中的外部章节链接');
  const parts=(base+clean).split('/'),out=[];
  for(const p of parts){if(p==='..'){if(!out.length)throw new Error('EPUB 路径不正确');out.pop();}else if(p&&p!=='.')out.push(p);}
  return out.join('/');
}
export async function parseEpub(buffer){
  let size=0;
  const files=unzipSync(new Uint8Array(buffer),{filter:file=>{
    if(!/\.(xml|opf|ncx|xhtml|html|htm)$/i.test(file.name))return false;
    size+=file.originalSize;
    if(size>MAX_UNPACKED||file.originalSize>5*1024*1024)throw new Error('EPUB 解压内容过大，请按章节导入文字');
    return true;
  }});
  const read=name=>{if(!files[name])throw new Error('EPUB 缺少必要文件：'+name);return strFromU8(files[name]);};
  if(files['META-INF/encryption.xml'])throw new Error('此 EPUB 含加密资源，请提供可正常读取的无加密版本');
  const container=parseXML(read('META-INF/container.xml'));
  const opfPath=byName(container,'rootfile')[0]?.getAttribute('full-path');
  if(!opfPath)throw new Error('未找到 EPUB 的书籍目录');
  const opf=parseXML(read(opfPath));const base=opfPath.includes('/')?opfPath.slice(0,opfPath.lastIndexOf('/')+1):'';
  const title=byName(opf,'title')[0]?.textContent.trim()||'我的 EPUB 阅读';
  const author=byName(opf,'creator')[0]?.textContent.trim()||'';
  const manifest=new Map(byName(opf,'item').map(item=>[item.getAttribute('id'),item]));
  const labels=new Map();
  // Prefer table-of-contents labels; handle chapters with no h1/h2 as well.
  for(const item of manifest.values()){
    if(item.getAttribute('media-type')==='application/x-dtbncx+xml'){
      const ncx=parseXML(read(resolvePath(base,item.getAttribute('href'))));
      for(const point of byName(ncx,'navPoint')){
        const content=byName(point,'content')[0],label=byName(point,'navLabel')[0];
        if(content&&label)labels.set(resolvePath(base,content.getAttribute('src')),label.textContent.trim());
      }
    }
  }
  const chapters=[];
  for(const ref of byName(opf,'itemref')){
    if(ref.getAttribute('linear')==='no')continue;
    const item=manifest.get(ref.getAttribute('idref'));if(!item)continue;
    const href=item.getAttribute('href');if(!href||!['application/xhtml+xml','text/html'].includes(item.getAttribute('media-type')))continue;
    if((item.getAttribute('properties')||'').split(/\s+/).includes('nav'))continue;
    const file=resolvePath(base,href);
    const doc=new DOMParser().parseFromString(read(file),'text/html');
    doc.querySelectorAll('script,style,nav,iframe,object,svg').forEach(el=>el.remove());
    const blocks=[...doc.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote')].filter(el=>!el.querySelector('p,li,blockquote'));
    const text=(blocks.length?blocks.map(el=>el.textContent.trim()).filter(Boolean).join('\n\n'):doc.body.textContent).replace(/[\t ]+/g,' ').trim();
    if(text.length<150||/\b(cover|title|copyright|brandpage|dedication|toc|endpage)\b/i.test(file.replace(/\.(xhtml|html)$/i,'')))continue;
    const heading=labels.get(file)||doc.querySelector('h1,h2,h3')?.textContent.trim()||`章节 ${chapters.length+1}`;
    if(heading.toLowerCase()==='contents')continue;
    chapters.push({id:file,title:heading,text});
  }
  if(!chapters.length)throw new Error('没有提取到可阅读章节，文件可能是扫描版或受保护的 EPUB');
  return {title,author,chapters};
}
