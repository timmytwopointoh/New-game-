#!/usr/bin/env python3
"""Overlay Bedrock chunk-transfer pack support into inspected v0.9.2 source."""
from pathlib import Path
import sys
root=Path(sys.argv[1]); conn=root/'bedrock-agent/src/connection.js'; ui=root/'android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java'
s=conn.read_text(encoding='utf8')
def exactly_replace(content,old,new):
    if content.count(old)!=1: raise RuntimeError('Source mismatch: '+old[:80])
    return content.replace(old,new,1)
s=exactly_replace(s,"import {root} from '../tools/config.js'","import {root} from '../tools/config.js'\nimport {attachRealmPacks} from './realm-packs.js'\nimport path from 'node:path'")
s=exactly_replace(s,"this.username='';this.authChallenge=null;this.authState='starting';this.lastError='';", "this.username='';this.authChallenge=null;this.authState='starting';this.packStatus={stage:'not-reached',message:'Pack stage not reached',done:0,total:0};this.lastError='';")
s=exactly_replace(s,"lastError:this.lastError,authState:this.authState,lastCommand:","lastError:this.lastError,authState:this.authState,packStatus:this.packStatus,lastCommand:")
s=exactly_replace(s,'    this.client=client\n', '''    this.client=client
    this.packHandler=attachRealmPacks(client,path.join(root,'private','realm-packs'),state=>{
      this.packStatus=state
      if(state.stage==='pack-error'){
        this.authState='error'
        this.lastError='Resource pack: '+state.message
        this.log('Resource pack transfer failed: '+state.message)
      }else if(state.stage==='packs-ready'){
        this.joined=true;this.authState='packs-ready'
        this.log('Resource pack handshake completed; waiting for the Minecraft spawn event.')
      }else{
        this.authState=state.stage
        this.log('Realm pack stage: '+state.message)
      }
    })
''')
s=exactly_replace(s,"client.on('join',()=>{this.authChallenge=null;this.authState='joined';this.joined=true;this.log('Bedrock game joined; waiting for spawn.')})", "client.on('join',()=>{this.authChallenge=null;this.authState='negotiating-packs';this.log('Bedrock handshake accepted; negotiating required Realm packs.')})")
s=exactly_replace(s,'  close(){try{this.client?.close()}catch(_){} }','  close(){try{this.packHandler?.cleanup();this.client?.close()}catch(_){} }')
conn.write_text(s,encoding='utf8')
s=ui.read_text(encoding='utf8')
s=exactly_replace(s,'        String err=r.optString("lastError","").trim();','''        String err=r.optString("lastError","").trim();
        JSONObject pack=r.optJSONObject("packStatus");
        String packStage=pack==null?"":pack.optString("stage","");''')
s=exactly_replace(s,'        else if(r.optBoolean("joined"))connection.setText("Joined Realm • waiting to spawn");','''        else if("pack-request".equals(packStage)||"downloading-packs".equals(packStage)||"pack-cached".equals(packStage))
            connection.setText("Realm resource packs: "+pack.optInt("done")+"/"+pack.optInt("total")+" verified");
        else if("packs-ready".equals(packStage))connection.setText("Realm packs ready • waiting to spawn");
        else if("negotiating-packs".equals(phase))connection.setText("Minecraft handshake • checking required packs");
        else if(r.optBoolean("joined"))connection.setText("Joined Realm • waiting to spawn");''')
ui.write_text(s,encoding='utf8')
print('v0.9.3: Bedrock pack request/chunk/hash/cache handshake added; errors visible')
