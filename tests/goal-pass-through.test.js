'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {projection}=require('../server.js');
const GOAL=55;

// Server must walk across the goal and bounce unless the last die step is 55.
const examples=[
  {from:54,die:1,path:[55],to:55},
  {from:54,die:3,path:[55,54,53],to:53},
  {from:53,die:3,path:[54,55,54],to:54},
  {from:52,die:5,path:[53,54,55,54,53],to:53},
  {from:54,die:6,path:[55,54,53,52,51,50],to:50}
];
for(const ex of examples){
 const result=projection(ex.from,ex.die);
 assert.deepEqual(result.path.map(step=>step.pos),ex.path,'unexpected route for '+ex.from+' + '+ex.die);
 assert.equal(result.to,ex.to);
}
function drawFrom(filename,role,storedPos,animatedPos){
 const contents=fs.readFileSync(path.join(__dirname,'..','public',filename),'utf8');
 const begin=contents.indexOf('function drawPieces(){');
 const end=contents.indexOf('function renderGame(){',begin);
 assert(begin!==-1&&end!==-1,'missing drawPieces in '+filename);
 const root=element('root',{});
 function element(tag,attrs){
   return {tag,attrs,children:[],appendChild(child){
      const idx=this.children.indexOf(child);
      if(idx>=0)this.children.splice(idx,1);
      this.children.push(child);
   },replaceChildren(){this.children=[]},setAttribute(k,v){this.attrs[k]=v}};
 }
 const context={
   $:()=>root,svg:(tag,attrs,parent)=>{const child=element(tag,attrs);parent.appendChild(child);return child;},
   state:{players:[{color:0,role,pieces:[storedPos,GOAL,GOAL,GOAL]}],
          viewerColor:-1,turn:-1,roundPhase:'moving',options:[]},
   GOAL,LAUNCH_POINT:[[10,10],[20,20],[30,30],[40,40]],
   COLOR:[{hex:'#41a7f5'},{hex:'#f6c945'},{hex:'#58c26a'},{hex:'#ef5350'}],
   PADS:[[64,64],[136,64],[64,136],[136,136]],
   piecePosition:(p,id)=>(context.animPiece?.color===p.color&&context.animPiece?.id===id)?context.animPiece.pos:p.pieces[id],
   point:(color,pos,id)=>[450,350+pos],
   roleMark:()=>role,
   PIECE_REST_DIAMETER:60,PIECE_MOVE_DIAMETER:85,
   // The offline HTML embeds the actual PNG; a harmless URI stub suffices here.
   POPOYA_PNG:'data:image/png;base64,iVBORw0KGgo=',
   pieceLanding:null,
   animPiece:animatedPos===null?null:{color:0,id:0,pos:animatedPos,growing:false},
   action:()=>{throw Error('Unexpected action')},
 };
 const draw=vm.runInNewContext('('+contents.slice(begin,end).trim()+')',context);
 draw();
 return root.children.filter(n=>n.tag==='g'&&String(n.attrs.class||'').includes('piece'));
}
for(const filename of ['app.js','single.html']){
 for(const role of ['A','E']){
   assert.equal(drawFrom(filename,role,GOAL,null).length,0,filename+': completed piece should disappear');
   assert.equal(drawFrom(filename,role,53,55).length,1,filename+': transient crossing of 55 must remain visible');
   assert.equal(drawFrom(filename,role,GOAL,55).length,1,filename+': final 55 remains visible until animation completes');
   assert.equal(drawFrom(filename,role,53,null).length,1,filename+': rebound end must remain visible');
 }
}
console.log('PASS: server bounce paths + online/offline goal visibility for character art and text pieces');
