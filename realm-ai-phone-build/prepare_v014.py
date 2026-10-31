#!/usr/bin/env python3
"""Materialize retained source plus reviewed fixes. No hosted builds or signing keys."""
from pathlib import Path
import base64,hashlib,io,os,shutil,subprocess,sys,tarfile
HERE=Path(__file__).resolve().parent
out=Path(sys.argv[1]).resolve()
if out.exists():raise SystemExit('Choose a new output directory; existing source is never overwritten')
out.mkdir(parents=True)
def extract(name,destination,digest=None):
 data=base64.b64decode((HERE/(name+'.tar.xz.b64')).read_bytes())
 if digest and hashlib.sha256(data).hexdigest()!=digest:raise SystemExit('Archive checksum mismatch: '+name)
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:xz') as t:t.extractall(destination,filter='data')
extract('source-v09',out,'3f1a70bf640d9bfef51169985be871fb55c299c7cd0fe78392aba3be46b1fac5')
root=out/'veilforge_realm_v09_apk_ready';app=root/'android-app/app';agent=root/'bedrock-agent'
def run(*args,cwd=None):subprocess.run(list(map(str,args)),cwd=cwd,check=True)
def patch(name):run(sys.executable,HERE/name,root)
run(sys.executable,HERE/'patch_auth_ui.py',app/'src/main/java/com/veilforge/realmagent/MainActivity.java')
patch('patch_realm_status_v092.py')
extract('v093-pack-overlay',root,'ea9771fe3a29fbf38f196b4affd8606f276ce91cce84be86d5a5823db45b9d98')
p=root/'tools/apply-pack-support.py';p.write_text(p.read_text().replace('lastError", ""','lastError",""'))
run(sys.executable,p,root)
for name in ['patch_disconnect_v094.py','patch_pack_response_v095.py','patch_cdn_v096.py','patch_pack_wait_v097.py','patch_join_503_status_v098.py']:patch(name)
extract('v013-adaptive-overlay',root,'db22b370489101c3f9b64e8cc046031d482f9099d441d5130aab6af2cec5baf5')
run('npm','ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund',cwd=agent)
for name in ['patch_bedrock_realm_join_v098.py','patch_single_pack_owner_v099.py','fix_bedrock_12660_schema.py','patch_cdn_owner_v0910.py','patch_pack_wire_v0911.py']:patch(name)
shutil.copy2(HERE/'v0911-cdn-tests.test.js',agent/'tests/cdn-packs.test.js')
shutil.copytree(HERE/'v014-overlay',root,dirs_exist_ok=True)
assert 'versionCode 100004' in (app/'build.gradle').read_text()
# Exclude Linux native addons and duplicate non-runtime asset data from Android.
for folder in ['raknet-native','raknet-node']:
 for p in (agent/'node_modules'/folder).rglob('*.node'):p.unlink()
for p in (agent/'node_modules').rglob('*.gz'):
 if p.with_suffix('').exists():p.unlink()
shutil.rmtree(agent/'node_modules/prismarine-nbt/sample',ignore_errors=True)
print(root)
