/* Scoring and quest rules shared by the browser and the server. */
(function(root){
'use strict';
const DAY=86400000,MAX=1000000,OUTCOMES=MAX+1;
const TIERS=[
 {id:'trash',name:'Trash',min:0,color:'#8b8b90',message:'The RNG gods left you on read.'},
 {id:'common',name:'Common',min:45,color:'#adb0b8',message:'One of the numbers of all time.'},
 {id:'uncommon',name:'Uncommon',min:70,color:'#9ac985',message:'A small victory. Act normal.'},
 {id:'rare',name:'Rare',min:110,color:'#83b9f4',message:'Statistically worth a little smugness.'},
 {id:'epic',name:'Epic',min:170,color:'#bba0ed',message:'You did absolutely nothing to deserve this.'},
 {id:'legendary',name:'Legendary',min:260,color:'#e9bf6b',message:'Send it to the group chat.'},
 {id:'mythic',name:'Mythic',min:400,color:'#ec9696',message:'Your entire skill issue has been forgiven.'},
 {id:'divine',name:'Divine',min:600,color:'#91d9ce',message:'The laws of probability would like a word.'},
 {id:'anomaly',name:'Anomaly',min:900,color:'#f1e5a8',message:'Nobody is going to believe you. Screenshot this.'}
];
const BADGES=[
 ['even','Even Steven','An even number. We had to start somewhere.','÷2'],
 ['pair','A pair, apparently','A digit appears exactly twice.','Ⅱ'],
 ['twoPairs','Seeing double','At least two different pairs.','ⅡⅡ'],
 ['triple','Three of a kind','At least three matching digits.','Ⅲ'],
 ['four','Four of a kind','At least four matching digits.','Ⅳ'],
 ['five','Five of a kind','At least five matching digits.','Ⅴ'],
 ['six','Copy + paste','All six digits are identical.','Ⅵ'],
 ['palindrome','Mirror mirror','Reads the same in both directions.','↔'],
 ['sequence','In order','Six consecutive ascending or descending digits.','↗'],
 ['alternating','Stuck on repeat','Two different digits alternate: ABABAB.','AB'],
 ['echo','Echo chamber','The first three digits repeat: ABCABC.','ABC'],
 ['bookend','Bookends','The first and last digit match.','[ ]'],
 ['binary','Computer science','Every digit is a 0 or a 1.','01'],
 ['allEven','Even the odds','Every digit is even.','024'],
 ['allOdd','Odd behaviour','Every digit is odd.','135'],
 ['sum7','Lucky seven','The digits add up to seven.','Σ7'],
 ['sum42','The answer','The digits add up to 42.','Σ42'],
 ['split','Perfectly balanced','The first and last three digits have the same sum.','='],
 ['prime','Prime specimen','A prime number. Divisible by nothing useful.','P'],
 ['harshad','Harshad','Divisible by the sum of its own digits.','H'],
 ['square','Square deal','A perfect square.','n²'],
 ['fibonacci','Golden child','A number in the Fibonacci sequence.','φ'],
 ['power2','Power trip','A power of two.','2ⁿ'],
 ['jackpot','Jackpot','Contains 777. No actual payout, obviously.','777'],
 ['nice','Nice.','Contains 69. You know why.','69'],
 ['weed','Touch grass','Contains 420. Botanical excellence.','420'],
 ['leet','Elite gamer','Contains 1337. Born ready.','1337'],
 ['year1984','Literally 1984','Exactly 1984. Big Brother approves.','1984'],
 ['year2001','Space odyssey','Exactly 2001. Open the pod bay doors.','2001'],
 ['taxicab','Taxi for Ramanujan','Exactly 1729, the famous taxicab number.','1729'],
 ['boundary','Out of bounds','Exactly 1,000,000. The seventh digit escaped.','∞'],
 ['fortyTwo','Life, the universe…','Exactly 42. Still no further explanation.','42'],
 ['odd','Odd one out','An odd number. Refuses to split the bill.','÷2?'],
 ['distinct','No duplicates','All six digits are different. A very exclusive group.','6≠'],
 ['threePairs','Triple double','Three different digits each appear twice.','2×3'],
 ['fullHouse','Full house','One triple, one pair, one other digit.','3+2'],
 ['doubleTriples','Twin triplets','Two different digits each appear three times.','3×2'],
 ['straight5','Almost a straight','Contains five consecutive ascending or descending digits.','↗5'],
 ['ascending','Going up','Six digits in nondecreasing order, with at least two different digits.','↑'],
 ['descending','Going down','Six digits in nonincreasing order, with at least two different digits.','↓'],
 ['step2','Skip a beat','Every adjacent digit steps up by two, wrapping after nine.','+2'],
 ['nextHalf','Next in line','The last three-digit half is exactly one greater than the first.','ABC+1'],
 ['nearMirror','Cracked mirror','Exactly two of the three mirrored digit pairs match.','↔?'],
 ['unique5','One impostor','Exactly five different digits. Someone came twice.','5≠'],
 ['unique4','Fantastic four','Exactly four different digits.','4≠'],
 ['unique3','Three is company','Exactly three different digits.','3≠'],
 ['unique2','Dynamic duo','Exactly two different digits.','2≠'],
 ['zeroFree','Zero tolerance','Not a single zero in the displayed number.','0̸'],
 ['hasZero','Ground zero','Contains at least one zero. Nothing to see here.','0'],
 ['ends00','Double zero','Ends in 00. Very round.','00'],
 ['ends000','Round of applause','Ends in 000. Aggressively round.','000'],
 ['ends123','Easy as 123','Ends in 123.','123→'],
 ['starts123','Off to a good start','Starts with 123 in the six-digit display.','→123'],
 ['piPrefix','A slice of pi','Starts with 314 in the six-digit display.','π'],
 ['ePrefix','Naturally lucky','Starts with 271 in the six-digit display.','e'],
 ['sqrt2Prefix','Irrational behaviour','Starts with 141 in the six-digit display.','√2'],
 ['cube','Cube mentality','A perfect cube, including zero.','n³'],
 ['triangular','Love triangle','A triangular number: n(n+1)/2.','△'],
 ['pentagonal','Five sides to the story','A pentagonal number: n(3n−1)/2.','⬠'],
 ['hexagonal','Bestagon','A hexagonal number: n(2n−1).','⬡'],
 ['factorial','Factorial attraction','A factorial: 1, 2, 6, 24, and so on.','n!'],
 ['power3','Third time lucky','An integer power of three, including 1.','3ⁿ'],
 ['power5','High five','An integer power of five, including 1.','5ⁿ'],
 ['perfect','Perfect specimen','Equals the sum of its positive proper divisors.','✓'],
 ['abundant','More than enough','Its positive proper divisors add up to more than the number.','+∞'],
 ['deficient','Never enough','Its positive proper divisors add up to less than the number.','−∞'],
 ['semiprime','Prime partnership','The product of exactly two primes, which may match.','P×P'],
 ['smith','Mr. Smith','A composite number whose digit sum equals the digit sums of its prime factors.','SM'],
 ['narcissist','Main character','Equals the sum of its digits raised to the number of unpadded digits.','ME'],
 ['automorphic','Self portrait','Its square ends with the original unpadded number.','n²↩'],
 ['trimorphic','Third-person view','Its cube ends with the original unpadded number.','n³↩'],
 ['pronic','Next-door neighbours','A product of two consecutive nonnegative integers.','n(n+1)'],
 ['happy','Happy accident','Repeated squared-digit sums eventually reach 1.',':)'],
 ['sum13','Unlucky for some','The displayed digits add up to 13.','Σ13'],
 ['sum21','Blackjack','The displayed digits add up to 21.','Σ21'],
 ['sum27','Club 27','The displayed digits add up to 27.','Σ27'],
 ['sum36','Six squared','The displayed digits add up to 36.','Σ36'],
 ['divisible7','Seven’s company','Divisible by 7. Zero gets an invitation too.','÷7'],
 ['divisible11','Eleven out of ten','Divisible by 11.','÷11'],
 ['divisible99','Ninety-nine problems','Divisible by 99. Luck is still one of them.','÷99'],
 ['devil','Devil in the digits','Contains 666. Suspiciously warm in here.','666'],
 ['angel111','Make a wish','Contains 111. The universe left a voicemail.','111'],
 ['angel222','Trust the process','Contains 222. The process is random.','222'],
 ['angel333','Triple signal','Contains 333. Reception has never been better.','333'],
 ['angel444','Protected by chance','Contains 444. No guarantees included.','444'],
 ['angel555','Change is coming','Contains 555. Probably a different number tomorrow.','555'],
 ['angel888','Infinite-ish','Contains 888. Sideways abundance.','888'],
 ['angel999','End of an era','Contains 999. Please remain dramatic.','999'],
 ['notFound','Luck not found','Contains 404. Try refreshing your expectations.','404'],
 ['serverError','Internal luck error','Contains 500. The universe encountered a problem.','500'],
 ['teapot','I’m a teapot','Contains 418. Short, stout, and statistically irrelevant.','418'],
 ['emergency','Luck emergency','Contains 911. This is not a real emergency.','911'],
 ['agent','License to roll','Contains 007 in the displayed number.','007'],
 ['calculator','Calculator humour','Exactly 80085. Turn your calculator upside down.','80085'],
 ['telephone','Call me maybe','Exactly 867530. One digit short of a famous phone number.','☎'],
 ['speed','Time traveller','Exactly 88. Great Scott.','88'],
 ['leetExact','Certified elite','Exactly 1337. The original gamer credential.','1337!'],
 ['zero','Absolute zero','Exactly 0. You have achieved nothing, perfectly.','∅'],
 ['maximumSix','So close, yet so far','Exactly 999999. One away from a seventh digit.','9×6'],
 ['one','The chosen one','Exactly 1. There can be only one.','1!']
].map(([id,name,description,icon])=>({id,name,description,icon,category:'patterns'}));
const MATH_IDS=new Set(['even','odd','sum7','sum42','prime','harshad','square','fibonacci','power2','cube','triangular','pentagonal','hexagonal','factorial','power3','power5','perfect','abundant','deficient','semiprime','smith','narcissist','automorphic','trimorphic','pronic','happy','sum13','sum21','sum27','sum36','divisible7','divisible11','divisible99']);
const CULTURE_IDS=new Set(['jackpot','nice','weed','leet','year1984','year2001','taxicab','fortyTwo','devil','angel111','angel222','angel333','angel444','angel555','angel888','angel999','notFound','serverError','teapot','emergency','agent','calculator','telephone','speed','leetExact']);
BADGES.forEach(b=>b.category=MATH_IDS.has(b.id)?'math':CULTURE_IDS.has(b.id)?'culture':b.id==='boundary'||b.id==='zero'||b.id==='one'||b.id==='maximumSix'?'special':'patterns');
const FIB=new Set([0,1]);{let a=0,b=1;while(b<=MAX){FIB.add(b);[a,b]=[b,a+b];}}
function isPrime(n){if(n<2)return false;if(n===2||n===3)return true;if(n%2===0||n%3===0)return false;for(let i=5;i*i<=n;i+=6)if(n%i===0||n%(i+2)===0)return false;return true;}
const digitSum=n=>{let s=0;do{s+=n%10;n=Math.floor(n/10);}while(n);return s;};
const powers=base=>{const values=new Set();for(let n=1;n<=MAX;n*=base)values.add(n);return values;};
const POW3=powers(3),POW5=powers(5),FACTORIAL=new Set([1]);{let n=1;for(let i=2;(n*=i)<=MAX;i++)FACTORIAL.add(n);}
// One lazy sieve serves prime-factor and divisor badges without repeated trial division.
let smallestFactor;
function factors(number){
 if(!smallestFactor){smallestFactor=new Uint32Array(MAX+1);for(let p=2;p*p<=MAX;p++)if(!smallestFactor[p])for(let n=p*p;n<=MAX;n+=p)if(!smallestFactor[n])smallestFactor[n]=p;}
 let n=number,sigma=1,count=0,factorSum=0;
 while(n>1){const p=smallestFactor[n]||n;let power=1,term=1;do{n/=p;power*=p;term+=power;count++;factorSum+=digitSum(p);}while(n>1&&n%p===0);sigma*=term;}
 return {proper:number>0?sigma-number:0,count,factorSum};
}
const happyCache=new Int8Array(568);
function isHappy(n){let value=n,path=[];while(value!==1&&value!==4){if(value<happyCache.length&&happyCache[value]){value=happyCache[value]===1?1:4;break;}path.push(value);let next=0;do{next+=(value%10)**2;value=Math.floor(value/10);}while(value);value=next;if(value===0)break;}const happy=value===1;for(const v of path)if(v<happyCache.length)happyCache[v]=happy?1:-1;return happy;}
function findPatterns(number){
 if(!Number.isInteger(number)||number<0||number>MAX)throw new RangeError('Draw outside 0–1,000,000');
 const digits=String(number).padStart(6,'0'),d=[...digits].map(Number),counts=Array(10).fill(0);d.forEach(n=>counts[n]++);
 const max=Math.max(...counts),pairs=counts.filter(n=>n===2).length,sum=d.reduce((a,b)=>a+b,0),six=digits.length===6,unique=counts.filter(Boolean).length,mirror=six?[0,1,2].filter(i=>d[i]===d[5-i]).length:0;
 const f=factors(number),raw=String(number),mod=10**raw.length;
 const tests={even:number%2===0,pair:pairs>0,twoPairs:pairs>=2,triple:max>=3,four:max>=4,five:max>=5,six:six&&max===6,palindrome:digits===[...digits].reverse().join(''),sequence:six&&('0123456789'.includes(digits)||'9876543210'.includes(digits)),alternating:six&&digits.slice(0,2).repeat(3)===digits&&digits[0]!==digits[1],echo:six&&digits.slice(0,3).repeat(2)===digits,bookend:d[0]===d[d.length-1],binary:d.every(n=>n<=1),allEven:d.every(n=>n%2===0),allOdd:d.every(n=>n%2===1),sum7:sum===7,sum42:sum===42,split:six&&d[0]+d[1]+d[2]===d[3]+d[4]+d[5],prime:isPrime(number),harshad:sum>0&&number%sum===0,square:Number.isInteger(Math.sqrt(number)),fibonacci:FIB.has(number),power2:number>0&&(number&(number-1))===0,jackpot:digits.includes('777'),nice:digits.includes('69'),weed:digits.includes('420'),leet:digits.includes('1337'),year1984:number===1984,year2001:number===2001,taxicab:number===1729,boundary:number===MAX,fortyTwo:number===42};
 Object.assign(tests,{
  odd:number%2===1,distinct:six&&unique===6,threePairs:six&&pairs===3,fullHouse:six&&max===3&&pairs===1,doubleTriples:six&&counts.filter(n=>n===3).length===2,
  straight5:six&&[digits.slice(0,5),digits.slice(1)].some(s=>'0123456789'.includes(s)||'9876543210'.includes(s)),
  ascending:six&&unique>1&&d.every((n,i)=>!i||n>=d[i-1]),descending:six&&unique>1&&d.every((n,i)=>!i||n<=d[i-1]),step2:six&&d.every((n,i)=>!i||n===(d[i-1]+2)%10),nextHalf:six&&Number(digits.slice(3))===Number(digits.slice(0,3))+1,nearMirror:mirror===2,
  unique5:unique===5,unique4:unique===4,unique3:unique===3,unique2:unique===2,zeroFree:!counts[0],hasZero:counts[0]>0,ends00:number%100===0,ends000:number%1000===0,ends123:digits.endsWith('123'),starts123:six&&digits.startsWith('123'),piPrefix:six&&digits.startsWith('314'),ePrefix:six&&digits.startsWith('271'),sqrt2Prefix:six&&digits.startsWith('141'),
  cube:Math.round(Math.cbrt(number))**3===number,triangular:Number.isInteger(Math.sqrt(8*number+1))&&(Math.sqrt(8*number+1)-1)%2===0,pentagonal:Number.isInteger(Math.sqrt(24*number+1))&&(1+Math.sqrt(24*number+1))%6===0||number===0,hexagonal:Number.isInteger(Math.sqrt(8*number+1))&&(1+Math.sqrt(8*number+1))%4===0||number===0,
  factorial:FACTORIAL.has(number),power3:POW3.has(number),power5:POW5.has(number),perfect:number>0&&f.proper===number,abundant:number>0&&f.proper>number,deficient:number>0&&f.proper<number,semiprime:f.count===2,smith:number>1&&!isPrime(number)&&sum===f.factorSum,
  narcissist:[...raw].reduce((s,n)=>s+Number(n)**raw.length,0)===number,automorphic:number**2%mod===number,
  // Modular multiplication keeps n³ exact even for the seven-digit boundary.
  trimorphic:((number**2%mod)*number)%mod===number,pronic:Number.isInteger(Math.sqrt(4*number+1))&&(Math.sqrt(4*number+1)-1)%2===0,happy:isHappy(number),sum13:sum===13,sum21:sum===21,sum27:sum===27,sum36:sum===36,divisible7:number%7===0,divisible11:number%11===0,divisible99:number%99===0,
  devil:digits.includes('666'),angel111:digits.includes('111'),angel222:digits.includes('222'),angel333:digits.includes('333'),angel444:digits.includes('444'),angel555:digits.includes('555'),angel888:digits.includes('888'),angel999:digits.includes('999'),notFound:digits.includes('404'),serverError:digits.includes('500'),teapot:digits.includes('418'),emergency:digits.includes('911'),agent:digits.includes('007'),calculator:number===80085,telephone:number===867530,speed:number===88,leetExact:number===1337,zero:number===0,maximumSix:number===999999,one:number===1
 });
 return BADGES.filter(b=>tests[b.id]).map(b=>b.id);
}
// Counts are exhaustive over the inclusive 0–1,000,000 range. Generated by scripts/calibrate.cjs.
const FREQUENCIES={"even":500001,"pair":735750,"twoPairs":237600,"triple":157601,"four":12701,"five":551,"six":10,"palindrome":1000,"sequence":10,"alternating":90,"echo":1000,"bookend":100000,"binary":65,"allEven":15625,"allOdd":15625,"sum7":792,"sum42":6062,"split":55252,"prime":78498,"harshad":95428,"square":1001,"fibonacci":30,"power2":20,"jackpot":3700,"nice":49401,"weed":3999,"leet":300,"year1984":1,"year2001":1,"taxicab":1,"boundary":1,"fortyTwo":1,"odd":500000,"distinct":151200,"threePairs":10800,"fullHouse":43200,"doubleTriples":900,"straight5":230,"ascending":4995,"descending":4995,"step2":10,"nextHalf":999,"nearMirror":27000,"unique5":453600,"unique4":327600,"unique3":64800,"unique2":2791,"zeroFree":531441,"hasZero":468560,"ends00":10001,"ends000":1001,"ends123":1000,"starts123":1000,"piPrefix":1000,"ePrefix":1000,"sqrt2Prefix":1000,"cube":101,"triangular":1414,"pentagonal":817,"hexagonal":708,"factorial":9,"power3":13,"power5":9,"perfect":4,"abundant":247545,"deficient":752451,"semiprime":210035,"smith":29928,"narcissist":21,"automorphic":12,"trimorphic":61,"pronic":1000,"happy":143071,"sum13":8232,"sum21":39662,"sum27":55252,"sum36":25927,"divisible7":142858,"divisible11":90910,"divisible99":10102,"devil":3700,"angel111":3700,"angel222":3700,"angel333":3700,"angel444":3700,"angel555":3700,"angel888":3700,"angel999":3700,"notFound":3979,"serverError":3999,"teapot":3999,"emergency":3999,"agent":3999,"calculator":1,"telephone":1,"speed":1,"leetExact":1,"zero":1,"maximumSix":1,"one":1};
function badgeEP(id){const frequency=FREQUENCIES[id];return frequency?Math.max(5,Math.round(-Math.log10(frequency/OUTCOMES)*25/5)*5):0;}
function classify(number){const digits=String(number).padStart(6,'0'),hits=findPatterns(number),ep=hits.reduce((n,id)=>n+badgeEP(id),0);let tier=0;TIERS.forEach((t,i)=>{if(ep>=t.min)tier=i;});return {number,digits,hits,ep,tier,rarity:TIERS[tier].id};}
const QUESTS=[
 {id:'daily',name:'Accept your fate',description:'Complete your main daily roll.',target:1,reward:1},
 {id:'rules',name:'Read the fine print',description:'Read the rules and admit that this takes no skill.',target:1,reward:1},
 {id:'share',name:'Make it everyone’s problem',description:'Copy a result to share with your friends.',target:1,reward:1},
 {id:'badges',name:'Find something interesting',description:'Discover 3 different badges in today’s rolls.',target:3,reward:1}
];
const dateKey=time=>new Date(time??Date.now()).toISOString().slice(0,10);
function questProgress(id,draws,actions,date){const today=draws.filter(r=>dateKey(r.at)===date);if(id==='daily')return today.some(r=>r.mode==='daily')?1:0;if(id==='rules'||id==='share')return actions.includes(id)?1:0;if(id==='badges')return Math.min(3,new Set(today.flatMap(r=>classify(r.number).hits)).size);return 0;}
function bonusBalance(draws,claims,date){const earned=claims.filter(c=>c.date===date).reduce((s,c)=>s+(QUESTS.find(q=>q.id===c.id)?.reward||0),0);return Math.max(0,earned-draws.filter(r=>r.mode==='bonus'&&!r.boosted&&dateKey(r.at)===date).length);}
const SECRET_CODE='123456';
// Every possible Anomaly under the current scoring rules. Normal draws stay uniform.
const INFINITY_NUMBERS=Object.freeze([0,1,2,5,6,999999]);
function updateSecret(current,request){
 const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
 if(!request||typeof request!=='object'||Array.isArray(request))fail(400,'Enter a secret code.');
 if(typeof request.code==='string'){
  if(request.code.trim()!==SECRET_CODE)fail(400,'That code did nothing. The universe remains unimpressed.');
  return {unlocked:true,enabled:true};
 }
 if(typeof request.enabled==='boolean'){
  if(!current?.unlocked)fail(403,'Unlock Infinity mode with a code first.');
  return {unlocked:true,enabled:request.enabled};
 }
 fail(400,'Enter a code or choose whether Infinity mode is on.');
}
const api={DAY,MAX,OUTCOMES,TIERS,BADGES,FREQUENCIES,QUESTS,SECRET_CODE,INFINITY_NUMBERS,updateSecret,isPrime,findPatterns,badgeEP,classify,dateKey,questProgress,bonusBalance};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RNG=api;
})(typeof window!=='undefined'?window:globalThis);
