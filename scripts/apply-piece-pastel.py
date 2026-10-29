#!/usr/bin/env python3
"""Synchronize soft-color chess piece bases with contrasting, matching outlines.

Only the chess token artwork bases and outline/selection colors are changed.
The board artwork, original character PNG, game rules and motion timing are untouched.
"""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PALETTE="""// Token-specific colors. Keep COLOR[] for game UI and board indicators.
const PIECE_COLORS=[
 {base:'#A9CFF3',edge:'#416F9C'}, // blue (player 0)
 {base:'#F4DEA0',edge:'#896424'}, // yellow (player 1)
 {base:'#A9D8B0',edge:'#417954'}, // green (player 2)
 {base:'#F2A7A7',edge:'#9B4D59'}  // red (player 3)
];
"""

def once(source, old, new, context):
    n=source.count(old)
    if n!=1:
        raise RuntimeError(f"{context}: expected one occurrence, got {n}: {old[:80]!r}")
    return source.replace(old,new,1)

for name in ("app.js","single.html"):
    file=ROOT/"public"/name
    source=file.read_text(encoding="utf-8")
    if "const PIECE_COLORS=[" in source or "const PIECE_COLORS=GAME_CONTENT.teams.map(" in source:
        print(name+": palette already supplied by game or active content pack")
        continue
    source=once(source,"const PIECE_MOVE_DIAMETER=85;\n","const PIECE_MOVE_DIAMETER=85;\n"+PALETTE,name+" palette config")
    before,after=source.split("function drawPieces(){",1)
    draw,rest=after.split("function renderGame(){",1)

    draw=once(draw,"  const radius=movingPiece?restSize/2:(packed?compactRadius:restSize/2);",
        "  const tone=PIECE_COLORS[p.color];\n  const radius=movingPiece?restSize/2:(packed?compactRadius:restSize/2);",name+" token tone")
    draw=once(draw,
        "fill:COLOR[p.color].hex,stroke:'#111111','stroke-width':rim",
        "fill:tone.base,stroke:tone.edge,'stroke-width':rim",name+" art base")
    draw=once(draw,
        "fill:'white',stroke:COLOR[p.color].hex,'stroke-width':border",
        "fill:tone.base,stroke:tone.edge,'stroke-width':border",name+" text placeholder")
    draw=once(draw,
        "stroke:COLOR[p.color].hex,'stroke-width':5,class:'halo'",
        "stroke:tone.edge,'stroke-width':5,class:'halo'",name+" selected piece halo")
    draw=once(draw,
        "fill:COLOR[p.color].hex,stroke:'white','stroke-width':2,class:'pointer'",
        "fill:tone.edge,stroke:'white','stroke-width':2,class:'pointer'",name+" choice pointer")
    source=before+"function drawPieces(){"+draw+"function renderGame(){"+rest
    assert source.count("const PIECE_COLORS=[")==1
    assert "fill:tone.base,stroke:tone.edge" in source
    file.write_text(source,encoding="utf-8")
    print(name+": four soft pastel bases + matching dark-colored outlines applied")
