#!/usr/bin/env python3
"""Reconstruct the locally signed Live v0.39.2 APK using public v0.38 APK bytes."""
from pathlib import Path
import base64, hashlib, json, lzma, sys, zipfile

SOURCE_SHA = 'c95d6ee5f934fec6d6ffb77ba7c7d78ca2ae043c04ffc9b31b2b9fd5cccde02d'
source, recipe_path, output = map(Path, sys.argv[1:])
src = source.read_bytes()
if hashlib.sha256(src).hexdigest() != SOURCE_SHA:
    raise SystemExit('Wrong public Live v0.38 base APK.')
recipe = json.loads(lzma.decompress(base64.b64decode(recipe_path.read_bytes())))
target = recipe.get('target_sha256')
if recipe.get('source_sha256') != SOURCE_SHA or not isinstance(target, str):
    raise SystemExit('Public recipe digest mismatch.')
if output.resolve() == source.resolve():
    raise SystemExit('Use a separate output APK path.')
with output.open('wb') as out:
    for part in recipe['parts']:
        if part[0] == 'copy':
            _, offset, length = part
            if type(offset) is not int or type(length) is not int or offset < 0 or length < 0 or offset+length > len(src):
                raise SystemExit('Invalid source slice.')
            out.write(src[offset:offset+length])
        elif part[0] == 'data':
            out.write(base64.b64decode(part[1], validate=True))
        else:
            raise SystemExit('Unknown recipe operation.')
if output.stat().st_size != recipe['target_bytes'] or hashlib.sha256(output.read_bytes()).hexdigest() != target:
    output.unlink(missing_ok=True)
    raise SystemExit('Reconstructed APK digest mismatch.')
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('APK ZIP integrity failed.')
print('PASS: exact locally signed Live v0.39.2 APK reconstructed from public bytes.')
