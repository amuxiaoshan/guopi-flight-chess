'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const active=require('../content/active.json').active;
if(active!=='oc'){console.log('SKIP: target-specific lines belong to OC pack');process.exit(0);}
const pack=require('../content/packs/oc/pack.json');
const expected={
 A:{B:'下次要多加注意哦，澄。',D:'抱歉麦冬——下次慢一些？',C:'注意背后~'},
 B:{A:'抱歉阿禾，我就先走一步咯！',D:'嘿！抓到麦冬了！'},
 D:{A:'抱歉啊，这儿我先收下啦。',B:'好机会！下次注意瞧着点(●´∀)σ',C:'不好意思哥，你再多逛一圈吧！'},
 C:{A:'你还不够谨慎。',D:'麦冬，多注意点。'}
};
assert.equal(Object.values(expected).reduce((n,obj)=>n+Object.keys(obj).length,0),10);
for(const [actor,targets] of Object.entries(expected))
 assert.deepEqual(pack.characters[actor].collisionTargets,targets);

function sliceBetween(s,start,end,name){
 const a=s.indexOf(start),b=s.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,name+' missing');
 return s.slice(a,b);
}
function engine(filename){
 const src=fs.readFileSync(path.join(root,filename),'utf8');
 const logic=[
  sliceBetween(src,'const COLLISION_LINES=','const startIndex =','dialogue selector'),
  sliceBetween(src,'const keyOnBoard =','function projection','board squares'),
  sliceBetween(src,'function captureAlong(','function legalMove(','capture mechanics')
 ].join('\n');
 const context={
  GAME_CONTENT:pack,globalThis:{GAME_CONTENT:pack},
  rand:()=>0,startIndex:[39,26,0,13],
  RING_SIZE:52,LANE:50,GOAL:55,crossedLane:[3,2,1,0]
 };
 const core=vm.runInNewContext(logic+'\n({collisionLine,captureAlong})',context);
 assert.ok(src.includes('const capturedRoles=[];'),'target capture tracking missing: '+filename);
 assert.ok(src.includes('captureAlong(room,p,plan,id,capturedRoles)'),'move must collect actual hit targets: '+filename);
 assert.ok(src.includes("dialogue:hit?collisionLine(p.role,capturedRoles):''"),'move must choose target-specific text: '+filename);
 return core;
}
for(const file of ['server.js','public/single.html']){
 const {captureAlong,collisionLine}=engine(file);
 const label=file+': ';
 function setup(actor,target,pos=15){
  const attacking={color:0,role:actor,pieces:[2,-1,-1,-1]};
  const defending={color:1,role:target,pieces:[pos,-1,-1,-1]};
  return {attacking,defending,room:{players:[attacking,defending]}};
 }
 for(const [actor,targets] of Object.entries(expected))
  for(const [victim,line] of Object.entries(targets)){
   const {room,attacking,defending}=setup(actor,victim);
   const captured=[];
   const hit=captureAlong(room,attacking,{path:[{pos:2,kind:'骰点'}]},0,captured);
   assert.equal(hit,1,label+actor+' hit '+victim);
   assert.equal(defending.pieces[0],-1,label+'knock back the actual victim');
   assert.deepEqual(Array.from(captured),[victim],label+'track real victim');
   assert.equal(collisionLine(actor,captured),line,label+'exact custom line');
  }
 // No matching pair keeps existing generic speech.
 assert.equal(collisionLine('A',['H']),pack.characters.A.collision[0],label+'generic fallback');
 assert.equal(collisionLine('H',['A']),pack.characters.H.collision[0],label+'unmapped attacker fallback');
 // A 1-to-2 encounter coexists; it must not fire a directed voice line.
 const unequal=setup('A','B');
 unequal.defending.pieces[1]=15;
 const nonCapture=[];
 assert.equal(captureAlong(unequal.room,unequal.attacking,{path:[{pos:2,kind:'骰点'}]},0,nonCapture),0,label+'unequal stack coexists');
 assert.deepEqual(Array.from(nonCapture),[],label+'no false targets');
 assert.equal(unequal.defending.pieces[0],15);
 // When a die step passes a defender but ends elsewhere, no capture.
 const passing=setup('A','B'),through=[];
 assert.equal(captureAlong(passing.room,passing.attacking,
  {path:[{pos:2,kind:'骰点'},{pos:3,kind:'骰点'}]},0,through),0,label+'passing over an opponent');
 assert.deepEqual(Array.from(through),[]);
 // When hopping, capturing at the bonus destination still detects target.
 const hop=setup('A','B',18),hopTargets=[];
 assert.equal(captureAlong(hop.room,hop.attacking,
  {path:[{pos:1,kind:'骰点'},{pos:5,kind:'跳格'}]},0,hopTargets),1,label+'jump destination collision');
 assert.equal(collisionLine('A',hopTargets),expected.A.B,label+'jump dialogue');
 // A flying piece can knock back a single crossing-lane defender.
 const flyingActor={color:0,role:'A',pieces:[29,-1,-1,-1]};
 const flyingVictim={color:3,role:'D',pieces:[52,-1,-1,-1]};
 const crossed=[];
 assert.equal(captureAlong({players:[flyingActor,flyingVictim]},flyingActor,
  {path:[{pos:17,kind:'骰点'},{pos:29,kind:'飞跃'}]},0,crossed),1,label+'flight-lane collision');
 assert.equal(collisionLine('A',crossed),expected.A.D,label+'flight dialogue');
 // When several different roles are knocked back, prefer a known targeted
 // relationship over unrelated generic lines, but display only one message.
 const mActor={color:0,role:'A',pieces:[2,-1,-1,-1]};
 const mOther={color:1,role:'H',pieces:[15,-1,-1,-1]};
 const mTarget={color:2,role:'D',pieces:[41,-1,-1,-1]};
 const caught=[];
 assert.equal(captureAlong({players:[mActor,mOther,mTarget]},mActor,
  {path:[{pos:2,kind:'骰点'}]},0,caught),2,label+'two roles knocked home');
 assert.deepEqual(Array.from(caught),['H','D']);
 assert.equal(collisionLine('A',caught),expected.A.D,label+'prioritize any valid targeted relationship');
}
console.log('PASS: all 10 directed lines, capture-only triggers, regular/hop/flight/multi-target hits in web and offline engines');
