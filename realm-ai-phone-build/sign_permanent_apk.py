#!/usr/bin/env python3
"""Sign using an existing private backup; never generates or replaces a key.
Usage: python3 sign_permanent_apk.py apksigner.jar input.apk output.apk private-backup-dir
"""
from pathlib import Path
import re,subprocess,sys,os,base64,tempfile,atexit
jar,source,out,backup=map(Path,sys.argv[1:])
if source.resolve()==out.resolve(): raise SystemExit('Use a separate output APK')
if str(backup)=='__github_secrets__':
 required=['VF_KEYSTORE_B64','VF_PASSWORD_B64','VF_EXPECTED_CERT']
 if any(not os.environ.get(n) for n in required):
  raise SystemExit('Permanent signing secrets/fingerprint missing; configure the supplied existing-key backup first')
 tmp=tempfile.TemporaryDirectory(prefix='vf-signing-');atexit.register(tmp.cleanup);backup=Path(tmp.name)
 for filename,variable in [('realm-ai-update.p12','VF_KEYSTORE_B64'),('signing-password.txt','VF_PASSWORD_B64')]:
  p=backup/filename;p.write_bytes(base64.b64decode(os.environ[variable],validate=True));p.chmod(0o600)
 (backup/'certificate-sha256.txt').write_text(os.environ['VF_EXPECTED_CERT'])
key=backup/'realm-ai-update.p12';pw=backup/'signing-password.txt' 
pin=(backup/'certificate-sha256.txt').read_text().strip().replace(':','').upper()
if not re.fullmatch('[0-9A-F]{64}',pin): raise SystemExit('Invalid pinned certificate')
base=['java','-jar',str(jar)]
subprocess.run(base+['sign','--ks',str(key),'--ks-type','PKCS12','--ks-key-alias','realm-ai-update','--ks-pass','file:'+str(pw),'--out',str(out),str(source)],check=True)
r=subprocess.run(base+['verify','--verbose','--print-certs',str(out)],check=True,text=True,capture_output=True)
m=re.search(r'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)',r.stdout)
if not m or m.group(1).upper()!=pin:
 out.unlink(missing_ok=True)
 raise SystemExit('Signer differs from pinned key; output removed')
print('PASS: APK signature verified; permanent certificate SHA256='+pin)
