import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const allowed = new Set(['index.html', 'styles.css', 'app.js', 'core.js', 'data.js', 'sw.js', 'icon.svg', 'manifest.webmanifest', 'vendor/pdf.mjs', 'vendor/pdf.worker.mjs', 'epub.js', 'glossary.js', 'vendor/fflate.js', 'reading-library.json', 'course-library.json', 'office.js', 'course.js']);
for (const file of ['features.css','features.js','activities.js','dictionary.js','level.css','level.js','level-ui.js','selection.js','frequency.js','selection-lexicon.js','frequency-DATA-NOTICE.txt']) allowed.add(file);
const port = Number(process.env.PORT || 3000);
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!allowed.has(name) && !/^dictionary\/(?:[a-z0]\.json|exceptions\.json|meta\.js|LICENSE\.txt)$/.test(name)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const actual = name === 'vendor/pdf.mjs' ? 'node_modules/pdfjs-dist/build/pdf.mjs' : name === 'vendor/pdf.worker.mjs' ? 'node_modules/pdfjs-dist/build/pdf.worker.mjs' : name === 'vendor/fflate.js' ? 'node_modules/fflate/esm/browser.js' : name === 'reading-library.json' ? '.local/reading-book.json' : name === 'course-library.json' ? '.local/course-library.json' : name;
    const data = await readFile(path.join(root, actual));
    res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Wordlane listening on port ${port}`));
