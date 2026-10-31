#!/usr/bin/env python3
"""Reconstruct locally verified v0.15.1 APK from public APK bytes."""
from pathlib import Path
import base64,hashlib,json,lzma,sys,zipfile
source,recipe_path,output=map(Path,sys.argv[1:])
SOURCE_SHA='eb2746a9f18cf619035266124f487b8e9b4dc8853c8d0b66a95bbbc235f6e946'
TARGET_SHA='071c0551cd9fb2bbe38d531cb4ce1c815ec78cc08cccd0802ca3300df7c87db0'
a=source.read_bytes()
if hashlib.sha256(a).hexdigest()!=SOURCE_SHA:raise SystemExit('Wrong public source APK')
r=json.loads(lzma.decompress(base64.b64decode(recipe_path.read_bytes())))
if r['source_sha256']!=SOURCE_SHA or r['target_sha256']!=TARGET_SHA:raise SystemExit('Recipe digest mismatch')
if output.resolve()==source.resolve():raise SystemExit('Use separate output path')
with output.open('wb') as f:
 for part in r['parts']:
  if part[0]=='copy':
   _,offset,length=part
   if type(offset)is not int or type(length)is not int or offset<0 or length<0 or offset+length>len(a):raise SystemExit('Invalid source slice')
   f.write(a[offset:offset+length])
  elif part[0]=='data':f.write(base64.b64decode(part[1],validate=True))
  else:raise SystemExit('Unknown recipe operation')
if output.stat().st_size!=r['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest()!=TARGET_SHA:
 output.unlink();raise SystemExit('Reconstructed APK digest mismatch')
with zipfile.ZipFile(output) as z:
 if z.testzip() is not None:raise SystemExit('APK ZIP integrity failed')
print('PASS: public source, exact v0.15.1 target digest and APK ZIP integrity')
