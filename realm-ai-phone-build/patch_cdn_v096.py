#!/usr/bin/env python3
"""v0.9.6 CDN packs + refresh embedded code on APK version changes without removing OAuth cache."""
from pathlib import Path
import sys
base=Path(sys.argv[1]); packs=base/'bedrock-agent/src/realm-packs.js'
java=base/'android-app/app/src/main/java/com/veilforge/realmagent/BotService.java'
source=Path(__file__).with_name('v096-cdn-download.js')
dest=base/'bedrock-agent/src/cdn-download.js'
dest.write_bytes(source.read_bytes())
s=packs.read_text(encoding='utf8')
def rep(old,new):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f'v096 Realm pack source mismatch ({n}): {old[:90]}')
 s=s.replace(old,new,1)
rep("import crypto from 'node:crypto'","import crypto from 'node:crypto'\nimport {downloadRealmCdn,checkCdnUrl} from './cdn-download.js'")
rep("const MAX_PACK_BYTES = 64 * 1024 * 1024","const MAX_PACK_BYTES = 192 * 1024 * 1024")
rep("const MAX_TOTAL_BYTES = 256 * 1024 * 1024","const MAX_TOTAL_BYTES = 512 * 1024 * 1024")
rep("export function attachRealmPacks(client, cacheDir, report = () => {}) {","export function attachRealmPacks(client, cacheDir, report = () => {}, {downloadCdn=downloadRealmCdn} = {}) {")
rep("  let totalBytes=0","  let totalBytes=0\n  const cancellation = new AbortController()")
rep("    failed=true\n    for","    failed=true\n    cancellation.abort()\n    for")
rep("if(totalBytes>MAX_TOTAL_BYTES)throw Error('Realm packs exceed 256MB download limit')","if(totalBytes>MAX_TOTAL_BYTES)throw Error('Realm packs exceed 512MB download limit')")
rep("        packs.set(key,{key,uuid,size,basename,ready:false})","        const cdn=String(meta.cdn_url||'').trim()\n        if(cdn)checkCdnUrl(cdn)\n        packs.set(key,{key,uuid,size,basename,ready:false,cdn})")
rep("        response('send_packs',[...packs.keys()])","        response('send_packs',[...packs.keys()])\n        for(const p of packs.values())if(p.cdn)void startCdn(p)")
rep("  client.on('resource_packs_info',packet=>{",'''  async function startCdn(p){
    try{
      p.file=path.join(cacheDir,p.basename);p.tmp=p.file+'.download'
      const marker=p.file+'.sha256'
      if(fs.existsSync(p.file)&&fs.existsSync(marker)){
        const digest=fs.readFileSync(marker,'utf8').trim()
        if(fs.statSync(p.file).size===p.size&&/^[a-f0-9]{64}$/.test(digest)&&crypto.createHash('sha256').update(fs.readFileSync(p.file)).digest('hex')===digest){
          p.ready=true;emit('pack-cached','Realm CDN pack previously downloaded',0,packs.size);progress();return
        }
      }
      emit('downloading-packs','Downloading Realm pack from secure CDN',0,packs.size)
      const done=await downloadCdn({url:p.cdn,dest:p.tmp,maxBytes:MAX_PACK_BYTES,expectedBytes:p.size,signal:cancellation.signal,onProgress:bytes=>{
        if(!failed)emit('downloading-packs','Receiving Realm pack: '+Math.floor(bytes/1048576)+' MB',0,packs.size)
      }})
      if(failed||cancellation.signal.aborted)return
      if(done.bytes!==p.size||!/^[a-f0-9]{64}$/.test(done.sha256))throw Error('CDN response size or local digest invalid')
      // The digest is local-cache integrity, NOT an authenticated Mojang-supplied hash.
      fs.renameSync(p.tmp,p.file);p.tmp=null
      fs.writeFileSync(marker,done.sha256,{mode:0o600})
      p.ready=true;emit('pack-cached','CDN archive stored in private app cache',0,packs.size);progress()
    }catch(e){failure(e)}
  }
  client.on('resource_packs_info',packet=>{''')
rep("      p.fd=fs.openSync(p.tmp,'w',0o600)","      if(p.cdn)return // HTTPS transfer is in progress; do not request server chunks\n      p.fd=fs.openSync(p.tmp,'w',0o600)")
rep("  return {snapshot:()=>","  client.once('close',()=>cancellation.abort())\n  return {snapshot:()=>")
rep("cleanup:()=>{\n    for","cleanup:()=>{\n    cancellation.abort()\n    for")
packs.write_text(s,encoding='utf8')
s=java.read_text(encoding='utf8')
def rep_java(old,new):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f'v096 BotService source mismatch ({n}): {old[:90]}')
 s=s.replace(old,new,1)
rep_java('                    copyAssetTree(getAssets(), "nodejs-project", root);','''                    // Refresh bundled code once per installed APK version.
                    // Config, Xbox session and Realm packs are not part of the bundled asset tree.
                    int code = getPackageManager().getPackageInfo(getPackageName(),0).versionCode;
                    android.content.SharedPreferences prefs = getSharedPreferences("veilforge-runtime",MODE_PRIVATE);
                    boolean refresh = prefs.getInt("asset_bundle_version",-1) != code;
                    copyAssetTree(getAssets(), "nodejs-project", root, refresh);
                    if(refresh) prefs.edit().putInt("asset_bundle_version",code).commit();''')
rep_java("private static void copyAssetTree(AssetManager assets, String assetPath, File dest) throws IOException {","private static void copyAssetTree(AssetManager assets, String assetPath, File dest, boolean refresh) throws IOException {")
rep_java("            if (dest.exists()) return;","            if (dest.exists() && !refresh) return;")
rep_java('for (String name: entries) copyAssetTree(assets, assetPath + "/" + name, new File(dest, name));','for (String name: entries) copyAssetTree(assets, assetPath + "/" + name, new File(dest, name), refresh);')
java.write_text(s,encoding='utf8')
print('v0.9.6: HTTPS CDN packs + app-private cache; bundled code refreshes on APK upgrade')
