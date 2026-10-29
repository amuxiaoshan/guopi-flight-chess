'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.join(__dirname,'..','public');
const tones=[
 {base:'#A9CFF3',edge:'#416F9C'}, // blue, player 0
 {base:'#F4DEA0',edge:'#896424'}, // yellow, player 1
 {base:'#A9D8B0',edge:'#417954'}, // green, player 2
 {base:'#F2A7A7',edge:'#9B4D59'}  // red, player 3
];
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
for(const name of ['app.js','single.html']){
 const source=read(name);
 const match=source.match(/const PIECE_COLORS=(\[[\s\S]*?\]);/);
 assert.ok(match,name+': missing piece palette');
 const actual=vm.runInNewContext(match[1]);
 assert.deepEqual(JSON.parse(JSON.stringify(actual)),tones,name+': bad colors or team order');
 assert.ok(source.includes('const tone=PIECE_COLORS[p.color]'),name+': missing team palette lookup');
 assert.ok(source.includes("fill:tone.base,stroke:tone.edge,'stroke-width':rim"),name+': illustration backing mismatched');
 assert.ok(source.includes("fill:tone.base,stroke:tone.edge,'stroke-width':border"),name+': text token mismatched');
 assert.ok(source.includes('if(pos===GOAL&&!passingThroughGoal)continue;'),name+': regress pass-through');
 assert.ok(source.includes('const PIECE_REST_DIAMETER=60'),name+': regress resting size');
 assert.ok(source.includes('const PIECE_MOVE_DIAMETER=85'),name+': regress moving size');
 assert.ok(source.includes("const sprite=svg('g',{},group);"),name+': original artwork must remain inside sprite');
}
for(const code of [...tones.map(t=>t.base),...tones.map(t=>t.edge)]){
 assert.ok(read('piece-motion-test.html').includes(code), 'movement preview missing '+code);
 assert.ok(read('piece-color-test.html').includes(code),'color preview missing '+code);
 assert.ok(read('piece-preview.html').includes(code),'static preview missing '+code);
}
assert.ok(read('piece-color-test.html').includes("selectedStroke='team'"),'color preview should initially select matching strokes');
console.log('PASS: all four team pastel bases and their own dark edges, online/offline/dynamic previews');
