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
const GAME_SFX={"toggle":"data:audio/mpeg;base64,//swxAAABqUA0jQRABkgpeaDEHABCD5jZDG5A9CVDgYtAMDdCEacjdCMoAIZTnfO+QhGkJnfnf//39TuhzvIQlSE1/0IQigAhkf6UJAr7mGBT3PGimJZ4+JfOJnjiiD6GuUUHH56WcTGg9IC/8wcMVXEUmaVIl/9zGnuouIjhcHpP/l190ZyS8cj//7TDG+x41pVH4G/3y/n0+fr//syxASACHyVi7jVABEKluzDIUAA4YDAYA6kQqfjBgj96AS4cxrQGwv2c2ihThdjtNz8eDceEmq6dGqP3T7eTqfC16/DJwaf/0H2mSH/6Cdfl0xryAhfUwAqHQKoGLKCjAMRSWAGVkSHJWXX2y6Ympl/1JEqO7j+W+P59almK0f/1LpUX+WOHCJ0NEj3/KJbz/lFAF0QCI4GDYH////7MsQFAAjdFVm8+gAQ/w6uNPwWgttxU7Ifz6GT0vpKR8AQdgd0EDYokiuOaasl/66G1D9lssuh+Isg//9P///6AxEbf////XUkIyDZSCl4tmzu/5AD7ABAAplXs74vgGQdBPwBIAYHjm9/qYe5TS3v6QEaCkLQg6PY8BEGghbx6S2AoynO6E/+oZ/+p3iH//9Kd//QA3gAIAG8b0r/+zLEBYIH2Kt3rgBYkR6jqKgOTWKTGYNBqXqKrrKqlncfyy/H6Wz+WXfMIDky6jAkEuAAQIYVBgOBTcy4JaVg26Wl5lTWu4Yb8A6wAAP3jz+Y1soa3cmSEMKoGHTmByKvaKl41SbSqSetZMl5NFkWMi8y6T9brWl/6kEUkiGgE9BRpsi//9v/////qMQQjKr1AADARkAADG1OyLlq//swxAYCSJEfO0ByjpDxI6d0Dk3QHQqKjDQKMU9E9wJUATXSLF1JHJ41f0Str//+3/pl00c4LWBiMIDAMiiaC//qf/////7GwBwwVZ5wIAOqOZ2JfhbigNAhioBEP/N9CFeURJoxSXn2+pv+v/0//WWUkS6OcBsgC+iRNmf/9///9v/9ZgBhEOxNAACAREAAD86SNxhy0vDAsATH//syxAkDST0fL0B2rsD4o+XIDtHQoBjFT0zIYRy2jW5RXqZ4cTb60///9L/2J4tmpDQyQDBawBsMPs4tS//Wh///t//WcG6AQOxmTJZSazqSuUPuqoDQnDi1MeJ5MyQNIgUauSxbPOhX/V///t/5whx1I2HCANCBawQp52//Nf/////dEmgCCwmR52//+ZRgXHmwkIACxdNFD839///7MsQJA0j1HSIC8rCI+qOkRB3CED/I2MYAMMBSlrjQ7Pc0j/R/////pF0ql4hwZ6BhRVgDI0gRikv/6k///9//6CZFAGB0HGG4GgP//TGAZajq8gATmSC5mL0cOgAgJR6Ya70Vo7GkUmdS//////WXVMaDlgAYYJPOzt/6n/////9Zwa4Nqh9UlRGmi8yMD5aq15ZI3ybZXJd4KHH/+zLECYMHPKkCAOBNALwjGQgQCsFVEKC86Qix2WOO6kLllQ7IdnKiOz////92MFDAg6CwsLCN3///1CwC1BEL5/iYYeI51FRC0/+UpSzF/Q3dStNhhSlZHMZWMb1b2o+tW8qf3zOuYMKxFExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq","coin1":"data:audio/mpeg;base64,//NAxAARkXbEHUE4AlEJEAxjGMYxsAAAAAAEMYxjHAA8bg/B+A8H4ljc8wwwwz+ee/8z///s/54+NBoNAQ0FwfP/f/h+s/ggCAY///4Pn/B8HwfVHht4Ph3wegt8mhlg+L1QaNEYC5j/80LEFBj72sQBh5gAGgwUww5IVgeJkul1X+l//1oqSMjH//JkXYp5dLqkkqyAhxz/UNQPcNf/0loopF7////EJy4kl/+K0L//+LnLn//SSWOQbf//yBGn//6xnzxgKSAOBkf//sjL6pf/80DEDBbzGux/wWgCh2nlmRqUy+SAugr4O4Xh5kgdMTY8mgtJnTUuzstVnrV///rdH/dlq2daluyZgdKY4y0lDM4i7JrUt2TUu9NS7f62f//////WpEvnDRP8qGaABbYCgUf//rU7f//zQsQLFgNmzH6Jmy76lrQNgqh+bn/6akiJxpaC5QvKl2eNypOa8qW2aOLM/////zEV3G0pF0yRUtbJLU7Ois0dnZX////////sLzUzhxaDopGJ1BNB2STNEBABQGF2//I0cBfQMxWgGP/zQMQPFzNqeB4IKhAtDgfDBQdORA3QTT//IM3/////8mv/6aBfIoI7AwIQANKhogY+iZMkUv+qoOKNP/////1DWV/+tSzg3QkKAKisfjMnyEEyJdv/WKyikW4QAQhhd//yNEkNzxZE//NCxA0XU2p0HggqECADAcJA86GBBMihfQTT//HJ//////yV//2TMB1ggQAGKhEGqQuCFkkGJ0vI/6qIm81///b//8ny1//dj5IBzgGI0HbIgQAZ8hpxf/yAkmdNqoDFAGAYb//9v/wr//NAxAsWE2qAXhbpBJl/Gq2AVzztQhVeAJupnnz//I7//////MP/9aBmTAC6gCeQT6F9hcJBidNkX/ruMiW//////5Gv//Wo6SgRIgOIFFA0LY3i0//x8H1nqgkBQCF0v/yiFxSsTo7/80LEDRabamw2CCoQSG6BLagavEwdCOoonE3b/5T//////y23/1oJlwgYegBgsRgbODIsA4zRP/9zgYOV/////+ogBb//s54kw4EAKYhvBEybIwvL//IcaKPVMCgIL//8P/4UoZdLYZX/80DEDhdLamwWDykAggJlzEgaD5SLF1L//Jh//////5M//6aBfGMAX6gYBGJSBu0SkMyRYupN+pVER2VX//+///1DqQ//WpZwboTVAYdWOozNyRGEW2/+Q8tHD6opgYBBf2FFLxdJkf/zQsQLFBNqdDYIKhhnACQEDRQADpSJGqX/+b//////5z//rQL4Dh6AczxPwWKidhwk8XUm/rxQJX//////lNv/9nNBigHKIW80LhTLqv/yNefqICAEL//8//yZrWqy13jA0BDvgIaSR//zQMQWE7tibBYPKwGdv/5r//////mbf/rQTJgWeFmQNGgIbZLH2f/9Qvkv/////5Mv//Wo6SgSDIGBAsQFTGxInv/0D82gEL+cGROImo9gYIXoCo9EMJM0TQ//pf/////57//QTLg5//NCxCITg2JoBggqGGAsOgMShAc0QWHNIsXUkf9VEc8tf/////yMf//djcWEAJQi2G5mYF5f/5SoRgDf//r/+Gh2kzqMrMFJc7AGQxgQcuG6CH/5j//////l7//qTNAH2gC3Ae6I+IKT//NAxDATcyZcDBcpAMapN/8gL//////y8e//qWcJUJmgMaVHOW5qVn/SMfQKSI7C2PgCoLCAzgc6HYGAAMNkgBNqZ2/9X/////+Yt//TMC+ISAAjQDPgZFkFw0//5k//////6yNPf/7/80LEPRObYlABQKgBxfMQsSAyeFhpmiBmVVf/mLSqVff7+y09FgagEDgkRzgLATUZhjUBQHwGiAMoWqgGhHAxKBRCyoviAovBl/Oy/Td1o/+vXr/6pMJ6fregb/6yCAYCQiAYugPhfYn/80DESiJbiigBgbAAFrl/zAEABAAgCiCRLPZHzw5RNGZ7/o6uOw/xjgHBpAFAF9qi9sodQAAIQAga//pGSbDrGzWsqf/8XKe1F7/DtWCTT///xOEMpW5SjQFArCQBB5xExjGNUpalof/zQsQbECsFmBXBKAGdS1L///////1LQSFkDws6lK2pf///////6GmNUtDTB4zYKaCu2kxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==","coin2":"data:audio/mpeg;base64,//NAxAASwyLEH0E4ARPQOABjGMYxugAAAAFjGMYxvMMMMM8cEQBgAABADAeEHqeef/MMb/v////5//+hhg3G43G43Pf///5hhn/zzDDDDDP////PPGg0AIIEICgJIQATJCEGAvAgvlD/80LEEBiDyul/gmgCvpJF79aJd/HcBQy6o6IMnMADFNJeLyKKP/pJJal7fv/60Vf//qSH0eSX/jSbf/Gc0/57WpJJaKKReLxiPUQVvr1espN//WgOMo///yb///koR3cUQH3Mi8bFITf/80DEChVjMpwdwKACBYUALyA1ZMVA2Lzraq/+dJJ/rLoaiGXiJF01NUdEokQ/5//v/r6JFSAkRFIhZ0LJQBrhdRNf///1FIg7f7/9L///9SDmRFwUZFYydRd//4BPxBQR/+0R3IEIcv/zQsQPFPne+l4wBaJk06MJk9MBAAgWA4zvd///gQ/9ou9J1ER2iOeAwGmxMBk9MIIIOQIIOeTJ7BMnf+3Od0ILAyv+TpEYPlAhBCJ3l93//EgXf/9gqShBwf+tfCfPosJPKJmlTqGobP/zQMQXGFsu4l541U/sJyoaytxzE6Or4tb5//zqFGexaQA+TqnVV43+x1VPVV9m+Mfqv1V2ZiBMzaqv///Yic1v/NwxAaJn///////m//NNPC5GgiibEVUM+7OalYcIYmAwNAiAxpAr//NCxBAWau5YACgsHAMLEOQNQAtgMEAFQbZBq0XMRUvI2/////3rGsIe//////6iGiURZwrUNWgAgCAwaCxA0lCAACDKFmhYSSNFIq/////+xuCgHi2yJb/////6SJkYkcK6CEAAGAYL//NAxBIXgu5UALArZMBiwBWBiIcSBzcD4Bg+AWAcA4NtFLEFKzKR/5NhpT//////oEXDpxkCXF0A8GgYifAHvnyBhwHBcOKAHPIoXDdv/////WkLSAcBDVIO+pZwpjoEjBIBQDxBAYX/80LEDxeC7lAAOCwcIDIGJo5YE5CANCZAsBYONFiHktmiC/////9qhWRml//////ojlBqoVqKCDAQGAABYGDkdgGm0WIGDkAwWKiliIn1pI//////TFoAGACXExv/////1IHlD7p6AEP/80DEDRMi7mAAF2sgoeCMw4MY9QDkSCgRuPBXNE0Ff////9sjRoN/////+suDgJ88R4bIBg06gcbPgBQTE6EHLhfTQ//////mwXmfahv/////zkA6R/1hDA0LAUVRgo/x1cNoCAAVuf/zQsQbE1rqXAAXayAMMzBNBv/////0BUW//////UXRkSLDmitQsmAwciwOcGYA4QiPiCmzKR//////UP4gIjUQ3/////7sexF20MCwGMawIBsuGiQ3ioACukOJkyWr/////3rF4LhV///zQMQpEzrqXAgXayL////qL5ByYNyYD0wMGFgDkRrAUCgncghfLiCf/////8oByqAQ3/////9nsy5roQBZjmBxhTQBomMJgWAAfKLmIqXkf/////vj6Gm//////6y8MkRUgwrYL4gY//NCxDcTGupYCBdrIB0QBvsygHBIWSRYuvf/////+Ug0s/Ub/////9FBVYKWSFwhMbwQMTZsOvw3BQhBgkUsQUnjV//////6QqT//////rLg5hNmBPhkQDC5PA7WdgDhOI8HGThfTQ////NAxEYTSupQABdrIP///1D+KEWqEN/////+ihJuAE3wsGoCGoxLXQ9hBAoEIOyNokS2eTWr/////bH2Ml//////l0WEgxBRWoN0gMBKMDdByAGCIoIipeXb/////+XAt5PVG///////80LEUxNa6kwIF2sg0OASt2EqzAwP0+TDUAD4UdAMFYggQcnDdBNP/////tj5HY3/////6i+Q8mDMqB84GGg4B3g7gMCgQeOAny4gn/////+sjg2M2Rv/////2FiJe/Cl5hAI5igCpUX/80DEYRNy6kQAF2sgvO7zKGATDihXSHFE4m7f/////KIkrf/////yaFGIKQYQmAoAwCWMBs89gBBoUCQIxUzt/////9RHh+yaX/////3ZI1J4goXyAwsQQM5B8DK25A1OxADlCA8ABv/zQsRuE6rqOAAXayDaLiICTzKRf/////zhBf/////60CBFMoEmLABhUuAdBVgKAsOkImThfTQ//////kNC+qsJALePXuilzMwKi2MuUC6RdReXw8AGEwWBjBHAbuipPCUQCQkAKDPAzP/zQMR7FHrmLAFBqAFBML9C3DMMFpYjUxYvfJgxL9zJNSS9f+qOUkmpf///om5cKwuUGxAGOjiBY4htpCE/11mgs5yKj6Sf/+pNqSKKVZSGadloI/////3NUWMVKkxBTUUzLjEwMKqq//NCxIQeCzIIoYKoAKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NAxGcAAANIAcAAAKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=","coin3":"data:audio/mpeg;base64,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","coin4":"data:audio/mpeg;base64,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"};
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
function playSelectedSfx(src,volume=0.85,fallback=null){
 if(!goalSoundEnabled||!src||typeof Audio!=='function'){if(fallback)fallback();return;}
 try{
  const sound=new Audio(src);
  sound.volume=volume;
  const playing=sound.play();
  if(playing&&typeof playing.catch==='function')playing.catch(()=>{if(fallback)fallback();});
 }catch{if(fallback)fallback();}
}
function playGoalPieceSound(ordinal){
 const filename=GAME_SFX['coin'+ordinal];
 if(filename)playSelectedSfx(filename,0.90,playGoalChime);
 else playGoalChime(); // Backward-compatible server events.
}
// Keep the selected 8-bit button sound alive between clicks. Some mobile browsers
// drop tiny, short-lived Audio players before they start making sound.
const toggleSoundPlayer=typeof Audio==='function'?new Audio(GAME_SFX.toggle):null;
if(toggleSoundPlayer){toggleSoundPlayer.preload='auto';toggleSoundPlayer.volume=0.85;}
let toggleAudioContext=null,toggleAudioBuffer=null;
async function playToggleViaWebAudio(){
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw new Error('AudioContext unavailable');
  if(!toggleAudioContext||toggleAudioContext.state==='closed')toggleAudioContext=new Context();
  const ctx=toggleAudioContext;
  if(ctx.state==='suspended')await ctx.resume();
  if(!toggleAudioBuffer){
   const encoded=GAME_SFX.toggle.split(',')[1],raw=atob(encoded);
   const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
   toggleAudioBuffer=await ctx.decodeAudioData(bytes.buffer);
  }
  const sound=ctx.createBufferSource(),gain=ctx.createGain();
  sound.buffer=toggleAudioBuffer;gain.gain.value=0.85;
  sound.connect(gain);gain.connect(ctx.destination);sound.start(0);
 }catch(e){
  console.warn('音效开关提示音无法播放',e);
  if(typeof toast==='function')toast('开关音效播放失败，请检查浏览器声音权限');
 }
}
function playToggleClick(){
 // Confirmation deliberately bypasses goalSoundEnabled: turning sound OFF
 // must make the same short click as turning it ON.
 if(!toggleSoundPlayer){void playToggleViaWebAudio();return;}
 try{
  toggleSoundPlayer.pause();
  toggleSoundPlayer.currentTime=0;
  const played=toggleSoundPlayer.play();
  if(played&&typeof played.catch==='function')played.catch(()=>playToggleViaWebAudio());
 }catch{void playToggleViaWebAudio();}
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
  envelope.gain.exponentialRampToValueAtTime(0.75,t+0.003);
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

// User-selected real dice recording: 10.60–13.12 s of original MP3 (trimmed from 10–14 s).
// Source: Shake And Roll Dice by Mike Koenig, SoundBible, CC BY 3.0.
// https://soundbible.com/182-Shake-And-Roll-Dice.html
// Embedded for reliable immediate playback with no remote request or leading silence.
const DICE_SHAKE_DATA='data:audio/mpeg;base64,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LOK0XVKWkJ5uUaGJApGpLR4SRJEwAGJRcOzfNqWXlPbTNRboWRIzhW1TSRQDQqWBlJ0TlTq3EgkRBp4sIgavxKxyix4SxE8WJUZ3CT4Z2v/7WMTWAA1NS1nnmGtqCjCqfYSJ/EYbJKfxoFiWIiK0tApsxuNpADCVdF3M2pWRRPstw5zQk1WWicaUnJtPMtSWEkXRBrmcl5KCt9c4io5czPoul1UAoxz56kx/aWx7GFdcJTpUsaWMFn4MskpH2gW//dvsEDqkMlkVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7OMTlAAzZB0vsMGPhiJCo/PSYHFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7GMTiAcqgwyunmGvAFYBjVAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
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
   if(typeof player.canPlayType==='function'&&!player.canPlayType('audio/mpeg'))return false;
   diceShakeAudio=player;
  }
  stopDiceShake();
  diceShakeAudio.volume=1;
  // Trimmed recording starts audibly right away; keep its natural pace.
  diceShakeAudio.playbackRate=1;
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
 if(goalSoundEnabled)playToggleClick(); // Only confirm when turning sound on.
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
function resetConnection(){cancelDiceSpin();stopDiceShake();if(events){events.close();events=null;}animationSerial++;rollSerial++;state=null;lastSequence=-1;lastMoveSeq=-1;lastRollSeq=-1;animPiece=null;}
function home(){resetConnection();code='';authToken='';myRoomMode='';pendingExit=false;screen('welcome');history.replaceState(null,'',location.pathname);refreshReturnSeat();}
function connect(){
 resetConnection();
 // Save the seat before opening the live connection, so reopening the browser can reclaim it.
 if(code&&authToken){try{localStorage.setItem(RETURN_SEAT_KEY,JSON.stringify({code,authToken}));}catch{}}
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
async function join(){const c=$('joinCode').value.toUpperCase().trim();if(savedReturnSeat()?.code===c){await resumeSavedSeat();return;}if(c.length!==6){toast('请输入六位房间码');return;}const result=await actionWithCode({type:'join',code:c,name:$('nickname').value});if(!result)return;code=result.code;authToken=result.token;myRoomMode='online';sessionStorage.setItem('flight_room',JSON.stringify({code,authToken}));connect();if(result.state)receive(result.state);}
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

const RETURN_SEAT_KEY='flight_return_seat';
let voteFadeTimer=null;
function savedReturnSeat(){
 try{const x=JSON.parse(localStorage.getItem(RETURN_SEAT_KEY)||'null');return x?.code&&x?.authToken?x:null;}catch{return null;}
}
function refreshReturnSeat(){
 const seat=savedReturnSeat(),b=$('resumeLast');
 if(b)b.hidden=!seat;
 if(seat&&(!$('joinCode').value||$('joinCode').value===seat.code))$('joinCode').value=seat.code;
}
async function resumeSavedSeat(){
 const saved=savedReturnSeat();
 if(!saved){toast('没有可恢复的座位');return;}
 const result=await actionWithCode({type:'resume',code:saved.code,token:saved.authToken});
 if(!result){toast('原房间可能已经结束，无法接管旧座位');return;}
 code=saved.code;authToken=saved.authToken;myRoomMode='online';
 try{localStorage.removeItem(RETURN_SEAT_KEY);}catch{}
 sessionStorage.setItem('flight_room',JSON.stringify({code,authToken}));
 connect();
 if(result.state)receive(result.state);
}
$('resumeLast').onclick=resumeSavedSeat;
function syncVotePrompt(){
 const el=$('continuePrompt');
 const v=state?.phase==='playing'&&state.roundPhase==='vote'?state.vote:null;
 if(!v){
  if(voteFadeTimer){clearTimeout(voteFadeTimer);voteFadeTimer=null;}
  el.classList.remove('open');el.setAttribute('aria-hidden','true');return;
 }
 const winner=state.players.find(p=>p.color===state.finishOrder[0]);
 $('continueTitle').textContent=`第一名：${winner?winner.role==='?'?winner.name:roleName(winner.role):'已产生'}`;
 $('continueText').textContent='是否继续观看剩余比赛？愿意留下的真人全部同意即可继续；不愿继续可以退出，电脑会接管棋子，之后仍可返回。电脑不投票。';
 $('continueProgress').textContent=`已同意 ${v.agreed}/${v.required} 人 · 等待其余真人玩家选择`;
 $('continueYes').disabled=v.myVote===true;
 $('continueNo').disabled=false; // Even after voting yes, a participant may choose to leave.
 if(!el.classList.contains('open')&&!voteFadeTimer){
  voteFadeTimer=setTimeout(()=>{
   voteFadeTimer=null;
   if(state?.phase==='playing'&&state.roundPhase==='vote'){
    el.setAttribute('aria-hidden','false');el.classList.add('open');
   }
  },680);
 }
}
$('continueYes').onclick=()=>action({type:'vote',agree:true});
$('continueNo').onclick=()=>leaveRoom(); // Disagreeing exits only this seat; the others keep playing.
$('settleNow').onclick=()=>dialog('提前结算比赛？','将按已到终点的棋子数量、再按最近的棋子距终点的格数排列名次。这个操作会结束所有人的当前比赛。',()=>action({type:'end-early'}));
function showRankDetails(){
 const order=state?.finishOrder||[];
 $('rankDetail').innerHTML=order.map((color,index)=>{
  const p=state.players.find(x=>x.color===color);if(!p)return '';
  const goals=p.pieces.filter(v=>v===GOAL).length;
  const distances=p.pieces.filter(x=>x!==GOAL).map(x=>x===-1?57:x===-2?56:GOAL-x);
  const distance=distances.length?Math.min(...distances):0;
  return `<div class="rank-line"><strong>第 ${index+1} 名 · ${escapeHTML(roleName(p.role))}</strong><small>${goals}/4 到终点 · 最近距终点 ${distance} 格</small></div>`;
 }).join('');
}

function receive(next){
 if(next.seq<=lastSequence)return;
 if(next.phase==='closed'){
   const leaving=pendingExit,reason=next.closeReason||'房间已结束。';
   sessionStorage.removeItem('flight_room');
   if(savedReturnSeat()?.code===code)try{localStorage.removeItem(RETURN_SEAT_KEY);}catch{}
   home();
   if(!leaving)dialog('房间已结束',reason);
   return;
 }
 const first=lastSequence<0;
 state=next;lastSequence=next.seq;
 if(first){roleIndex=Math.max(0,ROLE.indexOf(me()?.role??'?'));}
 if(next.phase==='lobby'){syncVotePrompt();screen('lobby');renderLobby();prepareLanAddresses();return;}
 if(next.phase==='playing'){screen('game');renderGame();syncVotePrompt();}
 if(next.phase==='over'){
   syncVotePrompt();screen('result');showRankDetails(); const rank=next.finishOrder.indexOf(next.viewerColor)+1;
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
  const div=document.createElement('div');div.className='seat';div.innerHTML=`<div class="tiny" style="--color:${COLOR[p.color].hex}">${escapeHTML(roleMark(p.role))}</div><div class="seatlabels"><div class="seatrole">${escapeHTML(roleName(p.role))}</div><div class="seatname">${escapeHTML(p.name)}${p.kind==='human'&&p.color===state.viewerColor?'（我）':''}${state.mode!=='solo'&&p.kind==='human'&&p.color===state.hostColor?(state.hostAwayUntil?'（房主暂离）':'（房主）'):''}</div></div>`;
  $('seats').appendChild(div);
 });
 $('botControl').hidden=!state.host;
 $('startGame').hidden=!state.host;
 $('startGame').disabled=!state.canStart;
 $('startGame').textContent=state.canStart?'开始游戏':'等待其他玩家／添加电脑';
 const humans=state.players.length;
 $('lobbyHint').textContent=state.mode==='solo'?'选择 1～3 个电脑，还可以分别调整它们的角色与颜色。':`真人 ${humans} 人 · 电脑 ${state.bots.length} 人。真人可重复角色，阵营颜色不重复；电脑由房主设置。${state.host&&['localhost','127.0.0.1'].includes(location.hostname)?' 邀请其他设备前，请改用房主的局域网IP或公网网址打开房间。':''}${state.canStart?'':' 至少需要两方，邀请朋友或添加一个电脑才能开始。'}`;
 if(state.hostAwayUntil&&state.mode==='online')$('lobbyHint').textContent+=' 房主暂离，三分钟后将按入房顺序移交给下一位在线真人；原房主在期限内回来则不移交。';
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
 if(result.auto){try{localStorage.setItem(RETURN_SEAT_KEY,JSON.stringify({code,authToken}));}catch{}}
 else if(savedReturnSeat()?.code===code)try{localStorage.removeItem(RETURN_SEAT_KEY);}catch{}
 sessionStorage.removeItem('flight_room');
 home();
}
function isSoloMode(){return state?.mode==='solo'||myRoomMode==='solo';}
function exitSetup(){
 if(state?.phase==='playing'){
  dialog('退出当前比赛？','如果还有真人留在房间，电脑会接管你的棋子，你之后可以重新进入；房主离开超过三分钟会按入房顺序移交。若你是最后一位真人，房间会立即关闭。',leaveRoom);
  return;
 }
 if(isSoloMode()){leaveRoom();return;}
 if(state?.host)dialog('暂时离开房间？','你的房主身份会保留三分钟；期间返回可以继续担任房主。超过三分钟仍未回来，会依最初入房顺序移交给下一位在线真人。',leaveRoom);
 else dialog('退出准备房间？','确定退出房间并释放座位？',leaveRoom);
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
// Every character uses the same 60 -> 85 -> 60 movement.
 // Original character images (including Popoya's PNG) are never modified.
const PIECE_REST_DIAMETER=60;
const PIECE_MOVE_DIAMETER=85;
// Token-specific colors. Keep COLOR[] for game UI and board indicators.
const PIECE_COLORS=[
 {base:'#A9CFF3',edge:'#416F9C'}, // blue (player 0)
 {base:'#F4DEA0',edge:'#896424'}, // yellow (player 1)
 {base:'#A9D8B0',edge:'#417954'}, // green (player 2)
 {base:'#F2A7A7',edge:'#9B4D59'}  // red (player 3)
];
let pieceLanding=null;
function drawPieces(){
 const node=$('pieces');node.replaceChildren();if(!state)return;
 for(let color=0;color<4;color++){
  const [cx,cy]=LAUNCH_POINT[color];
  svg('circle',{cx,cy,r:18,fill:'#fffdf9',stroke:COLOR[color].hex,'stroke-width':3,class:'launch-circle','pointer-events':'none'},node);
 }
 const packs=new Map();
 let movingNode=null;
 const restSize=PIECE_REST_DIAMETER;
 for(const p of state.players)for(let id=0;id<4;id++){
  const pos=piecePosition(p,id);
  const passingThroughGoal=animPiece?.color===p.color&&animPiece?.id===id;
  if(pos===GOAL&&!passingThroughGoal)continue;
  const [x,y]=point(p.color,pos,id),key=`${x},${y}`;
  if(!packs.has(key))packs.set(key,[]);
  packs.get(key).push({p,id,pos,x,y});
 }
 for(const pack of packs.values())for(let i=0;i<pack.length;i++){
  const {p,id,x,y}=pack[i];const count=pack.length;
  const colCount=Math.ceil(Math.sqrt(count));
  // Mixed-color stacks share the same square; give each piece a visible seat.
  const packed=count>1, hasPopoya=pack.some(item=>item.p.role==='E');
  const spacing=packed?(hasPopoya?44:30):0;
  const movingPiece=animPiece?.color===p.color&&animPiece?.id===id;
  const openingPiece=movingPiece&&animPiece.growing;
  const landingPiece=pieceLanding?.color===p.color&&pieceLanding?.id===id;
  // Stacked pieces remain compact when resting; a moving piece grows to 85.
  const compactRadius=p.role==='E'?Math.min(20,Math.round(restSize*.34)):17;
  const tone=PIECE_COLORS[p.color];
  const radius=movingPiece?restSize/2:(packed?compactRadius:restSize/2);
  const scale=PIECE_MOVE_DIAMETER/PIECE_REST_DIAMETER;
  const border=p.role==='E'?(movingPiece?3.2/scale:packed?2.8:3.2):(movingPiece?5/scale:packed?3.5:5);
  const fontSize=movingPiece?22:packed?16:22;
  const dx=packed?(i%colCount-(colCount-1)/2)*spacing:0;
  const dy=packed?(Math.floor(i/colCount)-(Math.ceil(count/colCount)-1)/2)*spacing:0;
  const canSelect=state.viewerColor===p.color&&state.turn===p.color&&state.roundPhase==='choose'&&state.options.length>1&&state.options.includes(id)&&!animPiece;
  const group=svg('g',{transform:`translate(${x+dx} ${y+dy})`,class:canSelect?'piece available':'piece',role:canSelect?'button':'img','aria-label':`${p.role} 第${id+1}枚棋子`,tabindex:canSelect?'0':'-1'},node);
  if(canSelect){svg('circle',{r:radius+(packed?7:8),fill:'none',stroke:tone.edge,'stroke-width':5,class:'halo'},group);
   const peak=-(radius+(packed?16:28));
   svg('path',{d:`M-10 ${peak} L10 ${peak} L0 ${peak+14}Z`,fill:tone.edge,stroke:'white','stroke-width':2,class:'pointer'},group);}
  const sprite=svg('g',{},group);
  if(p.role==='E'){
   // Only the SOLID-COLORED ROUND BASE receives the dark stroke.
   // Popoya's original PNG and its pre-existing white outline are untouched.
   const rim=border,discRadius=radius-rim/2,artRadius=radius-(packed&&!movingPiece?3.5:4);
   svg('circle',{r:discRadius,fill:tone.base,stroke:tone.edge,'stroke-width':rim},sprite);
   svg('image',{href:'/assets/popoya-original.png?v=popoya-7b365e61961d',x:-artRadius,y:-artRadius,width:artRadius*2,height:artRadius*2,preserveAspectRatio:'xMidYMid meet','pointer-events':'none'},sprite);
  }else{
   svg('circle',{r:radius,fill:tone.base,stroke:tone.edge,'stroke-width':border},sprite);
   const letter=svg('text',{x:0,y:1,'text-anchor':'middle','dominant-baseline':'central','font-size':fontSize,fill:'#272a30'},sprite);letter.textContent=roleMark(p.role);
  }
  // Scale the colored base and character art/letter as a single sprite.
  // Finish the opening animation before the first per-cell redraw whenever possible.
  if(movingPiece)sprite.setAttribute('transform',`scale(${scale})`);
  if(openingPiece||landingPiece){
   const fromScale=openingPiece?(packed?compactRadius/(restSize/2):1):PIECE_MOVE_DIAMETER/(2*radius);
   const toScale=openingPiece?scale:1;
   svg('animateTransform',{attributeName:'transform',attributeType:'XML',type:'scale',from:fromScale.toFixed(5),to:toScale.toFixed(5),dur:openingPiece?'120ms':'175ms',fill:'freeze'},sprite);
  }
  // Enlarged moving tokens are always drawn above stationary tokens.
  if(movingPiece)movingNode=group;
  if(canSelect){group.onclick=()=>action({type:'move',piece:id});group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action({type:'move',piece:id});}};}
 } if(movingNode)node.appendChild(movingNode);
}
function renderGame(){
 if(!state)return;
 const self=me();
 $('boardSelectedRole').textContent='【'+(self?roleName(self.role):'随机角色')+'】';
 $('boardSelectedRole').style.setProperty('--selected-color',self?COLOR[self.color].hex:'#878b91');
 $('playerStrip').innerHTML=ORDER.map(c=>state.players.find(p=>p.color===c)).filter(Boolean).map(p=>{
 const count=p.pieces.filter(v=>v===GOAL).length;
 const canTransfer=state.host&&state.mode==='online'&&p.kind==='human'&&!p.auto&&p.connected&&p.color!==state.viewerColor;
 const avatar=canTransfer
  ? `<button type="button" class="tiny host-transfer-avatar" style="--color:${COLOR[p.color].hex}" data-transfer-color="${p.color}" aria-label="移交房主给${escapeHTML(p.name)}" title="点击头像移交房主">${escapeHTML(roleMark(p.role))}</button>`
  : `<div class="tiny" style="--color:${COLOR[p.color].hex}">${escapeHTML(roleMark(p.role))}</div>`;
 const hostMark=p.kind==='human'&&p.color===state.hostColor?`<span class="host-tag">房主${state.hostAwayUntil?'·暂离':''}</span>`:'';
 return `<div class="playerchip ${state.turn===p.color?'turn':''} ${p.finished?'done':''}" style="--color:${COLOR[p.color].hex}">${avatar}<div title="${escapeHTML(roleName(p.role))}" class="seatname seatrole">${escapeHTML(roleName(p.role))}</div><small title="${escapeHTML(p.name)}">${p.kind==='ai'?'电脑':p.auto?'电脑托管':escapeHTML(p.name)}</small><small>${count}/4 已到终点</small>${hostMark}</div>`;
 }).join('');
 $('playerStrip').querySelectorAll('[data-transfer-color]').forEach(button=>{
   button.onclick=()=>{
     const target=state?.players.find(p=>p.kind==='human'&&p.color===Number(button.dataset.transferColor));
     if(!state?.host||state.phase!=='playing'||!target)return;
     dialog('确认移交房主？',`将房主身份交给「${target.name}」吗？移交后对方拥有房主权限；若新房主离开超过三分钟，房主身份将继续按入房顺序移交给其他在线真人。`,()=>action({type:'transfer-host',targetColor:target.color}));
   };
 });
 $('gameHint').textContent=state.host&&state.mode==='online'&&state.players.filter(p=>p.kind==='human').length>1?'房主可点击其他玩家的头像移交房主 · 轮到自己时掷骰':'轮到自己时掷骰 · 可选的棋子会显示光圈和小三角';
 if(self?.finished&&state.voteHandled&&state.roundPhase!=='vote')$('gameHint').textContent='你已完成全部棋子，当前正在观战。';
 if(state.hostAwayUntil&&state.mode==='online')$('gameHint').textContent+=' 房主暂离；三分钟后将自动移交给下一位在线真人。';
 const turnPlayer=state.players.find(p=>p.color===state.turn);
 const mine=state.viewerColor===state.turn;
 const phases={roll:mine?'点击骰子':'等待掷骰',choose:state.options?.length>1?(mine?'点击发光的棋子':'正在选择棋子'):'唯一可动棋子自动前进',moving:'正在移动棋子',rolling:'正在掷骰子'};
 $('status').textContent=turnPlayer&&(turnPlayer.kind==='ai'||turnPlayer.auto)?roleName(turnPlayer.role):(state.note||`${turnPlayer?.name||'玩家'} 的回合`);
 $('detail').textContent=state.roundPhase==='choose'&&state.die?`骰子 ${state.die} 点 · ${phases.choose}`:(phases[state.roundPhase]||'');
 $('roll').disabled=!(mine&&!self?.auto&&state.roundPhase==='roll');
 $('settleNow').hidden=state.phase!=='playing'||state.roundPhase==='vote';

 $('diceStatus').textContent=mine&&state.roundPhase==='roll'?'点击投掷骰子':turnPlayer&&(turnPlayer.kind==='ai'||turnPlayer.auto)?roleName(turnPlayer.role):`${turnPlayer?.name||'对方'} 的回合`;
 drawPieces();
}
$('roll').onclick=()=>action({type:'roll'});
function initDice(){document.querySelectorAll('.face').forEach(face=>{
 const n=Number(face.dataset.face);
 for(const idx of PIPS[n]){const pip=document.createElement('i');pip.className='pip';pip.style.left=`${[23,50,77][idx%3]}%`;pip.style.top=`${[23,50,77][Math.floor(idx/3)]}%`;face.appendChild(pip);}
});}
// The front-right-bottom vertex is the spinning top's contact point.
// A 54.7356° tilt around (-1, 0, 1) puts the cube's body diagonal upright;
// rotating around the screen's Y axis then leaves that corner stationary.
let diceSpinAnimation=null;
function cancelDiceSpin(){
 if(diceSpinAnimation){try{diceSpinAnimation.cancel();}catch{}diceSpinAnimation=null;}
 $('roll').classList.remove('pivoting');
}
function placeCube(n){
 cancelDiceSpin();
 const [x,y]=ORIENT[n]||ORIENT[1],cube=$('cube');
 cube.style.transition='none';
 cube.style.transformOrigin='50% 50% 0px';
 cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;
 $('roll').setAttribute('aria-label',`骰子：${n} 点`);
}
async function animateRoll(n){
 const own=++rollSerial, cube=$('cube'), [x,y]=ORIENT[n];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 cancelDiceSpin();
 const recorded=playRecordedDiceShake(); // Sound and movement start on the same game event.
 $('diceStatus').textContent='骰子旋转中';
 if(reduced){
  if(!recorded)playDiceTap(true);
  placeCube(n);
  $('diceStatus').textContent=`${n} 点`;
  return;
 }
 if(!recorded){
  // Browser audio fallback only; do not overlay synthetic taps on the recording.
  for(const ms of [0,170,350,570,850,1180,1530,1900,2350])
   setTimeout(()=>{if(own===rollSerial)playDiceTap(ms===2350);},ms);
 }
 $('roll').classList.add('pivoting');
 const tip='100% 100% 31px';
 // Slightly flatten/shrink only the spinning pose, while centering it in the normal dice slot.
 const spin=deg=>`translate3d(-31px,15px,0px) rotateY(${deg}deg) rotate3d(-1,0,1,54.7356deg) scale3d(.86,.82,.86)`;
 const duration=2560; // Same duration as the trimmed recorded shake and throw.
 cube.style.transition='none';
 cube.style.transformOrigin=tip;
 cube.style.transform=spin(0); // Cut straight from the resting face to the tilted pose.
 if(typeof cube.animate==='function'){
  try{
   const anim=cube.animate([{transform:spin(0)},{transform:spin(2880)}],{
    duration,easing:'linear',fill:'forwards'
   });
   diceSpinAnimation=anim;
   await anim.finished;
  }catch{if(own!==rollSerial)return;}
 }else{
  // Fallback: animate only the rotation, never the entry/exit pose.
  void cube.offsetWidth;
  cube.style.transition=`transform ${duration}ms linear`;
  cube.style.transform=spin(2880);
  await sleep(duration);
 }
 if(own!==rollSerial)return;
 placeCube(n); // Instantly reveal the final face, without landing or fade animation.
 // The server still holds this face on screen before progressing.
 $('diceStatus').textContent=`${n} 点`;
}
async function animateMove(move){$('bubble').style.display='none';const mine=++animationSerial;animPiece={color:move.color,id:move.piece,pos:move.start,growing:true};drawPieces();animPiece.growing=false;
 for(let k=0;k<move.path.length;k++){
  const step=move.path[k];await sleep(step.kind==='飞跃'?260:step.kind==='跳格'?230:140);
  if(mine!==animationSerial)return;
  animPiece.pos=step.pos;drawPieces();
  if(k===move.path.length-1&&step.pos===GOAL)playGoalPieceSound(move.goalOrdinal);
   else playStepPop();
 }
 await sleep(100);if(mine!==animationSerial)return;pieceLanding={color:move.color,id:move.piece};animPiece=null;drawPieces();pieceLanding=null;
 if(move.hit&&move.dialogue){const [x,y]=point(move.color,move.path.at(-1).pos,move.piece);const b=$('bubble');b.textContent=move.dialogue;b.style.setProperty('--bubble-color',COLOR[move.color]?.hex||'#ef7872');b.style.left=`${Math.max(35,Math.min(65,5+x/900*90))}%`;b.style.top=`${5+y/900*90}%`;b.classList.toggle('below',y<190);b.style.display='block';setTimeout(()=>{if(mine===animationSerial)b.style.display='none';},2700);}
}
function rules(){dialog('游戏说明','每方四枚棋子，掷出6可从基地进入棋盘外的起飞圈，并能再掷一次；起飞圈里的棋子下次掷骰进入棋盘时，紧邻起飞圈的斜三角格算第1格，后面的棋格依次计数。棋子到本色转弯格后进入6格终点道，最里面第6格即终点。落在本色格可向前跳4格；直接落在飞跃格时飞跃。每次掷骰最多触发一次跳格或飞跃，跳到飞机格不再连锁飞跃。走到对手占据的格子时，双方棋子数量不同时可并排共存；相等时把该对手的整组棋子撞回基地（单枚对单枚同样有效）。飞跃经过交叉处时，仍可撞回对方终点道里的单枚棋子。到终点必须刚好，超点折返。连续掷出三个6，未完成棋子回基地。\n\n真人角色可以重复，但颜色不重复。电脑角色与颜色由房主设置。第一名产生后，会询问所有在场真人是否继续比赛；留下的真人都同意就继续，不愿继续者可以退出由电脑托管，之后还能返回接管。已完成的玩家观战，电脑不投票。可以提前结束并结算，剩余玩家按已进终点的棋子数、再按剩余距离决定排名。对局中离开由电脑暂时接管，返回原设备的房间可以恢复自己的座位。房主离开三分钟后按真人原始入房顺序移交，期间回来保留房主身份。');}
$('rulesHome').onclick=rules;$('gameRules').onclick=rules;
initDice();placeCube(1);
refreshReturnSeat();
const incoming=new URLSearchParams(location.search).get('room');if(incoming){$('joinCode').value=incoming.toUpperCase();$('inviteNotice').hidden=false;$('nickname').focus();}
if(location.pathname!=='/spectate-test.html')try{const saved=JSON.parse(sessionStorage.getItem('flight_room')||'null');if(saved?.code&&saved?.authToken&&(!incoming||incoming.toUpperCase()===saved.code)){code=saved.code;authToken=saved.authToken;connect();}}catch{}
