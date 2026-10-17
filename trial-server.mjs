// Temporary, cookie-protected access for a private Wordlane trial.
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
const port=Number(process.env.TRIAL_PORT||3001);
const token=randomBytes(32).toString('base64url');
const created=Date.now(),expires=created+3*60*60*1000;
const filename=new URL('.local/trial-session.json',import.meta.url);
await mkdir(new URL('.local/',import.meta.url),{recursive:true});
await writeFile(filename,JSON.stringify({token,created,expires,port}),{mode:0o600});
const same=value=>typeof value==='string'&&Buffer.byteLength(value)===Buffer.byteLength(token)&&timingSafeEqual(Buffer.from(value),Buffer.from(token));
const cookie=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wordlane_trial='))?.slice('wordlane_trial='.length);
const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(Date.now()>expires){res.writeHead(410,{'Content-Type':'text/plain; charset=utf-8'});res.end('本次试用已结束，请回到对话重新开启。');return;}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/access'&&same(url.searchParams.get('key'))){
    res.writeHead(303,{'Location':'/','Set-Cookie':`wordlane_trial=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor((expires-Date.now())/1000)}; Path=/`});res.end();return;
  }
  if(!same(cookie(req))){res.writeHead(401,{'Content-Type':'text/plain; charset=utf-8'});res.end('请使用对话中提供的完整试用入口打开。');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  const upstream=http.request({hostname:'127.0.0.1',port:3000,path:req.url,method:req.method,headers:{accept:req.headers.accept||'*/*'}},response=>{
    for(const [key,value] of Object.entries(response.headers))if(value!==undefined&&!['cache-control','set-cookie','connection','transfer-encoding'].includes(key))res.setHeader(key,value);
    res.writeHead(response.statusCode||502);response.pipe(res);
  });
  upstream.setTimeout(15000,()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end('应用暂时未启动，请稍后重试。');});
  upstream.end();
});
server.listen(port,'127.0.0.1',()=>console.log(`Protected Wordlane trial on port ${port}; maximum lifetime 3 hours.`));
server.on('error',e=>{console.error(e.code||'Trial server failed');process.exitCode=1;});
