#!/usr/bin/env python3
"""Apply movement-size rules to both online and offline versions of Popoya."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
original_start = "// Popoya artwork is displayed at its original aspect ratio"
new_settings = """// Only the currently moving Popoya token grows. Its original PNG is never modified.
const POPOYA_REST_DIAMETER=60;
const POPOYA_MOVE_DIAMETER=85;
let popoyaLanding=null;
"""
old_radius = "const radius=p.role==='E'?(packed?Math.min(20,Math.round(popoyaSize*.34)):popoyaSize/2):(packed?17:24);"
new_radius = """const movingPopoya=p.role==='E'&&animPiece?.color===p.color&&animPiece?.id===id;
  const openingPopoya=movingPopoya&&animPiece.growing;
  const landingPopoya=p.role==='E'&&popoyaLanding?.color===p.color&&popoyaLanding?.id===id;
  const radius=p.role==='E'?(movingPopoya?POPOYA_MOVE_DIAMETER/2:(packed?Math.min(20,Math.round(popoyaSize*.34)):popoyaSize/2)):(packed?17:24);"""
old_begin = "animPiece={color:move.color,id:move.piece,pos:move.start};drawPieces();"
new_begin = "animPiece={color:move.color,id:move.piece,pos:move.start,growing:true};drawPieces();animPiece.growing=false;"
old_finish = "await sleep(100);if(mine!==animationSerial)return;animPiece=null;drawPieces();"
new_finish = "await sleep(100);if(mine!==animationSerial)return;popoyaLanding={color:move.color,id:move.piece};animPiece=null;drawPieces();popoyaLanding=null;"

for name in ("app.js", "single.html"):
    path = root / "public" / name
    src = path.read_text(encoding="utf-8")
    if "const sprite=svg('g',{},sprite);" in src:
        src = src.replace("const sprite=svg('g',{},sprite);", "const sprite=svg('g',{},group);")
        path.write_text(src, encoding="utf-8")
        print(name + ": fixed animation group initialization")
        continue
    if "const POPOYA_REST_DIAMETER=60;" in src:
        print(name + " already updated")
        continue
    start = src.index(original_start)
    stop = src.index("function drawPieces(){", start)
    src = src[:start] + new_settings + src[stop:]
    substitutions = (
        ("const popoyaSize=popoyaDiameter();", "const popoyaSize=POPOYA_REST_DIAMETER;"),
        (old_radius, new_radius),
        (old_begin, new_begin),
        (old_finish, new_finish),
    )
    for before, after in substitutions:
        count = src.count(before)
        if count != 1:
            raise RuntimeError(name + ": expected one occurrence, found " + str(count) + " of " + before[:48])
        src = src.replace(before, after, 1)
    start = src.index("  if(p.role==='E'){", src.index("function drawPieces(){"))
    stop = src.index("  }else{", start)
    original_block = src[start:stop]
    if original_block.count("},group);") != 2:
        raise RuntimeError(name + ": unexpected Popoya circle/image block")
    new_block = original_block.replace(
        "   svg('circle'",
        "   const sprite=svg('g',{},group);\n   svg('circle'",
        1,
    ).replace("},group);", "},sprite);", 2)
    new_block += """   // Scale the entire colored disc + unmodified artwork together.
   // Existing compact stacks stay compact when resting.
   if(openingPopoya||landingPopoya){
    const restDiameter=packed?2*Math.min(20,Math.round(popoyaSize*.34)):POPOYA_REST_DIAMETER;
    const fromScale=openingPopoya?restDiameter/POPOYA_MOVE_DIAMETER:POPOYA_MOVE_DIAMETER/restDiameter;
    svg('animateTransform',{attributeName:'transform',attributeType:'XML',type:'scale',from:fromScale.toFixed(5),to:'1',dur:openingPopoya?'165ms':'175ms',fill:'freeze'},sprite);
   }
"""
    src = src[:start] + new_block + src[stop:]
    if "return 70;" in src[src.index("function drawPieces(){")-300:src.index("function drawPieces(){")]:
        raise RuntimeError(name + ": obsolete size setting survived")
    path.write_text(src, encoding="utf-8")
    print(name + ": resting 60, moving 85, smooth 165/175ms size changes")

preview = root / "public/piece-preview.html"
src = preview.read_text(encoding="utf-8")
if "波波亚 · 移动放大测试" not in src:
    edits = [
        ('<a href="/">‹ 返回正式游戏</a>', '<a href="/">‹ 返回正式游戏</a>　<a href="/piece-motion-test.html">波波亚 · 移动放大测试</a>'),
        ('<output id="sizeText">70 单位</output>', '<output id="sizeText">60 单位</output>'),
        ('max="80" step="2" value="70"', 'max="90" step="2" value="60"'),
        ('现在默认直径 70（包括细黑边）', '正式游戏待机直径 60，移动时 85；预览滑块不影响游戏（包括细黑边）'),
        ('恢复推荐大小 70', '预览恢复 60'),
        ('细黑边 · 70 单位', '细黑边 · 60 单位'),
        ('棋子默认直径 70，离线版相同。', '正式版与离线版待机 60、移动 85；本页滑块仅调整对比预览。'),
        ("const KEY='guopi_popoya_piece_diameter_v3';\nfunction getSize(){try{const n=Number(localStorage.getItem(KEY));if(n>=48&&n<=80)return n;}catch{}return 70;}", 'function getSize(){return 60;}'),
        (" try{localStorage.setItem(KEY,String(n));}catch{}\n", ''),
        (" document.getElementById('pieceSize').value='70';", " document.getElementById('pieceSize').value='60';"),
        (" try{localStorage.setItem(KEY,'70');}catch{}\n", ''),
    ]
    for before, after in edits:
        n = src.count(before)
        if n != 1:
            raise RuntimeError("piece-preview.html unexpected text: "+before[:65]+" found "+str(n))
        src = src.replace(before, after, 1)
    preview.write_text(src, encoding="utf-8")
    print("piece-preview.html: links to moving test, default shows 60 and no obsolete game preference")
