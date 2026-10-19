'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createStore}=require('./store.cjs');
function createApp(options={}){
 const store=options.store||createStore(options.database||':memory:');
 const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/engine.js':['engine.js','text/javascript; charset=utf-8']};
 const buckets=new Map();
 const respond=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>8192){const error=new Error('Request too large.');error.status=413;throw error;}}try{return value?JSON.parse(value):{};}catch{const error=new Error('Invalid JSON.');error.status=400;throw error;}}
 const server=http.createServer(async(req,res)=>{
  const pathname=(req.url||'/').split('?')[0];
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(!pathname.startsWith('/api/')){
   const file=files[pathname];if(!file||req.method!=='GET'){res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(path.join(__dirname,file[0])).pipe(res);return;
  }
  try{
   if(req.method!=='GET'&&req.method!=='POST'){respond(res,405,{error:'Method not allowed.'});return;}
   if(req.method==='POST'){
    if(!(req.headers['content-type']||'').startsWith('application/json')){respond(res,415,{error:'Send JSON.'});return;}
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){respond(res,403,{error:'Cross-origin request blocked.'});return;}
   }
   const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('rng_session='))?.slice(12);
   const p=store.player(token);
   if(p.id!==token)res.setHeader('Set-Cookie',`rng_session=${p.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
   const now=Date.now(),bucket=buckets.get(p.id);
   if(bucket&&now-bucket.start<60000){if(++bucket.count>120){respond(res,429,{error:'Slow down a little. The numbers will wait.'});return;}}else buckets.set(p.id,{start:now,count:1});
   if(buckets.size>10000)for(const [key,value]of buckets)if(now-value.start>60000)buckets.delete(key);
   if(req.method==='GET'&&pathname==='/api/state'){respond(res,200,store.snapshot(p.id));return;}
   if(req.method!=='POST'){respond(res,404,{error:'Route not found.'});return;}
   const data=await body(req);
   if(pathname==='/api/roll')respond(res,200,store.draw(p.id,data.mode));
   else if(pathname==='/api/claim')respond(res,200,store.claim(p.id,data.quest));
   else if(pathname==='/api/action')respond(res,200,store.action(p.id,data.action));
   else if(pathname==='/api/profile')respond(res,200,store.rename(p.id,data.name));
   else if(pathname==='/api/secret')respond(res,200,store.secret(p.id,data));
   else respond(res,404,{error:'Route not found.'});
  }catch(error){respond(res,error.status||500,{error:error.status?error.message:'Something went wrong. Your saved roll is safe.'});if(!error.status)console.error(error);}
 });
 return {server,store};
}
if(require.main===module){const database=process.env.RNG_DATABASE||path.join(__dirname,'data','rng.sqlite');fs.mkdirSync(path.dirname(database),{recursive:true});const app=createApp({database});const port=Number(process.env.PORT)||3000;app.server.listen(port,'0.0.0.0',()=>console.log(`RNGdle → http://localhost:${port}`));}
module.exports={createApp};
