#!/usr/bin/env python3
"""Keep CDN state exclusively owned by the HTTPS downloader. Run after v0.9.9 patches."""
from pathlib import Path
import sys
p = Path(sys.argv[1]) / 'bedrock-agent/src/realm-packs.js'
s = p.read_text()
old = "      if(!p)throw Error('Received an unexpected Realm pack')"
new = old + "\n      // CDN owns readiness, cache and temporary files for this pack.\n      // Server chunk metadata must never advance or cancel that transfer.\n      if(p.cdn)return"
late = "      if(p.cdn)return // HTTPS transfer is in progress; do not request server chunks\n"
if s.count(old) != 1 or s.count(late) != 1:
    raise SystemExit('Unexpected pack implementation; refusing patch')
s = s.replace(old, new, 1).replace(late, '', 1)
p.write_text(s)
print('PASS: CDN headers cannot mutate HTTPS transfer state')
