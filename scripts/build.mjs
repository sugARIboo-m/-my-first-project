import { mkdir, readFile,writeFile,rm,copyFile,cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'vendor'),{recursive:true});
const files=['index.html','styles.css','features.css','app.js','core.js','course.js','data.js','glossary.js','epub.js','office.js','icon.svg','manifest.webmanifest','activities.js','features.js','dictionary.js'];
await cp(path.join(root,'dictionary'),path.join(out,'dictionary'),{recursive:true});
for(const file of files){
 let content=await readFile(path.join(root,file),'utf8');
 if(file==='index.html')content=content.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
 if(file==='app.js')content=content.replaceAll('src="/','src="./').replaceAll('href="/','href="./');
 if(['app.js','epub.js','office.js'].includes(file))content=content.replaceAll("'/vendor/","'./vendor/").replaceAll("from '/vendor/","from './vendor/");
 if(file==='app.js')content=content.replaceAll("fetch('/reading-library.json')","fetch('./reading-library.json')").replaceAll("fetch('/course-library.json')","fetch('./course-library.json')").replaceAll("register('/sw.js')","register('./sw.js')");
 if(file==='manifest.webmanifest'){
  const manifest=JSON.parse(content);manifest.start_url='./';manifest.scope='./';manifest.icons=manifest.icons.map(i=>({...i,src:'./'+i.src.replace(/^\//,'')}));content=JSON.stringify(manifest);
 }
 await writeFile(path.join(out,file),content);
}
for(const [src,dest] of [['node_modules/pdfjs-dist/build/pdf.mjs','vendor/pdf.mjs'],['node_modules/pdfjs-dist/build/pdf.worker.mjs','vendor/pdf.worker.mjs'],['node_modules/fflate/esm/browser.js','vendor/fflate.js']])await copyFile(path.join(root,src),path.join(out,dest));
for(const [src,dest] of [['node_modules/pdfjs-dist/LICENSE','vendor/LICENSE-pdfjs.txt'],['node_modules/fflate/LICENSE','vendor/LICENSE-fflate.txt']])await copyFile(path.join(root,src),path.join(out,dest));
await writeFile(path.join(out,'sw.js'),`const CACHE='wordlane-static-v3';
const base=new URL('./',self.location.href);
const assets=${JSON.stringify(['./',...files,'dictionary/meta.js','dictionary/LICENSE.txt','vendor/pdf.mjs','vendor/pdf.worker.mjs','vendor/fflate.js'])}.map(p=>new URL(p,base).href);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(assets)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&e.request.url.startsWith(base.href))e.respondWith(fetch(e.request).then(res=>{if(res.ok&&(assets.includes(e.request.url)||e.request.url.startsWith(new URL('dictionary/',base).href))){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}));}return res;}).catch(()=>caches.match(e.request).then(res=>res||new Response('当前离线，文件尚未缓存',{status:503}))));});
`);
await writeFile(path.join(out,'.nojekyll'),'');
console.log('Static web build ready in dist/. Personal .local books, teacher files, progress and trial access keys are excluded.');
