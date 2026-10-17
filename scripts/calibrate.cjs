const fs=require('node:fs');
const engine=require('../engine.js');
const counts=Object.fromEntries(engine.BADGES.map(b=>[b.id,0]));
for(let n=0;n<=engine.MAX;n++)for(const id of engine.findPatterns(n))counts[id]++;
const source=fs.readFileSync('engine.js','utf8').replace(/const FREQUENCIES=\{[^;]*\};/,`const FREQUENCIES=${JSON.stringify(counts)};`);
fs.writeFileSync('engine.js',source);
console.log('Calibrated',engine.OUTCOMES,'outcomes:',counts);
