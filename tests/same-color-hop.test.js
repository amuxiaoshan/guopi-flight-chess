'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {projection}=require('../server.js');
const offlineSource=fs.readFileSync(path.join(__dirname,'../public/single.html'),'utf8');
const offlineFunction=offlineSource.slice(offlineSource.indexOf('function projection(pos,roll){'),offlineSource.indexOf('// 特殊移动的停留格'));
assert.ok(offlineFunction.includes('if(cur>=1&&cur<=TURN&&(cur-1)%4===0)'));
const offlineProjection=vm.runInNewContext(
 '(()=>{const LAUNCH=-2,TURN=49,GOAL=55;\n'+offlineFunction+'\nreturn projection;})()'
);
function check(label,fn){
 for(const tile of Array.from({length:13},(_,i)=>1+4*i)){
  const outcome=fn(tile-1,1);
  assert.ok(outcome,'missing move on '+tile+' '+label);
  const expected=tile===17?29:tile+4;
  assert.equal(outcome.to,expected,label+' tile '+tile+' must receive its one bonus');
  assert.deepEqual(Array.from(outcome.path,step=>step.pos),[tile,expected],label+' tile '+tile+' route');
  assert.equal(outcome.path[1].kind,tile===17?'飞跃':'跳格',label+' tile '+tile+' kind');
  assert.equal(outcome.flags.length,1,label+' tile '+tile+' exactly one bonus');
 }
 for(const tile of [2,3,4,6,7,8,10,14,18,46,47,48,50,51,52,53,54]){
  const outcome=fn(tile-1,1);
  assert.equal(outcome.to,tile,label+' ordinary tile '+tile+' must not bonus');
  assert.equal(outcome.path.length,1,label+' ordinary tile '+tile+' route');
 }
 for(const [from,roll,to,route] of [
  [0,1,5,[1,5]],               // first color tile now works
  [12,1,17,[13,17]],           // hop onto flight tile does NOT fly
  [16,1,29,[17,29]],           // direct flight tile DOES fly
  [44,1,49,[45,49]],           // hop onto turn tile does NOT jump again
  [48,1,53,[49,53]],           // final same-color turn tile works
  [48,2,50,[49,50]],           // final die landing on lane skips bonus
  [51,4,55,[52,53,54,55]],     // reaching goal exactly
  [54,3,53,[55,54,53]]         // overshooting goal still bounces
 ]){
  const outcome=fn(from,roll);
  assert.equal(outcome.to,to,label+' '+from+'+'+roll);
  assert.deepEqual(Array.from(outcome.path,step=>step.pos),route,label+' '+from+'+'+roll+' route');
 }
}
check('online',projection);
check('offline',offlineProjection);
// Board artwork uses the same four-color sequence on the 52-cell ring.
// All four starting offsets have a matching-color tile at 1+4*n.
for(const [color,start,expectedModulo] of [[0,39,0],[1,26,3],[2,0,1],[3,13,2]]){
 for(let position=1;position<=49;position+=4)
  assert.equal((start+position)%4,expectedModulo,'team '+color+' has a matching color at '+position);
}
console.log('PASS: 13 same-color tiles, no chained bonuses, flight exceptions, bounce and online/offline consistency');
