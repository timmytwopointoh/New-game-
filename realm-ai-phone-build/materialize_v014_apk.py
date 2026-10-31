#!/usr/bin/env python3
"""Reconstruct the exact locally verified signed v0.14 APK using public bytes."""
from pathlib import Path
import base64,hashlib,json,lzma,sys,zipfile
source,recipe_path,output=map(Path,sys.argv[1:])
SOURCE_SHA='f49bc97c3a695317e238a2784b52490619abe55a0a53144a0ccba7506d7c44cf'
TARGET_SHA='9c786c9347609a4773c425c7a1c17ccf66fd6241696dd9fe8a9895a12085bbe4'
a=source.read_bytes()
if hashlib.sha256(a).hexdigest()!=SOURCE_SHA:raise SystemExit('Wrong public source APK')
r=json.loads(lzma.decompress(base64.b64decode(recipe_path.read_bytes())))
if r['source_sha256']!=SOURCE_SHA or r['target_sha256']!=TARGET_SHA:raise SystemExit('Recipe digest mismatch')
if output.resolve()==source.resolve():raise SystemExit('Use a separate output path')
with output.open('wb') as f:
 for part in r['parts']:
  if part[0]=='copy':
   _,offset,length=part
   if type(offset)!=int or type(length)!=int or offset<0 or length<0 or offset+length>len(a):raise SystemExit('Invalid source slice')
   f.write(a[offset:offset+length])
  elif part[0]=='data':f.write(base64.b64decode(part[1],validate=True))
  else:raise SystemExit('Unknown recipe operation')
if output.stat().st_size!=r['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest()!=TARGET_SHA:
 output.unlink();raise SystemExit('Reconstructed APK digest mismatch')
with zipfile.ZipFile(output) as z:
 if z.testzip() is not None:raise SystemExit('APK ZIP integrity failed')
print('PASS: public source, reconstructed target digest and APK ZIP integrity')
