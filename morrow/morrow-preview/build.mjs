import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory = new URL('./', import.meta.url);
const read = name => readFile(new URL(name,directory),'utf8');
const [html,css,domain,messages,app,gardenDomain,gardenMessages,gardenArt,gardenStore,gardenUi,gardenCss,experienceDomain,experiences,cloudConfig,cloudState,cloudClient,cloudSync,cloudMessages,cloudUi,quickDomain,quickMessages,quickUi,quickCss] = await Promise.all(['index.html','preview.css','domain.js','messages.js','preview.js','eras/domain.js','eras/messages.js','eras/art.js','eras/store.js','eras/ui.js','eras/styles.css','eras/experience-domain.js','eras/experiences.js','cloud/config.js','cloud/state.js','cloud/client.js','cloud/sync.js','cloud/messages.js','cloud/ui.js','ledger/domain.js','ledger/messages.js','ledger/ui.js','ledger/styles.css'].map(read));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length) throw new Error('Duplicate HTML/SVG IDs');
const strip=source=>source.replace(/^import .*?;\n/gm,'').replace(/^export /gm,'');
const script = [domain,messages,quickDomain,quickMessages,gardenDomain,gardenMessages,gardenArt,experienceDomain,cloudConfig,cloudState,gardenStore,cloudClient,cloudSync,cloudMessages,cloudUi,experiences,gardenUi,quickUi,app].map(strip).join('\n');
if (/^import /m.test(script)) throw new Error('Unbundled import in standalone');
const styleMarker='<link rel="stylesheet" href="preview.css">';
const scriptMarker='<script type="module" src="preview.js"></script>';
if(!html.includes(styleMarker)||!html.includes(scriptMarker)) throw new Error('Build markers missing');
const result=html.replace('<link rel="manifest" href="manifest.webmanifest">','').replace('<link rel="icon" type="image/svg+xml" href="app-icon.svg">','').replace('<link rel="stylesheet" href="eras/styles.css">','').replace('<link rel="stylesheet" href="ledger/styles.css">','').replace(styleMarker,()=>'<style>\n'+css+'\n'+gardenCss+'\n'+quickCss+'\n</style>')
 .replace(scriptMarker,()=>'<script>\n(()=>{\n'+script+'\n})();\n</script>');
await writeFile(new URL('morrow.html',directory),result);
await writeFile(new URL('eras-review.html',directory),result.replace('</body>','<script>window.addEventListener("load",()=>document.getElementById("eras-section").scrollIntoView());</script></body>'));
console.log('Standalone generated:',fileURLToPath(new URL('morrow.html',directory)));
