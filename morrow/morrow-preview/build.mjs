import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory = new URL('./', import.meta.url);
const read = name => readFile(new URL(name,directory),'utf8');
const [html,css,domain,messages,app,gardenDomain,gardenMessages,gardenArt,gardenStore,gardenUi,gardenCss,experienceDomain,experiences] = await Promise.all(['index.html','preview.css','domain.js','messages.js','preview.js','eras/domain.js','eras/messages.js','eras/art.js','eras/store.js','eras/ui.js','eras/styles.css','eras/experience-domain.js','eras/experiences.js'].map(read));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length) throw new Error('Duplicate HTML/SVG IDs');
const strip=source=>source.replace(/^import .*?;\n/gm,'').replace(/^export /gm,'');
const script = [domain,messages,gardenDomain,gardenMessages,gardenArt,experienceDomain,gardenStore,experiences,gardenUi,app].map(strip).join('\n');
if (/^import /m.test(script)) throw new Error('Unbundled import in standalone');
const styleMarker='<link rel="stylesheet" href="preview.css">';
const scriptMarker='<script type="module" src="preview.js"></script>';
if(!html.includes(styleMarker)||!html.includes(scriptMarker)) throw new Error('Build markers missing');
const result=html.replace('<link rel="stylesheet" href="eras/styles.css">','').replace(styleMarker,()=>'<style>\n'+css+'\n'+gardenCss+'\n</style>')
 .replace(scriptMarker,()=>'<script>\n(()=>{\n'+script+'\n})();\n</script>');
await writeFile(new URL('morrow.html',directory),result);
await writeFile(new URL('eras-review.html',directory),result.replace('</body>','<script>window.addEventListener("load",()=>document.getElementById("eras-section").scrollIntoView());</script></body>'));
console.log('Standalone generated:',fileURLToPath(new URL('morrow.html',directory)));
