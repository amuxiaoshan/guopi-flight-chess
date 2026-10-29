'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');

const root=path.join(__dirname,'..');
const active=require('../content/active.json').active;
if(active!=='oc'){console.log('SKIP: Tanulian artwork is OC-pack specific');process.exit(0);}
const pack=require('../content/packs/oc/pack.json');
const tanulian=pack.characters.G;
assert.equal(tanulian.name,'塔努利安');
assert.equal(tanulian.pieceImage,'assets/tanulian-original.png');
assert.deepEqual(tanulian.collision,[
 '哇我不是故意的、\n祝你加油！(;ﾟдﾟ)',
 '嗯……不错的决策。',
 '呃，下一个更好……？\n(ﾟ◇ﾟﾉ)ﾉ'
]);
const image=fs.readFileSync(path.join(root,'content/packs/oc/assets/tanulian-original.png'));
assert.equal(image.length,59021,'Must use the original uploaded image bytes');
assert.equal(crypto.createHash('sha256').update(image).digest('hex'),'184cc2e1701af7afa64e36bbe71a5724282a7c402136ddd70245aac243c37df4');
assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
const served=fs.readFileSync(path.join(root,'public/content/assets/oc/assets/tanulian-original.png'));
assert.deepEqual(served,image,'Online artwork must exactly match the original PNG');
const generated=fs.readFileSync(path.join(root,'public/content-pack.js'),'utf8');
assert.match(generated,/"G":\{"name":"塔努利安","mark":"塔","pieceImage":"\/content\/assets\/oc\/assets\/tanulian-original\.png"/);
const html=fs.readFileSync(path.join(root,'public/single.html'),'utf8');
const embedded=html.match(/"G":\{"name":"塔努利安","mark":"塔","pieceImage":"data:image\/png;base64,([^"]+)"/);
assert.ok(embedded,'Offline Tanulian image should be embedded in HTML');
assert.deepEqual(Buffer.from(embedded[1],'base64'),image,'Offline artwork must match the original PNG');
for(const filename of ['app.js','single.html']){
 const ui=fs.readFileSync(path.join(root,'public',filename),'utf8');
 assert.match(ui,/const roleTokenMarkup=role=>/,'Character picker and roster must render images');
 assert.match(ui,/svg\('image',\{href:ROLE_INFO\[p\.role\]\.pieceImage/,'Chessboard must render uploaded art');
}
console.log('PASS: original Tanulian PNG, 3 collision lines, roster, board, online and offline artwork');
