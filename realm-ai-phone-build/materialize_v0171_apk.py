#!/usr/bin/env python3
"""Reconstruct the exact, locally signed v0.17.1 APK from public APK bytes."""
from pathlib import Path
import base64, hashlib, json, lzma, sys, zipfile

SOURCE_SHA = '8c79153068e9c758944939dbca1747c648c597b0a24a941aa36fe27b688ea466'
TARGET_SHA = '3cf33b6f035d1867da3a11f1a3e9bc1fff8edd9903a7293560df1b552df210ed'

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
with zipfile.ZipFile(output) as z:
    if z.testzip() is not None:
        raise SystemExit('APK ZIP integrity failed')
print('PASS: public source, exact signed v0.17.1 target digest and APK ZIP integrity')
