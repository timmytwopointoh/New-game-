#!/usr/bin/env python3
"""Bedrock v0.9.4: preserve server-sent disconnect reason, last phase; no auth tokens."""
from pathlib import Path
import sys
root=Path(sys.argv[1])
f=root/'bedrock-agent/src/connection.js'
ui=root/'android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java'
s=f.read_text()
def rep(old,new):
 global s
 count=s.count(old)
 if count!=1:raise RuntimeError('v0.9.3 source mismatch count='+str(count)+' old='+old[:92])
 s=s.replace(old,new,1)
rep("import path from 'node:path'", """import path from 'node:path'
export function safeDisconnectMessage(packet){
  if(packet==null)return ''
  const raw=typeof packet==='string'?packet:String(packet.message||packet.reason||packet.status||'')
  return raw.replace(/[\\x00-\\x1f\\x7f]/g,' ').replace(/https?:\\/\\/\\S+/gi,'[link omitted]').trim().slice(0,180)
}
""")
rep("this.authState='starting';this.packStatus=","this.authState='starting';this.lastPhase='starting';this.packStatus=")
rep("lastError:this.lastError,authState:","lastError:this.lastError,lastPhase:this.lastPhase,authState:")
rep("this.authState='sign-in-required';this.lastError=''","this.lastPhase='sign-in-required';this.authState='sign-in-required';this.lastError=''")
rep("this.authState='realm-selecting'","this.lastPhase='realm-selecting';this.authState='realm-selecting'")
rep("this.authState='realm-selected'","this.lastPhase='realm-selected';this.authState='realm-selected'")
rep("      this.packStatus=state","      this.packStatus=state\n      if(state.stage!=='pack-error')this.lastPhase=state.stage")
rep("this.authState='authenticated';this.lastError=''","this.lastPhase='authenticated';this.authState='authenticated';this.lastError=''")
rep("this.authState='connecting';this.log('Bedrock transport connected.')","this.lastPhase='transport-connected';this.authState='connecting';this.log('Bedrock transport connected.')")
rep("this.authState='negotiating-packs';this.log('Bedrock handshake accepted","this.lastPhase='bedrock-login-accepted';this.authState='negotiating-packs';this.log('Bedrock handshake accepted")
rep("      this.spawned=true","      this.spawned=true;this.lastPhase='spawned'")
old="""    client.on('error',e=>{this.lastError=String(e.message||e).slice(0,180);this.authChallenge=null;this.authState='error';this.log('Bedrock error: '+this.lastError)})
    client.on('disconnect',e=>{this.emit('session-end');this.log('Bedrock connection disconnected');if(!this.lastError)this.lastError='Bedrock disconnected before joining Realm. Check Realm access and network.';this.authChallenge=null;this.authState='disconnected';this.connected=false;this.joined=false;this.spawned=false})
    client.on('close',()=>{this.emit('session-end');this.log('Connection closed');if(!this.lastError)this.lastError='Realm connection closed. Check access and connection details.';this.authChallenge=null;this.authState='disconnected';this.connected=false;this.joined=false;this.spawned=false})
    client.on('end',()=>{this.emit('session-end');this.log('Connection ended');if(!this.lastError)this.lastError='Realm connection ended before joining.';this.authChallenge=null;this.authState='disconnected';this.connected=false;this.joined=false})"""
new="""    const failure=(kind,packet)=>{
      const reason=safeDisconnectMessage(packet)
      if(reason&&!this.lastError)this.lastError=kind+': '+reason
      this.authChallenge=null;this.authState='error'
      if(this.lastError)this.log('Realm failed at '+this.lastPhase+': '+this.lastError)
    }
    client.on('play_status',p=>{
      const state=String(p?.status||'')
      if(state==='login_success')this.lastPhase='minecraft-login-ok'
      else if(state && state!=='player_spawn')failure('Minecraft login status',{message:state})
    })
    client.on('start_game',()=>{this.lastPhase='world-started';this.log('Minecraft start_game received; awaiting spawn.')})
    client.on('kick',p=>failure('Server rejected join',p))
    client.on('error',e=>failure('Bedrock protocol error',e))
    client.on('disconnect',p=>{
      failure('Server disconnect',p)
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
    })
    client.on('close',()=>{
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
      if(!this.lastError)this.lastError='Connection closed at '+this.lastPhase+'; no server reason was sent.'
      this.authChallenge=null;this.authState='disconnected'
    })
    client.on('end',()=>{
      this.emit('session-end');this.connected=false;this.joined=false;this.spawned=false
      if(!this.lastError)this.lastError='Connection ended at '+this.lastPhase+'; no server reason was sent.'
      this.authChallenge=null;this.authState='disconnected'
    })"""
# Accept both known v0.9.3 error-handler texts, bounded by return client.
begin=s.index("    client.on('error',")
end=s.index('    return client\n',begin)
block=s[begin:end]
assert "client.on('disconnect'" in block and "client.on('close'" in block and "client.on('end'" in block
rep(block,new+'\n')
f.write_text(s)
s=ui.read_text()
old='if(!err.isEmpty())connection.setText("Realm error: "+err);'
assert s.count(old)==1,'v0.9.3 Android UI changed'
s=s.replace(old,'if(!err.isEmpty())connection.setText("Realm error ("+r.optString("lastPhase","unknown stage")+"): "+err);',1)
ui.write_text(s)
print('v0.9.4 kick, disconnect and last-phase diagnostics installed')
