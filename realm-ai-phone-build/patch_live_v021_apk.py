#!/usr/bin/env python3
"""Rebuild v0.22 from the verified signed v0.21 public APK and current Java DEX."""
from pathlib import Path
import hashlib, shutil, struct, subprocess, sys, tempfile, zipfile

SOURCE_SHA = 'eb9836031c54673179c525a872a46675753397092c370fb7a571241dd6daebeb'
OLD_VERSION_NAME = '0.20-secure-updates'
NEW_VERSION_NAME = '0.21-signin-sharing'
OLD_VERSION_CODE = 200001
NEW_VERSION_CODE = 200002
ANDROID = 'http://schemas.android.com/apk/res/android'

source_apk, dex_path, output_apk = map(Path, sys.argv[1:])
source = source_apk.read_bytes()
if hashlib.sha256(source).hexdigest() != SOURCE_SHA:
    raise SystemExit('Input is not the published v0.21 APK.')
if output_apk.resolve() == source_apk.resolve():
    raise SystemExit('Use a separate output APK path.')

def read_len8(data, at):
    value = data[at]
    if value & 0x80:
        return ((value & 0x7f) << 8) | data[at+1], at+2
    return value, at+1

def strings_in_pool(data, off):
    _, header, _ = struct.unpack_from('<HHI', data, off)
    count, _, flags, strings_start, _ = struct.unpack_from('<IIIII', data, off+8)
    utf8 = bool(flags & 0x100)
    values = []
    for i in range(count):
        rel = struct.unpack_from('<I', data, off+header+i*4)[0]
        pos = off+strings_start+rel
        if utf8:
            _, pos = read_len8(data, pos)
            length, pos = read_len8(data, pos)
            text = data[pos:pos+length].decode('utf-8')
        else:
            length = struct.unpack_from('<H', data, pos)[0]
            pos += 2
            if length & 0x8000:
                length = ((length & 0x7fff) << 16) | struct.unpack_from('<H', data, pos)[0]
                pos += 2
            byte_length = length*2
            text = data[pos:pos+byte_length].decode('utf-16le')
        values.append((pos, length if utf8 else byte_length, text))
    return values, utf8

def patch_manifest(blob):
    data = bytearray(blob)
    strings = []
    utf8 = False
    offset = 8
    while offset < len(data):
        kind, _, size = struct.unpack_from('<HHI', data, offset)
        if size < 8 or offset+size > len(data):
            raise SystemExit('Malformed binary Android manifest.')
        if kind == 0x0001:
            strings, utf8 = strings_in_pool(data, offset)
        offset += size
    indices = {text: i for i, (_, _, text) in enumerate(strings)}
    if OLD_VERSION_NAME not in indices:
        raise SystemExit('Expected v0.21 versionName not found.')
    pos, length, _ = strings[indices[OLD_VERSION_NAME]]
    encoded = NEW_VERSION_NAME.encode('utf-8' if utf8 else 'utf-16le')
    if len(encoded) != length:
        raise SystemExit('New versionName must fit the existing string-pool slot.')
    data[pos:pos+length] = encoded
    version_code = False
    offset = 8
    while offset < len(data):
        kind, _, size = struct.unpack_from('<HHI', data, offset)
        if kind == 0x0102:
            name_index = struct.unpack_from('<I', data, offset+20)[0]
            if strings[name_index][2] == 'manifest':
                attr_start, attr_size, attr_count = struct.unpack_from('<HHH', data, offset+24)
                base = offset+16+attr_start
                for i in range(attr_count):
                    at = base+i*attr_size
                    ns, name, _ = struct.unpack_from('<III', data, at)
                    attr_name = strings[name][2]
                    if ns != 0xffffffff and strings[ns][2] != ANDROID:
                        continue
                    if attr_name == 'versionCode':
                        value_at = at+12
                        size_value, _, typ = struct.unpack_from('<HBB', data, value_at)
                        value_at += 4
                        if size_value != 8 or typ not in (0x10, 0x11):
                            raise SystemExit('Unexpected versionCode encoding.')
                        if struct.unpack_from('<I', data, value_at)[0] != OLD_VERSION_CODE:
                            raise SystemExit('Unexpected v0.21 source versionCode.')
                        struct.pack_into('<I', data, value_at, NEW_VERSION_CODE)
                        version_code = True
        offset += size
    if not version_code:
        raise SystemExit('Android versionCode was not found.')
    return bytes(data)

with zipfile.ZipFile(source_apk) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Base APK ZIP integrity failure.')
    manifest = patch_manifest(archive.read('AndroidManifest.xml'))

output_apk.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source_apk, output_apk)
with tempfile.TemporaryDirectory(prefix='vf-v022-patch-') as scratch:
    root = Path(scratch)
    (root/'AndroidManifest.xml').write_bytes(manifest)
    shutil.copy2(dex_path, root/'classes2.dex')
    subprocess.run(['zip', '-q', '-d', str(output_apk), 'AndroidManifest.xml', 'classes2.dex'], check=True)
    subprocess.run(['zip', '-q', str(output_apk), 'AndroidManifest.xml', 'classes2.dex'], cwd=root, check=True)

with zipfile.ZipFile(output_apk) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Patched APK ZIP integrity failure.')
    if archive.read('classes2.dex') != dex_path.read_bytes():
        raise SystemExit('Compiled Java DEX did not replace v0.21 DEX.')
print('PASS: v0.21 base APK updated with v0.22 app bytecode and version metadata.')
