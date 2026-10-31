#!/usr/bin/env python3
"""Publish a signed notice through the configured gh identity; no secrets in feed."""
from pathlib import Path
import base64,json,subprocess,sys,urllib.parse
repo='timmytwopointoh/New-game-';branch='realm-live-update-channel'
def api(path,method='GET',data=None,optional=False):
 cmd=['gh','api','repos/'+repo+'/'+path,'--method',method]
 if data is not None:cmd+=['--input','-']
 r=subprocess.run(cmd,input=json.dumps(data) if data is not None else None,capture_output=True,text=True)
 if r.returncode:
  if optional and '404' in r.stderr:return None
  raise RuntimeError(r.stderr[:500])
 return json.loads(r.stdout) if r.stdout.strip() else None
if api('git/ref/heads/'+branch,optional=True) is None:
 repoInfo=api('');default=repoInfo['default_branch'];head=api('git/ref/heads/'+default)
 api('git/refs','POST',{'ref':'refs/heads/'+branch,'sha':head['object']['sha']})
old=api('contents/release.json?ref='+urllib.parse.quote(branch,safe=''),optional=True)
data={'message':'Publish signed Realm AI Live update notice','branch':branch,'content':base64.b64encode(Path(sys.argv[1]).read_bytes()).decode()}
if old:data['sha']=old['sha']
api('contents/release.json','PUT',data)
print('Signed update channel published; no phone access or automatic installation')
