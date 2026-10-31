#!/usr/bin/env python3
"""Sign a Realm AI Live APK and its release notice with this app's dedicated key.
Private inputs stay outside the repo; no key/password is printed or published.
"""
import argparse,base64,hashlib,json,re,subprocess,tempfile,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--apk',type=Path,required=True);p.add_argument('--keystore',type=Path,required=True);p.add_argument('--password-file',type=Path,required=True);p.add_argument('--tools',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--url',required=True);p.add_argument('--notes',required=True)
p.add_argument('--input-aligned',action='store_true',help='Verify existing input alignment instead of creating another intermediate APK')
a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
def run(*cmd):return subprocess.run(list(map(str,cmd)),check=True,capture_output=True,text=True).stdout
if not a.url.startswith('https://github.com/timmytwopointoh/New-game-/releases/download/') or not a.url.endswith('/Realm-AI-Live.apk'):raise SystemExit('Use the dedicated GitHub release APK URL')
report=run(a.tools/'aapt','dump','badging',a.apk)
m=re.search(r"package: name='([^']+)' versionCode='(\d+)'",report)
if not m or m[1]!='com.veilforge.realmagent.live':raise SystemExit('Wrong app; refusing to sign another app')
version=int(m[2]);aligned=a.apk if a.input_aligned else a.output/'aligned-unsigned.apk';signed=a.output/'Realm-AI-Live.apk'
if signed.exists():raise SystemExit('Choose a fresh output directory; existing release is never overwritten')
if a.input_aligned:run(a.tools/'zipalign','-c','-P','16','4',aligned)
else:run(a.tools/'zipalign','-f','-P','16','4',a.apk,aligned)
run(a.tools/'apksigner','sign','--ks',a.keystore,'--ks-key-alias','realm-live-update','--ks-pass','file:'+str(a.password_file),'--out',signed,aligned)
certReport=run(a.tools/'apksigner','verify','--verbose','--print-certs',signed)
run(a.tools/'zipalign','-c','-P','16','4',signed)
cert=re.search(r'Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)',certReport)[1].upper()
expected=(Path(__file__).parent/'certificate-sha256.txt').read_text().strip()
if cert!=expected:raise SystemExit('Dedicated Realm Live certificate mismatch; release rejected')
now=int(time.time()*1000);data={'schema':1,'applicationId':m[1],'versionCode':version,'issuedAt':now,'expiresAt':now+7*86400000,'url':a.url,'size':signed.stat().st_size,'sha256':hashlib.sha256(signed.read_bytes()).hexdigest(),'notes':a.notes}
payload=json.dumps(data,separators=(',',':')).encode()
with tempfile.TemporaryDirectory() as d:
 d=Path(d);key=d/'key.pem';raw=d/'payload';sig=d/'signature';raw.write_bytes(payload)
 run('openssl','pkcs12','-in',a.keystore,'-passin','file:'+str(a.password_file),'-nocerts','-nodes','-out',key)
 key.chmod(0o600)
 run('openssl','dgst','-sha256','-sign',key,'-out',sig,raw)
 envelope={'payload':base64.b64encode(payload).decode(),'signature':base64.b64encode(sig.read_bytes()).decode()}
(a.output/'release.json').write_text(json.dumps(envelope,indent=2)+'\n')
(a.output/'verification.json').write_text(json.dumps({**data,'certificateSha256':cert,'validation':'signature, package, version, alignment and archive checked; phone installation not tested'},indent=2)+'\n')
(a.output/'certificate-report.txt').write_text(certReport)
if not a.input_aligned:aligned.unlink()
print('Signed separate Realm AI Live release; manifest created; private key not exported')
