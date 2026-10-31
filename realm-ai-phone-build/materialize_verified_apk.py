#!/usr/bin/env python3
"""Reconstruct a publicly signed APK; no signing keys or passwords are involved."""
from pathlib import Path
import base64,hashlib,json,lzma,sys,zipfile
source,recipe_path,output=map(Path,sys.argv[1:])
SOURCE_SHA='663c57dcf2ddd315448288f7983a1322851329421f396d356425db2038a39173' # populated below from the verified original build artifact
TARGET_SHA='1afea4471d159a8dbdd122c8b9c33be26980127384a48a9e7661d608c2923b54'
a=source.read_bytes()
if hashlib.sha256(a).hexdigest()!=SOURCE_SHA: raise SystemExit('Wrong original APK')
r=json.loads(lzma.decompress(base64.b64decode(recipe_path.read_bytes(),validate=False)))
if r['source_sha256']!=SOURCE_SHA or r['target_sha256']!=TARGET_SHA: raise SystemExit('Recipe digest mismatch')
with output.open('wb') as f:
 for part in r['parts']:
  if part[0]=='copy':
   _,offset,length=part
   if not isinstance(offset,int) or not isinstance(length,int) or offset<0 or length<0 or offset+length>len(a): raise SystemExit('Invalid source slice')
   f.write(a[offset:offset+length])
  elif part[0]=='data': f.write(base64.b64decode(part[1],validate=True))
  else: raise SystemExit('Unknown recipe operation')
if output.stat().st_size!=r['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest()!=TARGET_SHA:
 output.unlink();raise SystemExit('Reconstructed APK digest mismatch')
with zipfile.ZipFile(output) as z:
 if z.testzip() is not None: raise SystemExit('APK ZIP integrity failed')
print('PASS: original APK digest, reconstructed APK digest, and ZIP integrity')
