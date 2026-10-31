#!/usr/bin/env python3
"""v0.9.7: inspect real pack timing and transport close reason, no automatic re-login.
The packet transport may close connection without an explicit Minecraft kick. Waiting
in the UI after close cannot fix it; record whether first pack data arrived before close.
"""
import sys
from pathlib import Path

root=Path(sys.argv[1])
f=root/'bedrock-agent/src/connection.js'
ui=root/'android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java'
s=f.read_text(encoding='utf8')
def one(old,new):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError('Unexpected v0.9.6 Connection source '+str(n)+': '+old[:100])
 s=s.replace(old,new,1)

one("this.packStatus={stage:",
    "this.packRequestAt=0;this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0;this.transportCloseReason='';this.packStatus={stage:")

one("lastPhase:this.lastPhase,", """lastPhase:this.lastPhase,
      packWaitSeconds:this.packRequestAt&&!this.spawned?Math.max(0,Math.floor((Date.now()-this.packRequestAt)/1000)):0,
      packHeadersReceived:this.packHeadersReceived,packChunksReceived:this.packChunksReceived,""")

one("    this.packHandler=attachRealmPacks(client", """    // These listeners run before the pack handler and record counts only.
    // Never persist pack URLs, auth data, or raw Minecraft packets to logs.
    client.on('resource_pack_data_info',()=>{this.packHeadersReceived++})
    client.on('resource_pack_chunk_data',p=>{
      this.packChunksReceived++
      this.packBytesReceived+=Math.max(0,Number(p?.payload?.length||0))
    })
    this.packHandler=attachRealmPacks(client""")

one("      this.packStatus=state", """      if(state.stage==='pack-request'){
        this.packRequestAt=Date.now()
        this.packHeadersReceived=0;this.packChunksReceived=0;this.packBytesReceived=0
      }
      this.packStatus=state""")

one("    client.on('join',()=>{", """    client.on('join',()=>{
      // The transport can close silently without a Minecraft kick packet.
      // Capture its reason BEFORE bedrock-protocol calls close().
      const transport=client.connection
      if(transport&&typeof transport.onCloseConnection==='function'&&!transport.__veilforgeCloseObserved){
        transport.__veilforgeCloseObserved=true
        const previous=transport.onCloseConnection
        transport.onCloseConnection=(reason)=>{
          const msg=safeDisconnectMessage(reason)
          if(msg){
            this.transportCloseReason=msg
            if(!this.lastError)this.lastError='Transport closed: '+msg
          }
          return previous.call(transport,reason)
        }
      }
""")

one("    client.on('close',()=>{", """    client.on('close',()=>{
      if(!this.lastError&&this.packRequestAt){
        const sec=Math.max(0,Math.round((Date.now()-this.packRequestAt)/1000))
        if(!this.packHeadersReceived&&this.packStatus?.stage==='pack-request'){
          this.lastError='Server closed '+sec+'s after pack request; no pack data was sent. This is not a slow download.'
        }else{
          this.lastError='Connection closed '+sec+'s after pack request: '+this.packHeadersReceived+' pack headers and '+this.packChunksReceived+' chunks received.'
        }
      }
""")

# Explicit safeDisconnectMessage helper was added in v0.9.4 and is imported
# here through same-file function definition, never from raw packet logging.
if "export function safeDisconnectMessage(packet)" not in s:
 raise RuntimeError("Missing v0.9.4 safeDisconnectMessage")
if "packRequestAt" not in s or "packHeadersReceived" not in s:
 raise RuntimeError("Missing v0.9.7 monitoring fields")
f.write_text(s,encoding='utf8')

s=ui.read_text(encoding='utf8')
anchor='else if("pack-request".equals(packStage)||"downloading-packs".equals(packStage)||"pack-cached".equals(packStage))'
if s.count(anchor)!=1:
 raise RuntimeError('Expected v0.9.6 Android pack progress branch once; found '+str(s.count(anchor)))
s=s.replace(anchor,'''else if("pack-request".equals(packStage))
            connection.setText("Requested Realm packs • waiting "+r.optInt("packWaitSeconds",0)+"s for server data");
        else if("downloading-packs".equals(packStage)||"pack-cached".equals(packStage))''',1)
ui.write_text(s,encoding='utf8')
print('v0.9.7: seconds + download-packet counts, network close reason, no repeated sign-ins')
