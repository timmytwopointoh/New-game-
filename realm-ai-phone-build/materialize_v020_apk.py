#!/usr/bin/env python3
"""Reconstruct the locally signed v0.20 APK from public APK bytes."""
from pathlib import Path
import base64, hashlib, json, lzma, sys, zipfile

SOURCE_SHA='252c1e3e7c6078927b5477c04bf8645d4546606a0666edf0a5f476225de74072'
TARGET_SHA='87b92b7746edf849e0d5caf69018c667190bcd9336691be02a22fa995b8a1b51'
source,recipe_path,output=map(Path,sys.argv[1:])
src=source.read_bytes()
if hashlib.sha256(src).hexdigest()!=SOURCE_SHA:raise SystemExit('Wrong public v0.19 base APK.')
recipe=json.loads(lzma.decompress(base64.b64decode(recipe_path.read_bytes())))
if recipe.get('source_sha256')!=SOURCE_SHA or recipe.get('target_sha256')!=TARGET_SHA:raise SystemExit('Public recipe digest mismatch.')
if output.resolve()==source.resolve():raise SystemExit('Use a separate output APK path.')
with output.open('wb') as out:
 for part in recipe['parts']:
  if part[0]=='copy':
   _,offset,length=part
   if type(offset)is not int or type(length)is not int or offset<0 or length<0 or offset+length>len(src):raise SystemExit('Invalid source slice.')
   out.write(src[offset:offset+length])
  elif part[0]=='data':out.write(base64.b64decode(part[1],validate=True))
  else:raise SystemExit('Unknown recipe operation.')
if output.stat().st_size!=recipe['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest()!=TARGET_SHA:
 output.unlink();raise SystemExit('Reconstructed APK digest mismatch.')
with zipfile.ZipFile(output) as archive:
 if archive.testzip() is not None:raise SystemExit('APK ZIP integrity failed.')
print('PASS: exact locally signed v0.20 APK reconstructed from public bytes.')
