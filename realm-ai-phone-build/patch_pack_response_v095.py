#!/usr/bin/env python3
"""Bedrock 1.26.60 server-pack handshake: correct on-wire response text.
Patch source after v0.9.3 resource pack integration, before APK stage.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1])
p=root/'bedrock-agent/src/realm-packs.js'
s=p.read_text(encoding='utf8')
old="""      response_status_name:name,"""
new="""      // Modern Bedrock's response text differs from Prismarine enum labels.
      // Mojang 1.26.60: Cancel/Downloading/DownloadingFinished/ResourcePackStackFinished.
      response_status_name:({refused:'Cancel',send_packs:'Downloading',
        have_all_packs:'DownloadingFinished',completed:'ResourcePackStackFinished'})[name]||name,"""
if s.count(old)!=1:
    raise SystemExit('Expected one resource pack response status writer; source changed')
p.write_text(s.replace(old,new,1),encoding='utf8')
print('v0.9.5: Bedrock official resource-pack response text mapped')
