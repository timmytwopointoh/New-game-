#!/usr/bin/env python3
"""Rebuild merged Live v0.25 from the verified Live v0.24 APK, Java DEX and full source tree."""
from pathlib import Path
import hashlib, shutil, struct, subprocess, sys, tempfile, zipfile

SOURCE_SHA = 'e884df281e2e6e24765b42aaf3a2f62650612c433cd47a1c56eb3e9886e2e7a9'
OLD_VERSION_NAME = '0.24-switch-sign-in'
NEW_VERSION_NAME = '0.25-grounded-walks'
OLD_VERSION_CODE = 200005
NEW_VERSION_CODE = 200006
ANDROID = 'http://schemas.android.com/apk/res/android'

source_apk, dex_path, overlay_root, output_apk = map(Path, sys.argv[1:])
source = source_apk.read_bytes()
if hashlib.sha256(source).hexdigest() != SOURCE_SHA:
    raise SystemExit('Input is not the published v0.24 APK.')
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
        raise SystemExit('Expected v0.24 versionName not found.')
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
                            raise SystemExit('Unexpected v0.24 source versionCode.')
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
    existing_names=set(archive.namelist())

output_apk.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source_apk, output_apk)
with tempfile.TemporaryDirectory(prefix='vf-v025-patch-') as scratch:
    root = Path(scratch)
    (root/'AndroidManifest.xml').write_bytes(manifest)
    shutil.copy2(dex_path, root/'classes2.dex')
    mapping={'assets/nodejs-project/package.json':overlay_root/'bedrock-agent/package.json'}
    for file in (overlay_root/'bedrock-agent/src').rglob('*'):
        if file.is_file():mapping['assets/nodejs-project/src/'+str(file.relative_to(overlay_root/'bedrock-agent/src'))]=file
    for name,file in mapping.items():
        target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(file.read_bytes())
    subprocess.run(['zip','-q','-d',str(output_apk),'AndroidManifest.xml','classes2.dex',*[n for n in mapping if n in existing_names]],check=True)
    subprocess.run(['zip','-q',str(output_apk),'AndroidManifest.xml','classes2.dex',*mapping.keys()],cwd=root,check=True)

with zipfile.ZipFile(output_apk) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Patched APK ZIP integrity failure.')
    if archive.read('classes2.dex') != dex_path.read_bytes():
        raise SystemExit('Compiled Java DEX did not replace v0.24 DEX.')
    for name,file in mapping.items():
        if archive.read(name)!=file.read_bytes():raise SystemExit('APK source mismatch: '+name)
print('PASS: every merged Live source file, Java DEX and version metadata packaged.')
