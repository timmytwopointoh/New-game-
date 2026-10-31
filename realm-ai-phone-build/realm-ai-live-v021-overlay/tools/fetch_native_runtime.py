#!/usr/bin/env python3
from pathlib import Path
import hashlib,urllib.request,zipfile
root=Path(__file__).resolve().parents[1]
url='https://github.com/timmytwopointoh/New-game-/releases/download/realm-ai-live-020-secure-updates/Realm-AI-Live.apk'
archive=root/'native-baseline.apk'
with urllib.request.urlopen(url,timeout=120) as src,archive.open('wb') as dst:
 import shutil
 shutil.copyfileobj(src,dst)
if hashlib.sha256(archive.read_bytes()).hexdigest()!='eb9836031c54673179c525a872a46675753397092c370fb7a571241dd6daebeb':
 raise SystemExit('Native baseline checksum mismatch')
with zipfile.ZipFile(archive) as z:
 for name in z.namelist():
  if name.startswith('lib/arm64-v8a/') and name.endswith('.so'):
   target=root/'android-app/app/src/main/jniLibs/arm64-v8a'/Path(name).name
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
archive.unlink()
print('Verified native runtime prepared')
