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
 {name:'蓝',key:'blue',hex:'#41a7f5',start:40,base:[10,678]},
 {name:'黄',key:'yellow',hex:'#f6c945',start:27,base:[690,678]},
 {name:'绿',key:'green',hex:'#58c26a',start:1,base:[10,22]},
 {name:'红',key:'red',hex:'#ef5350',start:14,base:[690,22]}
];
const ORDER=[3,1,0,2];
const TURN=48, LANE=49, GOAL=54;
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
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const ORIENT={1:[0,0],2:[90,0],3:[0,-90],4:[0,90],5:[-90,0],6:[0,180]};
let code='',authToken='',events=null,state=null,lastSequence=-1,lastRollSeq=-1,lastMoveSeq=-1;
let roleIndex=0, animPiece=null, animationSerial=0, rollSerial=0, toastTimer, busy=false;
let myRoomMode='',viewerToken=null,pendingExit=false,checkingRoom=false;
let lanAddresses=[],lanFetched=false;
const sleep=ms=>new Promise(res=>setTimeout(res,ms));
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
function resetConnection(){if(events){events.close();events=null;}animationSerial++;rollSerial++;state=null;lastSequence=-1;lastMoveSeq=-1;lastRollSeq=-1;animPiece=null;}
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
 if(pos===-1){const [x,y]=COLOR[color].base;return [x+PADS[id][0],y+PADS[id][1]];}
 if(pos===GOAL)return LANES[COLOR[color].key][GOAL-LANE];
 if(pos<LANE)return RING[(COLOR[color].start+pos)%52];
 return LANES[COLOR[color].key][pos-LANE];
}
function svg(tag,props,parent){const el=document.createElementNS(NS,tag);Object.entries(props).forEach(([k,v])=>el.setAttribute(k,String(v)));parent.appendChild(el);return el;}
function piecePosition(p,id){if(animPiece?.color===p.color&&animPiece?.id===id)return animPiece.pos;return p.pieces[id];}
function drawPieces(){
 const node=$('pieces');node.replaceChildren();if(!state)return;
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
  const dx=count===1?0:(i%colCount-(colCount-1)/2)*12;
  const dy=count===1?0:(Math.floor(i/colCount)-(Math.ceil(count/colCount)-1)/2)*12;
  const canSelect=state.viewerColor===p.color&&state.turn===p.color&&state.roundPhase==='choose'&&state.options.length>1&&state.options.includes(id)&&!animPiece;
  const group=svg('g',{transform:`translate(${x+dx} ${y+dy})`,class:canSelect?'piece available':'piece',role:canSelect?'button':'img','aria-label':`${p.role} 第${id+1}枚棋子`,tabindex:canSelect?'0':'-1'},node);
  if(canSelect){svg('circle',{r:32,fill:'none',stroke:COLOR[p.color].hex,'stroke-width':5,class:'halo'},group);
   svg('path',{d:'M-10 -52 L10 -52 L0 -38Z',fill:COLOR[p.color].hex,stroke:'white','stroke-width':2,class:'pointer'},group);}
  svg('circle',{r:24,fill:'white',stroke:COLOR[p.color].hex,'stroke-width':5},group);
  const letter=svg('text',{x:0,y:1,'text-anchor':'middle','dominant-baseline':'central','font-size':22,fill:'#272a30'},group);letter.textContent=roleMark(p.role);
  if(canSelect){group.onclick=()=>action({type:'move',piece:id});group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action({type:'move',piece:id});}};}
 }
}
function renderGame(){
 if(!state)return;
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
 if(reduced){placeCube(n);return;}
 cube.style.transition='transform .64s cubic-bezier(.18,.65,.2,1)';cube.style.transform=`rotateX(${720+x}deg) rotateY(${1080+y}deg)`;
 await sleep(660);if(own!==rollSerial)return;
 cube.style.transition='none';cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;$('roll').setAttribute('aria-label',`骰子：${n} 点`);
}
async function animateMove(move){const mine=++animationSerial;animPiece={color:move.color,id:move.piece,pos:move.start};drawPieces();
 for(const step of move.path){await sleep(step.kind==='飞跃'?260:step.kind==='跳格'?230:140);if(mine!==animationSerial)return;animPiece.pos=step.pos;drawPieces();}
 await sleep(100);if(mine!==animationSerial)return;animPiece=null;drawPieces();
 if(move.hit){const [x,y]=point(move.color,move.path.at(-1).pos,move.piece);const b=$('bubble');b.textContent=['借过一下。','这个位置归我了。','先走一步。'][move.piece%3];b.style.left=`${x/900*100}%`;b.style.top=`${y/900*100}%`;b.style.display='block';setTimeout(()=>{if(mine===animationSerial)b.style.display='none';},1650);}
}
function rules(){dialog('游戏说明','每方四枚棋子，掷出6才可起飞且可再掷一次。棋子到本色转弯格后进入6格终点道，最里面第6格即终点。落在本色格可向前跳4格；骰点直接落在飞跃格时飞跃后再跳4格，先跳到飞跃格时只飞跃，不会再次跳格。经过虚线交叉处能撞落对方终点道棋子。到终点必须刚好，超点折返。连续掷出三个6，未完成棋子回基地。\n\n真人角色可以重复，但颜色不重复。电脑角色与颜色由房主设置。');}
$('rulesHome').onclick=rules;$('gameRules').onclick=rules;
initDice();placeCube(1);
const incoming=new URLSearchParams(location.search).get('room');if(incoming){$('joinCode').value=incoming.toUpperCase();$('inviteNotice').hidden=false;$('nickname').focus();}
try{const saved=JSON.parse(sessionStorage.getItem('flight_room')||'null');if(saved?.code&&saved?.authToken&&(!incoming||incoming.toUpperCase()===saved.code)){code=saved.code;authToken=saved.authToken;connect();}}catch{}
