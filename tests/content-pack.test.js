'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const active=require('../content/active.json').active;
const pack=require('../content/packs/'+active+'/pack.json');
const source=fs.readFileSync(path.join(ROOT,'public/content-pack.js'),'utf8');
const sandbox={globalThis:{}};
vm.runInNewContext(source,sandbox);
const generated=JSON.parse(JSON.stringify(sandbox.globalThis.GAME_CONTENT));
assert.equal(generated.id,active);
assert.deepEqual(Object.keys(generated.characters).sort(),Object.keys(pack.characters).sort());
for(const id of Object.keys(pack.characters)){
 const ch=pack.characters[id];
 assert.equal(generated.characters[id].name,ch.name);
 assert.equal(generated.characters[id].mark,ch.mark);
 assert.deepEqual(generated.characters[id].collision,ch.collision);
 if(ch.pieceImage) {
  assert.ok(generated.characters[id].pieceImage.startsWith('/content/assets/'+active+'/'));
  const asset=generated.characters[id].pieceImage.slice(1);
  assert.ok(fs.existsSync(path.join(ROOT,'public',asset)));
 }
}
const offline=fs.readFileSync(path.join(ROOT,'public/single.html'),'utf8');
const match=offline.match(/<script id="content-pack-data">(.*?)<\/script>/s);
assert.ok(match,'Offline HTML lacks embedded content pack');
const offlineSandbox={globalThis:{}};
vm.runInNewContext(match[1],offlineSandbox);
assert.equal(offlineSandbox.globalThis.GAME_CONTENT.id,active);
for(const ch of Object.values(offlineSandbox.globalThis.GAME_CONTENT.characters)){
 if(ch.pieceImage)assert.match(ch.pieceImage,/^data:image\//);
}
assert.ok(offline.includes('const GAME_CONTENT=globalThis.GAME_CONTENT;'));
assert.ok(offline.includes('const ROLE_INFO=GAME_CONTENT.characters;'));
assert.ok(fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8').includes('<script src="/content-pack.js" defer></script>'));

const {server}=require('../server.js');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  for(const uri of ['/','/app.js','/content-pack.js','/single.html']){
   const r=await fetch(origin+uri);
   assert.equal(r.status,200,uri+' should be served');
   assert.ok((await r.text()).length>80,uri+' must have content');
  }
  for(const ch of Object.values(generated.characters)){
   if(!ch.pieceImage)continue;
   const r=await fetch(origin+ch.pieceImage);
   assert.equal(r.status,200,'Character art should load');
   assert.equal(r.headers.get('content-type'),'image/png');
   assert.ok((await r.arrayBuffer()).byteLength>128);
  }
  const unknown=await fetch(origin+'/content/assets/'+active+'/secret-placeholder.png');
  assert.equal(unknown.status,404,'Unlisted artwork should be unavailable');
  console.log('PASS: active pack JSON, character quotes, artwork, standalone HTML and HTTP routes');
 }finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
