#!/usr/bin/env python3
"""Recreate a publicly distributable, already-signed APK from unsigned APK + public byte recipe.
The recipe contains compressed public APK bytes only, never the private signing key/password.
This does not perform any signing or modify the APK. Fail closed on hash mismatch.
"""
import base64, hashlib, json, lzma, sys, zipfile
from pathlib import Path

if len(sys.argv)<5:
    raise SystemExit('usage: reconstruct_signed_v0398_public.py UNSIGNED.apk OUTPUT.apk RECIPE.part1 [part2...]')
src_path,out_path,*parts=map(Path,sys.argv[1:])
if not parts or src_path.resolve()==out_path.resolve():
    raise SystemExit('Missing public recipe or output equals input')
src=src_path.read_bytes()
recipe=json.loads(lzma.decompress(base64.b64decode(b''.join(p.read_bytes() for p in parts),validate=True)))
if recipe.get('schema')!=1 or hashlib.sha256(src).hexdigest()!=recipe.get('source_sha256'):
    raise SystemExit('Public APK recipe source SHA-256 mismatch')
target_sha=recipe.get('target_sha256')
size=recipe.get('target_bytes')
if not isinstance(target_sha,str) or len(target_sha)!=64 or not isinstance(size,int) or size<=0:
    raise SystemExit('Invalid signed APK target')
with out_path.open('wb') as output:
    for part in recipe['parts']:
        if part[0]=='copy' and len(part)==3:
            _,offset,length=part
            if type(offset)!=int or type(length)!=int or offset<0 or length<0 or offset+length>len(src):
                raise SystemExit('Invalid byte span')
            output.write(src[offset:offset+length])
        elif part[0]=='data' and len(part)==2:
            output.write(base64.b64decode(part[1],validate=True))
        else:
            raise SystemExit('Invalid public recipe operation')
if out_path.stat().st_size!=size or hashlib.sha256(out_path.read_bytes()).hexdigest()!=target_sha:
    out_path.unlink(missing_ok=True)
    raise SystemExit('Signed APK SHA-256 mismatch')
with zipfile.ZipFile(out_path) as apk:
    if apk.testzip() is not None:
        raise SystemExit('Invalid signed APK zip contents')
print('PASS exact signed Live APK recreated from public unsigned bytes; original keystore never used by CI')
print('SHA-256:',target_sha)
