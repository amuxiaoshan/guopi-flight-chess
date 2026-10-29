#!/usr/bin/env python3
"""Make every OC piece 60 at rest, 85 during movement; leave artwork unchanged."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OLD_HEADER="""// Only the currently moving Popoya token grows. Its original PNG is never modified.
const POPOYA_REST_DIAMETER=60;
const POPOYA_MOVE_DIAMETER=85;
let popoyaLanding=null;"""
NEW_HEADER="""// Every character uses the same 60 -> 85 -> 60 movement.
 // Original character images (including Popoya's PNG) are never modified.
const PIECE_REST_DIAMETER=60;
const PIECE_MOVE_DIAMETER=85;
let pieceLanding=null;"""

def once(src, old, new, what):
    n=src.count(old)
    if n != 1:
        raise RuntimeError(f"{what}: expected one match, found {n}: {old[:90]}")
    return src.replace(old,new,1)

for name in ("app.js","single.html"):
    path=ROOT/"public"/name
    src=path.read_text(encoding="utf-8")
    if "const PIECE_REST_DIAMETER=60;" in src:
        print(name+": already converted")
        continue
    src=once(src,OLD_HEADER,NEW_HEADER,name+" constants")
    start=src.index("function drawPieces(){")
    end=src.index("function renderGame(){",start)
    part=src[start:end]

    part=once(part,
        " const popoyaSize=POPOYA_REST_DIAMETER;",
        " const restSize=PIECE_REST_DIAMETER;",
        name+" resting size")

    old_shape="""  const movingPopoya=p.role==='E'&&animPiece?.color===p.color&&animPiece?.id===id;
  const openingPopoya=movingPopoya&&animPiece.growing;
  const landingPopoya=p.role==='E'&&popoyaLanding?.color===p.color&&popoyaLanding?.id===id;
  const radius=p.role==='E'?(movingPopoya?POPOYA_MOVE_DIAMETER/2:(packed?Math.min(20,Math.round(popoyaSize*.34)):popoyaSize/2)):(packed?17:24);
  const border=p.role==='E'?(packed?2.8:3.2):(packed?3.5:5), fontSize=packed?16:22;"""
    new_shape="""  const movingPiece=animPiece?.color===p.color&&animPiece?.id===id;
  const openingPiece=movingPiece&&animPiece.growing;
  const landingPiece=pieceLanding?.color===p.color&&pieceLanding?.id===id;
  // Stacked pieces remain compact when resting; a moving piece grows to 85.
  const compactRadius=p.role==='E'?Math.min(20,Math.round(restSize*.34)):17;
  const radius=movingPiece?restSize/2:(packed?compactRadius:restSize/2);
  const scale=PIECE_MOVE_DIAMETER/PIECE_REST_DIAMETER;
  const border=p.role==='E'?(movingPiece?3.2/scale:packed?2.8:3.2):(movingPiece?5/scale:packed?3.5:5);
  const fontSize=movingPiece?22:packed?16:22;"""
    part=once(part,old_shape,new_shape,name+" piece sizing")
    part=once(part," const packs=new Map();"," const packs=new Map();\n let movingNode=null;",name+" layering")

    part=once(part,"  if(p.role==='E'){","  const sprite=svg('g',{},group);\n  if(p.role==='E'){",name+" shared sprite")
    part=once(part,"   const sprite=svg('g',{},group);\n","",name+" old sprite")
    part=once(part,
        "const rim=border,discRadius=radius-rim/2,artRadius=radius-(packed?3.5:4);",
        "const rim=border,discRadius=radius-rim/2,artRadius=radius-(packed&&!movingPiece?3.5:4);",
        name+" PNG original sizing")

    old_transition="""   // Scale the entire colored disc + unmodified artwork together.
   // Existing compact stacks stay compact when resting.
   if(openingPopoya||landingPopoya){
    const restDiameter=packed?2*Math.min(20,Math.round(popoyaSize*.34)):POPOYA_REST_DIAMETER;
    const fromScale=openingPopoya?restDiameter/POPOYA_MOVE_DIAMETER:POPOYA_MOVE_DIAMETER/restDiameter;
    svg('animateTransform',{attributeName:'transform',attributeType:'XML',type:'scale',from:fromScale.toFixed(5),to:'1',dur:openingPopoya?'165ms':'175ms',fill:'freeze'},sprite);
   }
"""
    part=once(part,old_transition,"",name+" old animation")
    part=once(part,
        "svg('circle',{r:radius,fill:'white',stroke:COLOR[p.color].hex,'stroke-width':border},group);",
        "svg('circle',{r:radius,fill:'white',stroke:COLOR[p.color].hex,'stroke-width':border},sprite);",
        name+" placeholder base")
    part=once(part,
        "fill:'#272a30'},group);letter.textContent=roleMark(p.role);",
        "fill:'#272a30'},sprite);letter.textContent=roleMark(p.role);",
        name+" placeholder letter")

    effects="""  // Scale the colored base and character art/letter as a single sprite.
  // Finish the opening animation before the first per-cell redraw whenever possible.
  if(movingPiece)sprite.setAttribute('transform',`scale(${scale})`);
  if(openingPiece||landingPiece){
   const fromScale=openingPiece?(packed?compactRadius/(restSize/2):1):PIECE_MOVE_DIAMETER/(2*radius);
   const toScale=openingPiece?scale:1;
   svg('animateTransform',{attributeName:'transform',attributeType:'XML',type:'scale',from:fromScale.toFixed(5),to:toScale.toFixed(5),dur:openingPiece?'120ms':'175ms',fill:'freeze'},sprite);
  }
  // Enlarged moving tokens are always drawn above stationary tokens.
  if(movingPiece)movingNode=group;
"""
    part=once(part,"  if(canSelect){group.onclick=",effects+"  if(canSelect){group.onclick=",name+" animation")
    if not part.endswith(" }\n}\n"):
        raise RuntimeError(name+": unexpected drawPieces function ending")
    part=part[:-3] + " if(movingNode)node.appendChild(movingNode);\n}\n"
    src=src[:start]+part+src[end:]
    src=once(src,
        "popoyaLanding={color:move.color,id:move.piece};animPiece=null;drawPieces();popoyaLanding=null;",
        "pieceLanding={color:move.color,id:move.piece};animPiece=null;drawPieces();pieceLanding=null;",
        name+" landing")
    assert src.count("const PIECE_REST_DIAMETER=60;")==1
    assert src.count("const PIECE_MOVE_DIAMETER=85;")==1
    assert "movingPopoya" not in src
    assert "popoyaLanding" not in src
    assert "const sprite=svg('g',{},group);" in src
    assert src.count("svg('animateTransform'")==1
    path.write_text(src,encoding="utf-8")
    print(f"{name}: unified 60 resting, 85 moving, 60 landing; kept PNG untouched")
