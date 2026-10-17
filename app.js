'use strict';
const E=window.RNG,$=id=>document.getElementById(id),fmt=n=>n.toLocaleString('en-US');
const LOCAL_KEY='rngdle-v3-local',SETTINGS_KEY='rngdle-settings';
let state=null,local=null,source='connecting',busy=false,currentResult=null,displayMode='daily',filter='all',toastTimer,audioContext,timeOffset=0,lastQuestDate='',settings={sound:false,less:false};
try{settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};}catch{}
const now=()=>Date.now()+timeOffset;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function randomNumber(){const a=new Uint32Array(1),limit=Math.floor(4294967296/E.OUTCOMES)*E.OUTCOMES;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%E.OUTCOMES;}
function loadLocal(){
 try{const raw=JSON.parse(localStorage.getItem(LOCAL_KEY));if(raw&&Array.isArray(raw.draws)){local={name:'Local player',claims:[],actions:[],...raw};return;}}catch{}
 local={name:'Local player',draws:[],claims:[],actions:[]};
 try{const old=JSON.parse(localStorage.getItem('rng-void-v2'));if(Array.isArray(old?.draws))local.draws=old.draws.filter(r=>Number.isInteger(r.number)&&r.number>=0&&r.number<=E.MAX).map(r=>({id:r.id,number:r.number,mode:r.mode==='daily'?'daily':'legacy',at:r.at||Date.parse(r.date),ep:E.classify(r.number).ep}));
 else{const earlier=JSON.parse(localStorage.getItem('lucky-daily-v1'));if(Array.isArray(earlier?.rolls))local.draws=earlier.rolls.filter(r=>Number.isInteger(r.number)&&r.number>=0&&r.number<=E.MAX).map((r,i)=>({id:'legacy-'+i,number:r.number,mode:'daily',at:Date.parse(r.date),ep:E.classify(r.number).ep}));}}catch{}
 saveLocal();
}
function saveLocal(){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(local));}catch{toast('Storage is unavailable. Keep this tab open to retain your progress.');}}
function localSnapshot(){const date=E.dateKey(now()),actions=local.actions.filter(a=>a.date===date).map(a=>a.id),last=[...local.draws].filter(r=>r.mode==='daily').sort((a,b)=>b.at-a.at)[0];return {source:'local',name:local.name,draws:local.draws,claims:local.claims,actions,now:now(),nextDailyAt:last?last.at+E.DAY:0,bonus:E.bonusBalance(local.draws,local.claims,date),quests:E.QUESTS.map(q=>({...q,progress:E.questProgress(q.id,local.draws,actions,date),claimed:local.claims.some(c=>c.date===date&&c.id===q.id)})),leaderboard:null};}
async function api(path,data){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{const response=await fetch('/api/'+path,{method:data?'POST':'GET',credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:controller.signal});
 if(!(response.headers.get('content-type')||'').includes('application/json')){const error=new Error('Backend unavailable.');error.status=404;throw error;}
 const payload=await response.json();if(!response.ok){const error=new Error(payload.error||'Connection failed.');error.status=response.status;throw error;}return payload;
 }finally{clearTimeout(timer);}
}
async function mutate(path,data){
 if(source==='server')return api(path,data);
 if(source!=='local')throw new Error('Still connecting. Please try again.');
 // Refresh local storage before validating rewards or the 24-hour lock.
 loadLocal();let snapshot=localSnapshot();
 if(path==='roll'){
  if(data.mode==='daily'&&now()<snapshot.nextDailyAt)throw new Error('Your main daily result is locked.');
  if(data.mode==='bonus'&&snapshot.bonus<1)throw new Error('Claim a quest reward to earn another roll.');
  const number=randomNumber(),roll={id:crypto.randomUUID(),number,mode:data.mode,at:now(),ep:E.classify(number).ep};local.draws.push(roll);saveLocal();return {roll,state:localSnapshot()};
 }
 if(path==='action'){
  if(!['rules','share'].includes(data.action))throw new Error('Unknown quest.');
  if(data.action==='share'&&!local.draws.length)throw new Error('Roll a result first.');
  if(!local.actions.some(a=>a.date===E.dateKey(now())&&a.id===data.action))local.actions.push({date:E.dateKey(now()),id:data.action});
 }
 if(path==='claim'){
  const quest=snapshot.quests.find(q=>q.id===data.quest);if(!quest||quest.claimed||quest.progress<quest.target)throw new Error('This reward is unavailable.');
  local.claims.push({date:E.dateKey(now()),id:quest.id});
 }
 if(path==='profile')local.name=data.name;
 saveLocal();return localSnapshot();
}
function useState(data){state=data;source=data.source;timeOffset=data.now-Date.now();lastQuestDate=E.dateKey(now());render();}
function latestDaily(){return state?.draws.filter(r=>r.mode==='daily').sort((a,b)=>b.at-a.at)[0];}
function discoveries(){return new Set((state?.draws||[]).flatMap(r=>E.classify(r.number).hits));}
function streak(){const dates=new Set((state?.draws||[]).filter(r=>r.mode==='daily').map(r=>E.dateKey(r.at)));let day=Date.parse(E.dateKey(now()));if(!dates.has(E.dateKey(day)))day-=E.DAY;let n=0;while(dates.has(E.dateKey(day))){n++;day-=E.DAY;}return n;}
function render(){if(!state)return;renderQuests();renderCollection();renderHistory();renderBoard();$('bonus-balance').textContent=state.bonus;$('bonus-button').disabled=busy||state.bonus<1;$('streak-number').textContent=streak();$('your-rank').textContent=state.leaderboard?.rank?'#'+state.leaderboard.rank:'—';$('connection-status').textContent=source==='server'?'Shared leaderboard':'Local play';$('connection-status').title=source==='server'?'Rolls and rankings saved on this server.':'Your rolls and quest progress are saved in this browser.';$('leaderboard-help').textContent=source==='server'?'The leaderboard is shared by everyone playing on this server. No skill, money, or luck boosts involved.':'This edition saves progress in your browser. Global rankings need the shared game server. No skill, money, or luck boosts involved.';$('edition').textContent='RNGdle #'+Math.max(1,Math.floor((now()-Date.UTC(2026,0,1))/E.DAY)+1)+' · '+new Date(now()).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).toUpperCase();tick();}
function renderQuests(){
 $('quests').innerHTML=state.quests.map(q=>`<article class="quest ${q.claimed?'claimed':''}"><div class="quest-top"><h3>${q.name}</h3><span class="quest-reward">${q.claimed?'✓ claimed':'+1 roll'}</span></div><p>${q.description}</p><div class="quest-bottom"><div class="quest-track"><i style="width:${Math.min(100,q.progress/q.target*100)}%"></i></div><span>${q.progress}/${q.target}</span></div>${!q.claimed&&q.progress>=q.target?`<button class="claim-button" data-claim="${q.id}" ${busy?'disabled':''}>Claim 1 quest roll ↗</button>`:!q.claimed&&q.id==='rules'?'<button class="quest-action" data-action="rules">Read the rules ↗</button>':!q.claimed&&q.id==='share'?'<button class="quest-action" data-action="share">Copy my result ↗</button>':''}</article>`).join('');
}
function renderCollection(){const found=discoveries();$('collection-count').textContent=found.size;$('collection-progress').textContent=`${found.size} / ${E.BADGES.length} found`;
 const badges=E.BADGES.filter(b=>filter==='all'||(filter==='found'?found.has(b.id):!found.has(b.id)));
 $('collection-grid').innerHTML=badges.length?badges.map(b=>`<article class="collectible ${found.has(b.id)?'unlocked':''}"><div class="collectible-top"><span class="badge-icon">${b.icon}</span><span>+${E.badgeEP(b.id)} EP</span></div><h3>${b.name}</h3><p>${b.description}</p><small>${found.has(b.id)?'✓ Discovered':'Not discovered yet'} · 1 in ${formatOdds(E.OUTCOMES/E.FREQUENCIES[b.id])}</small></article>`).join(''):'<p class="empty">Nothing here yet. There is no strategy to improve this.</p>';
}
function formatOdds(n){return n<100?n.toFixed(1):fmt(Math.round(n));}
function renderHistory(){const rows=state.draws;$('total-ep').textContent=fmt(rows.reduce((sum,r)=>sum+r.ep,0))+' EP lifetime';$('history').innerHTML=rows.length?[...rows].sort((a,b)=>b.at-a.at).slice(0,12).map(r=>{const t=E.TIERS[E.classify(r.number).tier];return `<div class="history-row" style="--tier:${t.color}"><b>${String(r.number).padStart(6,'0')}</b><span>${r.mode==='daily'?'Main daily':r.mode==='bonus'?'Quest roll':'Legacy'} · ${new Date(r.at).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}</span><span>${t.name}</span><span>${fmt(r.ep)} EP</span></div>`;}).join(''):'<p class="empty">Nothing to blame on probability. Yet.</p>';}
function renderBoard(){const board=state.leaderboard;$('leaderboard-date').textContent=E.dateKey(now());$('leaderboard-players').textContent=board?board.players+' daily player'+(board.players===1?'':'s'):'';
 if(!board){$('leaderboard').innerHTML='<p class="empty">Global rankings aren’t available in this edition.<br>Your daily rolls, quests, and badges still work.</p>';$('leaderboard-note').textContent='Progress is saved in this browser. Local results are not uploaded or given a global rank.';return;}
 $('leaderboard').innerHTML=board.rows.length?board.rows.map((r,i)=>{const t=E.TIERS[E.classify(r.number).tier];return `<div class="board-row ${r.yours?'yours':''}" style="--tier:${t.color}"><span class="board-rank">${i+1}</span><span class="board-name">${escape(r.name)}${r.yours?'<small>you</small>':''}</span><b>${String(r.number).padStart(6,'0')}</b><span class="board-tier">${t.name}</span><span class="board-ep">${fmt(r.ep)} EP</span></div>`;}).join(''):'<p class="empty">Nobody has rolled today. An excellent opportunity to briefly be #1.</p>';
 $('leaderboard-note').textContent=`Top 25 main rolls for this UTC day. You’re playing as ${state.name}.${board.rank?' Your rank: #'+board.rank+'.':''} Quest rolls and local-only results are excluded.`;
}
function renderLadder(){$('rarity-ladder').innerHTML=E.TIERS.map((t,i)=>`<div class="rarity-row" style="--tier:${t.color}"><span class="rarity-dot"></span><span>${t.name}</span><span>${t.min}${E.TIERS[i+1]?'–'+(E.TIERS[i+1].min-1):'+'} EP</span></div>`).join('');}
function setReels(count){$('reels').classList.toggle('seven',count===7);if($('reels').children.length!==count)$('reels').innerHTML=Array.from({length:count},()=>'<span>?</span>').join('');}
function idle(){displayMode='daily';currentResult=null;$('roll-card').classList.remove('result-enter');setReels(6);$('reels').classList.remove('revealed');[...$('reels').children].forEach(el=>{el.textContent='?';el.classList.remove('locked','spinning','lock-in');});$('draw-heading').textContent='Your daily roll';$('availability').textContent='1 roll available';$('result-summary').classList.add('hidden');$('result-badges').classList.add('hidden');$('share-button').classList.add('hidden');$('return-daily').classList.add('hidden');$('machine-status').textContent='The RNG gods are waiting.';$('reveal-fill').style.width='0%';$('roll-button').disabled=!state;$('roll-button').innerHTML='Roll my daily number <span>↗</span>';$('roll-note').textContent='Locked in instantly. The suspense is just for your benefit.';}
function showResult(roll){
 currentResult=roll;displayMode=roll.mode;const r=E.classify(roll.number),t=E.TIERS[r.tier];setReels(r.digits.length);
 [...$('reels').children].forEach((el,i)=>{el.textContent=r.digits[i];el.classList.remove('locked','spinning','lock-in');});$('reels').classList.add('revealed');$('roll-card').style.setProperty('--rarity',t.color);$('roll-card').classList.add('result-enter');
 $('draw-heading').textContent=roll.mode==='daily'?'Your daily result':'Your quest roll';$('availability').textContent=roll.mode==='daily'?'Locked in':'Bonus · unranked';$('machine-status').textContent=t.message;$('reveal-fill').style.width='100%';
 $('result-summary').classList.remove('hidden');$('result-ep').textContent=fmt(roll.ep);$('result-rarity').textContent=t.name;$('rarity-comment').textContent=roll.mode==='daily'?'Your official daily result.':'Extra luck. Your main result hasn’t changed.';
 $('result-badges').classList.remove('hidden');$('badge-hit-count').textContent=r.hits.length+' badge'+(r.hits.length===1?'':'s');
 $('earned-badges').innerHTML=r.hits.length?r.hits.map(id=>{const b=E.BADGES.find(b=>b.id===id);return `<div class="earned-badge"><span class="badge-icon">${b.icon}</span><div><b>${b.name}</b><p>${b.description}</p></div><span>+${E.badgeEP(id)} EP</span></div>`;}).join(''):'<p class="empty">No badges. A truly unremarkable achievement.</p>';
 $('share-button').classList.remove('hidden');$('return-daily').classList.toggle('hidden',roll.mode==='daily');const ready=state&&now()>=state.nextDailyAt;
 $('roll-button').disabled=!ready;$('roll-button').innerHTML=ready?'Roll my daily number <span>↗</span>':'Daily roll locked <span>✓</span>';
 $('roll-note').textContent=roll.mode==='daily'?'No take-backs. Quests earn separate bonus rolls.':'Quest rolls never replace your ranked daily result.';
}
function tone(frequency,duration=.06){if(!settings.sound)return;try{audioContext ||=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);osc.type='triangle';osc.frequency.value=frequency;gain.gain.setValueAtTime(.03,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);osc.start();osc.stop(audioContext.currentTime+duration);}catch{}}
function less(){return settings.less||matchMedia('(prefers-reduced-motion: reduce)').matches;}
async function roll(mode='daily'){
 if(busy||!state)return;busy=true;$('roll-button').disabled=true;$('bonus-button').disabled=true;$('share-button').classList.add('hidden');$('roll-button').textContent='Consulting the RNG gods…';renderQuests();
 try{
  const payload=await mutate('roll',{mode}),roll=payload.roll,r=E.classify(roll.number),reduced=less();
  // The server has already locked and persisted this result before the animation begins.
  state=payload.state;source=state.source;timeOffset=state.now-Date.now();setReels(r.digits.length);$('reels').classList.remove('revealed');$('roll-card').classList.add('rolling');$('roll-card').classList.remove('result-enter');$('roll-card').setAttribute('aria-busy','true');$('result-summary').classList.add('hidden');$('result-badges').classList.add('hidden');$('draw-heading').textContent=mode==='daily'?'Your daily roll':'One more roll of fate';$('availability').textContent='Already decided';$('machine-status').textContent='Your number is locked. Your nerves aren’t.';
  const duration=reduced?1800:7200,start=performance.now(),count=r.digits.length,first=reduced?250:1500,spacing=reduced?200:850;let previous=0;
  if(window.innerWidth<650)$('machine').scrollIntoView({behavior:reduced?'auto':'smooth',block:'center'});
  await new Promise(resolve=>{const timer=setInterval(()=>{const elapsed=performance.now()-start,locked=Math.min(count,Math.max(0,Math.floor((elapsed-first)/spacing)+1));
   [...$('reels').children].forEach((el,i)=>{const done=i<locked;el.textContent=done?r.digits[i]:String(Math.floor(Math.random()*10));el.classList.toggle('locked',done);el.classList.toggle('spinning',!done);if(done&&i>=previous){el.classList.add('lock-in');tone(220+i*75,.12);}});
   $('reveal-fill').style.width=Math.min(100,elapsed/duration*100)+'%';if(locked!==previous)$('machine-status').textContent=locked===count?'Calculating how smug you’re allowed to be…':locked===count-1?'One digit left. Deep breaths.':`${locked} of ${count} digits revealed. No skill detected.`;previous=locked;
   if(elapsed>=Math.max(duration,first+(count-1)*spacing+400)){clearInterval(timer);resolve();}
  },65);});
  showResult(roll);render();tone(660,.2);setTimeout(()=>tone(880,.25),160);
  if(window.innerWidth<650)$('result-summary').scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'});
 }catch(error){toast(error.message||'Couldn’t connect. Retry to recover your saved result.');
  // A lost response may follow a committed roll: recover instead of generating another one.
  try{if(source==='server')useState(await api('state'));else if(local){loadLocal();useState(localSnapshot());}}catch{}
  const saved=latestDaily();if(saved)showResult(saved);else idle();
 }finally{busy=false;$('roll-card').classList.remove('rolling');$('roll-card').setAttribute('aria-busy','false');if(state){render();if(currentResult)showResult(currentResult);else idle();}}
}
async function claim(id){if(busy||!state)return;busy=true;try{useState(await mutate('claim',{quest:id}));toast('Quest complete. +1 bonus roll.');}catch(error){toast(error.message);}finally{busy=false;render();}}
async function recordAction(action){if(!state||busy)return;try{useState(await mutate('action',{action}));}catch(error){toast(error.message);}}
async function copyResult(){if(!currentResult||busy){toast('Roll a number first. Then complain publicly.');return;}
 const r=E.classify(currentResult.number),t=E.TIERS[r.tier];const text=`RNGdle · ${currentResult.mode==='daily'?'Daily':'Quest roll (unranked)'}\n${r.digits} · ${t.name.toUpperCase()} · ${currentResult.ep} EP\n${r.hits.map(id=>E.BADGES.find(b=>b.id===id).name).join(' / ')||'No badges. Incredible.'}\n\nAbsolutely no skill was involved.\n${location.href.split('#')[0]}`;
 try{await navigator.clipboard.writeText(text);await recordAction('share');toast('Copied. Your friends definitely need to see this.');}catch{toast('Clipboard unavailable. Open the game over HTTPS or localhost.');}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function setView(view){if(busy)return;['play','collection','leaderboard'].forEach(v=>$(v+'-view').classList.toggle('hidden',v!==view));document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='leaderboard')refresh();}
async function refresh(){if(busy)return;try{if(source==='server')useState(await api('state'));else if(source==='local'){loadLocal();useState(localSnapshot());}else await connect();}catch(error){toast(error.message||'Couldn’t reconnect.');}}
function applySettings(){document.body.classList.toggle('less-motion',settings.less);$('sound-button').textContent='Sound '+(settings.sound?'on':'off');$('sound-button').setAttribute('aria-pressed',String(settings.sound));$('motion-button').textContent=settings.less?'Full suspense':'Less suspense';$('motion-button').setAttribute('aria-pressed',String(settings.less));try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}}
function timeString(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');}
function tick(){if(!state)return;const time=now(),ready=time>=state.nextDailyAt;$('countdown').textContent=ready?'Ready when you are':timeString(state.nextDailyAt-time);$('next-roll-label').textContent=ready?'One main roll every 24 hours':'Your next main daily roll';const midnight=(Math.floor(time/E.DAY)+1)*E.DAY;$('quest-countdown').textContent=timeString(midnight-time);if(ready&&!busy){$('roll-button').disabled=false;if(currentResult)$('roll-button').innerHTML='Roll my daily number <span>↗</span>';}
 if(E.dateKey(time)!==lastQuestDate&&!busy){lastQuestDate=E.dateKey(time);refresh();}}
async function connect(){try{if(/(^|\.)github\.io$/.test(location.hostname||'')){source='local';timeOffset=0;loadLocal();useState(localSnapshot());}else useState(await api('state'));}catch(error){if(error.status===404||error instanceof TypeError||location.protocol==='file:'){source='local';timeOffset=0;loadLocal();useState(localSnapshot());}else{$('connection-status').textContent='Connection failed';$('machine-status').textContent='The game server is unavailable. Refresh to reconnect.';$('roll-button').disabled=true;toast('Couldn’t connect to the game server. Your saved rolls are safe.');return;}}
 const saved=latestDaily();if(saved&&now()<state.nextDailyAt)showResult(saved);else idle();}
$('roll-button').addEventListener('click',()=>roll('daily'));$('bonus-button').addEventListener('click',()=>roll('bonus'));$('share-button').addEventListener('click',copyResult);
$('return-daily').addEventListener('click',()=>{if(busy)return;const saved=latestDaily();if(saved)showResult(saved);else idle();});
$('quests').addEventListener('click',e=>{const claimButton=e.target.closest('[data-claim]');if(claimButton){claim(claimButton.dataset.claim);return;}const action=e.target.closest('[data-action]')?.dataset.action;if(action==='rules')$('help-dialog').showModal();if(action==='share')copyResult();});
for(const b of document.querySelectorAll('.nav-link'))b.addEventListener('click',()=>setView(b.dataset.view));
$('badge-filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el===b));if(state)renderCollection();});
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());$('accept-rules').addEventListener('click',async()=>{$('help-dialog').close();await recordAction('rules');});
for(const b of document.querySelectorAll('.close-dialog'))b.addEventListener('click',()=>b.closest('dialog').close());
$('name-button').addEventListener('click',()=>{$('player-name').value=state?.name||'';$('name-dialog').showModal();});
$('name-form').addEventListener('submit',async e=>{e.preventDefault();if(busy||!state)return;const name=$('player-name').value.trim();if(!/^[a-zA-Z0-9 _-]{2,20}$/.test(name)){toast('Use 2–20 letters, numbers, spaces, dashes, or underscores.');return;}try{useState(await mutate('profile',{name}));$('name-dialog').close();toast('Name saved. Use your powers irresponsibly.');}catch(error){toast(error.message);}});
$('refresh-board').addEventListener('click',refresh);
$('sound-button').addEventListener('click',()=>{settings.sound=!settings.sound;applySettings();tone(440,.12);});$('motion-button').addEventListener('click',()=>{settings.less=!settings.less;applySettings();});
document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||busy||$('play-view').classList.contains('hidden')||$('help-dialog').open||$('name-dialog').open||['BUTTON','INPUT','TEXTAREA','A','SELECT'].includes(document.activeElement?.tagName))return;if(state&&now()>=state.nextDailyAt){e.preventDefault();roll('daily');}});
window.addEventListener('storage',e=>{if(e.key===LOCAL_KEY&&source==='local'&&!busy){loadLocal();useState(localSnapshot());const saved=latestDaily();if(saved&&now()<state.nextDailyAt)showResult(saved);}});
renderLadder();applySettings();$('roll-button').disabled=true;connect();setInterval(tick,1000);setInterval(()=>{if(source==='server'&&!busy)refresh();},60000);
