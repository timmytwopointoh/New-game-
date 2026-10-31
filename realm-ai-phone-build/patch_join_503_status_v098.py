#!/usr/bin/env python3
"""v0.9.8: annotate 503-only /join retries while reusing cached Microsoft session."""
from pathlib import Path
import sys
root=Path(sys.argv[1])
connection=root/'bedrock-agent/src/connection.js'
java=root/'android-app/app/src/main/java/com/veilforge/realmagent/MainActivity.java'
s=connection.read_text(encoding='utf8')
old='    const client=bedrock.createClient(options)'
if s.count(old)!=1: raise RuntimeError('v0.9.7 client creation location changed')
new="""    // Only a transient 503 on /worlds/{realmId}/join is retried. We never restart Xbox login.
    options.onRealmJoinRetry=({attempt,totalAttempts,delayMs})=>{
      this.lastPhase='realm-join-retry';this.authState='realm-join-retry';this.lastError=''
      this.log('Minecraft Realm join request returned HTTP 503; retry '+(attempt+1)+'/'+totalAttempts+' in '+Math.ceil(delayMs/1000)+'s')
    }
    const client=bedrock.createClient(options)"""
s=s.replace(old,new,1)
connection.write_text(s,encoding='utf8')
s=java.read_text(encoding='utf8')
old='else if("realm-selected".equals(phase))connection.setText("Realm found • connecting to Minecraft");'
if s.count(old)!=1: raise RuntimeError('v0.9.7 Realm status branch changed')
s=s.replace(old,'else if("realm-join-retry".equals(phase))connection.setText("Minecraft Realms temporarily unavailable (503) • retrying with saved login");\n        '+old,1)
java.write_text(s,encoding='utf8')
print('v0.9.8: visible join-503 retry status, auth cache unchanged')
