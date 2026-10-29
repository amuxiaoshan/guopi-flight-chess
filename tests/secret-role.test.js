'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pack=require('../content/packs/oc/pack.json');
const active=require('../content/active.json').active;
const standardIds='ABCDEFGH'.split('');
const secretId='I';
if(active!=='oc'){console.log('SKIP: alternate content pack intentionally has no OC-only secret');process.exit(0);}
assert.equal(pack.characters[secretId]?.name,'瓦塞');
assert.equal(pack.characters[secretId]?.secret,true);
assert.equal(pack.characters[secretId]?.humanOnly,true);
assert.equal(Object.keys(pack.characters).at(-1),secretId);

const serverSource=fs.readFileSync(path.join(root,'server.js'),'utf8');
const online=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const offline=fs.readFileSync(path.join(root,'public/single.html'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const style=fs.readFileSync(path.join(root,'public/style.css'),'utf8');
for(const [name,content] of [['server',serverSource],['offline',offline]]){
 assert.match(content,/roles=Object\.keys\((?:globalThis\.)?GAME_CONTENT\.characters\)\.filter\(id=>!.*?\.secret\)/,name+': standard random pool must exclude secrets');
 assert.match(content,/if\(type==='unlock-secret'\)/,name+': unlock action missing');
 assert.match(content,/p\.kind!=='human'\|\|!p\.secretUnlocked/,name+': human-only restriction missing');
 assert.match(content,/secretUnlocked:!!me\?\.secretUnlocked/,name+': private unlock flag missing');
}
for(const [name,content] of [['online',online],['offline',offline]]){
 assert.match(content,/secretTapCount\+\+/,name+': tap counter');
 assert.match(content,/secretTapCount<5/,name+': fifth-click trigger');
 assert.match(content,/me\(\)\?\.role!=='\?'/,name+': must tap while random role selected');
 assert.match(content,/playToggleClick\(\);[\s\S]*?action\(\{type:'unlock-secret'\}\)/,name+': reuse sound toggle effect');
 assert.match(content,/const humanRoleChoices=.*secretUnlocked/,name+': only unlocked humans see secret');
 assert.match(content,/\$\('myToken'\)\.addEventListener\('click',tapSecretQuestion\)/,name+': missing question mark click');
 assert.match(content,/\$\('botEditors'\)\.innerHTML[\s\S]*?\$\{ROLE\.map/,name+': bot options must use standard roles only');
 assert.match(name==='online'?index:offline,/id="secretHint"[^>]+hidden>Give me five！/,name+': popup missing');
}
assert.match(style,/\.secretHint\{/);

const {createRoom,handleAction,rooms}=require('../server.js');
const r=createRoom('测试真人','solo');
const payload={code:r.code,token:r.token};
const act=(type,extra={})=>handleAction({...payload,type,...extra});
try{
 assert.throws(()=>act('select',{role:secretId}),/需要先解锁/);
 assert.equal(act('state').state.secretUnlocked,false);
 const unlock=act('unlock-secret');
 assert.equal(unlock.ok,true);
 assert.equal(act('state').state.secretUnlocked,true);
 act('select',{role:secretId});
 assert.equal(act('state').state.players.find(p=>p.kind==='human').role,secretId);
 // Computer role list excludes secret both via configuration and when randomized.
 assert.ok(!/const ROLE=\['\?',\.\.\.Object\.keys\(ROLE_INFO\)\];/.test(online));
 act('bot-config',{index:0,role:secretId});
 assert.notEqual(act('state').state.bots[0].role,secretId);
 act('select',{role:'?'});
 const standardNames=new Set(standardIds);
 for(let i=0;i<20;i++){
  const pr=act('start');
  assert.equal(pr.ok,true);
  const st=act('state').state;
  for(const player of st.players)assert.ok(standardNames.has(player.role),'random selection must never choose the secret role');
  // Start creates an active game; future loops need fresh rooms, so one round is enough.
  break;
 }
 // In contrast, human explicitly selecting the secret before start is allowed.
 const fresh=createRoom('第二位真人','solo');
 try{
  const ctx={code:fresh.code,token:fresh.token};
  handleAction({...ctx,type:'unlock-secret'});
  handleAction({...ctx,type:'select',role:secretId});
  handleAction({...ctx,type:'start'});
  const state=handleAction({...ctx,type:'state'}).state;
  assert.equal(state.players.find(p=>p.kind==='human').role,secretId);
  assert.notEqual(state.players.find(p=>p.kind==='ai').role,secretId);
 }finally{rooms.delete(fresh.code);}
}finally{rooms.delete(r.code);}
console.log('PASS: five-tap UI, online/offline unlock, human-only role, bots excluded, random excluded');
