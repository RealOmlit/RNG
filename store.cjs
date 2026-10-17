'use strict';
const {DatabaseSync}=require('node:sqlite');
const {randomInt,randomUUID,randomBytes}=require('node:crypto');
const E=require('./engine.js');
function createStore(filename=':memory:',options={}){
 const db=new DatabaseSync(filename),pick=options.random||(()=>randomInt(E.MAX+1));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rolls(id TEXT PRIMARY KEY,player TEXT NOT NULL REFERENCES players(id),number INTEGER NOT NULL CHECK(number BETWEEN 0 AND 1000000),mode TEXT NOT NULL CHECK(mode IN ('daily','bonus')),at INTEGER NOT NULL,ep INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS rolls_player ON rolls(player,at);
 CREATE INDEX IF NOT EXISTS rolls_board ON rolls(mode,at,ep);
 CREATE TABLE IF NOT EXISTS claims(player TEXT NOT NULL REFERENCES players(id),date TEXT NOT NULL,quest TEXT NOT NULL,PRIMARY KEY(player,date,quest));
 CREATE TABLE IF NOT EXISTS actions(player TEXT NOT NULL REFERENCES players(id),date TEXT NOT NULL,action TEXT NOT NULL,PRIMARY KEY(player,date,action));`);
 const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
 function player(id){const existing=typeof id==='string'&&db.prepare('SELECT * FROM players WHERE id=?').get(id);if(existing)return existing;const p={id:randomBytes(32).toString('hex'),name:'Unlucky-'+randomBytes(2).toString('hex').toUpperCase()};db.prepare('INSERT INTO players VALUES(?,?)').run(p.id,p.name);return p;}
 function records(id){return db.prepare('SELECT id,number,mode,at,ep FROM rolls WHERE player=? ORDER BY at,id').all(id);}
 function claimRows(id){return db.prepare('SELECT date,quest AS id FROM claims WHERE player=?').all(id);}
 function actionRows(id,date){return db.prepare('SELECT action FROM actions WHERE player=? AND date=?').all(id,date).map(r=>r.action);}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
 function snapshot(id,now=Date.now()){
  const p=db.prepare('SELECT name FROM players WHERE id=?').get(id);if(!p)fail(401,'Player session expired. Reload to reconnect.');
  const draws=records(id),claims=claimRows(id),date=E.dateKey(now),actions=actionRows(id,date),last=[...draws].reverse().find(r=>r.mode==='daily');
  const start=Date.parse(date),end=start+E.DAY;
  const board=db.prepare(`SELECT r.id,r.number,r.ep,r.at,p.name,r.player=? AS yours FROM rolls r JOIN players p ON p.id=r.player WHERE r.mode='daily' AND r.at>=? AND r.at<? ORDER BY r.ep DESC,r.at ASC,r.id ASC LIMIT 25`).all(id,start,end);
  const players=Number(db.prepare("SELECT COUNT(*) AS n FROM rolls WHERE mode='daily' AND at>=? AND at<?").get(start,end).n);
  const own=db.prepare("SELECT ep,at,id FROM rolls WHERE player=? AND mode='daily' AND at>=? AND at<? ORDER BY at DESC LIMIT 1").get(id,start,end);
  const rank=own?Number(db.prepare("SELECT COUNT(*)+1 AS n FROM rolls WHERE mode='daily' AND at>=? AND at<? AND (ep>? OR (ep=? AND (at<? OR (at=? AND id<?))))").get(start,end,own.ep,own.ep,own.at,own.at,own.id).n):null;
  return {source:'server',name:p.name,draws,claims,actions,now,nextDailyAt:last?last.at+E.DAY:0,bonus:E.bonusBalance(draws,claims,date),quests:E.QUESTS.map(q=>({...q,progress:E.questProgress(q.id,draws,actions,date),claimed:claims.some(c=>c.date===date&&c.id===q.id)})),leaderboard:{date,players,rank,rows:board}};
 }
 function draw(id,mode,now=Date.now()){
  if(!['daily','bonus'].includes(mode))fail(400,'Choose a daily or quest roll.');
  return transaction(()=>{
   const rows=records(id),claims=claimRows(id),last=[...rows].reverse().find(r=>r.mode==='daily');
   if(mode==='daily'&&last&&now<last.at+E.DAY)fail(409,'Your daily roll is locked. It cannot be rerolled.');
   if(mode==='bonus'&&E.bonusBalance(rows,claims,E.dateKey(now))<1)fail(409,'Complete and claim a quest to earn a bonus roll.');
   const number=pick(),ep=E.classify(number).ep,roll={id:randomUUID(),number,mode,at:now,ep};
   db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?,?)').run(roll.id,id,number,mode,now,ep);
   return {roll,state:snapshot(id,now)};
  });
 }
 function action(id,type,now=Date.now()){
  if(!['rules','share'].includes(type))fail(400,'Unknown quest action.');
  if(type==='share'&&!records(id).length)fail(409,'Roll a number before copying a result.');
  db.prepare('INSERT OR IGNORE INTO actions VALUES(?,?,?)').run(id,E.dateKey(now),type);return snapshot(id,now);
 }
 function claim(id,questId,now=Date.now()){
  return transaction(()=>{
   const quest=E.QUESTS.find(q=>q.id===questId);if(!quest)fail(404,'Quest not found.');
   const date=E.dateKey(now),draws=records(id),actions=actionRows(id,date);
   if(E.questProgress(questId,draws,actions,date)<quest.target)fail(409,'Finish this quest before claiming its roll.');
   const claimed=claimRows(id).some(c=>c.date===date&&c.id===questId);if(claimed)fail(409,'This quest reward has already been claimed.');
   db.prepare('INSERT INTO claims VALUES(?,?,?)').run(id,date,questId);return snapshot(id,now);
  });
 }
 function rename(id,name){const clean=String(name||'').trim();if(!/^[a-zA-Z0-9 _-]{2,20}$/.test(clean))fail(400,'Use 2–20 letters, numbers, spaces, dashes, or underscores.');db.prepare('UPDATE players SET name=? WHERE id=?').run(clean,id);return snapshot(id);}
 return {player,snapshot,draw,action,claim,rename,close:()=>db.close()};
}
module.exports={createStore};
