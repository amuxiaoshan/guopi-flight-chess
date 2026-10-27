'use strict';
// 飞行棋房间试玩版：仅使用 Node.js 内置模块，无额外依赖。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const root = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
function localAddresses(){
  const entries=[];
  for(const [name, nets] of Object.entries(os.networkInterfaces())){
    for(const n of nets||[]){
      if((n.family!=='IPv4'&&n.family!==4)||n.internal||n.address.startsWith('169.254.'))continue;
      // Only local-network IPv4 addresses should be offered as Wi-Fi invitations.
      if(!/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(n.address))continue;
      entries.push({name,address:n.address});
    }
  }
  return entries.sort((a,b)=>{
    const score=e=>/wi-?fi|wlan|wireless|ethernet|^eth|^en[0-9]/i.test(e.name)?0:/veth|docker|vmware|virtual|wsl|hyper-v/i.test(e.name)?2:1;
    return score(a)-score(b);
  });
}

const colors = ['blue','yellow','green','red'];
const roles = ['A','B','C','D','E','F','G','H'];
const roleNames = {A:'青栖禾',B:'澄',C:'勒尔斯',D:'麦冬',E:'波波亚',F:'麻特',G:'塔努利安',H:'亚洛'};
const roleName = role => roleNames[role] || role;
// Choose one authoritative line for each collision. Newlines only format long lines.
const COLLISION_LINES = {
 "A": [
  "哎哎？ Σ(⊙▽⊙",
  "真是抱歉…",
  "下次要注意路况哦。\n( ᴗˬᴗ)"
 ],
 "B": [
  "抱歉抱歉——！",
  "不好意思哦！(人˘ㅂ˘)",
  "芜湖~此处已占领！"
 ],
 "C": [
  "现在这地方归我了",
  "闪开点。",
  "下次注意些吧。"
 ],
 "D": [
  "借过！(●´∀)σ",
  "对不住咯",
  "抱歉！但我不改。"
 ],
 "E": [
  "当当——漂亮的一击！",
  "Prefect~(ˆoˆ)",
  "吃！(`▽´๑)"
 ],
 "F": [
  "注意点。",
  "下次加把劲。",
  "运气不错…"
 ],
 "G": [
  "哇我不是故意的、\n祝你加油！(;ﾟдﾟ)",
  "嗯……不错的决策。",
  "呃，下一个更好……？\n(ﾟ◇ﾟﾉ)ﾉ"
 ],
 "H": [
  "……嗯？",
  "不好意思。",
  "我下次注意。"
 ]
};
const collisionLine = role => {const lines=COLLISION_LINES[role]||[];return lines.length?lines[rand(lines.length)]:'';};
const startIndex = [40,27,1,14];
// 每方先以掷出6从基地进入棋盘外起飞点 (pos=-2)，下次掷骰才从起飞点进入棋盘格 (pos=0起)；
// pos=49..54 对应本色终点道的6个可见格子，第6格(54)即为终点；没有隐藏的第7格。
const LAUNCH=-2, TURN=48, LANE=49, GOAL=54, RING_SIZE=52;
// Four corners are exclusive. A role is cosmetic and may repeat.
const emptyColors = r => [0,1,2,3].filter(c=>!r.players.some(p=>p.kind==='human'&&p.color===c));
function arrangeBots(r){
  const free=emptyColors(r);
  r.bots=r.bots.slice(0,free.length);
  const used=new Set();
  r.bots.forEach(b=>{if(!free.includes(b.color)||used.has(b.color)){b.color=free.find(c=>!used.has(c));}used.add(b.color);});
  r.botCount=r.bots.length;
}

const ROOM_LIMIT = 100;
const rooms = new Map();
const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = n => crypto.randomInt(n);
const token = () => crypto.randomBytes(18).toString('hex');
const roomCode = () => Array.from({length:6},()=>codeChars[rand(codeChars.length)]).join('');
const cleanCode = s => String(s||'').toUpperCase().trim();
const cleanName = s => String(s||'').trim().slice(0,16).replace(/[<>]/g,'') || '玩家';
const current = (r) => r.players.find(p=>p.color===r.turn);
const available = (p,n) => p.pieces.map((pc,i)=>pc===GOAL?-1:(pc>=0||pc===LAUNCH||n===6?i:-1)).filter(i=>i>=0);
// 实际格位统一由颜色+位置决定；转弯后不可继续沿外圈绕回起点。
const keyOnBoard = (color,pos) => pos>=0&&pos<LANE ? `ring:${(startIndex[color]+pos)%RING_SIZE}`
  :pos>=LANE&&pos<GOAL ? `lane:${color}:${pos}` : null;
function projection(pos,roll){
  if(pos===GOAL || !Number.isInteger(roll) || roll<1 || roll>6 || pos<LAUNCH || pos>GOAL) return null;
  if(pos===-1) return roll===6?{path:[{pos:LAUNCH,kind:'起飞'}],to:LAUNCH,flags:['进入起飞点']}:null;
  let cur=pos===LAUNCH?-1:pos,dir=1;
  const route=[],flags=pos===LAUNCH?['从起飞点进入棋盘']:[];
  for(let i=0;i<roll;i++){
    if(cur===GOAL)dir=-1;
    cur+=dir;
    route.push({pos:cur,kind:'骰点'});
  }
  if(cur===GOAL) return {path:route,to:cur,flags:['到达终点']};
  // 同色跳4格；到自己转弯格(48)为止，不把跳格延伸到终点道。
  if(cur>=4&&cur<TURN&&cur%4===0){
    if(cur===16){
      // 骰点直接落在飞跃格：飞跃，再跳4格。
      cur=28;route.push({pos:cur,kind:'飞跃'});flags.push('飞跃');
      cur=32;route.push({pos:cur,kind:'跳格'});flags.push('跳格');
    }else{
      // 从同色格跳到飞跃格：只飞跃，不再补一次4格跳。
      cur+=4;route.push({pos:cur,kind:'跳格'});flags.push('跳格');
      if(cur===16){cur=28;route.push({pos:cur,kind:'飞跃'});flags.push('飞跃');}
    }
  }
  return {path:route,to:cur,flags};
}
// 特殊移动的停留格都应判撞；飞跃途中经过对方的终点道也应撞机。
const crossedLane = [3,2,1,0]; // 蓝飞越红、黄飞越绿、绿飞越黄、红飞越蓝
function captureAlong(room,actor,plan){
  let hits=0;
  const diceEnd=plan.path.findLastIndex(step=>step.kind==='骰点');
  for(let k=0;k<plan.path.length;k++){
    const step=plan.path[k];
    if(step.kind==='骰点'&&k!==diceEnd)continue;
    const square=keyOnBoard(actor.color,step.pos);
    for(const enemy of room.players){
      if(enemy.color===actor.color)continue;
      for(let i=0;i<4;i++){
        const ep=enemy.pieces[i];
        const landing=square!==null&&keyOnBoard(enemy.color,ep)===square;
        const crossing=step.kind==='飞跃'&&enemy.color===crossedLane[actor.color]&&ep===LANE+2;
        if(landing||crossing){enemy.pieces[i]=-1;hits++;}
      }
    }
  }
  return hits;
}
function legalMove(r,p,pieceId){
  return Number.isInteger(pieceId)&&pieceId>=0&&pieceId<4&&available(p,r.die).includes(pieceId);
}
function publicState(room,viewer){
  const me=room.players.find(p=>p.token===viewer);
  return {code:room.code,phase:room.phase,roundPhase:room.roundPhase,host:room.host===viewer,
    hostColor:room.players.find(p=>p.token===room.host)?.color??null,closeReason:room.closeReason||null,
    viewerColor:me?me.color:null,viewerName:me?me.name:null,turn:room.turn,die:room.die,options:room.options,botCount:room.botCount,bots:room.phase==='lobby'?room.bots:[],mode:room.mode,
    players:room.players.map(p=>({color:p.color,role:p.role,name:p.name,kind:p.kind,pieces:p.pieces,finished:p.finished,connected:p.kind==='ai'||p.connections>0})),
    finishOrder:room.finishOrder,seq:room.seq,lastMove:room.lastMove,lastRoll:room.lastRoll,
    note:room.note,canStart:room.phase==='lobby'&&room.players.length+room.bots.length>=2};
}
function sendOne(room,conn){
  try{conn.res.write(`data: ${JSON.stringify(publicState(room,conn.token))}\n\n`);}catch{room.clients.delete(conn);}
}
function publish(room){room.seq++;room.lastActivity=Date.now();for(const conn of room.clients)sendOne(room,conn);}
// Deliver a final SSE state before removing the room, so all open pages return home.
function closeRoom(room,reason){
  if(room.phase==='closed')return;
  room.phase='closed';room.roundPhase='closed';room.closeReason=reason;room.note=reason;
  publish(room);
  rooms.delete(room.code);
  for(const conn of room.clients){try{conn.res.end();}catch{}}
  room.clients.clear();
}
function fail(message, status=400){ const e=new Error(message);e.status=status;throw e; }
function findRoom(code){const r=rooms.get(cleanCode(code));if(!r)fail('房间不存在或已经过期',404);return r;}
function auth(room,userToken){const p=room.players.find(x=>x.kind==='human'&&x.token===userToken);if(!p)fail('没有加入该房间，请重新通过邀请码进入',403);return p;}
function reply(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'same-origin'});res.end(JSON.stringify(obj));}
function advance(room){
  if(room.phase!=='playing')return;
  if(room.finishOrder.length>=room.players.length-1){
    for(const p of room.players)if(!room.finishOrder.includes(p.color))room.finishOrder.push(p.color);
    room.phase='over';room.roundPhase='over';room.note='本局结束';publish(room);return;
  }
  let next=room.turn;
  for(let i=0;i<4;i++){next=(next+1)%4;const candidate=room.players.find(p=>p.color===next);if(candidate&&!candidate.finished)break;}
  room.turn=next;room.roundPhase='roll';room.die=null;room.options=[];room.sixStreak=0;
  room.note=`轮到 ${current(room).name} 掷骰`;publish(room);runAI(room);
}
function performMove(room,p,id){
  if(room.phase!=='playing'||room.roundPhase!=='choose'||p.color!==room.turn||!legalMove(room,p,id))fail('现在不能移动这枚棋子');
  const plan=projection(p.pieces[id],room.die);if(!plan)fail('无效移动');
  const start=p.pieces[id];p.pieces[id]=plan.to;
  const hit=captureAlong(room,p,plan);
  room.lastMove={seq:room.seq+1,color:p.color,piece:id,start,path:plan.path,flags:plan.flags,hit,die:room.die,dialogue:hit?collisionLine(p.role):''};
  room.roundPhase='moving';room.options=[];
  room.note=hit?`${roleName(p.role)} 撞回 ${hit} 枚棋子`:plan.to===GOAL?`${roleName(p.role)} 到达终点`:plan.flags.join('、')||`${roleName(p.role)} 前进 ${room.die} 格`;
  if(p.pieces.every(v=>v===GOAL)&&!p.finished){p.finished=true;room.finishOrder.push(p.color);}
  publish(room);
  const duration = Math.max(450,plan.path.length*150+220);
  setTimeout(()=>{
    if(room.phase!=='playing'||room.roundPhase!=='moving')return;
    if(room.finishOrder.length>=room.players.length-1){advance(room);return;}
    if(room.die===6&&!p.finished){room.roundPhase='roll';room.options=[];room.note=`${p.name} 可以再掷一次`;publish(room);runAI(room);}
    else advance(room);
  },duration);
}
function roll(room,p){
  if(room.phase!=='playing'||room.roundPhase!=='roll'||room.turn!==p.color)fail('还没有轮到你掷骰');
  const n=1+rand(6);room.die=n;room.lastRoll={seq:room.seq+1,color:p.color,value:n};
  room.sixStreak=n===6?room.sixStreak+1:0;
  const overSix=room.sixStreak>=3;
  if(overSix){p.pieces=p.pieces.map(v=>v===GOAL?GOAL:-1);room.roundPhase='rolling';room.note=`${p.name} 连续三次掷出 6，未完成棋子回基地`;}
  else {
    room.options=available(p,n);room.roundPhase=room.options.length?'choose':'rolling';
    room.note=room.options.length?`${p.name} 掷出了 ${n} 点`:`${p.name} 掷出 ${n} 点，没有可移动的棋子`;
  }
  publish(room);
  if(room.roundPhase==='rolling')setTimeout(()=>{
    if(room.phase!=='playing'||room.roundPhase!=='rolling')return;
    if(n===6&&!overSix){room.roundPhase='roll';publish(room);runAI(room);}
    else advance(room);
  },1000);
  else if(p.kind==='ai')setTimeout(()=>{
    if(room.phase==='playing'&&room.roundPhase==='choose'&&room.turn===p.color){
      const options=room.options.map(id=>{
        const pl=projection(p.pieces[id],room.die);let score=(pl.to===GOAL?300:pl.to*1.2)+(p.pieces[id]<0?30:0);
        const at=keyOnBoard(p.color,pl.to);if(at!=null)for(const other of room.players)if(other.color!==p.color&&other.pieces.some(v=>keyOnBoard(other.color,v)===at))score+=230;
        score+=rand(20);return {id,score};
      }).sort((a,b)=>b.score-a.score);
      performMove(room,p,options[0].id);
    }
  },700);
  else if(room.options.length===1){setTimeout(()=>{
    if(room.phase==='playing'&&room.roundPhase==='choose'&&room.turn===p.color&&room.options.length===1)performMove(room,p,room.options[0]);
  },550);}
}
function runAI(room){
  if(room.phase!=='playing'||room.roundPhase!=='roll')return;
  const p=current(room);if(p&&p.kind==='ai')setTimeout(()=>{
    if(room.phase==='playing'&&room.roundPhase==='roll'&&room.turn===p.color)roll(room,p);
  },850);
}
function createRoom(name,mode='online'){
  if(rooms.size>=ROOM_LIMIT)fail('试玩服务器的房间数量已满');
  let code;do{code=roomCode();}while(rooms.has(code));
  const t=token(); const host={token:t,name:cleanName(name||'房主'),color:3,role:'?',kind:'human',pieces:Array(4).fill(-1),finished:false,connections:0};
  const r={code,host:t,mode:mode==='solo'?'solo':'online',bots:[{color:0,role:'?'}],botCount:1,players:[host],phase:'lobby',roundPhase:'lobby',turn:0,die:null,options:[],finishOrder:[],sixStreak:0,seq:0,lastRoll:null,lastMove:null,note:'等待其他玩家加入',clients:new Set(),lastActivity:Date.now()};rooms.set(code,r);
  return {code,token:t};
}
function handleAction(data){
  const type=data.type;
  if(type==='create')return createRoom(data.name,data.mode);
  if(type==='join'){
    const r=findRoom(data.code);if(r.phase!=='lobby')fail('游戏已经开始，暂不支持中途加入');
    if(r.mode==='solo')fail('单人对局不支持加入');
    if(r.players.filter(p=>p.kind==='human').length>=4)fail('房间已满');
    const assigned=colors.map((_,i)=>i).find(c=>!r.players.some(p=>p.color===c&&p.kind==='human'));
    const t=token();r.players.push({token:t,name:cleanName(data.name||`玩家${r.players.length+1}`),color:assigned,role:'?',kind:'human',pieces:Array(4).fill(-1),finished:false,connections:0});
    arrangeBots(r);publish(r);
    return {code:r.code,token:t};
  }
  const r=findRoom(data.code), p=auth(r,data.token);
  if(type==='state')return {state:publicState(r,data.token)};
  if(type==='select'){
    if(r.phase!=='lobby')fail('开局后不能切换角色或颜色');
    if(typeof data.role==='string'&& (data.role==='?'||roles.includes(data.role)))p.role=data.role;
    if(data.color!==undefined){const c=Number(data.color);if(!Number.isInteger(c)||c<0||c>3)fail('无效颜色');if(r.players.some(x=>x!==p&&x.color===c))fail('该颜色已被其他真人玩家选择');p.color=c;arrangeBots(r);}
    publish(r);return {ok:true};
  }
  if(type==='bots'){
    if(data.token!==r.host)fail('只有房主能设置电脑人数');
    if(r.phase!=='lobby')fail('开局后无法修改');
    const count=Number(data.count);if(!Number.isInteger(count)||count<(r.mode==='solo'?1:0)||count>4-r.players.length)fail('电脑人数超出可用位置');
    const free=emptyColors(r);r.bots=r.bots.slice(0,count);while(r.bots.length<count){const taken=r.bots.map(b=>b.color);r.bots.push({color:free.find(c=>!taken.includes(c)),role:'?'});}
    arrangeBots(r);publish(r);return {ok:true};
  }
  if(type==='bot-config'){
    if(data.token!==r.host)fail('只有房主能设置电脑角色和颜色');
    if(r.phase!=='lobby')fail('开局后不能调整');
    const index=Number(data.index),c=Number(data.color);
    if(!Number.isInteger(index)||index<0||index>=r.bots.length)fail('电脑座位无效');
    if(typeof data.role==='string'&&(data.role==='?'||roles.includes(data.role)))r.bots[index].role=data.role;
    if(data.color!==undefined){
      if(!Number.isInteger(c)||c<0||c>3)fail('颜色不正确');
      if(r.players.some(p=>p.color===c)||r.bots.some((b,i)=>i!==index&&b.color===c))fail('这个颜色已被占用');
      r.bots[index].color=c;
    }
    arrangeBots(r);publish(r);return {ok:true};
  }
  if(type==='transfer-host'){
    if(r.mode!=='online'||r.phase!=='playing')fail('只能在多人对局中移交房主');
    if(r.host!==p.token)fail('只有房主可以移交房主身份');
    const targetColor=Number(data.targetColor);
    if(!Number.isInteger(targetColor))fail('无效的玩家座位');
    const target=r.players.find(x=>x.kind==='human'&&x.color===targetColor&&x.token!==p.token);
    if(!target)fail('请选择其他真人玩家，不能将房主交给电脑');
    r.host=target.token;
    r.note=`${p.name} 已将房主移交给 ${target.name}`;
    publish(r);
    return {ok:true};
  }
  if(type==='leave'){
    const wasHost=r.host===p.token;
    r.players=r.players.filter(x=>x!==p);
    r.finishOrder=r.finishOrder.filter(c=>c!==p.color);
    if(wasHost){
      closeRoom(r,'房主已退出，房间已解散。');
      return {ok:true,closed:true};
    }
    if(r.players.filter(x=>x.kind==='human').length<=1){
      closeRoom(r,'房间只剩一位真人玩家，已自动结束。');
      return {ok:true,closed:true};
    }
    for(const conn of [...r.clients].filter(c=>c.token===p.token)){
      r.clients.delete(conn);
      try{conn.res.end();}catch{}
    }
    if(r.phase==='lobby'){
      arrangeBots(r);
      r.note=`${p.name} 已退出房间`;
      publish(r);
    }else if(r.phase==='playing'&&r.turn===p.color){
      r.note=`${p.name} 已退出，轮到下一位`;
      advance(r);
    }else{
      r.note=`${p.name} 已退出游戏`;
      publish(r);
    }
    return {ok:true};
  }
  if(type==='reset'){
    if(data.token!==r.host)fail('只有房主能重新开局');
    if(r.phase!=='over')fail('本局尚未结束');
    r.players=r.players.filter(pl=>pl.kind==='human').map(pl=>({...pl,pieces:Array(4).fill(-1),finished:false}));
    arrangeBots(r);
    r.phase='lobby';r.roundPhase='lobby';r.turn=0;r.die=null;r.options=[];
    r.finishOrder=[];r.sixStreak=0;r.lastRoll=null;r.lastMove=null;r.note='返回准备界面';
    publish(r);return {ok:true};
  }
  if(type==='start'||type==='replay'){
    if(data.token!==r.host)fail('只有房主能开始游戏');
    if(type==='start'&&r.phase!=='lobby')fail('本局已经开始');
    if(type==='replay'&&r.phase!=='over')fail('本局尚未结束');
    // A replay keeps the same room, roles and color seats, and resets the board.
    const humans=r.players.filter(pl=>pl.kind==='human');
    if(humans.length+r.bots.length<2)fail('至少需要两方玩家或电脑');
    r.players=humans;
    for(const pl of humans){pl.pieces=Array(4).fill(-1);pl.finished=false;if(pl.role==='?')pl.role=roles[rand(roles.length)];}
    for(const spec of r.bots)r.players.push({token:null,name:`电脑 ${colors[spec.color]}`,color:spec.color,role:spec.role==='?'?roles[rand(roles.length)]:spec.role,kind:'ai',pieces:Array(4).fill(-1),finished:false,connections:1});
    r.players.sort((a,b)=>a.color-b.color);r.phase='playing';r.roundPhase='roll';r.turn=r.players[0].color;r.die=null;r.sixStreak=0;r.options=[];r.finishOrder=[];r.lastRoll=null;r.lastMove=null;r.note='游戏开始';publish(r);runAI(r);return {ok:true};
  }
  if(type==='roll'){if(p.color!==r.turn)fail('不是你的回合');roll(r,p);return {ok:true};}
  if(type==='move'){if(p.color!==r.turn)fail('不是你的回合');performMove(r,p,Number(data.piece));return {ok:true};}
  fail('未知操作');
}
function readJSON(req){return new Promise((resolve,reject)=>{
 let body='',large=false;
 req.on('data',b=>{body+=b;if(body.length>8192){large=true;req.destroy();}});
 req.on('end',()=>{try{if(large)fail('请求过大');resolve(JSON.parse(body||'{}'));}catch(e){reject(e);}});
 req.on('error',reject);
 });}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(req.method==='POST'&&url.pathname==='/api/action'){
    const payload=await readJSON(req);
    const result=handleAction(payload);
    // Always return the authoritative new state with successful actions.
    // This prevents a missed/delayed SSE event from trapping a client in the lobby.
    const session=(result&&result.code&&result.token)?result:payload;
    const room=rooms.get(cleanCode(session.code));
    if(room&&room.players.some(p=>p.kind==='human'&&p.token===session.token))result.state=publicState(room,session.token);
    return reply(res,200,result);
  }
  if(req.method==='GET'&&url.pathname==='/api/network'){
    // LAN IPs are shown only to the computer running the game server.
    const remote=req.socket.remoteAddress||'';
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote))return reply(res,200,{addresses:[]});
    return reply(res,200,{addresses:localAddresses()});
  }
  if(req.method==='GET'&&url.pathname==='/api/state'){
    const r=findRoom(url.searchParams.get('code')); auth(r,url.searchParams.get('token'));return reply(res,200,publicState(r,url.searchParams.get('token')));
  }
  if(req.method==='GET'&&url.pathname==='/api/events'){
    const r=findRoom(url.searchParams.get('code')),token=url.searchParams.get('token'),player=auth(r,token);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache,no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const c={res,token};r.clients.add(c);player.connections++;sendOne(r,c);publish(r);
    const heartbeat=setInterval(()=>{try{res.write(': ping\n\n');}catch{}},20000);
    res.on('close',()=>{clearInterval(heartbeat);r.clients.delete(c);player.connections=Math.max(0,player.connections-1);if(rooms.get(r.code)===r&&r.phase!=='closed')publish(r);});
    return;
  }
  if(req.method==='GET'){
    const known={'/':'index.html','/index.html':'index.html','/board.svg':'board.svg','/board-lineart.svg':'board-lineart.svg','/single.html':'single.html','/collision-test.html':'collision-test.html','/app.js':'app.js','/style.css':'style.css'};
    const name=known[url.pathname];if(!name)fail('页面不存在',404);
    const type=name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'image/svg+xml';
    const data=fs.readFileSync(path.join(root,name));res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);return;
  }
  fail('不支持的请求',405);
 }catch(e){if(!res.headersSent)reply(res,e.status||400,{error:e.message||'请求失败'});else res.end();}
});
setInterval(()=>{const now=Date.now();for(const [code,r] of rooms){if(now-r.lastActivity>6*3600*1000&&r.clients.size===0)rooms.delete(code);}},15*60*1000).unref();
if(require.main===module){
  server.on('error', err=>{
    if(err.code==='EADDRINUSE')console.error(`端口 ${PORT} 已被占用。可能之前的游戏服务器还开着，请关闭旧窗口后重试。`);
    else console.error('服务器启动失败：',err.message);
    process.exitCode=1;
  });
  server.listen(PORT,'0.0.0.0',()=>{
    const address=`http://127.0.0.1:${PORT}/`;
    console.log(`飞行棋已启动：${address}`);
    const ipList=localAddresses();
    if(ipList.length){
      console.log('手机和电脑连接同一 Wi-Fi 时，在手机浏览器打开：');
      for(const item of ipList)console.log(`  http://${item.address}:${PORT}/   (${item.name})`);
    }else console.log('未发现常见的局域网 IPv4，请在 Windows 的 ipconfig 中查询 IPv4 地址。');
    console.log('保持此终端窗口开启，关闭它会停止多人房间。');
    // On Windows, open the browser only after listening has succeeded.
    if(process.platform==='win32' && process.env.NO_BROWSER!=='1'){
      require('node:child_process').exec(`start "" "${address}"`,{windowsHide:true},(err)=>{
        if(err)console.log('如果浏览器没有自动打开，请复制上面的地址到浏览器。');
      });
    }
  });
}
module.exports={server,projection,createRoom,handleAction,rooms};
