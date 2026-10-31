#!/usr/bin/env python3
"""Patch Realm bot sources and version metadata into the verified public v0.19 APK."""
from pathlib import Path
import hashlib, shutil, struct, subprocess, sys, tempfile, zipfile

SOURCE_SHA = '252c1e3e7c6078927b5477c04bf8645d4546606a0666edf0a5f476225de74072'
OLD_VERSION_NAME = '0.19-language-chat'
NEW_VERSION_NAME = '0.20-language-chat'
OLD_VERSION_CODE = 100016
NEW_VERSION_CODE = 100017
ANDROID = 'http://schemas.android.com/apk/res/android'

source_apk, overlay_root, output_apk = map(Path, sys.argv[1:])
src = source_apk.read_bytes()
if hashlib.sha256(src).hexdigest() != SOURCE_SHA:
    raise SystemExit('Input is not the published v0.18 APK.')
overlay = overlay_root / 'bedrock-agent' / 'src'
mapping = {
    'assets/nodejs-project/src/api.js': overlay / 'api.js',
    'assets/nodejs-project/src/connection.js': overlay / 'connection.js',
    'assets/nodejs-project/src/conversation.js': overlay / 'conversation.js',
    'assets/nodejs-project/src/lexicon/lookup.js': overlay / 'lexicon' / 'lookup.js',
    'assets/nodejs-project/src/lexicon/english-5000.json.gz': overlay / 'lexicon' / 'english-5000.json.gz',
    'assets/nodejs-project/src/lexicon/minecraft-context.json': overlay / 'lexicon' / 'minecraft-context.json',
    'assets/nodejs-project/src/survival/catalog.js': overlay / 'survival' / 'catalog.js',
    'assets/nodejs-project/src/survival/command-vocabulary.js': overlay / 'survival' / 'command-vocabulary.js',
    'assets/nodejs-project/src/survival/controller.js': overlay / 'survival' / 'controller.js',
}
replacements = {name: path.read_bytes() for name, path in mapping.items()}

def decode_len8(data, at):
    value=data[at]
    if value & 0x80:return ((value & 0x7f) << 8) | data[at+1], at+2
    return value, at+1

def strings_in_pool(data, off, size):
    _, header, _ = struct.unpack_from('<HHI', data, off)
    count, _, flags, strings_start, _ = struct.unpack_from('<IIIII', data, off+8)
    utf8=bool(flags & 0x100)
    values=[]
    for i in range(count):
        rel=struct.unpack_from('<I',data,off+header+i*4)[0]
        pos=off+strings_start+rel
        if utf8:
            _,pos=decode_len8(data,pos)
            byte_len,pos=decode_len8(data,pos)
            text=data[pos:pos+byte_len].decode('utf-8')
        else:
            char_len=struct.unpack_from('<H',data,pos)[0];pos+=2
            if char_len&0x8000:
                char_len=((char_len&0x7fff)<<16)|struct.unpack_from('<H',data,pos)[0];pos+=2
            byte_len=char_len*2;text=data[pos:pos+byte_len].decode('utf-16le')
        values.append((pos,byte_len,text))
    return values,utf8

def patch_manifest(blob):
    data=bytearray(blob);strings=[];utf8=False;offset=8
    while offset<len(data):
        kind,_,size=struct.unpack_from('<HHI',data,offset)
        if size<8 or offset+size>len(data):raise SystemExit('Malformed binary Android manifest.')
        if kind==0x0001:strings,utf8=strings_in_pool(data,offset,size)
        offset+=size
    if not strings:raise SystemExit('Android manifest has no string pool.')
    by_text={text:i for i,(_,_,text) in enumerate(strings)}
    if OLD_VERSION_NAME not in by_text:raise SystemExit('Expected v0.19 versionName not found.')
    idx=by_text[OLD_VERSION_NAME];pos,n,_=strings[idx]
    encoded=NEW_VERSION_NAME.encode('utf-8' if utf8 else 'utf-16le')
    if len(encoded)!=n:raise SystemExit('New Android versionName must fit the existing string-pool slot.')
    data[pos:pos+n]=encoded
    version_code=False
    offset=8
    while offset<len(data):
        kind,_,size=struct.unpack_from('<HHI',data,offset)
        if kind==0x0102:
            name_idx=struct.unpack_from('<I',data,offset+20)[0]
            tag=strings[name_idx][2]
            if tag=='manifest':
                attr_start,attr_size,attr_count=struct.unpack_from('<HHH',data,offset+24)
                base=offset+16+attr_start
                for i in range(attr_count):
                    at=base+i*attr_size
                    ns,name,raw=struct.unpack_from('<III',data,at)
                    attr_name=strings[name][2]
                    if ns!=0xffffffff and strings[ns][2]!=ANDROID:continue
                    if attr_name=='versionCode':
                        value_at=at+12
                        size_value,zero,typ=struct.unpack_from('<HBB',data,value_at)
                        value_at+=4
                        if size_value!=8 or typ not in (0x10,0x11):raise SystemExit('Unexpected versionCode encoding.')
                        if struct.unpack_from('<I',data,value_at)[0]!=OLD_VERSION_CODE:raise SystemExit('Unexpected v0.19 source versionCode.')
                        struct.pack_into('<I',data,value_at,NEW_VERSION_CODE);version_code=True
        offset+=size
    if not version_code:raise SystemExit('Android versionCode was not found.')
    return bytes(data)

with zipfile.ZipFile(source_apk,'r') as src_zip:
    names=set(src_zip.namelist())
    optional={'assets/nodejs-project/src/lexicon/lookup.js','assets/nodejs-project/src/lexicon/english-5000.json.gz','assets/nodejs-project/src/lexicon/minecraft-context.json'}
    for name in set(mapping)-optional:
        if name not in names:raise SystemExit(f'Missing expected v0.19 APK asset: {name}')
    manifest=patch_manifest(src_zip.read('AndroidManifest.xml'))
output_apk.parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(source_apk,output_apk)
with tempfile.TemporaryDirectory(prefix='vf-v019-patch-') as scratch:
    root=Path(scratch)
    (root/'AndroidManifest.xml').write_bytes(manifest)
    for name,payload in replacements.items():
        target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(payload)
    existing=['AndroidManifest.xml',*(name for name in mapping if name in names)]
    subprocess.run(['zip','-q','-d',str(output_apk),*existing],cwd=root,check=True)
    subprocess.run(['zip','-q',str(output_apk),'AndroidManifest.xml',*mapping.keys()],cwd=root,check=True)
with zipfile.ZipFile(output_apk) as check:
    if check.testzip() is not None:raise SystemExit('Patched APK ZIP integrity failure.')
    manifest=check.read('AndroidManifest.xml')
    assert NEW_VERSION_NAME.encode('utf-16le') in manifest
    assert check.getinfo('assets/nodejs-project/src/conversation.js')
    assert check.getinfo('assets/nodejs-project/src/survival/command-vocabulary.js')
    assert check.getinfo('assets/nodejs-project/src/lexicon/lookup.js')
    assert check.getinfo('assets/nodejs-project/src/lexicon/english-5000.json.gz')
    assert check.getinfo('assets/nodejs-project/src/lexicon/minecraft-context.json')
print('PASS: updated bot source and Android version metadata patched into public APK bytes.')
