#!/usr/bin/env python3
"""Rebuild the exact locally signed v0.18 test APK from public APK bytes."""
from pathlib import Path
import base64, hashlib, json, lzma, sys, zipfile

SOURCE_SHA = 'a43499d8f5a09910c64c063e099a0697c30058a596686bc7c82c1bbc4def82d2'
TARGET_SHA = '13c2969f26904d6cedd6ba524c03191217ef7aaf70dbcda2eba0260d94134eb7'

source, recipe_path, output = map(Path, sys.argv[1:])
src = source.read_bytes()
if hashlib.sha256(src).hexdigest() != SOURCE_SHA:
    raise SystemExit('Wrong public source APK')
recipe = json.loads(lzma.decompress(base64.b64decode(recipe_path.read_bytes())))
if recipe['source_sha256'] != SOURCE_SHA or recipe['target_sha256'] != TARGET_SHA:
    raise SystemExit('Recipe digest mismatch')
if output.resolve() == source.resolve():
    raise SystemExit('Use a separate output path')
with output.open('wb') as out:
    for part in recipe['parts']:
        if part[0] == 'copy':
            _, offset, length = part
            if type(offset) is not int or type(length) is not int or offset < 0 or length < 0 or offset + length > len(src):
                raise SystemExit('Invalid source slice')
            out.write(src[offset:offset + length])
        elif part[0] == 'data':
            out.write(base64.b64decode(part[1], validate=True))
        else:
            raise SystemExit('Unknown recipe operation')
if output.stat().st_size != recipe['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest() != TARGET_SHA:
    output.unlink()
    raise SystemExit('Reconstructed APK digest mismatch')
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('APK ZIP integrity failed')
print('PASS: exact signed v0.18 APK reconstructed from public bytes')
