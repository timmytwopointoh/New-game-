#!/usr/bin/env python3
"""Install guarded join-503 retry shim in the npm Bedrock client after npm install.
Do not change generic Microsoft authentication or any other HTTP/API requests.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1])
installed=root/'bedrock-agent/node_modules/bedrock-protocol/src/client'
auth=installed/'auth.js'
if not auth.is_file(): raise SystemExit('Missing installed Bedrock protocol Realm authentication module')
helper=Path(__file__).with_name('realm-join-503-retry.cjs')
dest=installed/'realmJoin503Retry.js'
s=auth.read_text(encoding='utf8')
imp="const { RealmAPI } = require('prismarine-realms')"
join="  const join = await api.rest.get(`/worlds/${realm.id}/join`)"
if s.count(imp)!=1 or s.count(join)!=1:
    raise SystemExit('Unknown Realms API source: refusing unsafe retry patch')
s=s.replace(imp,imp+"\nconst { joinRealmWithRetry } = require('./realmJoin503Retry')",1)
s=s.replace(join,"  const join = await joinRealmWithRetry(() => api.rest.get(`/worlds/${realm.id}/join`), options.onRealmJoinRetry)",1)
auth.write_text(s,encoding='utf8')
dest.write_bytes(helper.read_bytes())
print('v0.9.8 installed bounded 503 retries only for Realms join API, not for authentication')
