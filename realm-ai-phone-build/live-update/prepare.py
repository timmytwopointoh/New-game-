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
base='https://github.com/timmytwopointoh/New-game-/releases/download/veilforge-realm-ai-v019-language-chat-test/'
inputs={'v019-source-overlay.tar.xz':'058b8de3c00d0ea6fc8b75b5f0d545b759ce0d3d22e6d14cd2e578da38930468','VEILFORGE-Realm-AI-v0.19-Conversation-TEST.apk':'252c1e3e7c6078927b5477c04bf8645d4546606a0666edf0a5f476225de74072'}
for name,digest in inputs.items():
 dest=cache/name
 with urllib.request.urlopen(base+name,timeout=90) as src,dest.open('wb') as dst:shutil.copyfileobj(src,dst)
 if hashlib.sha256(dest.read_bytes()).hexdigest()!=digest:raise SystemExit('Verified input hash mismatch')
with tarfile.open(cache/'v019-source-overlay.tar.xz') as t:t.extractall(cache,filter='data')
# The materialized tree is disposable; original source/test branches are retained.
for folder in ['src','tests']:shutil.rmtree(root/'bedrock-agent'/folder)
shutil.copytree(cache/'v019-source-overlay',root,dirs_exist_ok=True)
with zipfile.ZipFile(cache/'VEILFORGE-Realm-AI-v0.19-Conversation-TEST.apk') as z:
 for name in z.namelist():
  if name.startswith('lib/arm64-v8a/') and name.endswith('.so'):
   target=root/'android-app/app/src/main/jniLibs/arm64-v8a'/Path(name).name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
subprocess.run([sys.executable,str(here/'integrate.py'),str(root)],check=True)
p=root/'android-app/app/build.gradle';s=p.read_text()
s=s.replace("    ndkVersion '28.2.13676358'\n",'').replace("        externalNativeBuild { cmake { cppFlags '-std=c++20 -fexceptions'; arguments '-DANDROID_STL=c++_shared' } }\n",'').replace("    externalNativeBuild { cmake { path 'CMakeLists.txt' } }\n",'')
s=s.replace("        if (!file('libnode/bin/arm64-v8a/libnode.so').exists() || !file('libnode/include/node/node.h').exists())","        if (!file('src/main/jniLibs/arm64-v8a/libnode.so').exists() || !file('src/main/jniLibs/arm64-v8a/libveilforge_bridge.so').exists())")
p.write_text(s)
print('Ready:',root)
