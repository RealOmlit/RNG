const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const fs=require('node:fs');
const vm=require('node:vm');
const E=require('../engine.js');
const {createStore}=require('../store.cjs');
const {createApp}=require('../server.cjs');
const TIME=Date.UTC(2026,9,17,12);
function store(sequence=[123321]){let i=0;return createStore(':memory:',{random:()=>sequence[i++%sequence.length]});}
function status(fn,expected){assert.throws(fn,error=>error.status===expected);}
test('exhaustive badge frequencies are correct, all rarity tiers are reachable, and EP is additive',()=>{
 const frequencies=Object.fromEntries(E.BADGES.map(b=>[b.id,0])),tiers=Array(E.TIERS.length).fill(0);
 for(let n=0;n<=E.MAX;n++){const r=E.classify(n);r.hits.forEach(id=>frequencies[id]++);tiers[r.tier]++;if(n%101===0)assert.equal(r.ep,r.hits.reduce((s,id)=>s+E.badgeEP(id),0));}
 assert.deepEqual(frequencies,E.FREQUENCIES);assert.equal(tiers.reduce((a,b)=>a+b),1000001);assert.ok(tiers.every(n=>n>0));
 for(const a of E.BADGES)for(const b of E.BADGES)if(frequencies[a.id]<frequencies[b.id])assert.ok(E.badgeEP(a.id)>=E.badgeEP(b.id));
});
test('math badges handle primes, zero, Harshad numbers, squares and Fibonacci correctly',()=>{
 for(const n of [2,3,97,123457])assert.ok(E.isPrime(n));for(const n of [0,1,4,49,999999,1000000])assert.equal(E.isPrime(n),false);
 assert.ok(E.classify(123321).hits.includes('palindrome'));assert.ok(E.classify(18).hits.includes('harshad'));assert.equal(E.classify(0).hits.includes('harshad'),false);assert.ok(E.classify(144).hits.includes('square'));assert.ok(E.classify(144).hits.includes('fibonacci'));
});
test('cultural badges and inclusive seven-digit boundary score correctly',()=>{
 for(const [number,id]of [[1984,'year1984'],[2001,'year2001'],[1729,'taxicab'],[420,'weed'],[1337,'leet'],[69,'nice'],[777777,'jackpot'],[42,'fortyTwo'],[1000000,'boundary']])assert.ok(E.classify(number).hits.includes(id));
 assert.equal(E.classify(0).digits,'000000');assert.equal(E.classify(1000000).digits,'1000000');assert.equal(E.classify(1000000).hits.includes('six'),false);assert.throws(()=>E.classify(-1));assert.throws(()=>E.classify(1000001));assert.throws(()=>E.classify(0.5));
});
test('main daily outcome is immutable for a full 24 hours, including across UTC midnight',()=>{
 const s=store([123321,777777]);try{const p=s.player(),r=s.draw(p.id,'daily',TIME);assert.equal(r.roll.number,123321);assert.equal(r.roll.ep,E.classify(123321).ep);status(()=>s.draw(p.id,'daily',TIME+12*3600000),409);status(()=>s.draw(p.id,'daily',TIME+E.DAY-1),409);assert.equal(s.snapshot(p.id,TIME+100).draws[0].number,123321);assert.equal(s.draw(p.id,'daily',TIME+E.DAY).roll.number,777777);}finally{s.close();}
});
test('quests grant separate bonus rolls exactly once and never overwrite daily result',()=>{
 const s=store([123321,777777]);try{const p=s.player();status(()=>s.draw(p.id,'bonus',TIME),409);status(()=>s.claim(p.id,'daily',TIME),409);s.draw(p.id,'daily',TIME);const claimed=s.claim(p.id,'daily',TIME);assert.equal(claimed.bonus,1);status(()=>s.claim(p.id,'daily',TIME),409);const bonus=s.draw(p.id,'bonus',TIME+1);assert.equal(bonus.roll.number,777777);assert.equal(bonus.state.bonus,0);assert.equal(bonus.state.draws.find(r=>r.mode==='daily').number,123321);status(()=>s.draw(p.id,'bonus',TIME+2),409);}finally{s.close();}
});
test('all four quests are attainable and grant at most four daily bonus rolls',()=>{
 const s=store();try{const p=s.player();status(()=>s.action(p.id,'share',TIME),409);s.action(p.id,'rules',TIME);s.claim(p.id,'rules',TIME);s.draw(p.id,'daily',TIME);s.action(p.id,'share',TIME);
 for(const id of ['daily','share','badges'])s.claim(p.id,id,TIME);
 assert.equal(s.snapshot(p.id,TIME).bonus,4);for(let i=0;i<4;i++)s.draw(p.id,'bonus',TIME+i+1);assert.equal(s.snapshot(p.id,TIME+10).bonus,0);status(()=>s.draw(p.id,'bonus',TIME+11),409);assert.equal(s.snapshot(p.id,TIME).draws.length,5);
 }finally{s.close();}
});
test('unused quest rolls expire at UTC midnight and claims can renew the next day',()=>{
 const s=store();try{const p=s.player();s.action(p.id,'rules',TIME);s.claim(p.id,'rules',TIME);const midnight=Date.parse(E.dateKey(TIME))+E.DAY;assert.equal(s.snapshot(p.id,midnight-1).bonus,1);assert.equal(s.snapshot(p.id,midnight).bonus,0);status(()=>s.draw(p.id,'bonus',midnight),409);status(()=>s.claim(p.id,'rules',midnight),409);s.action(p.id,'rules',midnight);assert.equal(s.claim(p.id,'rules',midnight).bonus,1);}finally{s.close();}
});
test('daily leaderboard ranks real main rolls by EP, excludes bonus rolls, and resolves ties by time',()=>{
 const s=store([123457,123321,777777,123321]);try{const a=s.player(),b=s.player(),c=s.player();s.draw(a.id,'daily',TIME);s.draw(b.id,'daily',TIME+1);s.claim(a.id,'daily',TIME+2);s.draw(a.id,'bonus',TIME+3);s.draw(c.id,'daily',TIME+4);const board=s.snapshot(a.id,TIME+5).leaderboard;assert.equal(board.players,3);assert.equal(board.rows.length,3);assert.equal(board.rank,3);assert.equal(board.rows[0].number,123321);assert.equal(board.rows[1].number,123321);assert.equal(board.rows[2].number,123457);assert.equal(s.snapshot(b.id,TIME+5).leaderboard.rank,1);}finally{s.close();}
});
test('unknown modes, quests, actions and invalid names are rejected',()=>{
 const s=store();try{const p=s.player();status(()=>s.draw(p.id,'arcade',TIME),400);status(()=>s.claim(p.id,'fake',TIME),404);status(()=>s.action(p.id,'fake',TIME),400);status(()=>s.rename(p.id,'<script>'),400);assert.equal(s.rename(p.id,'Very_Unlucky-7').name,'Very_Unlucky-7');}finally{s.close();}
});
function request(app,path,{method='GET',data,cookie,origin}={}){return new Promise(resolve=>{const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);req.method=method;req.url=path;req.headers={host:'localhost:3000',...(method==='POST'?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...(origin?{origin}:{})};const headers={};let status;const res={setHeader:(k,v)=>headers[k.toLowerCase()]=v,writeHead:(s,h)=>{status=s;Object.assign(headers,h);},end:body=>resolve({status,headers,body:JSON.parse(body)})};app.server.emit('request',req,res);});}
test('API creates a private session, scores server-side, enforces the lock, and serves shared ranking',async()=>{
 const s=store([123321]),app=createApp({store:s});try{const initial=await request(app,'/api/state');assert.equal(initial.status,200);assert.match(initial.headers['set-cookie'],/HttpOnly; SameSite=Lax/);const cookie=initial.headers['set-cookie'].split(';')[0];
 const rolled=await request(app,'/api/roll',{method:'POST',cookie,data:{mode:'daily',number:777777,ep:9999999}});assert.equal(rolled.status,200);assert.equal(rolled.body.roll.number,123321);assert.equal(rolled.body.roll.ep,E.classify(123321).ep);
 const again=await request(app,'/api/roll',{method:'POST',cookie,data:{mode:'daily'}});assert.equal(again.status,409);
 const stranger=await request(app,'/api/state');assert.equal(stranger.body.draws.length,0);assert.equal(stranger.body.leaderboard.rows.length,1);
 const blocked=await request(app,'/api/claim',{method:'POST',cookie,origin:'https://bad.example',data:{quest:'daily'}});assert.equal(blocked.status,403);
 const bonus=await request(app,'/api/claim',{method:'POST',cookie,data:{quest:'daily'}});assert.equal(bonus.body.bonus,1);
 }finally{s.close();app.server.close();}
});
test('database persists rolls and quest claims across process-store recreation',()=>{
 const os=require('node:os'),path=require('node:path');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rngdle-')),file=path.join(dir,'test.sqlite');let s=createStore(file,{random:()=>420});const p=s.player();s.draw(p.id,'daily',TIME);s.claim(p.id,'daily',TIME);s.close();s=createStore(file);try{const result=s.snapshot(p.id,TIME+100);assert.equal(result.draws[0].number,420);assert.equal(result.bonus,1);status(()=>s.claim(p.id,'daily',TIME+100),409);}finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
function browser(app,{hostname='localhost'}={}){
 const html=fs.readFileSync('index.html','utf8'),source=fs.readFileSync('app.js','utf8');
 class Element{
  constructor(id){this.id=id;this.classes=new Set();this.children=[];this.listeners={};this.style={setProperty(){}};this.dataset={};this.textContent='';this.value='';this.open=false;this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:n=>this.classes.has(n),toggle:(n,value)=>{if(value??!this.classes.has(n))this.classes.add(n);else this.classes.delete(n);}};}
  set innerHTML(value){this.html=value;if(this.id==='reels')this.children=Array.from(value.matchAll(/<span>/g),()=>new Element());}get innerHTML(){return this.html||'';}
  addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(){}scrollIntoView(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));ids.reels.children=Array.from({length:6},()=>new Element());
 const nav=['play','collection','leaderboard'].map(view=>{const el=new Element();el.dataset.view=view;return el;});
 const body=new Element(),saved=new Map(),intervals=new Map();let cookie='',time=0,timerId=0,clipboard='';
 const context=vm.createContext({console,Date,Math,Set,JSON,Uint32Array,AbortController,TypeError,performance:{now:()=>time},crypto:{getRandomValues:a=>(a[0]=777777,a),randomUUID:()=>require('node:crypto').randomUUID()},matchMedia:()=>({matches:false}),location:{href:'http://localhost:3000/',protocol:'http:',hostname},navigator:{clipboard:{writeText:async text=>{clipboard=text;}}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,v)=>saved.set(key,v)},document:{body,activeElement:null,addEventListener(){},getElementById:id=>{assert.ok(ids[id],'Missing DOM ID '+id);return ids[id];},querySelectorAll:q=>q==='.nav-link'?nav:[]},window:{RNG:E,innerWidth:390,addEventListener(){}},fetch:async(path,options={})=>{const result=await request(app,path,{method:options.method||'GET',data:options.body?JSON.parse(options.body):undefined,cookie});if(result.headers['set-cookie'])cookie=result.headers['set-cookie'].split(';')[0];return {ok:result.status<400,status:result.status,headers:{get:()=> 'application/json'},json:async()=>result.body};},setTimeout:()=>0,clearTimeout(){},setInterval:(fn,ms)=>{intervals.set(++timerId,{fn,ms});return timerId;},clearInterval:id=>intervals.delete(id)});
 vm.runInContext(source,context);
 return {ids,clipboard:()=>clipboard,run:code=>vm.runInContext(code,context),async ready(){await new Promise(setImmediate);await new Promise(setImmediate);},advance(ms){for(let elapsed=0;elapsed<ms;elapsed+=65){time+=65;for(const [id,t]of [...intervals])if(t.ms<1000)t.fn();}},async roll(mode){const pending=vm.runInContext(`roll('${mode}')`,context);await this.ready();this.advance(8500);await pending;}};
}
test('frontend integrates with the real API for sequential reveal, EP, quest claims, sharing and bonus isolation',async()=>{
 const s=store([123321,1000000]),app=createApp({store:s}),b=browser(app);try{await b.ready();assert.equal(b.run('source'),'server');assert.equal(b.ids['roll-button'].disabled,false);
 const pending=b.run("roll('daily')");await b.ready();assert.equal(b.run('busy'),true);assert.equal(b.ids['result-summary'].classList.contains('hidden'),true);b.advance(1400);assert.equal(b.ids.reels.children[0].classList.contains('locked'),false);b.advance(200);assert.equal(b.ids.reels.children[0].classList.contains('locked'),true);b.advance(6000);await pending;
 assert.equal(b.ids.reels.children.map(el=>el.textContent).join(''),'123321');assert.equal(b.ids['result-ep'].textContent,String(E.classify(123321).ep));assert.equal(b.ids['roll-button'].disabled,true);assert.equal(b.run('state.leaderboard.rank'),1);
 await b.run('copyResult()');assert.match(b.clipboard(),/RNGdle · Daily/);assert.match(b.clipboard(),/123321/);assert.equal(b.run("state.quests.find(q=>q.id==='share').progress"),1);
 await b.run("claim('daily')");assert.equal(b.ids['bonus-button'].disabled,false);assert.equal(b.run('state.bonus'),1);await b.roll('bonus');assert.equal(b.ids.reels.children.length,7);assert.equal(b.ids.reels.children.map(el=>el.textContent).join(''),'1000000');assert.equal(b.run('latestDaily().number'),123321);assert.equal(b.run('state.leaderboard.rows[0].number'),123321);assert.equal(b.run('state.bonus'),0);
 }finally{s.close();app.server.close();}
});
test('frontend gracefully uses honest local mode when the static host has no API',async()=>{
 const app={server:{emit:(event,req,res)=>{res.writeHead(404,{});res.end(JSON.stringify({error:'No API'}));}}};const b=browser(app);await b.ready();assert.equal(b.run('source'),'local');assert.equal(b.run('state.leaderboard'),null);await b.roll('daily');assert.equal(b.run('state.draws.length'),1);assert.equal(b.ids['roll-button'].disabled,true);await b.run("claim('daily')");assert.equal(b.run('state.bonus'),1);assert.match(b.ids.leaderboard.innerHTML,/Global rankings aren’t available/);
});

test('GitHub Pages starts in local mode without contacting a nonexistent API',async()=>{
 let called=false;const app={server:{emit:()=>{called=true;throw Error('Pages has no API');}}};const b=browser(app,{hostname:'realomlit.github.io'});await b.ready();assert.equal(called,false);assert.equal(b.run('source'),'local');assert.equal(b.ids['roll-button'].disabled,false);await b.roll('daily');assert.equal(b.run('state.draws.length'),1);assert.equal(called,false);
});
