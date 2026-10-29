#!/usr/bin/env python3
"""Build one selected OC/art/UI/quotes content pack for online and offline versions.

Edit content/active.json or run: python3 scripts/build-content-pack.py --use example
Artwork remains byte-for-byte identical. Only links and embedded data URIs are generated.
"""
import argparse
import base64
import copy
import json
import mimetypes
import re
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/"public"
CONTENT=ROOT/"content"
PACK_IDS=list("ABCDEFGH")
ALLOWED=re.compile(r"^[a-z0-9_-]+$")

def once(source,old,new,label):
    n=source.count(old)
    if n!=1: raise RuntimeError(f"{label}: expected 1 match, got {n}: {old[:85]}")
    return source.replace(old,new,1)

def subs(source,pattern,replacement,label):
    result,n=re.subn(pattern,lambda match: replacement,source,count=1,flags=re.S)
    if n!=1: raise RuntimeError("could not find "+label)
    return result

def file_replace(path, source):
    current=path.read_text(encoding="utf-8") if path.exists() else None
    if current!=source:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(source,encoding="utf-8")
        print("updated",path.relative_to(ROOT))
    else:
        print("unchanged",path.relative_to(ROOT))

def validate(pack,id):
    if pack.get("id")!=id: raise ValueError("pack.id must match folder name")
    roster=set(pack["characters"])
    if not set(PACK_IDS).issubset(roster): raise ValueError("Characters A-H are required")
    extra=roster-set(PACK_IDS)
    if extra and (extra!={"I"} or pack["characters"]["I"].get("secret") is not True or pack["characters"]["I"].get("humanOnly") is not True):
        raise ValueError("Optional secret slot I must be human-only")
    if extra and list(pack["characters"])[-1]!="I":
        raise ValueError("Secret slot I must be last in the character roster")
    if len(pack["teams"])!=4: raise ValueError("Exactly 4 team styles required")
    if [x["key"] for x in pack["teams"]] != ["blue","yellow","green","red"]:
        raise ValueError("Team colors must keep board-order blue/yellow/green/red")
    for c in pack["characters"].values():
        if not isinstance(c["name"],str) or not isinstance(c["mark"],str):
            raise ValueError("Every character needs a name and token mark")
        if not isinstance(c.get("collision",[]),list) or not all(isinstance(x,str) for x in c["collision"]):
            raise ValueError("Invalid collision lines")
        special=c.get("collisionTargets",{})
        if not isinstance(special,dict) or any(
            target not in roster or not isinstance(line,str) or not line.strip()
            for target,line in special.items()
        ):
            raise ValueError("Invalid target-specific collision lines")
    for t in pack["teams"]:
        for field in ("base","edge","ui"):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}",t[field]):raise ValueError("Bad color "+field)

def render_pack(raw,id,offline):
    built=copy.deepcopy(raw)
    pack_folder=CONTENT/"packs"/id
    # A pending original is kept in source control as a path hint; when the
    # exact user-uploaded asset is committed, the next build adopts it.
    for ch in built["characters"].values():
        pending=ch.get("pieceImagePending")
        if pending and isinstance(pending,str) and (pack_folder/pending).is_file():
            ch["pieceImage"]=pending
        ch.pop("pieceImagePending",None)
    asset_paths=[]
    for cid,ch in built["characters"].items():
        if ch.get("pieceImage"):
            asset_paths.append(("character "+cid,ch,"pieceImage"))
    for key in ("board","resultImage","backgroundImage","logoImage","uiCss"):
        if built.get("art",{}).get(key):
            asset_paths.append(("art "+key,built["art"],key))
    for label,parent,key in asset_paths:
        item=parent[key]
        if not isinstance(item,str) or not item:
            raise ValueError(label+': invalid asset path')
        if item.startswith("/"):
            if offline and item.startswith("/content/"):
                raise ValueError("Offline pack cannot embed external content path: "+item)
            if offline and item.startswith("/"):
                source=PUBLIC/item.lstrip("/")
                if not source.exists(): raise FileNotFoundError(item)
                mimetype=mimetypes.guess_type(source.name)[0] or "application/octet-stream"
                parent[key]="data:"+mimetype+";base64,"+base64.b64encode(source.read_bytes()).decode("ascii")
            continue
        resolved=(pack_folder/item).resolve()
        if not resolved.is_relative_to(pack_folder.resolve()) or not resolved.is_file():
            raise ValueError(f"{label}: missing or unsafe asset {item}")
        mimetype=mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        if offline:
            parent[key]="data:"+mimetype+";base64,"+base64.b64encode(resolved.read_bytes()).decode("ascii")
        else:
            target=PUBLIC/"content"/"assets"/id/item
            target.parent.mkdir(parents=True,exist_ok=True)
            if not target.exists() or target.read_bytes()!=resolved.read_bytes():
                shutil.copyfile(resolved,target)
            parent[key]="/content/assets/"+id+"/"+item.replace("\\","/")
    return built

def migrate_server(source):
    if "const GAME_CONTENT=require('./content/packs/'" not in source:
        before="const root = path.join(__dirname, 'public');"
        addition="""
const packId=require('./content/active.json').active;
if(!/^[a-z0-9_-]+$/.test(packId))throw Error('Invalid active content pack');
const GAME_CONTENT=require('./content/packs/'+packId+'/pack.json');
"""
        source=once(source,before,before+"\n"+addition,"server pack selector")
        source=subs(source,
            r"const roleNames = \{[^;]*\};",
            "const roleNames=Object.fromEntries(Object.entries(GAME_CONTENT.characters).map(([id,data])=>[id,data.name]));",
            "server role names")
        source=subs(source,
            r"const COLLISION_LINES = \{[\s\S]*?\n\};",
            "const COLLISION_LINES=Object.fromEntries(Object.entries(GAME_CONTENT.characters).map(([id,data])=>[id,data.collision||[]]));",
            "server collision quotes")
        source=once(source,"'/piece-color-test.html':'piece-color-test.html'",
            "'/piece-color-test.html':'piece-color-test.html','/content-pack.js':'content-pack.js'",
            "online pack JS route")
        source=once(source,
            "    const name=known[url.pathname];if(!name)fail('页面不存在',404);",
            """    // Expose only artwork files referenced by the active content pack.
    const artRefs=[...Object.values(GAME_CONTENT.characters).map(c=>c.pieceImage),...Object.values(GAME_CONTENT.art||{})].filter(v=>typeof v==='string'&&v.startsWith('assets/'));
    for(const asset of artRefs){
      const rel='content/assets/'+packId+'/'+asset;
      known['/'+rel]=rel;
    }
    const name=known[url.pathname];if(!name)fail('页面不存在',404);""",
            "server asset allowlist")
        source=once(source,
            "name.endsWith('.png')?'image/png':'image/svg+xml'",
            "name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')||name.endsWith('.jpeg')?'image/jpeg':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'image/svg+xml'",
            "server asset MIME")
    return source

def migrate_client(source,offline=False):
    if "const GAME_CONTENT=globalThis.GAME_CONTENT;" not in source:
        source=once(source,
            "const $ = id => document.getElementById(id);",
            "const $ = id => document.getElementById(id);\nconst GAME_CONTENT=globalThis.GAME_CONTENT;",
            "client pack")
        source=subs(source,
            r"const ROLE_INFO=\{[\s\S]*?\n\};",
            "const ROLE_INFO=GAME_CONTENT.characters;",
            "client roles")
        source=subs(source,
            r"const COLOR=\[[\s\S]*?\n\];",
            """const COLOR=[
 {name:GAME_CONTENT.teams[0].name,key:'blue',hex:GAME_CONTENT.teams[0].ui,start:39,base:[10,678]},
 {name:GAME_CONTENT.teams[1].name,key:'yellow',hex:GAME_CONTENT.teams[1].ui,start:26,base:[690,678]},
 {name:GAME_CONTENT.teams[2].name,key:'green',hex:GAME_CONTENT.teams[2].ui,start:0,base:[10,22]},
 {name:GAME_CONTENT.teams[3].name,key:'red',hex:GAME_CONTENT.teams[3].ui,start:13,base:[690,22]}
];""",
            "client team indicators")
        source=subs(source,
            r"const PIECE_COLORS=\[[\s\S]*?\n\];",
            "const PIECE_COLORS=GAME_CONTENT.teams.map(team=>({base:team.base,edge:team.edge}));",
            "client token palette")
        source=once(source,
            "const packed=count>1, hasPopoya=pack.some(item=>item.p.role==='E');",
            "const packed=count>1, hasPopoya=pack.some(item=>Boolean(ROLE_INFO[item.p.role]?.pieceImage));",
            "client stack artwork detection")
        source=once(source,
            "  const compactRadius=p.role==='E'?Math.min(20,Math.round(restSize*.34)):17;",
            "  const hasArt=Boolean(ROLE_INFO[p.role]?.pieceImage);\n  const compactRadius=hasArt?Math.min(20,Math.round(restSize*.34)):17;",
            "client artwork sizing")
        source=once(source,
            "  const border=p.role==='E'?(movingPiece?3.2/scale:packed?2.8:3.2):(movingPiece?5/scale:packed?3.5:5);",
            "  const border=hasArt?(movingPiece?3.2/scale:packed?2.8:3.2):(movingPiece?5/scale:packed?3.5:5);",
            "client art border")
        source=once(source,
            "  if(p.role==='E'){",
            "  if(hasArt){",
            "client generic PNG rendering")
        if offline:
            source=once(source,"href:POPOYA_PNG,","href:ROLE_INFO[p.role].pieceImage,","offline art")
        else:
            source=subs(source,
                r"href:'/assets/popoya-original\.png\?v=[^']+',",
                "href:ROLE_INFO[p.role].pieceImage,",
                "online art")
        insert="""
function applyPackUI(){
 const ui=GAME_CONTENT.ui||{},art=GAME_CONTENT.art||{};
 document.title=ui.documentTitle||GAME_CONTENT.title||document.title;
 for(const [selector,value] of [
  ['#welcome .titleblock h1',ui.welcomeTitle||GAME_CONTENT.title],
  ['#welcome .titleblock p',ui.welcomeSubtitle],
  ['#game .nav strong',ui.gameTitle||GAME_CONTENT.title],
  ['#welcome .intro .sub',ui.welcomeDescription]
 ]){
  const el=document.querySelector(selector);
  if(el&&value)el.textContent=value;
 }
 const board=document.querySelector('.boardart');if(board&&art.board)board.src=art.board;
 const download=document.querySelector('a[download]');if(download&&ui.downloadName)download.download=ui.downloadName;
 const result=document.querySelector('.art-placeholder');
 if(result&&art.resultImage){
  result.replaceChildren();
  result.style.background='center / contain no-repeat url("'+art.resultImage+'")';
  result.setAttribute('aria-label','结算插图');
 }
 if(art.backgroundImage)document.body.style.backgroundImage='url("'+art.backgroundImage+'")';
 if(art.logoImage){
  const h=document.querySelector('#welcome .titleblock h1');
  if(h){const logo=document.createElement('img');logo.src=art.logoImage;logo.alt=ui.welcomeTitle||GAME_CONTENT.title;logo.style.cssText='max-width:100%;max-height:135px;object-fit:contain';h.replaceChildren(logo);}
 }
 if(art.uiCss){const css=document.createElement('link');css.rel='stylesheet';css.href=art.uiCss;document.head.appendChild(css);}
 for(const [name,value] of Object.entries(GAME_CONTENT.theme||{})){
  if(/^--[a-z0-9-]+$/.test(name)&&typeof value==='string')document.documentElement.style.setProperty(name,value);
 }
}
applyPackUI();
"""
        source=once(source,
            "const ROLE_INFO=GAME_CONTENT.characters;",
            "const ROLE_INFO=GAME_CONTENT.characters;\n"+insert,
            "client dynamic theme and UI")
        if offline:
            source=subs(source,r"const POPOYA_PNG='data:image/png;base64,[a-zA-Z0-9+/=]+';\n","", "remove old offline PNG constant")
    return source

def migrate_html(source,offline=False):
    if offline:
        # The self-contained offline HTML receives a generated inline JSON pack.
        source=re.sub(r'<script id="content-pack-data">[\s\S]*?</script>\s*','',source,count=1)
        return source
    if '<script src="/content-pack.js" defer></script>' not in source:
        source=once(source,'<script src="/app.js" defer></script>',
            '<script src="/content-pack.js" defer></script><script src="/app.js" defer></script>',
            "load online content pack first")
    return source

def generate():
    parser=argparse.ArgumentParser()
    parser.add_argument('--use',help='Switch active pack before building; e.g. example or oc')
    a=parser.parse_args()
    activeFile=CONTENT/"active.json"
    active=json.loads(activeFile.read_text(encoding="utf-8"))
    if a.use:
        if not ALLOWED.fullmatch(a.use):raise ValueError("Unsafe pack id")
        active["active"]=a.use
        file_replace(activeFile,json.dumps(active,ensure_ascii=False,indent=2)+"\n")
    id=active["active"]
    if not ALLOWED.fullmatch(id):raise ValueError("Unsafe active pack id")
    raw=json.loads((CONTENT/"packs"/id/"pack.json").read_text(encoding="utf-8"))
    validate(raw,id)
    # Seed the original PNG only once; subsequent content-pack artwork edits are not overwritten.
    if id=="oc":
        original=PUBLIC/"assets"/"popoya-original.png"
        bundled=CONTENT/"packs"/id/"assets"/"popoya-original.png"
        if original.exists() and not bundled.exists():
            bundled.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(original,bundled)
            print("mirrored original PNG bytes to content pack")
    browser=render_pack(raw,id,False)
    offline=render_pack(raw,id,True)
    file_replace(PUBLIC/"content-pack.js",
        "/* Generated from content/active.json; edit content pack JSON, not this file. */\n"+
        "globalThis.GAME_CONTENT="+json.dumps(browser,ensure_ascii=False,separators=(",",":"))+";\n")
    file_replace(ROOT/"server.js",migrate_server((ROOT/"server.js").read_text(encoding="utf-8")))
    file_replace(PUBLIC/"app.js",migrate_client((PUBLIC/"app.js").read_text(encoding="utf-8")))
    index=PUBLIC/"index.html"
    file_replace(index,migrate_html(index.read_text(encoding="utf-8")))
    single=PUBLIC/"single.html"
    html=migrate_html(single.read_text(encoding="utf-8"),offline=True)
    # Offline contains server emulation and a second, independent front-end.
    if "const GAME_CONTENT=globalThis.GAME_CONTENT;" not in html:
        html=subs(html,r"const roleNames=\{[^;]+\};",
           "const roleNames=Object.fromEntries(Object.entries(globalThis.GAME_CONTENT.characters).map(([id,data])=>[id,data.name]));",
           "offline room role names")
        html=subs(html,r"const COLLISION_LINES = \{[\s\S]*?\n\};",
           "const COLLISION_LINES=Object.fromEntries(Object.entries(globalThis.GAME_CONTENT.characters).map(([id,data])=>[id,data.collision||[]]));",
           "offline room collision lines")
        html=migrate_client(html,offline=True)
    # Keep inline JSON safe even if imported dialogue contains literal HTML script tags.
    safe_json=json.dumps(offline,ensure_ascii=False,separators=(",",":")).replace("<",r"\u003c")
    packScript='<script id="content-pack-data">globalThis.GAME_CONTENT='+safe_json+';</script>\n'
    html=once(html,"<script>\n(function(){",packScript+"<script>\n(function(){","offline pack embed")
    file_replace(single,html)
    print("Built content pack:",id,"(online + self-contained offline)")

if __name__=="__main__":generate()
