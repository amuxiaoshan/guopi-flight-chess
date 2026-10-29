#!/usr/bin/env python3
"""Add five-tap hidden human-only role without disturbing other game mechanics.

Safe to rerun after content pack rebuild; updates online and self-contained offline.
"""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'

def once(source,from_text,to_text,label):
    count=source.count(from_text)
    if count!=1:raise RuntimeError(f'{label}: expected one match, found {count}: {from_text[:100]}')
    return source.replace(from_text,to_text,1)

def save(file,text):
    if file.read_text(encoding='utf-8')!=text:
        file.write_text(text,encoding='utf-8')
        print('Updated',file.relative_to(ROOT))
    else:print('Unchanged',file.relative_to(ROOT))

def patch_engine(source,offline=False):
    if "const SECRET_ROLE=Object.entries(GAME_CONTENT.characters)" in source:
        return source
    source=once(source,
        "const roles = ['A','B','C','D','E','F','G','H'];",
        """const roles=Object.keys(GAME_CONTENT.characters).filter(id=>!GAME_CONTENT.characters[id].secret);
const SECRET_ROLE=Object.entries(GAME_CONTENT.characters).find(([id,item])=>item.secret&&item.humanOnly)?.[0]||null;""" if not offline else
        """const roles=Object.keys(globalThis.GAME_CONTENT.characters).filter(id=>!globalThis.GAME_CONTENT.characters[id].secret);
const GAME_CONTENT=globalThis.GAME_CONTENT;
const SECRET_ROLE=Object.entries(GAME_CONTENT.characters).find(([id,item])=>item.secret&&item.humanOnly)?.[0]||null;""",
        "engine role pool")
    source=once(source,
        "viewerColor:me?me.color:null,viewerName:me?me.name:null,",
        "viewerColor:me?me.color:null,viewerName:me?me.name:null,secretUnlocked:!!me?.secretUnlocked,",
        "viewer private unlock state")
    source=once(source,
        "  if(type==='select'){",
        """  if(type==='unlock-secret'){
    if(r.phase!=='lobby'||p.kind!=='human'||!SECRET_ROLE)fail('现在无法解锁隐藏角色');
    p.secretUnlocked=true;
    publish(r);return {ok:true};
  }
  if(type==='select'){""",
        "engine secret unlock action")
    source=once(source,
        "if(typeof data.role==='string'&& (data.role==='?'||roles.includes(data.role)))p.role=data.role;",
        """if(typeof data.role==='string'){
       if(data.role===SECRET_ROLE){
         if(p.kind!=='human'||!p.secretUnlocked)fail('需要先解锁隐藏角色');
         p.role=SECRET_ROLE;
       }else if(data.role==='?'||roles.includes(data.role))p.role=data.role;
     }""",
        "engine human-only secret role selection")
    # No changes to bot validation: its allowed pool is now only the ordinary roles.
    return source

def patch_client(source,offline=False):
    if "const SECRET_ROLE=Object.entries(ROLE_INFO)" in source:
        return source
    source=once(source,
        "const ROLE=['?',...Object.keys(ROLE_INFO)];",
        """const SECRET_ROLE=Object.entries(ROLE_INFO).find(([id,info])=>info.secret&&info.humanOnly)?.[0]||null;
const ROLE=['?',...Object.keys(ROLE_INFO).filter(id=>!ROLE_INFO[id].secret)];
const humanRoleChoices=()=>state?.secretUnlocked&&SECRET_ROLE?[...ROLE,SECRET_ROLE]:ROLE;""",
        "client hide secret until unlock")
    source=once(source,
        "roleIndex=Math.max(0,ROLE.indexOf(me()?.role??'?'));",
        "roleIndex=Math.max(0,humanRoleChoices().indexOf(me()?.role??'?'));",
        "client initial role index")
    source=once(source,
        "roleIndex=Math.max(0,ROLE.indexOf(self.role));",
        "roleIndex=Math.max(0,humanRoleChoices().indexOf(self.role));",
        "client lobby role index")
    source=once(source,
        """function changeRole(delta){if(!state||state.phase!=='lobby')return;const idx=ROLE.indexOf(me().role);const next=(idx+delta+ROLE.length)%ROLE.length;action({type:'select',role:ROLE[next]});}""",
        """ let secretTapCount=0,unlockingSecret=false,secretPopupTimer=null;
 function showSecretPopup(){
  const hint=$('secretHint');if(!hint)return;
  hint.textContent='Give me five！';hint.hidden=false;
  clearTimeout(secretPopupTimer);
  secretPopupTimer=setTimeout(()=>{hint.hidden=true;},2600);
 }
 async function tapSecretQuestion(){
  if(!state||state.phase!=='lobby'||me()?.kind!=='human'||me()?.role!=='?'||!SECRET_ROLE||state.secretUnlocked)return;
  secretTapCount++;
  if(secretTapCount<5||unlockingSecret)return;
  secretTapCount=0;unlockingSecret=true;
  // Reuse the existing sound-toggle confirmation sound exactly, even when
  // goal music is muted, just as the sound toggle itself does.
  playToggleClick();
  const result=await action({type:'unlock-secret'});
  unlockingSecret=false;
  if(result)showSecretPopup();
 }
 $('myToken').addEventListener('click',tapSecretQuestion);
 $('myToken').addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&me()?.role==='?'){
   event.preventDefault();void tapSecretQuestion();
  }
 });
 function changeRole(delta){
  if(!state||state.phase!=='lobby')return;
  const options=humanRoleChoices();
  const idx=options.indexOf(me()?.role);
  const next=((idx<0?0:idx)+delta+options.length)%options.length;
  secretTapCount=0;
  action({type:'select',role:options[next]});
 }""",
        "client five clicks and role switch")
    source=once(source,
        " $('myToken').textContent=roleMark(self.role);",
        """  $('myToken').textContent=roleMark(self.role);
  $('myToken').style.cursor=self.role==='?'&&!state.secretUnlocked&&SECRET_ROLE?'pointer':'default';
  $('myToken').setAttribute('role','button');
  $('myToken').tabIndex=self.role==='?'&&!state.secretUnlocked&&SECRET_ROLE?0:-1;""",
        "client question mark interactions")
    return source

def patch_html(source):
    if 'id="secretHint"' in source: return source
    source=once(source,
        '<p id="myRole" class="center hint">随机角色</p>',
        '<p id="myRole" class="center hint">随机角色</p><div id="secretHint" class="secretHint" role="status" aria-live="polite" hidden>Give me five！</div>',
        'secret hint position below random question')
    return source

def patch_css(source):
    if '.secretHint{' in source:return source
    return source+"""
/* Subtle five-tap reward: appears under the role selector, not over gameplay. */
.secretHint{align-self:center;width:max-content;max-width:95%;font-size:13px;line-height:1.5;
  margin:1px auto 9px;padding:7px 15px;border-radius:11px;
  color:#546880;background:#f3f7fb;border:1px solid #dce8f3;
  box-shadow:0 4px 16px #637a9815;animation:secretHintAppear .2s ease-out;}
.secretHint[hidden]{display:none!important}
@keyframes secretHintAppear{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
"""

def main():
    server=ROOT/'server.js'
    client=PUBLIC/'app.js'
    offline=PUBLIC/'single.html'
    index=PUBLIC/'index.html'
    style=PUBLIC/'style.css'
    save(server,patch_engine(server.read_text(encoding='utf-8')))
    save(client,patch_client(client.read_text(encoding='utf-8')))
    save(offline,patch_client(patch_engine(patch_html(offline.read_text(encoding='utf-8')),offline=True),offline=True).replace(
        '</style></head>',
        """/* Secret unlock hint matches the online styling. */
.secretHint{align-self:center;width:max-content;max-width:95%;font-size:13px;line-height:1.5;margin:1px auto 9px;padding:7px 15px;border-radius:11px;color:#546880;background:#f3f7fb;border:1px solid #dce8f3;box-shadow:0 4px 16px #637a9815;animation:secretHintAppear .2s ease-out}
.secretHint[hidden]{display:none!important}
@keyframes secretHintAppear{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
</style></head>""",1) if '.secretHint{' not in offline.read_text(encoding='utf-8') else patch_client(patch_engine(patch_html(offline.read_text(encoding='utf-8')),offline=True),offline=True))
    save(index,patch_html(index.read_text(encoding='utf-8')))
    save(style,patch_css(style.read_text(encoding='utf-8')))
    print("Easter role configured: five question-mark taps, toggle sound, human-only final role")

if __name__=='__main__':main()
