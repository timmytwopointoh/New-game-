#!/usr/bin/env python3
"""v0.9.9: prevent bedrock-protocol default handler from racing custom pack manager.

bedrock-protocol 3.61+ installs an automatic resource_packs_info handler that
immediately sends 'completed' and sends it again at resource_pack_stack.
VEILFORGE sends 'send_packs' and waits for verified downloads. Sending both
is contradictory and can disconnect the client.

Only remove the redundant built-in response, preserve its cache, radius and
other connection initialization. Fail if third-party library layout differs.
Run after npm install, with all earlier Realm pack patches already applied.
"""
from pathlib import Path
import sys
base=Path(sys.argv[1])
source=base/'bedrock-agent/node_modules/bedrock-protocol/src/createClient.js'
packs=base/'bedrock-agent/src/realm-packs.js'
if not source.is_file() or not packs.is_file():
    raise SystemExit('Missing Bedrock client library or VEILFORGE custom pack manager')
s=source.read_text(encoding='utf8')
start_marker="  const completeResourcePacks = () => client.write('resource_pack_client_response', {"
next_marker="    client.queue('client_cache_status', { enabled: false })"
if s.count(start_marker)!=1 or s.count(next_marker)!=1:
    raise SystemExit('Unexpected Bedrock resource pack implementation; refusing to patch')
start=s.index(start_marker)
end=s.index(next_marker,start)
section=s[start:end]
if not all([
  "response_status: 'completed'" in section,
  "client.once('resource_packs_info', () => {" in section,
  "client.once('resource_pack_stack', completeResourcePacks)" in section,
  section.count("completeResourcePacks()")==1,
  section.count("resource_pack_client_response")==1,
]):
    raise SystemExit('Unknown Bedrock default resource pack responder; refusing unsafe patch')
replacement="""  // VEILFORGE exclusive pack handshake owner:
  // src/realm-packs.js requests/downloads/verifies packs before responding.
  // Still preserve client cache status, radius, and all Bedrock initialization.
  client.once('resource_packs_info', () => {
"""
result=s[:start]+replacement+s[end:]
if "completeResourcePacks" in result:
    raise SystemExit('Automatic pack responder remains in client code; refusing patch')
if result.count("client.queue('client_cache_status', { enabled: false })")!=1:
    raise SystemExit('Minecraft cache init changed')
if result.count("client.queue('request_chunk_radius'")!=1:
    raise SystemExit('Minecraft radius init changed')
p=packs.read_text(encoding='utf8')
if p.count("client.write('resource_pack_client_response'")!=1:
    raise SystemExit('VEILFORGE pack handler not uniquely configured')
source.write_text(result,encoding='utf8')
print('PASS: one pack-handshake owner; preserved Bedrock client-cache and chunk-radius initialization')
