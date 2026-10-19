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
function browser(app,{hostname='localhost',savedEntries=[],storageBlocked=false,reducedMotion=false}={}){
 const html=fs.readFileSync('index.html','utf8'),source=fs.readFileSync('app.js','utf8');
 class Element{
  constructor(id){this.id=id;this.classes=new Set();this.children=[];this.listeners={};this.style={setProperty(){}};this.dataset={};this.textContent='';this.value='';this.open=false;this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:n=>this.classes.has(n),toggle:(n,value)=>{if(value??!this.classes.has(n))this.classes.add(n);else this.classes.delete(n);}};}
  set innerHTML(value){this.html=value;if(this.id==='reels')this.children=Array.from(value.matchAll(/<span>/g),()=>new Element());}get innerHTML(){return this.html||'';}
  addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(){}scrollIntoView(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));ids.reels.children=Array.from({length:6},()=>new Element());
 const nav=['play','collection','leaderboard'].map(view=>{const el=new Element();el.dataset.view=view;return el;});
 const body=new Element(),saved=new Map(savedEntries),intervals=new Map();let cookie='',time=0,timerId=0,clipboard='';
 const context=vm.createContext({console,Date,Math,Set,JSON,Uint32Array,AbortController,TypeError,performance:{now:()=>time},crypto:{getRandomValues:a=>(a[0]=777777,a),randomUUID:()=>require('node:crypto').randomUUID()},matchMedia:()=>({matches:reducedMotion}),location:{href:'http://localhost:3000/',protocol:'http:',hostname},navigator:{clipboard:{writeText:async text=>{clipboard=text;}}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,v)=>{if(storageBlocked)throw Error('Storage full');saved.set(key,v);}},document:{body,activeElement:null,addEventListener(){},getElementById:id=>{assert.ok(ids[id],'Missing DOM ID '+id);return ids[id];},querySelectorAll:q=>q==='.nav-link'?nav:[]},window:{RNG:E,innerWidth:390,addEventListener(){}},fetch:async(path,options={})=>{const result=await request(app,path,{method:options.method||'GET',data:options.body?JSON.parse(options.body):undefined,cookie});if(result.headers['set-cookie'])cookie=result.headers['set-cookie'].split(';')[0];return {ok:result.status<400,status:result.status,headers:{get:()=> 'application/json'},json:async()=>result.body};},setTimeout:()=>0,clearTimeout(){},setInterval:(fn,ms)=>{intervals.set(++timerId,{fn,ms});return timerId;},clearInterval:id=>intervals.delete(id)});
 vm.runInContext(source,context);
 return {ids,clipboard:()=>clipboard,run:code=>vm.runInContext(code,context),async ready(){await new Promise(setImmediate);await new Promise(setImmediate);},advance(ms){for(let elapsed=0;elapsed<ms;elapsed+=65){time+=65;for(const [id,t]of [...intervals])if(t.ms<1000)t.fn();}},async roll(mode){const pending=vm.runInContext(`roll('${mode}')`,context);await this.ready();this.advance(30000);await pending;}};
}
test('frontend integrates with the real API for sequential reveal, EP, quest claims, sharing and bonus isolation',async()=>{
 const s=store([123321,1000000]),app=createApp({store:s}),b=browser(app);try{await b.ready();assert.equal(b.run('source'),'server');assert.equal(b.ids['roll-button'].disabled,false);
 const pending=b.run("roll('daily')");await b.ready();assert.equal(b.run('busy'),true);assert.equal(b.ids['result-summary'].classList.contains('hidden'),true);b.advance(1600);assert.equal(b.ids.reels.children[0].classList.contains('locked'),false);b.advance(250);assert.equal(b.ids.reels.children[0].classList.contains('locked'),true);b.advance(7000);assert.equal(b.ids.reels.children[4].classList.contains('locked'),true);assert.equal(b.ids.reels.children[5].classList.contains('locked'),false);assert.equal(b.ids['roll-card'].classList.contains('final-digit'),true);assert.equal(b.ids['result-summary'].classList.contains('hidden'),true);b.advance(4000);assert.equal(b.ids['result-summary'].classList.contains('hidden'),false);assert.ok(Number(b.ids['result-ep'].textContent)<E.classify(123321).ep);b.advance(15000);await pending;
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

test('expanded cabinet has 100 distinct attainable badges with positive calibrated rewards',()=>{
 assert.equal(E.BADGES.length,100);assert.equal(new Set(E.BADGES.map(b=>b.id)).size,100);
 for(const b of E.BADGES){assert.ok(E.FREQUENCIES[b.id]>0,b.id);assert.ok(E.badgeEP(b.id)>=5,b.id);assert.ok(['patterns','math','culture','special'].includes(b.category),b.id);}
});

test('new mathematics badges match known values and exact modular arithmetic',()=>{
 const examples={cube:[0,1,8,27,1000000],triangular:[0,1,3,6,10,15],pentagonal:[0,1,5,12,22,35],hexagonal:[0,1,6,15,28,45],factorial:[1,2,6,24,362880],power3:[1,3,9,531441],power5:[1,5,25,390625],perfect:[6,28,496,8128],abundant:[12,18,20],deficient:[1,2,3,13],semiprime:[4,6,9,15,49],smith:[4,22,27,58,666],narcissist:[0,1,153,370,371,407,9474,548834],automorphic:[0,1,5,6,25,76,376,625,109376,890625],trimorphic:[0,1,4,5,6,9,24,49],pronic:[0,2,6,12,20,30],happy:[1,7,10,19,1000000]};
 for(const [id,numbers]of Object.entries(examples))for(const n of numbers)assert.ok(E.findPatterns(n).includes(id),`${id}: ${n}`);
 for(const n of [0,2,4,16,20])assert.equal(E.findPatterns(n).includes('happy'),false,`unhappy: ${n}`);
 for(const n of [0,1,2,8,12,16,27])assert.equal(E.findPatterns(n).includes('semiprime'),false,`not semiprime: ${n}`);
 for(const n of [1,2,3,7,11,13])assert.equal(E.findPatterns(n).includes('smith'),false,`not Smith: ${n}`);
 for(const n of [0,1,49,625,99999,109376,890625,999999,1000000]){const raw=BigInt(n),mod=10n**BigInt(String(n).length),hits=E.findPatterns(n);assert.equal(hits.includes('automorphic'),raw**2n%mod===raw);assert.equal(hits.includes('trimorphic'),raw**3n%mod===raw);}
});

test('new digit patterns respect six-digit padding and the seven-digit boundary',()=>{
 for(const [id,n]of [['threePairs',112233],['fullHouse',111223],['doubleTriples',111222],['straight5',912345],['ascending',123449],['descending',987711],['step2',246802],['nextHalf',123124],['nearMirror',123421],['unique5',123451],['unique4',123414],['unique3',123123],['unique2',121212],['ends00',123400],['ends000',123000],['ends123',456123],['starts123',123999],['piPrefix',314159],['ePrefix',271828],['sqrt2Prefix',141421],['agent',7],['calculator',80085],['telephone',867530],['speed',88],['leetExact',1337],['zero',0],['one',1],['maximumSix',999999]])assert.ok(E.findPatterns(n).includes(id),`${id}: ${n}`);
 for(const id of ['distinct','threePairs','fullHouse','doubleTriples','straight5','ascending','descending','step2','nextHalf','nearMirror'])assert.equal(E.findPatterns(1000000).includes(id),false,id);
 assert.equal(E.findPatterns(111111).includes('ascending'),false);assert.equal(E.findPatterns(123123).includes('nextHalf'),false);
});

test('existing SQLite rolls are rescored once so history, leaderboard and badge EP agree',()=>{
 const os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rngdle-upgrade-')),file=path.join(dir,'test.sqlite');
 let s=createStore(file,{random:()=>123321});const p=s.player();s.draw(p.id,'daily',TIME);s.claim(p.id,'daily',TIME);s.close();
 const db=new DatabaseSync(file);db.exec("UPDATE rolls SET ep=1; DELETE FROM metadata;");db.close();s=createStore(file);
 try{const result=s.snapshot(p.id,TIME+100),expected=E.classify(123321).ep;assert.equal(result.draws[0].ep,expected);assert.equal(result.leaderboard.rows[0].ep,expected);assert.equal(result.nextDailyAt,TIME+E.DAY);assert.equal(result.bonus,1);assert.equal(result.quests.find(q=>q.id==='daily').claimed,true);}finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});

const pagesApp={server:{emit:()=>{throw Error('Static mode must not request an API');}}};
test('local saves gain the new badges and scores while keeping daily locks and claims',async()=>{
 const at=Date.now()-1000,raw={name:'Old player',draws:[{id:'old',number:123321,mode:'daily',at,ep:1},{number:2000000,at,mode:'daily'},{number:3,at:null,mode:'daily'}],claims:[{id:'daily',date:E.dateKey(at)}],actions:null};
 const b=browser(pagesApp,{hostname:'realomlit.github.io',savedEntries:[['rngdle-v3-local',JSON.stringify(raw)]]});await b.ready();assert.equal(b.run('state.draws.length'),1);assert.equal(b.run('state.draws[0].ep'),E.classify(123321).ep);assert.equal(b.run('state.bonus'),1);assert.equal(b.ids['roll-button'].disabled,true);assert.equal(Number(b.ids['collection-count'].textContent),E.classify(123321).hits.length);assert.equal(b.ids['result-ep'].textContent,String(E.classify(123321).ep));
});

test('full browser storage keeps new progress in memory across later mutations',async()=>{
 const old={name:'Old player',draws:[],claims:[],actions:[]},b=browser(pagesApp,{hostname:'realomlit.github.io',storageBlocked:true,savedEntries:[['rngdle-v3-local',JSON.stringify(old)]]});await b.ready();await b.roll('daily');await b.run("claim('daily')");assert.equal(b.run('state.draws.length'),1);assert.equal(b.run('state.bonus'),1);await b.roll('bonus');assert.equal(b.run('state.draws.length'),2);assert.equal(b.run('state.bonus'),0);await b.run('refresh()');assert.equal(b.run('state.draws.length'),2);
});

test('reveal skip completes quickly with the exact saved outcome, score, and discoveries',async()=>{
 const s=store([123321]),app=createApp({store:s}),b=browser(app);try{await b.ready();const pending=b.run("roll('daily')");await b.ready();b.advance(500);assert.equal(b.ids['result-summary'].classList.contains('hidden'),true);assert.equal(b.ids['skip-reveal'].classList.contains('hidden'),false);b.ids['skip-reveal'].listeners.click();b.advance(100);await pending;assert.equal(b.run('busy'),false);assert.equal(b.ids.reels.children.map(el=>el.textContent).join(''),'123321');assert.equal(b.ids['result-ep'].textContent,String(E.classify(123321).ep));assert.equal(b.ids['skip-reveal'].classList.contains('hidden'),true);assert.match(b.ids['earned-badges'].innerHTML,/NEW/);assert.equal(b.run('state.draws.length'),1);}finally{s.close();app.server.close();}
});

test('reduced-motion preference and less-suspense setting both finish in under a second',async()=>{
 for(const options of [{reducedMotion:true},{savedEntries:[['rngdle-settings','{"less":true}']]}]){const b=browser(pagesApp,{hostname:'realomlit.github.io',...options});await b.ready();const pending=b.run("roll('daily')");await b.ready();b.advance(700);await pending;assert.equal(b.run('busy'),false);assert.equal(b.ids.reels.children.map(el=>el.textContent).join(''),'777777');assert.equal(b.ids['result-ep'].textContent,String(E.classify(777777).ep));}
});

test('badge search, category, discovery filters and rarity sorting work together',async()=>{
 const b=browser(pagesApp,{hostname:'realomlit.github.io'});await b.ready();assert.equal((b.ids['collection-grid'].innerHTML.match(/<article/g)||[]).length,100);
 b.ids['badge-search'].listeners.input({target:{value:'teapot'}});assert.match(b.ids['collection-grid'].innerHTML,/I’m a teapot/);assert.equal(b.ids['badge-results-count'].textContent,'1 shown');
 b.ids['badge-category'].listeners.change({target:{value:'math'}});assert.match(b.ids['collection-grid'].innerHTML,/No badges match/);
 b.ids['badge-search'].listeners.input({target:{value:''}});assert.equal((b.ids['collection-grid'].innerHTML.match(/<article/g)||[]).length,E.BADGES.filter(b=>b.category==='math').length);
 b.ids['badge-category'].listeners.change({target:{value:'all'}});b.ids['badge-sort'].listeners.change({target:{value:'rarest'}});assert.ok(b.ids['collection-grid'].innerHTML.indexOf('Literally 1984')<b.ids['collection-grid'].innerHTML.indexOf('Even Steven'));
 b.run("filter='found';renderCollection()");assert.match(b.ids['collection-grid'].innerHTML,/No badges match/);await b.roll('daily');assert.equal((b.ids['collection-grid'].innerHTML.match(/<article/g)||[]).length,E.classify(777777).hits.length);
});

test('a lost response after a committed bonus roll recovers that bonus without spending another',async()=>{
 const s=store([123321,1000000]),app=createApp({store:s}),b=browser(app);try{await b.ready();await b.roll('daily');await b.run("claim('daily')");b.run("const originalApi=api;api=async(path,data)=>{const result=await originalApi(path,data);if(path==='roll')throw new TypeError('Response lost');return result;}");await b.roll('bonus');assert.equal(b.run('state.draws.length'),2);assert.equal(b.run('state.bonus'),0);assert.equal(b.run('currentResult.number'),1000000);assert.equal(b.run('currentResult.mode'),'bonus');assert.equal(b.run('latestDaily().number'),123321);}finally{s.close();app.server.close();}
});

test('local mutation locks serialize competing daily rolls and duplicate claims',async()=>{
 const b=browser(pagesApp,{hostname:'realomlit.github.io'});await b.ready();b.run("let lockQueue=Promise.resolve();navigator.locks={request:(name,fn)=>{const next=lockQueue.then(fn);lockQueue=next.catch(()=>{});return next;}}");
 const rolls=await b.run("Promise.allSettled([mutate('roll',{mode:'daily'}),mutate('roll',{mode:'daily'})])");assert.equal(rolls.filter(r=>r.status==='fulfilled').length,1);assert.equal(b.run('local.draws.length'),1);
 const claims=await b.run("Promise.allSettled([mutate('claim',{quest:'daily'}),mutate('claim',{quest:'daily'})])");assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);assert.equal(b.run('localSnapshot().bonus'),1);
});

test('the secret code unlocks a persistent toggle and malformed or incorrect codes do not',()=>{
 const locked={unlocked:false,enabled:false};
 for(const request of [null,[],{},'123456',{code:123456},{code:'000000'},{enabled:'true'}])status(()=>E.updateSecret(locked,request),400);
 status(()=>E.updateSecret(locked,{enabled:true}),403);
 const active=E.updateSecret(locked,{code:' 123456 '});assert.deepEqual(active,{unlocked:true,enabled:true});
 const paused=E.updateSecret(active,{enabled:false});assert.deepEqual(paused,{unlocked:true,enabled:false});assert.equal(E.updateSecret(paused,{enabled:true}).enabled,true);
 assert.ok(E.INFINITY_NUMBERS.length>1);for(const number of E.INFINITY_NUMBERS)assert.equal(E.classify(number).rarity,'anomaly');
});

test('Infinity grants unlimited Anomaly rolls without spending quest rolls or changing daily ranking',()=>{
 const s=store([123321,1000000]);try{const p=s.player();s.draw(p.id,'daily',TIME);s.claim(p.id,'daily',TIME);s.secret(p.id,{code:'123456'},TIME+1);
 for(let i=0;i<12;i++){const result=s.draw(p.id,'bonus',TIME+2+i);assert.equal(result.roll.boosted,true);assert.equal(E.classify(result.roll.number).rarity,'anomaly');assert.equal(result.roll.ep,E.classify(result.roll.number).ep);assert.equal(result.state.bonus,1);assert.equal(result.state.leaderboard.players,1);assert.equal(result.state.leaderboard.rows[0].number,123321);assert.equal(result.state.nextDailyAt,TIME+E.DAY);}
 status(()=>s.draw(p.id,'daily',TIME+100),409);s.secret(p.id,{enabled:false},TIME+101);const normal=s.draw(p.id,'bonus',TIME+102);assert.equal(normal.roll.boosted,false);assert.equal(normal.roll.number,1000000);assert.equal(normal.state.bonus,0);status(()=>s.draw(p.id,'bonus',TIME+103),409);
 }finally{s.close();}
});

test('unlocking before a main roll leaves ranked outcomes uniform and requires no quest balance',()=>{
 const s=store([123457]);try{const p=s.player();s.secret(p.id,{code:'123456'},TIME);for(let i=0;i<5;i++)assert.equal(s.draw(p.id,'bonus',TIME+i).state.bonus,0);assert.equal(s.snapshot(p.id,TIME+10).leaderboard.players,0);const main=s.draw(p.id,'daily',TIME+11);assert.equal(main.roll.number,123457);assert.equal(main.roll.boosted,false);assert.equal(main.state.leaderboard.players,1);assert.equal(main.state.nextDailyAt,TIME+11+E.DAY);}finally{s.close();}
});

test('Infinity unlock, paused state and boosted roll markers persist through SQLite reopen',()=>{
 const os=require('node:os'),path=require('node:path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rngdle-infinity-')),file=path.join(dir,'test.sqlite');let s=createStore(file);const p=s.player();s.secret(p.id,{code:'123456'},TIME);s.draw(p.id,'bonus',TIME+1);s.close();s=createStore(file);assert.deepEqual(s.snapshot(p.id,TIME+2).secret,{unlocked:true,enabled:true});assert.equal(s.snapshot(p.id,TIME+2).draws[0].boosted,1);s.secret(p.id,{enabled:false},TIME+3);s.close();s=createStore(file);
 try{assert.deepEqual(s.snapshot(p.id,TIME+4).secret,{unlocked:true,enabled:false});status(()=>s.draw(p.id,'bonus',TIME+5),409);s.secret(p.id,{enabled:true},TIME+6);assert.equal(s.draw(p.id,'bonus',TIME+7).roll.boosted,true);}finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('pre-Infinity database schema upgrades while preserving old rolls and cooldowns',()=>{
 const os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rngdle-old-schema-')),file=path.join(dir,'test.sqlite'),db=new DatabaseSync(file);
 db.exec("CREATE TABLE players(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE TABLE rolls(id TEXT PRIMARY KEY,player TEXT NOT NULL REFERENCES players(id),number INTEGER NOT NULL,mode TEXT NOT NULL,at INTEGER NOT NULL,ep INTEGER NOT NULL); INSERT INTO players VALUES('original','Original player');");db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?,?)').run('saved','original',123321,'daily',TIME,E.classify(123321).ep);db.close();const s=createStore(file);
 try{const state=s.snapshot('original',TIME+100);assert.equal(state.draws[0].boosted,0);assert.equal(state.draws[0].number,123321);assert.equal(state.nextDailyAt,TIME+E.DAY);assert.deepEqual(state.secret,{unlocked:false,enabled:false});s.secret('original',{code:'123456'},TIME+101);assert.equal(s.draw('original','bonus',TIME+102).roll.boosted,true);}finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('secret API validates the code server-side and keeps unlocks private to each session',async()=>{
 const s=store(),app=createApp({store:s});try{const initial=await request(app,'/api/state'),cookie=initial.headers['set-cookie'].split(';')[0];
 for(const data of [null,{code:'000000'},{enabled:true}]){const result=await request(app,'/api/secret',{method:'POST',cookie,data});assert.ok([400,403].includes(result.status));}
 const spoofed=await request(app,'/api/roll',{method:'POST',cookie,data:{mode:'bonus',boosted:true,secret:{enabled:true}}});assert.equal(spoofed.status,409);
 const unlocked=await request(app,'/api/secret',{method:'POST',cookie,data:{code:'123456'}});assert.equal(unlocked.status,200);assert.equal(unlocked.body.secret.enabled,true);
 const infinity=await request(app,'/api/roll',{method:'POST',cookie,data:{mode:'bonus',number:123456,ep:999999}});assert.equal(infinity.body.roll.boosted,true);assert.equal(E.classify(infinity.body.roll.number).rarity,'anomaly');assert.equal(infinity.body.state.leaderboard.players,0);
 const stranger=await request(app,'/api/state');assert.equal(stranger.body.secret.unlocked,false);assert.equal(stranger.body.draws.length,0);
 }finally{s.close();app.server.close();}
});

test('frontend code entry unlocks unlimited rolls, labels boosted shares and restores normal play',async()=>{
 const s=store([123321]),app=createApp({store:s}),b=browser(app);try{await b.ready();await b.roll('daily');b.ids['secret-button'].listeners.click();assert.equal(b.ids['secret-dialog'].open,true);await b.run("changeSecret({code:'000000'})");assert.equal(b.run('infinityOn()'),false);assert.equal(b.ids['secret-dialog'].open,true);assert.match(b.ids['secret-error'].textContent,/code did nothing/);
 await b.run("changeSecret({code:'123456'})");assert.equal(b.run('infinityOn()'),true);assert.equal(b.ids['secret-dialog'].open,false);assert.equal(b.ids['infinity-banner'].classList.contains('hidden'),false);assert.equal(b.ids['bonus-balance'].textContent,'∞');assert.equal(b.ids['roll-button'].disabled,false);assert.match(b.ids['roll-button'].innerHTML,/infinite luck/);
 const pending=b.ids['roll-button'].listeners.click();await b.ready();b.advance(30000);await pending;assert.equal(b.run('currentResult.boosted'),true);assert.equal(b.ids['result-rarity'].textContent,'Anomaly');assert.match(b.ids['draw-heading'].textContent,/infinity/);await b.run('copyResult()');assert.match(b.clipboard(),/Infinity mode \(boosted · unranked\)/);
 await b.run("changeSecret({enabled:false})");assert.equal(b.run('state.secret.unlocked'),true);assert.equal(b.run('infinityOn()'),false);assert.equal(b.ids['roll-button'].disabled,true);assert.equal(b.ids['bonus-balance'].textContent,0);assert.equal(b.run('latestDaily().number'),123321);assert.equal(b.run('state.leaderboard.rows[0].number'),123321);await b.run("changeSecret({enabled:true})");assert.equal(b.ids['roll-button'].disabled,false);
 }finally{s.close();app.server.close();}
});

test('static-host Infinity survives refreshing and preserves a claimed normal quest roll',async()=>{
 const b=browser(pagesApp,{hostname:'realomlit.github.io',reducedMotion:true});await b.ready();await b.roll('daily');await b.run("claim('daily')");await b.run("changeSecret({code:'123456'})");for(let i=0;i<6;i++)await b.roll('bonus');await b.run('refresh()');assert.equal(b.run('infinityOn()'),true);assert.equal(b.run('state.bonus'),1);assert.equal(b.run('state.draws.filter(r=>r.boosted).length'),6);assert.equal(b.run("state.draws.filter(r=>r.boosted).every(r=>E.classify(r.number).rarity==='anomaly')"),true);await b.run("changeSecret({enabled:false})");await b.roll('bonus');assert.equal(b.run('state.bonus'),0);assert.equal(b.run('currentResult.boosted'),false);assert.equal(b.run('state.draws.filter(r=>r.boosted).length'),6);
});
