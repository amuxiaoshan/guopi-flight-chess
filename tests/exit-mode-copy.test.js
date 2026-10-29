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
 const expectedRules=[
  '→人数与目标\n2–4人，每人4架飞机。最先让全部4架飞机精确到达终点者获胜。',
  '→起飞\n掷出【6点】才能起飞一架飞机，并可再掷一次。',
  '→行棋\n按骰子点数前进。棋子停在与自己同色的格子上，可向前跳4格；跳格后不可再连跳。',
  '→飞棋（虚线）\n· 直接走到同色虚线格：沿虚线飞到对面。\n· 通过跳格到达虚线格：不能飞过去。',
  '→撞击与迭子\n停在对方棋子所在格，对方回基地。若对方有多个棋子在这个格子里，那么对方不会回到基地。想要对方回到基底需要有相同数量的棋子在这一格里。',
  '→终点\n必须恰好到达终点；若投掷点数超出则往回退多余步数。',
  '→惩罚\n连续三次掷出6点，己方飞机全部返回基地。'
 ].join('\n\n');
 for(const mode of ['solo','online','home']){
  const snapshot=rulesFor(mode);
  assert.equal(snapshot.title,'【适得其所】飞行棋规则',name+': rules title');
  assert.equal(snapshot.body,expectedRules,name+': exact seven-section rules in '+mode);
  assert.doesNotMatch(snapshot.body,/单人游戏由电脑|电脑托管|电脑暂时接管|房主离开|返回接管|提前结束并结算/,name+': removed obsolete mode-specific notes');
 }
 assert.ok(source.includes("classList.toggle('rules-dialog'"),name+': rule-specific scroll layout');
 assert.ok(source.includes("'continueText').textContent=isSoloMode()?"),name+': vote prompt should differ by mode');
 assert.ok(source.includes("'continueNo').textContent=isSoloMode()?'退出比赛'"),name+': solo vote button must not mention takeover');
}
console.log('PASS: solo exit prompts, exact seven-section unified rules, vote text online/offline');
