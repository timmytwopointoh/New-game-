#!/usr/bin/env python3
"""Build a delta from PUBLIC APK bytes only. Never reads a keystore or password."""
import base64,hashlib,json,lzma,struct,sys,zipfile
from pathlib import Path
source,target,output=map(Path,sys.argv[1:])
a=source.read_bytes();b=target.read_bytes()
def digest(data):return hashlib.sha256(data).hexdigest()
def segments(file,data):
 with zipfile.ZipFile(file) as z:
  for entry in z.infolist():
   header=entry.header_offset
   assert data[header:header+4]==b'PK\x03\x04'
   names,extra=struct.unpack_from('<HH',data,header+26)
   start=header+30+names+extra
   yield start,entry.compress_size
known={}
for start,length in segments(source,a):
 if length>32:known.setdefault((length,digest(a[start:start+length])),start)
parts=[];cursor=0;copied=0
for start,length in segments(target,b):
 offset=known.get((length,digest(b[start:start+length])))
 if offset is None:continue
 if start>cursor:parts.append(['data',base64.b64encode(b[cursor:start]).decode()])
 parts.append(['copy',offset,length]);copied+=length;cursor=start+length
if cursor<len(b):parts.append(['data',base64.b64encode(b[cursor:]).decode()])
recipe={'source_sha256':digest(a),'target_sha256':digest(b),'target_bytes':len(b),'parts':parts}
output.write_bytes(base64.b64encode(lzma.compress(json.dumps(recipe,separators=(',',':')).encode())))
print(f'Public recipe: {output.stat().st_size} bytes; {copied}/{len(b)} target bytes reused from public source APK')
