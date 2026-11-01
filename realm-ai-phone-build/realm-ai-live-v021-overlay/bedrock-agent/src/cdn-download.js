// HTTPS-only bounded CDN retrieval for Bedrock Realm resource pack archives.
// Private/loopback targets are forbidden; partial archives are never executed or extracted.
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import {promises as fsp,createReadStream} from 'node:fs'
import crypto from 'node:crypto'

const MAX_REDIRECTS=3, IDLE_TIMEOUT_MS=90000
function cdnError(code,message){const e=new Error(message);e.code=code;return e}
function isPublic(ip){
 const kind=net.isIP(ip)
 if(kind===4){
  const x=ip.split('.').map(Number)
  return !(x[0]===0||x[0]===10||x[0]===127||x[0]>=224||x[0]===169&&x[1]===254||x[0]===172&&x[1]>=16&&x[1]<=31||x[0]===192&&x[1]===168||x[0]===100&&x[1]>=64&&x[1]<=127||x[0]===198&&x[1]===18)
 }
 if(kind===6){
  const s=ip.toLowerCase()
  if(s==='::'||s==='::1'||s.startsWith('fe80:')||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('ff'))return false
  return s.startsWith('::ffff:')?isPublic(s.slice(7)):true
 }
 return false
}
export function checkCdnUrl(raw){
 let u;try{u=new URL(String(raw))}catch{throw cdnError('INVALID_PACK_URL','Realm pack CDN URL invalid')}
 const host=u.hostname.toLowerCase()
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!host||host.length>253||net.isIP(host)||host==='localhost'||host.endsWith('.local'))throw cdnError('INVALID_PACK_URL','Realm pack URL must use a public HTTPS host')
 return u
}
async function hashPrefix(pathname,bytes,digest){
 if(!bytes)return
 let count=0
 for await(const chunk of createReadStream(pathname,{start:0,end:bytes-1})){
  count+=chunk.length
  digest.update(chunk)
 }
 if(count!==bytes)throw cdnError('PACK_PARTIAL_INVALID','Saved Realm pack fragment changed; retry needed')
}
// Reuse a previously downloaded fragment only if the CDN confirms the exact byte range.
// A 200 response to a Range request is a safe restart; 206 must match offset/total.
export async function downloadRealmCdn({url,dest,maxBytes,expectedBytes,signal,onProgress=()=>{},get=https.get}){
 let current=checkCdnUrl(url),redirects=0
 let resumeFrom=0
 try{
  const stat=await fsp.stat(dest)
  if(Number.isSafeInteger(stat.size)&&stat.size>0&&stat.size<expectedBytes&&stat.size<=maxBytes)resumeFrom=stat.size
 }catch(e){if(e?.code!=='ENOENT')throw e}
 for(;;){
  if(signal?.aborted)throw cdnError('PACK_CANCELLED','Realm pack download interrupted')
  const result=await new Promise((resolve,reject)=>{
   let request
   const lookup=(host,opts,cb)=>dns.lookup(host,{all:true},(err,list)=>{
    if(err)return cb(err)
    const safe=(list||[]).filter(x=>isPublic(x.address))
    if(!safe.length)return cb(cdnError('CDN_UNSAFE_ADDRESS','Realm CDN has no public address'))
    const address=safe.find(x=>x.family===4)||safe[0]
    cb(null,address.address,address.family)
   })
   const headers={accept:'application/octet-stream','accept-encoding':'identity'}
   if(resumeFrom)headers.Range='bytes='+resumeFrom+'-'
   const opts={lookup,headers}
   request=get(current,opts,async res=>{
    const status=res.statusCode||0
    if([301,302,303,307,308].includes(status)){
     const next=res.headers.location;res.resume()
     if(!next)return reject(cdnError('CDN_REDIRECT','CDN redirect missing location'))
     return resolve({redirect:new URL(next,current).href})
    }
    if(status!==200&&status!==206){res.resume();return reject(cdnError('CDN_HTTP_'+status,'Realm CDN returned HTTP '+status))}
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){
     res.resume();return reject(cdnError('CDN_BAD_RESPONSE','Compressed Realm CDN response is not supported'))
    }
    const usingPartial=status===206
    let offset=usingPartial?resumeFrom:0
    if(usingPartial){
     const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(res.headers['content-range']||''))
     if(!resumeFrom||!match||Number(match[1])!==resumeFrom||Number(match[2])<resumeFrom||Number(match[3])!==expectedBytes){
      res.resume();return reject(cdnError('CDN_RANGE_MISMATCH','Realm CDN returned an invalid resume range'))
     }
    }
    const stated=res.headers['content-length']===undefined?0:Number(res.headers['content-length'])
    const remaining=expectedBytes-offset
    if((stated&&!Number.isSafeInteger(stated))||(stated&&(stated>maxBytes-offset||stated!==remaining))){
     res.resume();return reject(cdnError('CDN_LENGTH_MISMATCH','Realm CDN response size does not match the requested pack'))
    }
    let fd
    const digest=crypto.createHash('sha256')
    try{
     // Hash a saved fragment as a stream, not a large in-memory Buffer.
     if(offset)await hashPrefix(dest,offset,digest)
     fd=await fsp.open(dest,offset?'a':'w',0o600)
     let count=offset
     onProgress(count)
     for await(const part of res){
      if(signal?.aborted)throw cdnError('PACK_CANCELLED','Realm pack download interrupted')
      count+=part.length
      if(count>maxBytes||count>expectedBytes)throw cdnError('PACK_SIZE_MISMATCH','Realm pack exceeds its declared size')
      let partOffset=0
      while(partOffset<part.length){
       const r=await fd.write(part,partOffset,part.length-partOffset)
       if(r.bytesWritten<=0)throw cdnError('PACK_WRITE_FAILED','Unable to save Realm pack to the phone')
       partOffset+=r.bytesWritten
      }
      digest.update(part);onProgress(count)
     }
     if(count!==expectedBytes)throw cdnError('PACK_INCOMPLETE','Realm CDN stopped before the complete pack was received')
     resolve({bytes:count,sha256:digest.digest('hex'),resumed:offset>0})
    }catch(e){reject(e)}finally{await fd?.close().catch(()=>{})}
   })
   request.setTimeout(IDLE_TIMEOUT_MS,()=>request.destroy(cdnError('CDN_IDLE_TIMEOUT','Realm CDN stopped sending data for 90 seconds')))
   request.on('error',reject)
   if(signal){
    const onAbort=()=>request.destroy(cdnError('PACK_CANCELLED','Realm pack download interrupted'))
    if(signal.aborted)onAbort()
    else{
     signal.addEventListener('abort',onAbort,{once:true})
     request.once('close',()=>signal.removeEventListener('abort',onAbort))
    }
   }
  })
  if(result.redirect){if(++redirects>MAX_REDIRECTS)throw cdnError('CDN_REDIRECT','Too many CDN redirects');current=checkCdnUrl(result.redirect);continue}
  return result
 }
}
