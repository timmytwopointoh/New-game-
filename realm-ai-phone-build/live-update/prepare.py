#!/usr/bin/env python3
"""Reconstruct verified v019 and add updater, reusing its unchanged native APK libraries.
This entry point avoids mixing later-branch tests/assets into the v019 baseline.
Requires npm, Python, a configured Android SDK and JDK. Does not sign or publish.
"""
from pathlib import Path
import hashlib,shutil,subprocess,sys,tarfile,urllib.request,zipfile
here=Path(__file__).resolve().parent
out=Path(sys.argv[1]).resolve()
if out.exists():raise SystemExit('Choose a fresh output directory')
subprocess.run([sys.executable,str(here.parent/'prepare_v014.py'),str(out)],check=True)
root=out/'veilforge_realm_v09_apk_ready';cache=out/'verified-inputs';cache.mkdir()
base='https://github.com/timmytwopointoh/New-game-/releases/download/realm-ai-live-020-secure-updates/'
name='Realm-AI-Live.apk'
import json,base64
expected=json.loads((here/'first-release-verification.json').read_text())['sha256']
with urllib.request.urlopen(base+name,timeout=90) as src,(cache/name).open('wb') as dst:shutil.copyfileobj(src,dst)
if hashlib.sha256((cache/name).read_bytes()).hexdigest()!=expected:raise SystemExit('Pinned native baseline mismatch')
archive=base64.b64decode((here/'baseline-v019-source.tar.xz.b64').read_bytes())
if hashlib.sha256(archive).hexdigest()!='058b8de3c00d0ea6fc8b75b5f0d545b759ce0d3d22e6d14cd2e578da38930468':raise SystemExit('Source baseline mismatch')
import io
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:xz') as t:t.extractall(cache,filter='data')
# The materialized tree is disposable; original source/test branches are retained.
for folder in ['src','tests']:shutil.rmtree(root/'bedrock-agent'/folder)
shutil.copytree(cache/'v019-source-overlay',root,dirs_exist_ok=True)
with zipfile.ZipFile(cache/'Realm-AI-Live.apk') as z:
 for name in z.namelist():
  if name.startswith('lib/arm64-v8a/') and name.endswith('.so'):
   target=root/'android-app/app/src/main/jniLibs/arm64-v8a'/Path(name).name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
subprocess.run([sys.executable,str(here/'integrate.py'),str(root)],check=True)
p=root/'android-app/app/build.gradle';s=p.read_text()
s=s.replace("    ndkVersion '28.2.13676358'\n",'').replace("        externalNativeBuild { cmake { cppFlags '-std=c++20 -fexceptions'; arguments '-DANDROID_STL=c++_shared' } }\n",'').replace("    externalNativeBuild { cmake { path 'CMakeLists.txt' } }\n",'')
s=s.replace("        if (!file('libnode/bin/arm64-v8a/libnode.so').exists() || !file('libnode/include/node/node.h').exists())","        if (!file('src/main/jniLibs/arm64-v8a/libnode.so').exists() || !file('src/main/jniLibs/arm64-v8a/libveilforge_bridge.so').exists())")
p.write_text(s)
print('Ready:',root)
