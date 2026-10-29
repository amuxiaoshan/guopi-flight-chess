'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const active=require('../content/active.json').active;
const pack=require('../content/packs/'+active+'/pack.json');
const {server,projection:realProjection}=require('../server.js');
const html=fs.readFileSync(path.join(root,'public/collision-lab.html'),'utf8');
const engineSource=fs.readFileSync(path.join(root,'public/collision-lab-engine.js'),'utf8');
const context={globalThis:{GAME_CONTENT:pack}};
vm.runInNewContext(engineSource,context);
const testEngine=context.globalThis.COLLISION_LAB_ENGINE;
assert.ok(testEngine,'lab engine missing');
for(let pos=-2;pos<=54;pos++)for(let die=1;die<=6;die++){
  const a=realProjection(pos,die),b=testEngine.projection(pos,die);
  assert.deepEqual(b===null?null:JSON.parse(JSON.stringify(b)),a,'same projection '+pos+' roll '+die);
}
assert.equal(html.includes('/content-pack.js'),true);
assert.equal(html.includes('/collision-lab-engine.js'),true);
assert.equal(html.includes('/board.svg'),true);
for(const id of ['actorColor','movingPiece','die','placeTarget','seats','simulate','autoAlign','sameRole','reset','boardPieces']){
 assert.ok(html.includes('id="'+id+'"'),'lab control '+id);
}
assert.ok(html.includes('p.pieces[i]=Number(sel.value)'), 'the 4 pieces of every seat are editable');
assert.ok(html.includes("eng.captureAlong({players:view},actor,plan,movingPiece,victims)"),'actual hit evaluation');
assert.ok(html.includes('eng.collisionLine(actor.role,victims)'),'use original quote selector');
assert.ok(html.includes('await new Promise(resolve=>setTimeout(resolve,120))'),'stepwise board motion');
assert.ok(!html.includes("'/api/action'")&&!html.includes('"/api/action"'),'lab must not mutate rooms');
for(let i=0;i<4;i++){
 for(let pos=-2;pos<=55;pos++){
  const xy=testEngine.point(i,pos,0);
  assert.equal(xy.length,2);
  assert.ok(xy.every(x=>x>=0&&x<=900),'board placement must fit viewbox');
 }
}
// Real capture on different-color teams with identical OC roles.
if(active==='oc'){
 const self={
  A:'你是……真奇怪呢。',
  B:'哎？刚刚那个是不是长得跟我有点像？',
  D:'一边去吧冒牌货！',
  C:'不堪一击。',
  E:'就算你跟我一样帅气我也不会放水的啦！',
  G:'呃、撞飞自己感觉还真奇怪…',
  F:'管你是谁……',
  H:'那么你代替我先回去吧。'
 };
 for(const [role,line] of Object.entries(self)){
  const actor={color:3,role,pieces:[11,-1,-1,-1]};
  const defender={color:0,role,pieces:[37,-1,-1,-1]};
  const victims=[];
  const route=testEngine.projection(8,3);
  assert.equal(route.to,11);
  const hits=testEngine.captureAlong({players:[actor,defender]},actor,route,0,victims);
  assert.equal(hits,1,'lab collision '+role);
  assert.deepEqual([...victims],[role]);
  assert.equal(testEngine.collisionLine(role,victims),line);
  assert.equal(defender.pieces[0],-1,'opponent sent home');
 }
}
// The test map must be available over the same HTTP server as the game.
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  for(const file of ['/collision-lab.html','/collision-lab-engine.js']){
   const response=await fetch(url+file);
   assert.equal(response.status,200,file+' served');
   assert.ok((await response.text()).length>1000,file+' content');
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
 console.log('PASS: fixed die and editable pieces, authoritative collision lab equals main-game rules, same-role speeches');
})().catch(e=>{console.error(e);process.exitCode=1;});
