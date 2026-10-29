'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');

for(const name of ['app.js','single.html']){
 const source=fs.readFileSync(path.join(root,'public',name),'utf8');
 const exitStart=source.indexOf('function isSoloMode(){');
 const exitEnd=source.indexOf("\n$('leave').onclick=exitSetup;",exitStart);
 assert.ok(exitStart!==-1&&exitEnd>exitStart,name+': exit block not found');
 const exitCode=source.slice(exitStart,exitEnd);
 const ruleStart=source.indexOf('function rules(){');
 const ruleEnd=source.indexOf("\n$('rulesHome').onclick=rules;",ruleStart);
 assert.ok(ruleStart!==-1&&ruleEnd>ruleStart,name+': rules block not found');
 const ruleCode=source.slice(ruleStart,ruleEnd);
 const modal=(mode,phase,host=false)=>{
  const events=[];
  const leaveRoom=()=>events.push(['leave']);
  const context={state:{mode,phase,host},myRoomMode:mode,
   dialog:(title,body,confirm)=>events.push(['dialog',title,body,confirm]),
   leaveRoom};
  vm.runInNewContext(exitCode+'\nexitSetup();',context);
  return {events,leaveRoom};
 };
 for(const phase of ['playing','lobby']){
  const {events,leaveRoom}=modal('solo',phase);
  assert.equal(events.length,1,name+': solo '+phase+' one prompt');
  assert.equal(events[0][0],'dialog');
  assert.equal(events[0][1],'确认要退出吗？');
  assert.equal(events[0][2],'',name+': solo must not mention computer takeover');
  assert.equal(events[0][3],leaveRoom);
 }
 const over=modal('solo','over');
 assert.equal(over.events[0][0],'leave',name+': solo results can go home without new warning');
 if(name==='app.js'){
  const multiplayer=modal('online','playing');
  assert.match(multiplayer.events[0][2],/电脑会接管/,name+': preserve takeover warning for multiplayer');
  const hostLobby=modal('online','lobby',true);
  assert.match(hostLobby.events[0][2],/房主身份/);
 }
 const rulesFor=(mode)=>{
  const events=[];
  const context={state:mode==='home'?null:{mode},myRoomMode:mode==='home'?'':mode,
   isSoloMode:()=>mode==='solo',dialog:(title,body)=>events.push({title,body})};
  vm.runInNewContext(ruleCode+'\nrules();',context);
  return events[0];
 };
 const soloRules=rulesFor('solo');
 assert.match(soloRules.body,/跳格/);
 assert.match(soloRules.body,/单人游戏/);
 assert.doesNotMatch(soloRules.body,/电脑托管|电脑暂时接管|房主离开|返回接管|按入房顺序移交/,name+': solo rules mention multiplayer takeover');
 assert.ok(soloRules.body.includes('\n\n'),name+': rule paragraphs have real line breaks');
 const multiRules=rulesFor('online');
 assert.match(multiRules.body,/电脑暂时接管|返回接管/,name+': multiplayer rules retained');
 assert.doesNotMatch(rulesFor('home').body,/电脑暂时接管/,name+': welcome rules should be mode-neutral');
 assert.ok(source.includes("'continueText').textContent=isSoloMode()?"),name+': vote prompt should differ by mode');
 assert.ok(source.includes("'continueNo').textContent=isSoloMode()?'退出比赛'"),name+': solo vote button must not mention takeover');
}
console.log('PASS: solo exit confirmation only, multiplayer takeover retained, separate rules/vote copy online and offline');
