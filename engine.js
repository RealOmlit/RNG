/* Scoring and quest rules shared by the browser and the server. */
(function(root){
'use strict';
const DAY=86400000,MAX=1000000,OUTCOMES=MAX+1;
const TIERS=[
 {id:'trash',name:'Trash',min:0,color:'#8b8b90',message:'The RNG gods left you on read.'},
 {id:'common',name:'Common',min:15,color:'#adb0b8',message:'One of the numbers of all time.'},
 {id:'uncommon',name:'Uncommon',min:35,color:'#9ac985',message:'A small victory. Act normal.'},
 {id:'rare',name:'Rare',min:65,color:'#83b9f4',message:'Statistically worth a little smugness.'},
 {id:'epic',name:'Epic',min:110,color:'#bba0ed',message:'You did absolutely nothing to deserve this.'},
 {id:'legendary',name:'Legendary',min:180,color:'#e9bf6b',message:'Send it to the group chat.'},
 {id:'mythic',name:'Mythic',min:280,color:'#ec9696',message:'Your entire skill issue has been forgiven.'},
 {id:'divine',name:'Divine',min:420,color:'#91d9ce',message:'The laws of probability would like a word.'},
 {id:'anomaly',name:'Anomaly',min:600,color:'#f1e5a8',message:'Nobody is going to believe you. Screenshot this.'}
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
 ['fortyTwo','Life, the universe…','Exactly 42. Still no further explanation.','42']
].map(([id,name,description,icon])=>({id,name,description,icon}));
const FIB=new Set([0,1]);{let a=0,b=1;while(b<=MAX){FIB.add(b);[a,b]=[b,a+b];}}
function isPrime(n){if(n<2)return false;if(n===2||n===3)return true;if(n%2===0||n%3===0)return false;for(let i=5;i*i<=n;i+=6)if(n%i===0||n%(i+2)===0)return false;return true;}
function findPatterns(number){
 if(!Number.isInteger(number)||number<0||number>MAX)throw new RangeError('Draw outside 0–1,000,000');
 const digits=String(number).padStart(6,'0'),d=[...digits].map(Number),counts=Array(10).fill(0);d.forEach(n=>counts[n]++);
 const max=Math.max(...counts),pairs=counts.filter(n=>n===2).length,sum=d.reduce((a,b)=>a+b,0),six=digits.length===6;
 const tests={even:number%2===0,pair:pairs>0,twoPairs:pairs>=2,triple:max>=3,four:max>=4,five:max>=5,six:six&&max===6,palindrome:digits===[...digits].reverse().join(''),sequence:six&&('0123456789'.includes(digits)||'9876543210'.includes(digits)),alternating:six&&digits.slice(0,2).repeat(3)===digits&&digits[0]!==digits[1],echo:six&&digits.slice(0,3).repeat(2)===digits,bookend:d[0]===d[d.length-1],binary:d.every(n=>n<=1),allEven:d.every(n=>n%2===0),allOdd:d.every(n=>n%2===1),sum7:sum===7,sum42:sum===42,split:six&&d[0]+d[1]+d[2]===d[3]+d[4]+d[5],prime:isPrime(number),harshad:sum>0&&number%sum===0,square:Number.isInteger(Math.sqrt(number)),fibonacci:FIB.has(number),power2:number>0&&(number&(number-1))===0,jackpot:digits.includes('777'),nice:digits.includes('69'),weed:digits.includes('420'),leet:digits.includes('1337'),year1984:number===1984,year2001:number===2001,taxicab:number===1729,boundary:number===MAX,fortyTwo:number===42};
 return BADGES.filter(b=>tests[b.id]).map(b=>b.id);
}
// Counts are exhaustive over the inclusive 0–1,000,000 range. Generated by scripts/calibrate.cjs.
const FREQUENCIES={"even":500001,"pair":735750,"twoPairs":237600,"triple":157601,"four":12701,"five":551,"six":10,"palindrome":1000,"sequence":10,"alternating":90,"echo":1000,"bookend":100000,"binary":65,"allEven":15625,"allOdd":15625,"sum7":792,"sum42":6062,"split":55252,"prime":78498,"harshad":95428,"square":1001,"fibonacci":30,"power2":20,"jackpot":3700,"nice":49401,"weed":3999,"leet":300,"year1984":1,"year2001":1,"taxicab":1,"boundary":1,"fortyTwo":1};
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
function bonusBalance(draws,claims,date){const earned=claims.filter(c=>c.date===date).reduce((s,c)=>s+(QUESTS.find(q=>q.id===c.id)?.reward||0),0);return Math.max(0,earned-draws.filter(r=>r.mode==='bonus'&&dateKey(r.at)===date).length);}
const api={DAY,MAX,OUTCOMES,TIERS,BADGES,FREQUENCIES,QUESTS,isPrime,findPatterns,badgeEP,classify,dateKey,questProgress,bonusBalance};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RNG=api;
})(typeof window!=='undefined'?window:globalThis);
