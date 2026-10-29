'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const sourcePath='content/packs/oc/assets/wase-original.png';
const publicPath='public/content/assets/oc/assets/wase-original.png';
const original=fs.readFileSync(path.join(root,sourcePath));
const rendered=fs.readFileSync(path.join(root,publicPath));
assert.deepEqual(rendered,original,'Never redraw or re-encode the original Wase PNG');
const sha=crypto.createHash('sha256').update(original).digest('hex');
assert.equal(original.length,45189,'Use user-uploaded original file, not an imagegen replacement');
assert.equal(original.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
const active=require('../content/active.json').active;
if(active!=='oc'){console.log('SKIP: OC-only artwork preview test for alternate content pack');process.exit(0);}
const pack=require('../content/packs/oc/pack.json');
assert.equal(pack.characters.I.pieceImage,'assets/wase-original.png');
const onlineJSON=read('public/content-pack.js');
assert.ok(onlineJSON.includes('/content/assets/oc/assets/wase-original.png'));
const offline=read('public/single.html');
assert.ok(offline.includes('"I":{"name":"瓦塞","mark":"瓦","pieceImage":"data:image/png;base64,'));
const online=read('public/app.js');
const css=read('public/style.css');

for(const [filename,source] of [['online',online],['offline',offline]]){
 assert.ok(source.includes("'myToken').innerHTML=canTapQuestion"),filename+': picker must limit the ? tap target');
 assert.ok(source.includes(": roleTokenMarkup(self.role);"),filename+': picker must render original portraits for selected roles');
 assert.ok(source.includes("class=\"secret-question-hit\""),filename+': random-role glyph should be an accessible button');
 assert.ok(source.includes("('myToken').style.backgroundColor=GAME_CONTENT.teams[self.color].base"),filename+': picker needs matching team base');
 assert.equal((source.match(/\$\{roleTokenMarkup\(p\.role\)\}/g)||[]).length,filename==='online'?3:2,filename+': lobby and every in-game avatar, including host transfer');
 assert.ok(source.includes("svg('image',{href:ROLE_INFO[p.role].pieceImage"),filename+': board must render the same PNG');
 assert.ok(source.includes("('myToken').addEventListener('click',tapSecretQuestion)"),filename+': five-tap easter egg must survive');
 assert.ok(source.includes("const roleTokenStyle=color=>"),filename+': shared same-color outline style');
 const helperStart=source.indexOf("const roleTokenMarkup=role=>");
 const helperEnd=source.indexOf("const COLOR=[",helperStart);
 assert.ok(helperStart>0&&helperEnd>helperStart,'missing shared artwork helpers');
 const {roleTokenMarkup,roleTokenStyle}=vm.runInNewContext(
  source.slice(helperStart,helperEnd)+"\n({roleTokenMarkup,roleTokenStyle})",
  {ROLE_INFO:{I:{pieceImage:filename==='online'?'/content/assets/oc/assets/wase-original.png':'data:image/png;base64,AAA',mark:'瓦'},A:{pieceImage:null,mark:'禾'}},
   GAME_CONTENT:{teams:pack.teams},COLOR:pack.teams.map(t=>({hex:t.ui})),
   roleMark:role=>role==='I'?'瓦':role==='A'?'禾':'?',
   escapeHTML:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;')});
 assert.match(roleTokenMarkup('I'),/<img class="role-art" src="(?:\/content\/assets\/oc\/assets\/wase-original\.png|data:image\/png;base64,AAA)"/);
 assert.equal(roleTokenMarkup('A'),'禾');
 assert.ok(roleTokenStyle(0).includes('--piece-base:#A9CFF3'));
 assert.ok(roleTokenStyle(0).includes('--piece-edge:#416F9C'));
}
for(const code of [css,offline]){
 assert.ok(code.includes('.role-art'), 'missing portrait rendering CSS');
 assert.ok(code.includes('object-fit:contain'), 'do not crop character art');
 assert.ok(code.includes('pointer-events:none'), 'tap event must reach the question mark parent');
}
console.log('PASS: original Wase PNG '+sha.slice(0,12)+' and online/offline character-picker, lobby, player and board previews');
