'use strict';
// Flight chess front end: one shared room state for humans, and server-driven AI.
const $ = id => document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
// Stable game identifiers A-H map to Shanshan's OCs. Names/marks are display-only.
const ROLE_INFO={
 A:{name:'青栖禾',mark:'禾'},
 B:{name:'澄',mark:'澄'},
 C:{name:'勒尔斯',mark:'勒'},
 D:{name:'麦冬',mark:'麦'},
 E:{name:'波波亚',mark:'波'},
 F:{name:'麻特',mark:'麻'},
 G:{name:'塔努利安',mark:'塔'},
 H:{name:'亚洛',mark:'亚'}
};
const ROLE=['?',...Object.keys(ROLE_INFO)];
const roleName=role=>ROLE_INFO[role]?.name||'随机角色';
const roleMark=role=>ROLE_INFO[role]?.mark||'?';
const COLOR=[
 {name:'蓝',key:'blue',hex:'#41a7f5',start:39,base:[10,678]},
 {name:'黄',key:'yellow',hex:'#f6c945',start:26,base:[690,678]},
 {name:'绿',key:'green',hex:'#58c26a',start:0,base:[10,22]},
 {name:'红',key:'red',hex:'#ef5350',start:13,base:[690,22]}
];
const ORDER=[3,1,0,2];
const TURN=49, LANE=50, GOAL=55;
const RING=[
 [92,292],[150,275],[200,275],[258,292],[292,258],[275,200],[275,150],[292,92],
 [350,75],[400,75],[450,75],[500,75],[550,75],[608,92],[625,150],[625,200],
 [608,258],[642,292],[700,275],[750,275],[808,292],[825,350],[825,400],[825,450],
 [825,500],[825,550],[808,608],[750,625],[700,625],[642,608],[608,642],[625,700],
 [625,750],[608,808],[550,825],[500,825],[450,825],[400,825],[350,825],[292,808],
 [275,750],[275,700],[292,642],[258,608],[200,625],[150,625],[92,608],[75,550],
 [75,500],[75,450],[75,400],[75,350]
];
const LANES={
 red:[[450,150],[450,200],[450,250],[450,300],[450,350],[450,400]],
 blue:[[450,750],[450,700],[450,650],[450,600],[450,550],[450,500]],
 green:[[150,450],[200,450],[250,450],[300,450],[350,450],[400,450]],
 yellow:[[750,450],[700,450],[650,450],[600,450],[550,450],[500,450]]
};
const PADS=[[64,64],[136,64],[64,136],[136,136]];
// A symmetric launch marker for every team, outside the board art.
// Incenter of each blank triangular notch beside the four preparation hangars.
const LAUNCH_POINT=[[254,846],[846,646],[54,254],[646,54]];
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const ORIENT={1:[0,0],2:[90,0],3:[0,-90],4:[0,90],5:[-90,0],6:[0,180]};
let code='',authToken='',events=null,state=null,lastSequence=-1,lastRollSeq=-1,lastMoveSeq=-1;
let roleIndex=0, animPiece=null, animationSerial=0, rollSerial=0, toastTimer, busy=false;
let myRoomMode='',viewerToken=null,pendingExit=false,checkingRoom=false;
let lanAddresses=[],lanFetched=false;
const sleep=ms=>new Promise(res=>setTimeout(res,ms));
// Original two-note retro coin chime. Synthesized locally; no external or copyrighted audio file.
const SOUND_PREF='flight-goal-sound';
let goalSoundEnabled=true,goalAudio=null;
try{goalSoundEnabled=localStorage.getItem(SOUND_PREF)!=='off';}catch{}
function prepareGoalAudio(){
 if(!goalSoundEnabled)return null;
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return null;
 try{
  if(!goalAudio||goalAudio.state==='closed')goalAudio=new Context();
  if(goalAudio.state==='suspended')goalAudio.resume().catch(()=>{});
  return goalAudio;
 }catch{return null;}
}
function playGoalChime(){
 const audio=prepareGoalAudio();if(!audio||!goalSoundEnabled)return;
 const now=audio.currentTime+0.012;
 for(const [pitch,delay,duration,volume] of [[987.77,0,0.110,0.095],[1318.51,0.095,0.185,0.090]]){
  const oscillator=audio.createOscillator(),envelope=audio.createGain(),t=now+delay;
  oscillator.type='square';oscillator.frequency.setValueAtTime(pitch,t);
  envelope.gain.setValueAtTime(0.0001,t);
  envelope.gain.exponentialRampToValueAtTime(volume,t+0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001,t+duration);
  oscillator.connect(envelope);envelope.connect(audio.destination);
  oscillator.start(t);oscillator.stop(t+duration+0.012);
 }
}
// A crisp 65 ms pop per actual piece landing, kept separate from the goal chime.
function playStepPop(){
 const audio=prepareGoalAudio();if(!audio||!goalSoundEnabled)return;
 try{
  const t=audio.currentTime+0.004;
  const oscillator=audio.createOscillator(),envelope=audio.createGain();
  oscillator.type='triangle';
  oscillator.frequency.setValueAtTime(950,t);
  oscillator.frequency.exponentialRampToValueAtTime(590,t+0.055);
  envelope.gain.setValueAtTime(0.0001,t);
  envelope.gain.exponentialRampToValueAtTime(0.125,t+0.003);
  envelope.gain.exponentialRampToValueAtTime(0.0001,t+0.065);
  oscillator.connect(envelope);envelope.connect(audio.destination);
  oscillator.start(t);oscillator.stop(t+0.070);
 }catch{}
}
// Tiny tabletop dice rattle, ending with a deeper landing click. No external audio assets.
function playDiceTap(landing=false){
 const audio=prepareGoalAudio();if(!audio||!goalSoundEnabled)return;
 try{
  const t=audio.currentTime+0.004;
  const oscillator=audio.createOscillator(),envelope=audio.createGain();
  const duration=landing?0.105:0.050;
  oscillator.type='triangle';
  oscillator.frequency.setValueAtTime(landing?410:690,t);
  oscillator.frequency.exponentialRampToValueAtTime(landing?230:430,t+duration*0.85);
  envelope.gain.setValueAtTime(0.0001,t);
  envelope.gain.exponentialRampToValueAtTime(landing?0.115:0.082,t+0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001,t+duration);
  oscillator.connect(envelope);envelope.connect(audio.destination);
  oscillator.start(t);oscillator.stop(t+duration+0.008);
 }catch{}
}

// Kenney Casino Audio, dice-shake-1.ogg (CC0), loudness-normalized in Emberdelve.
// https://kenney.nl/assets/casino-audio
// Embedded so the offline standalone HTML also plays without a network connection.
const DICE_SHAKE_DATA='data:audio/ogg;base64,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';
let diceShakeAudio=null;
function stopDiceShake(){
 if(!diceShakeAudio)return;
 try{diceShakeAudio.pause();diceShakeAudio.currentTime=0;}catch{}
}
function playRecordedDiceShake(){
 if(!goalSoundEnabled||typeof Audio!=='function')return false;
 try{
  if(!diceShakeAudio){
   const player=new Audio(DICE_SHAKE_DATA);
   player.preload='auto';
   if(typeof player.canPlayType==='function'&&!player.canPlayType('audio/ogg; codecs="vorbis"'))return false;
   diceShakeAudio=player;
  }
  stopDiceShake();
  diceShakeAudio.volume=1;
  // Fit the shake recording to the existing 0.64 s dice animation.
  const d=diceShakeAudio.duration;
  diceShakeAudio.playbackRate=Number.isFinite(d)&&d>0?Math.max(0.85,Math.min(2.8,d/0.65)):1.35;
  const started=diceShakeAudio.play();
  if(started&&typeof started.catch==='function')started.catch(()=>{if(goalSoundEnabled)playDiceTap(true);});
  return true;
 }catch{return false;}
}
function refreshSoundEngine(){
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context){toast('当前浏览器不支持游戏音效');return;}
 let fresh;
 try{fresh=new Context();}catch{
  toast('无法重新启动音效，请检查浏览器的声音权限');return;
 }
 stopDiceShake();diceShakeAudio=null;
 const old=goalAudio;
 goalAudio=fresh;
 const serial=++soundRefreshSerial;
 if(!goalSoundEnabled){
  goalSoundEnabled=true;
  try{localStorage.setItem(SOUND_PREF,'on');}catch{}
  refreshSoundToggle();
 }
 // Retire the old audio engine asynchronously; game turns and animations keep running.
 if(old&&old!==fresh&&old.state!=='closed'){
  try{Promise.resolve(old.close()).catch(()=>{});}catch{}
 }
 let started;
 try{started=fresh.state==='suspended'?fresh.resume():Promise.resolve();}
 catch(e){started=Promise.reject(e);}
 Promise.resolve(started).then(()=>{
  if(serial!==soundRefreshSerial||goalAudio!==fresh)return;
  if(fresh.state!=='running'){
   toast('音效未能启动，请检查设备音量与浏览器声音设置');return;
  }
  playStepPop(); // short audible confirmation, no interruption of the active turn
  toast('音效已刷新，当前棋局不会重置');
 }).catch(()=>{
  if(serial===soundRefreshSerial&&goalAudio===fresh)
   toast('音效启动失败，请检查浏览器的声音权限');
 });
}
function refreshSoundToggle(){
 const button=$('soundToggle');if(!button)return;
 button.textContent=goalSoundEnabled?'音效：开':'音效：关';
 button.setAttribute('aria-pressed',String(goalSoundEnabled));
 button.title=goalSoundEnabled?'关闭游戏音效':'开启游戏音效';
}
$('soundToggle').onclick=()=>{
 goalSoundEnabled=!goalSoundEnabled;
 try{localStorage.setItem(SOUND_PREF,goalSoundEnabled?'on':'off');}catch{}
 refreshSoundToggle();
 if(!goalSoundEnabled)stopDiceShake();
 if(goalSoundEnabled)playGoalChime(); // On-switch confirmation also unlocks audio on mobile.
};
document.addEventListener('pointerdown',prepareGoalAudio,{passive:true});
document.addEventListener('keydown',prepareGoalAudio);
refreshSoundToggle();
for(const id of ['soundRepairHome','soundRepairGame']){
 const repairButton=$(id);
 if(repairButton)repairButton.onclick=refreshSoundEngine;
}


const escapeHTML=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function screen(id){document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function dialog(title,body,confirm=null){$('dlgTitle').textContent=title;$('dlgText').textContent=body;$('dlgClose').textContent=confirm?'取消':'知道了';$('dialog').classList.add('open');$('dlgConfirm').hidden=!confirm;$('dlgConfirm').onclick=confirm?()=>{$('dialog').classList.remove('open');confirm();}:null;}
$('dlgClose').onclick=()=>$('dialog').classList.remove('open');
$('dialog').onclick=e=>{if(e.target===$('dialog'))$('dialog').classList.remove('open');};
async function api(payload){const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,code,token:authToken})});let data;try{data=await response.json();}catch{throw Error('服务端没有返回正确数据');}if(!response.ok)throw Error(data.error||'操作失败');return data;}
async function action(payload){
 try{
  const result=await api(payload);
  if(result.state&&payload.type!=='create')receive(result.state);
  return result;
 }catch(e){toast(e.message);return null;}
}
function resetConnection(){stopDiceShake();if(events){events.close();events=null;}animationSerial++;rollSerial++;state=null;lastSequence=-1;lastMoveSeq=-1;lastRollSeq=-1;animPiece=null;}
function home(){resetConnection();code='';authToken='';myRoomMode='';pendingExit=false;screen('welcome');history.replaceState(null,'',location.pathname);}
function connect(){
 resetConnection();
 events=new EventSource(`/api/events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(authToken)}`);
 events.onmessage=e=>{try{receive(JSON.parse(e.data));}catch(err){console.error(err);toast('更新房间画面时出了问题');}};
 events.onerror=async()=>{
   if(!code||!authToken||checkingRoom)return;
   const oldCode=code,oldToken=authToken;
   checkingRoom=true;
   try{
     const r=await fetch(`/api/state?code=${encodeURIComponent(oldCode)}&token=${encodeURIComponent(oldToken)}`,{cache:'no-store'});
     if((r.status===403||r.status===404)&&code===oldCode&&authToken===oldToken&&!pendingExit){
       sessionStorage.removeItem('flight_room');
       home();dialog('房间已结束','房间不存在或你已退出，已经返回主页。');
     }
   }catch{}finally{checkingRoom=false;}
 };
}
async function enter(mode){const result=await action({type:'create',name:$('nickname').value,mode});if(!result)return;code=result.code;authToken=result.token;myRoomMode=mode;sessionStorage.setItem('flight_room',JSON.stringify({code,authToken}));connect();if(result.state)receive(result.state);}
async function join(){const c=$('joinCode').value.toUpperCase().trim();if(c.length!==6){toast('请输入六位房间码');return;}const result=await actionWithCode({type:'join',code:c,name:$('nickname').value});if(!result)return;code=result.code;authToken=result.token;myRoomMode='online';sessionStorage.setItem('flight_room',JSON.stringify({code,authToken}));connect();if(result.state)receive(result.state);}
async function prepareLanAddresses(){
 if(lanFetched)return;
 lanFetched=true;
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
 try{
   const response=await fetch('/api/network',{cache:'no-store'});
   if(response.ok)lanAddresses=(await response.json()).addresses||[];
 }catch(e){console.warn('不能读取局域网地址',e);}
 if(state?.phase==='lobby')renderShareSettings();
}
function invitationURL(){
 const link=new URL(location.href);
 link.search='';link.hash='';link.searchParams.set('room',code);
 if(['localhost','127.0.0.1','[::1]'].includes(link.hostname)){
   const chosen=$('lanAddress').value||lanAddresses[0]?.address;
   if(chosen)link.hostname=chosen;
 }
 return link.toString();
}
function renderShareSettings(){
 const holder=$('shareSettings');
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 holder.hidden=!(state?.host&&local&&state?.mode==='online');
 if(holder.hidden)return;
 const options=lanAddresses.map(it=>`<option value="${escapeHTML(it.address)}">${escapeHTML(it.address)} (${escapeHTML(it.name)})</option>`);
 const previous=$('lanAddress').value;
 $('lanAddress').innerHTML=options.join('');
 if(lanAddresses.some(it=>it.address===previous))$('lanAddress').value=previous;
 $('networkHint').textContent=lanAddresses.length?'电脑、手机连同一 Wi-Fi；邀请链接将使用上面的地址。若有多个地址，请选实际 Wi-Fi 对应的 IPv4。':'未自动找到局域网地址。可在电脑运行 ipconfig 查询 Wi-Fi 的 IPv4，再把链接的 127.0.0.1 替换为该地址。';
}
async function actionWithCode(payload){try{const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||'请求失败');return d;}catch(e){toast(e.message);return null;}}
$('solo').onclick=()=>enter('solo');$('create').onclick=()=>enter('online');$('join').onclick=join;
$('joinCode').oninput=e=>{e.target.value=e.target.value.replace(/[^a-z0-9]/ig,'').toUpperCase();};
function me(){return state?.players.find(p=>p.kind==='human'&&p.color===state.viewerColor);}
function receive(next){
 if(next.seq<=lastSequence)return;
 if(next.phase==='closed'){
   const leaving=pendingExit,reason=next.closeReason||'房间已结束。';
   sessionStorage.removeItem('flight_room');
   home();
   if(!leaving)dialog('房间已结束',reason);
   return;
 }
 const first=lastSequence<0;
 state=next;lastSequence=next.seq;
 if(first){roleIndex=Math.max(0,ROLE.indexOf(me()?.role??'?'));}
 if(next.phase==='lobby'){screen('lobby');renderLobby();prepareLanAddresses();return;}
 if(next.phase==='playing'){screen('game');renderGame();}
 if(next.phase==='over'){
   screen('result'); const rank=next.finishOrder.indexOf(next.viewerColor)+1;
   $('rank').textContent=rank?`第 ${rank} 名`:'—';
   $('restart').textContent='再次游戏';
   $('restart').disabled=!next.host;
   $('resultNote').hidden=next.host;
 }
 if(!first&&next.lastRoll?.seq!==undefined&&next.lastRoll.seq!==lastRollSeq){lastRollSeq=next.lastRoll.seq;animateRoll(next.lastRoll.value);}
 else if(first&&next.lastRoll){lastRollSeq=next.lastRoll.seq;placeCube(next.lastRoll.value);}
 if(!first&&next.lastMove?.seq!==undefined&&next.lastMove.seq!==lastMoveSeq){lastMoveSeq=next.lastMove.seq;animateMove(next.lastMove);}
 else if(first&&next.lastMove){lastMoveSeq=next.lastMove.seq;}
}
function swatchButton(i,chosen,disabled){return `<button type="button" class="colorButton ${chosen?'chosen':''}" style="--color:${COLOR[i].hex}" title="${COLOR[i].name}色" aria-label="${COLOR[i].name}色" data-color="${i}" ${disabled?'disabled':''}></button>`;}
function renderLobby(){
 if(!state)return;
 // A solo game uses an internal room identifier, but has no invite workflow.
 document.querySelector('#lobby .roommeta').hidden=state.mode==='solo';
 document.querySelector('#lobby .nav strong').textContent=state.mode==='solo'?'单人准备':'房间准备';
 $('codeText').textContent=state.mode==='solo'?'':state.code;
 renderShareSettings();
 const self=me();if(!self)return;
 roleIndex=Math.max(0,ROLE.indexOf(self.role));
 $('myToken').textContent=roleMark(self.role);
 $('myToken').style.borderColor=COLOR[self.color].hex;
 $('myRole').textContent=self.role==='?'?'随机角色':roleName(self.role);
 const used=state.players.filter(p=>p.kind==='human'&&p.color!==self.color).map(p=>p.color);
 $('myColors').innerHTML=ORDER.map(c=>swatchButton(c,c===self.color,used.includes(c))).join('');
 $('myColors').querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>action({type:'select',color:Number(b.dataset.color)}));
 const specs=[...state.players.map(p=>({...p,fromBot:false})),...state.bots.map((b,i)=>({name:`电脑 ${i+1}`,role:b.role,color:b.color,kind:'ai',fromBot:true}))];
 $('seats').replaceChildren();
 specs.sort((a,b)=>a.color-b.color).forEach(p=>{
  const div=document.createElement('div');div.className='seat';div.innerHTML=`<div class="tiny" style="--color:${COLOR[p.color].hex}">${escapeHTML(roleMark(p.role))}</div><div class="seatlabels"><div class="seatrole">${escapeHTML(roleName(p.role))}</div><div class="seatname">${escapeHTML(p.name)}${p.kind==='human'&&p.color===state.viewerColor?'（我）':''}${state.mode!=='solo'&&p.kind==='human'&&p.color===state.hostColor?'（房主）':''}</div></div>`;
  $('seats').appendChild(div);
 });
 $('botControl').hidden=!state.host;
 $('startGame').hidden=!state.host;
 $('startGame').disabled=!state.canStart;
 $('startGame').textContent=state.canStart?'开始游戏':'等待其他玩家／添加电脑';
 const humans=state.players.length;
 $('lobbyHint').textContent=state.mode==='solo'?'选择 1～3 个电脑，还可以分别调整它们的角色与颜色。':`真人 ${humans} 人 · 电脑 ${state.bots.length} 人。真人可重复角色，阵营颜色不重复；电脑由房主设置。${state.host&&['localhost','127.0.0.1'].includes(location.hostname)?' 邀请其他设备前，请改用房主的局域网IP或公网网址打开房间。':''}${state.canStart?'':' 至少需要两方，邀请朋友或添加一个电脑才能开始。'}`;
 if(state.host){
  const max=4-humans;
  const min=state.mode==='solo'?1:0;
  $('botCount').innerHTML=Array.from({length:max-min+1},(_,i)=>i+min).map(i=>`<option value="${i}" ${i===state.bots.length?'selected':''}>${i}</option>`).join('');
  const humanColors=state.players.map(p=>p.color);
  $('botEditors').innerHTML=state.bots.map((b,i)=>{
   const occupied=state.bots.filter((_,j)=>i!==j).map(x=>x.color).concat(humanColors);
   return `<div class="botrow"><span>电脑${i+1}</span><select data-role-index="${i}" aria-label="电脑${i+1}角色">${ROLE.map(r=>`<option value="${r}" ${r===b.role?'selected':''}>${r==='?'?'随机角色':roleName(r)}</option>`).join('')}</select><select data-color-index="${i}" aria-label="电脑${i+1}颜色">${ORDER.map(c=>`<option value="${c}" ${c===b.color?'selected':''} ${occupied.includes(c)?'disabled':''}>${COLOR[c].name}色</option>`).join('')}</select></div>`;
  }).join('');
  $('botEditors').querySelectorAll('[data-role-index]').forEach(el=>el.onchange=()=>action({type:'bot-config',index:Number(el.dataset.roleIndex),role:el.value}));
  $('botEditors').querySelectorAll('[data-color-index]').forEach(el=>el.onchange=()=>action({type:'bot-config',index:Number(el.dataset.colorIndex),color:Number(el.value)}));
 }
}
function changeRole(delta){if(!state||state.phase!=='lobby')return;const idx=ROLE.indexOf(me().role);const next=(idx+delta+ROLE.length)%ROLE.length;action({type:'select',role:ROLE[next]});}
$('prevRole').onclick=()=>changeRole(-1);$('nextRole').onclick=()=>changeRole(1);
$('botCount').onchange=e=>action({type:'bots',count:Number(e.target.value)});
$('startGame').onclick=async()=>{
 if(busy)return;
 busy=true;
 const button=$('startGame');button.disabled=true;button.textContent='正在开始…';
 const result=await action({type:'start'});
 busy=false;
 if(result?.state)receive(result.state);
 else if(state?.phase==='lobby')renderLobby();
};
$('copyInvite').onclick=async()=>{
 await prepareLanAddresses();
 const msg=invitationURL();
 const local=['localhost','127.0.0.1','[::1]'].includes(new URL(msg).hostname);
 if(local){dialog('手机联机地址',`房间码：${code}。未检测到可用的电脑局域网 IP。请在电脑用 ipconfig 查 Wi-Fi 的 IPv4，手机打开 http://电脑IPv4:${location.port||3000}/?room=${code} 。`);return;}
 try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(msg);toast('手机邀请链接已复制');}
 catch{dialog('邀请朋友',`房间码：${code}\n邀请链接：${msg}\n长按链接文字复制。请确保双方连接同一 Wi-Fi，或服务器有公网地址。`);}
};
async function leaveRoom(){
 if(!code||!authToken){home();return;}
 pendingExit=true;
 const result=await action({type:'leave'});
 if(!result){pendingExit=false;return;}
 sessionStorage.removeItem('flight_room');
 home();
}
function isSoloMode(){return state?.mode==='solo'||myRoomMode==='solo';}
function exitSetup(){
 if(isSoloMode()){leaveRoom();return;}
 if(state?.host){
   dialog('房主退出房间？','你是房主，离开后整个房间会解散，所有玩家都会返回主页。想保留房间，请先在对局中点击其他真人玩家的头像移交房主。',leaveRoom);
 }else{
   const humans=state?.players.filter(p=>p.kind==='human').length||0;
   dialog('退出房间？',humans<=2?'退出后房间只剩一位真人玩家，所有人将自动返回主页。':'你会离开本局，其余玩家可以继续游戏。',leaveRoom);
 }
}
$('leave').onclick=exitSetup;
$('exitLobby').onclick=exitSetup;
$('gameBack').onclick=exitSetup;
$('resultHome').onclick=exitSetup;
$('restart').onclick=()=>action({type:'replay'});
function point(color,pos,id){
 if(pos===-2)return LAUNCH_POINT[color];
 if(pos===-1){const [x,y]=COLOR[color].base;return [x+PADS[id][0],y+PADS[id][1]];}
 if(pos===GOAL)return LANES[COLOR[color].key][GOAL-LANE];
 if(pos<LANE)return RING[(COLOR[color].start+pos)%52];
 return LANES[COLOR[color].key][pos-LANE];
}
function svg(tag,props,parent){const el=document.createElementNS(NS,tag);Object.entries(props).forEach(([k,v])=>el.setAttribute(k,String(v)));parent.appendChild(el);return el;}
function piecePosition(p,id){if(animPiece?.color===p.color&&animPiece?.id===id)return animPiece.pos;return p.pieces[id];}
function drawPieces(){
 const node=$('pieces');node.replaceChildren();if(!state)return;
 for(let color=0;color<4;color++){
  const [cx,cy]=LAUNCH_POINT[color];
  svg('circle',{cx,cy,r:18,fill:'#fffdf9',stroke:COLOR[color].hex,'stroke-width':3,class:'launch-circle','pointer-events':'none'},node);
 }
 const packs=new Map();
 for(const p of state.players)for(let id=0;id<4;id++){
  const pos=piecePosition(p,id);if(pos===GOAL)continue;
  const [x,y]=point(p.color,pos,id),key=`${x},${y}`;
  if(!packs.has(key))packs.set(key,[]);
  packs.get(key).push({p,id,pos,x,y});
 }
 for(const pack of packs.values())for(let i=0;i<pack.length;i++){
  const {p,id,x,y}=pack[i];const count=pack.length;
  const colCount=Math.ceil(Math.sqrt(count));
  // Mixed-color stacks share the same square; give each piece a visible seat.
  const packed=count>1, spacing=packed?30:0;
  const radius=packed?17:24, border=packed?3.5:5, fontSize=packed?16:22;
  const dx=packed?(i%colCount-(colCount-1)/2)*spacing:0;
  const dy=packed?(Math.floor(i/colCount)-(Math.ceil(count/colCount)-1)/2)*spacing:0;
  const canSelect=state.viewerColor===p.color&&state.turn===p.color&&state.roundPhase==='choose'&&state.options.length>1&&state.options.includes(id)&&!animPiece;
  const group=svg('g',{transform:`translate(${x+dx} ${y+dy})`,class:canSelect?'piece available':'piece',role:canSelect?'button':'img','aria-label':`${p.role} 第${id+1}枚棋子`,tabindex:canSelect?'0':'-1'},node);
  if(canSelect){svg('circle',{r:packed?23:32,fill:'none',stroke:COLOR[p.color].hex,'stroke-width':5,class:'halo'},group);
   svg('path',{d:packed?'M-8 -42 L8 -42 L0 -29Z':'M-10 -52 L10 -52 L0 -38Z',fill:COLOR[p.color].hex,stroke:'white','stroke-width':2,class:'pointer'},group);}
  svg('circle',{r:radius,fill:'white',stroke:COLOR[p.color].hex,'stroke-width':border},group);
  const letter=svg('text',{x:0,y:1,'text-anchor':'middle','dominant-baseline':'central','font-size':fontSize,fill:'#272a30'},group);letter.textContent=roleMark(p.role);
  if(canSelect){group.onclick=()=>action({type:'move',piece:id});group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action({type:'move',piece:id});}};}
 }
}
function renderGame(){
 if(!state)return;
 const self=me();
 $('boardSelectedRole').textContent='【'+(self?roleName(self.role):'随机角色')+'】';
 $('boardSelectedRole').style.setProperty('--selected-color',self?COLOR[self.color].hex:'#878b91');
 $('playerStrip').innerHTML=ORDER.map(c=>state.players.find(p=>p.color===c)).filter(Boolean).map(p=>{
 const count=p.pieces.filter(v=>v===GOAL).length;
 const canTransfer=state.host&&state.mode==='online'&&p.kind==='human'&&p.color!==state.viewerColor;
 const avatar=canTransfer
  ? `<button type="button" class="tiny host-transfer-avatar" style="--color:${COLOR[p.color].hex}" data-transfer-color="${p.color}" aria-label="移交房主给${escapeHTML(p.name)}" title="点击头像移交房主">${escapeHTML(roleMark(p.role))}</button>`
  : `<div class="tiny" style="--color:${COLOR[p.color].hex}">${escapeHTML(roleMark(p.role))}</div>`;
 const hostMark=p.kind==='human'&&p.color===state.hostColor?'<span class="host-tag">房主</span>':'';
 return `<div class="playerchip ${state.turn===p.color?'turn':''} ${p.finished?'done':''}" style="--color:${COLOR[p.color].hex}">${avatar}<div title="${escapeHTML(roleName(p.role))}" class="seatname seatrole">${escapeHTML(roleName(p.role))}</div><small title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</small><small>${count}/4 已到终点</small>${hostMark}</div>`;
 }).join('');
 $('playerStrip').querySelectorAll('[data-transfer-color]').forEach(button=>{
   button.onclick=()=>{
     const target=state?.players.find(p=>p.kind==='human'&&p.color===Number(button.dataset.transferColor));
     if(!state?.host||state.phase!=='playing'||!target)return;
     dialog('确认移交房主？',`将房主身份交给「${target.name}」吗？移交后对方拥有房主权限；如果对方退出，整个房间将解散。`,()=>action({type:'transfer-host',targetColor:target.color}));
   };
 });
 $('gameHint').textContent=state.host&&state.mode==='online'&&state.players.filter(p=>p.kind==='human').length>1?'房主可点击其他玩家的头像移交房主 · 轮到自己时掷骰':'轮到自己时掷骰 · 可选的棋子会显示光圈和小三角';
 const turnPlayer=state.players.find(p=>p.color===state.turn);
 const mine=state.viewerColor===state.turn;
 const phases={roll:mine?'点击骰子':'等待掷骰',choose:state.options?.length>1?(mine?'点击发光的棋子':'正在选择棋子'):'唯一可动棋子自动前进',moving:'正在移动棋子',rolling:'骰子结果已出'};
 $('status').textContent=state.note||`${turnPlayer?.name||'玩家'} 的回合`;
 $('detail').textContent=state.roundPhase==='choose'&&state.die?`骰子 ${state.die} 点 · ${phases.choose}`:(phases[state.roundPhase]||'');
 $('roll').disabled=!(mine&&state.roundPhase==='roll');

 $('diceStatus').textContent=mine&&state.roundPhase==='roll'?'点击投掷骰子':turnPlayer?.kind==='ai'?'电脑操作中':`${turnPlayer?.name||'对方'} 的回合`;
 drawPieces();
}
$('roll').onclick=()=>action({type:'roll'});
function initDice(){document.querySelectorAll('.face').forEach(face=>{
 const n=Number(face.dataset.face);
 for(const idx of PIPS[n]){const pip=document.createElement('i');pip.className='pip';pip.style.left=`${[23,50,77][idx%3]}%`;pip.style.top=`${[23,50,77][Math.floor(idx/3)]}%`;face.appendChild(pip);}
});}
function placeCube(n){const [x,y]=ORIENT[n]||ORIENT[1];$('cube').style.transition='none';$('cube').style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;$('roll').setAttribute('aria-label',`骰子：${n} 点`);}
async function animateRoll(n){const own=++rollSerial;const cube=$('cube');const [x,y]=ORIENT[n];const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const recorded=playRecordedDiceShake();
 if(reduced){
  if(!recorded)playDiceTap(true);
  placeCube(n);
  if(recorded)setTimeout(()=>{if(own===rollSerial)stopDiceShake();},670);
  return;
 }
 if(recorded){
  // Use real dice-in-cup audio instead of the previous faint synthetic rattling.
  setTimeout(()=>{if(own===rollSerial)playDiceTap(true);},565);
 }else{
  playDiceTap();
  for(const ms of [90,190,310,440,570]){
   setTimeout(()=>{if(own===rollSerial)playDiceTap(ms===570);},ms);
  }
 }
 cube.style.transition='transform .64s cubic-bezier(.18,.65,.2,1)';cube.style.transform=`rotateX(${720+x}deg) rotateY(${1080+y}deg)`;
 await sleep(660);if(own!==rollSerial)return;
 if(recorded)stopDiceShake();
 cube.style.transition='none';cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;$('roll').setAttribute('aria-label',`骰子：${n} 点`);
}
async function animateMove(move){$('bubble').style.display='none';const mine=++animationSerial;animPiece={color:move.color,id:move.piece,pos:move.start};drawPieces();
 for(let k=0;k<move.path.length;k++){
  const step=move.path[k];await sleep(step.kind==='飞跃'?260:step.kind==='跳格'?230:140);
  if(mine!==animationSerial)return;
  animPiece.pos=step.pos;drawPieces();
  if(k===move.path.length-1&&step.pos===GOAL)playGoalChime();
   else playStepPop();
 }
 await sleep(100);if(mine!==animationSerial)return;animPiece=null;drawPieces();
 if(move.hit&&move.dialogue){const [x,y]=point(move.color,move.path.at(-1).pos,move.piece);const b=$('bubble');b.textContent=move.dialogue;b.style.setProperty('--bubble-color',COLOR[move.color]?.hex||'#ef7872');b.style.left=`${Math.max(35,Math.min(65,5+x/900*90))}%`;b.style.top=`${5+y/900*90}%`;b.classList.toggle('below',y<190);b.style.display='block';setTimeout(()=>{if(mine===animationSerial)b.style.display='none';},2700);}
}
function rules(){dialog('游戏说明','每方四枚棋子，掷出6可从基地进入棋盘外的起飞圈，并能再掷一次；起飞圈里的棋子下次掷骰进入棋盘时，紧邻起飞圈的斜三角格算第1格，后面的棋格依次计数。棋子到本色转弯格后进入6格终点道，最里面第6格即终点。落在本色格可向前跳4格；直接落在飞跃格时飞跃。每次掷骰最多触发一次跳格或飞跃，跳到飞机格不再连锁飞跃。走到对手占据的格子时，双方棋子数量不同时可并排共存；相等时把该对手的整组棋子撞回基地（单枚对单枚同样有效）。飞跃经过交叉处时，仍可撞回对方终点道里的单枚棋子。到终点必须刚好，超点折返。连续掷出三个6，未完成棋子回基地。\n\n真人角色可以重复，但颜色不重复。电脑角色与颜色由房主设置。');}
$('rulesHome').onclick=rules;$('gameRules').onclick=rules;
initDice();placeCube(1);
const incoming=new URLSearchParams(location.search).get('room');if(incoming){$('joinCode').value=incoming.toUpperCase();$('inviteNotice').hidden=false;$('nickname').focus();}
try{const saved=JSON.parse(sessionStorage.getItem('flight_room')||'null');if(saved?.code&&saved?.authToken&&(!incoming||incoming.toUpperCase()===saved.code)){code=saved.code;authToken=saved.authToken;connect();}}catch{}
