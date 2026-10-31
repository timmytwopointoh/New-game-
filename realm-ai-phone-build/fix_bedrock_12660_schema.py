#!/usr/bin/env python3
"""Patch only the 1.26.60 resource-pack response enum in bundled minecraft-data.

Mojang's 2026-10-27 Bedrock 1.26.60 protocol 2225 defines:
Cancel=1, Downloading=2, DownloadingFinished=3, ResourcePackStackFinished=4.
The published PrismarineJS 1.26.60 protocol data still maps these onto 0..3.
Fail closed if the dependency's structure has changed or the patch is not needed.
"""
import json
import sys
from pathlib import Path
root=Path(sys.argv[1])
module=root/'bedrock-agent/node_modules/minecraft-data'
if not module.is_dir():
    raise SystemExit('minecraft-data dependency was not installed')
candidates=list(module.rglob('bedrock/1.26.60/protocol.json'))
if len(candidates)!=1:
    raise SystemExit(f'Expected 1 installed 1.26.60 protocol JSON, found {len(candidates)}')
p=candidates[0]
data=json.loads(p.read_text(encoding='utf8'))
try:
    packet=data['types']['packet_resource_pack_client_response']
    assert packet[0]=='container'
    field=next(t for t in packet[1] if t.get('name')=='response_status')
    assert field['type'][0]=='mapper'
    mapper=field['type'][1]
    assert mapper['type']=='varint'
    mapping=mapper['mappings']
except (KeyError,IndexError,StopIteration,TypeError,AssertionError) as e:
    raise SystemExit('Unknown 1.26.60 response packet schema; refusing unsafe patch') from e
old={'0':'refused','1':'send_packs','2':'have_all_packs','3':'completed'}
new={'1':'refused','2':'send_packs','3':'have_all_packs','4':'completed'}
if mapping==old:
    mapper['mappings']=new
    p.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False),encoding='utf8')
    print('Patched outdated Bedrock 1.26.60 response_status wire mapping 0..3 => 1..4')
elif mapping==new:
    print('Bedrock 1.26.60 protocol mapping already current')
else:
    raise SystemExit(f'Unexpected 1.26.60 enum mapping {mapping}; refusing unsafe patch')
