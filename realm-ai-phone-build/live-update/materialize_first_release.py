#!/usr/bin/env python3
"""Deliver exact public, already-signed APK bytes. Contains no signing secrets."""
from pathlib import Path
import base64,hashlib,json,lzma,sys,zipfile
source,output=map(Path,sys.argv[1:]);here=Path(__file__).resolve().parent
if output.exists():raise SystemExit('Refusing to overwrite an existing APK')
a=source.read_bytes();expected=json.loads((here/'first-release-verification.json').read_text())['sha256']
if hashlib.sha256(a).hexdigest()!='252c1e3e7c6078927b5477c04bf8645d4546606a0666edf0a5f476225de74072':raise SystemExit('Wrong original v019 APK')
r=json.loads(lzma.decompress(base64.b64decode((here/'first-release-recipe.json.xz.b64').read_bytes())))
if r['source_sha256']!=hashlib.sha256(a).hexdigest() or r['target_sha256']!=expected or r['target_bytes']>256*1024*1024:raise SystemExit('Recipe identity rejected')
try:
 with output.open('xb') as f:
  for part in r['parts']:
   if part[0]=='copy':
    _,offset,length=part
    if type(offset)!=int or type(length)!=int or offset<0 or length<0 or offset+length>len(a):raise ValueError('Invalid source slice')
    f.write(a[offset:offset+length])
   elif part[0]=='data':f.write(base64.b64decode(part[1],validate=True))
   else:raise ValueError('Unknown recipe operation')
   if f.tell()>r['target_bytes']:raise ValueError('Oversized reconstruction')
 if output.stat().st_size!=r['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest()!=expected:raise ValueError('APK digest mismatch')
 with zipfile.ZipFile(output) as z:
  if z.testzip() is not None:raise ValueError('ZIP integrity failed')
except Exception:
 output.unlink(missing_ok=True);raise
print('Verified original input, exact signed APK digest and ZIP integrity; no private key used')
