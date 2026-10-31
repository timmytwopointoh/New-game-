#!/usr/bin/env python3
"""GitHub CI preparation for a 16 KB-aligned embedded mobile Node runtime.

No account tokens or Minecraft sign-ins are read here. Downloads public release
artifacts and validates their published SHA-256 before extraction.
"""
from pathlib import Path
from urllib.request import urlopen, Request
import argparse
import hashlib
import os
import shutil
import subprocess
import tempfile
import zipfile

VERSION='24.22.1-0'
NAME=f'nodejs-mobile-android-{VERSION}.zip'
BASE=f'https://github.com/fogtape/nodejs-mobile/releases/download/v{VERSION}'
MAX_DOWNLOAD=150 * 1024 * 1024
MAX_EXTRACT=700 * 1024 * 1024
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'android-app'/'app'/'libnode'

def download(url, out:Path, limit=MAX_DOWNLOAD):
    req=Request(url,headers={'User-Agent':'VEILFORGE-RealmAI-build/0.9'})
    with urlopen(req, timeout=90) as resp, out.open('wb') as file:
        total=0
        while True:
            block=resp.read(1024*1024)
            if not block:break
            total+=len(block)
            if total>limit:raise ValueError('Release download exceeded configured byte limit')
            file.write(block)
    return hashlib.sha256(out.read_bytes()).hexdigest()

def checksum_for(contents):
    matches=[]
    for line in contents.splitlines():
        items=line.strip().replace('*',' ').split()
        if len(items)==2 and items[1].strip('./')==NAME and len(items[0])==64:
            matches.append(items[0].lower())
    if len(matches)!=1:raise ValueError('Missing or duplicate exact runtime checksum')
    return matches[0]

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--ndk',default=os.environ.get('ANDROID_NDK_HOME') or os.environ.get('ANDROID_NDK_ROOT',''))
    a=p.parse_args()
    if not a.ndk:raise SystemExit('Set ANDROID_NDK_HOME to an installed Android NDK r28+')
    ndk=Path(a.ndk)
    runtime=ndk/'sources'/'cxx-stl'/'llvm-libc++'/'libs'/'arm64-v8a'/'libc++_shared.so'
    if not runtime.is_file():
        runtime=ndk/'toolchains'/'llvm'/'prebuilt'/'linux-x86_64'/'sysroot'/'usr'/'lib'/'aarch64-linux-android'/'libc++_shared.so'
    if not runtime.is_file():raise SystemExit('Could not locate Android ARM64 libc++_shared.so in NDK')
    with tempfile.TemporaryDirectory() as tmp:
        tmp=Path(tmp)
        digest=tmp/'SHA256SUMS';archive=tmp/NAME
        download(BASE+'/SHA256SUMS',digest,32768)
        expected=checksum_for(digest.read_text())
        actual=download(BASE+'/'+NAME,archive)
        if actual!=expected:raise SystemExit('STOP: Node runtime SHA-256 mismatch')
        print('Verified upstream Node mobile runtime SHA-256',actual)
        with zipfile.ZipFile(archive) as z:
            files=z.infolist()
            if sum(x.file_size for x in files)>MAX_EXTRACT:raise ValueError('Runtime archive exceeds extraction budget')
            so=[x for x in files if x.filename.endswith('/arm64-v8a/libnode.so') or x.filename=='arm64-v8a/libnode.so']
            hdr=[x for x in files if x.filename.endswith('/include/node/node.h') or x.filename=='include/node/node.h']
            if len(so)!=1 or len(hdr)!=1:raise ValueError('Unexpected runtime archive structure: missing/duplicate libnode.so or node.h')
            prefix=hdr[0].filename[:-len('node.h')]
            includes=[x for x in files if x.filename.startswith(prefix) and not x.is_dir()]
            if not includes or len(includes)>4000:raise ValueError('Invalid header manifest')
            for item in includes:
                sub=item.filename[len(prefix):]
                if '..' in Path(sub).parts or Path(sub).is_absolute():raise ValueError('Unsafe header path')
                target=OUT/'include'/'node'/sub
                target.parent.mkdir(parents=True,exist_ok=True)
                with z.open(item) as src, target.open('wb') as dst:shutil.copyfileobj(src,dst)
            libtarget=OUT/'bin'/'arm64-v8a'/'libnode.so'
            libtarget.parent.mkdir(parents=True,exist_ok=True)
            with z.open(so[0]) as src, libtarget.open('wb') as dst:shutil.copyfileobj(src,dst)
            shutil.copyfile(runtime,OUT/'bin'/'arm64-v8a'/'libc++_shared.so')
    check=ROOT/'tools'/'check_node_elf.py'
    for candidate in [OUT/'bin'/'arm64-v8a'/'libnode.so', OUT/'bin'/'arm64-v8a'/'libc++_shared.so']:
        subprocess.run(['python3',str(check),str(candidate)],check=True)
    print('Prepared verified Android ARM64 Node runtime + NDK libc++ for Gradle')

if __name__=='__main__':main()
