#!/usr/bin/env python3
"""Audit shipped Live source and feature parity, including files missed in v0.21."""
from pathlib import Path
import gzip,hashlib,json,sys,zipfile
apk,source,baseline=map(Path,sys.argv[1:])
with zipfile.ZipFile(apk) as z,zipfile.ZipFile(baseline) as old:
 assert z.testzip() is None
 expected={}
 for file in (source/'bedrock-agent/src').rglob('*'):
  if file.is_file():expected['assets/nodejs-project/src/'+str(file.relative_to(source/'bedrock-agent/src'))]=file
 for name,file in expected.items():assert z.read(name)==file.read_bytes(),f'Shipped source mismatch: {name}'
 unexpected={n for n in z.namelist() if n.startswith('assets/nodejs-project/src/') and not n.endswith('/')} - set(expected)
 assert not unexpected,unexpected
 options=z.read('assets/nodejs-project/src/options.js')
 assert b"authTitle:'00000000441cc96b',deviceType:'Nintendo',deviceOS:12,flow:'live'" in options
 assert b"'private','auth','switch'" in options
 assert z.read('assets/nodejs-project/package.json')==(source/'bedrock-agent/package.json').read_bytes()
 for name in old.namelist():
  if name.startswith(('lib/','assets/nodejs-project/node_modules/')):assert z.read(name)==old.read(name),f'Unexpected runtime change: {name}'
 words=json.loads(gzip.decompress(z.read('assets/nodejs-project/src/lexicon/english-5000.json.gz')))
 assert len(words['words'])==5000
 assert z.read('assets/nodejs-project/src/lexicon/ATTRIBUTION.txt')
 for name in z.namelist():
  assert not name.startswith('assets/nodejs-project/private/')
  assert name!='assets/nodejs-project/config.json'
 dex=z.read('classes2.dex')
 for token in [b'https://www.microsoft.com/link',b'Copy sign-in code',b'Share one file',b'Language and learning',b'Copy diagnostics',b'Check companion updates',b'Lcom/veilforge/realmagent/AppUpdater;',b'Lcom/veilforge/realmagent/ConnectionDiagnostics;',b'markControllerAvailable',b'Nintendo Switch']:
  assert token in dex,token
print(json.dumps({'package':'com.veilforge.realmagent.live','sourceFilesChecked':len(expected),'bundledWords':5000,'nativeAndDependencies':'byte-identical to Live v0.21','controls':'Microsoft link/copy, sharing, learning, diagnostics and Live updater present','apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest()},indent=2))
