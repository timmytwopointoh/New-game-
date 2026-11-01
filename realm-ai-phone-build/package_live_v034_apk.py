#!/usr/bin/env python3
"""Usage: base-v026.apk compiled.dex overlay-root compiled-resources.ap_ unsigned-output.apk."""
from pathlib import Path
import zipfile,hashlib,copy,struct
import sys
base,dex,root,res,output=map(Path,sys.argv[1:])
assert hashlib.sha256(base.read_bytes()).hexdigest()=='c03c155e98ba5f3ac3f6fcf9ca5f43314d7ac0ae9100d507c602f291278355fd'
mapping={'classes2.dex':dex}
for folder in ['src','tools','pack-template']:
 for f in (root/'bedrock-agent'/folder).rglob('*'):
  if f.is_file():mapping['assets/nodejs-project/'+str(f.relative_to(root/'bedrock-agent'))]=f
for name in ['package.json','package-lock.json']:
 mapping['assets/nodejs-project/'+name]=root/'bedrock-agent'/name
with zipfile.ZipFile(base) as z,zipfile.ZipFile(res) as r,zipfile.ZipFile(output,'w') as out:
 resources=set(r.namelist())
 for info in z.infolist():
  n=info.filename
  if n in resources or n in mapping or n.startswith('META-INF/') or n.startswith(('assets/nodejs-project/src/','assets/nodejs-project/tools/','assets/nodejs-project/pack-template/')):continue
  # Keep the exact compressed public runtime bytes.
  assert not info.flag_bits & 8, 'Unexpected data descriptor'
  z.fp.seek(info.header_offset);header=z.fp.read(30)
  name_len,extra_len=struct.unpack_from('<HH',header,26)
  blob=header+z.fp.read(name_len+extra_len+info.compress_size)
  kept=copy.copy(info);kept.header_offset=out.fp.tell()
  out.fp.write(blob);out.filelist.append(kept);out.NameToInfo[n]=kept
  out.start_dir=out.fp.tell();out._didModify=True
 for info in r.infolist():out.writestr(info,r.read(info.filename))
 for n,f in mapping.items():out.writestr(n,f.read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
print('Packaged current compiled resources, Java and complete runtime source; preserved verified native libraries and dependencies.')
