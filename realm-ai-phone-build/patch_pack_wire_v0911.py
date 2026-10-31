#!/usr/bin/env python3
"""Repair variant discriminants and response text, not legacy enum values.
Independent reference: Sandertv/gophertunnel minecraft/protocol/packet/resource_pack_client_response.go.
Run after the historical 1..4 schema patch and CDN ownership patch.
"""
from pathlib import Path
import json,sys
base=Path(sys.argv[1]); matches=list((base/'bedrock-agent/node_modules/minecraft-data').rglob('bedrock/1.26.60/protocol.json'))
if len(matches)!=1: raise SystemExit('Expected one 1.26.60 schema')
p=matches[0]; data=json.loads(p.read_text())
f=next(x for x in data['types']['packet_resource_pack_client_response'][1] if x['name']=='response_status')
old={'1':'refused','2':'send_packs','3':'have_all_packs','4':'completed'}
new={'0':'refused','1':'send_packs','2':'have_all_packs','3':'completed'}
if f['type'][1]['mappings'] not in (old,new): raise SystemExit('Unexpected response schema')
f['type'][1]['mappings']=new
p.write_text(json.dumps(data,separators=(',',':')))
p=base/'bedrock-agent/src/realm-packs.js';s=p.read_text()
for a,b in [("refused:'Cancel'","refused:'cancel'"),("send_packs:'Downloading'","send_packs:'downloading'"),("have_all_packs:'DownloadingFinished'","have_all_packs:'downloadingfinished'"),("completed:'ResourcePackStackFinished'","completed:'resourcepackstackfinished'")]:
 if s.count(a)!=1: raise SystemExit('Unexpected response text: '+a)
 s=s.replace(a,b)
s=s.replace('// Mojang 1.26.60: Cancel/Downloading/DownloadingFinished/ResourcePackStackFinished.', '// Variant tags are 0..3; wire response strings are lowercase (Gophertunnel reference).')
p.write_text(s)
print('Pack response variant tags restored to 0..3, lowercase wire names')
