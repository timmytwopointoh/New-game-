// HTTPS-only bounded CDN retrieval for Bedrock Realm resource pack archives.
// No script execution or extraction; private and loopback addresses are prohibited.
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import {promises as fsp} from 'node:fs'
import crypto from 'node:crypto'
const MAX_REDIRECTS=3, DEADLINE_MS=45000
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
 let u;try{u=new URL(String(raw))}catch{throw Error('Realm pack CDN URL invalid')}
 const host=u.hostname.toLowerCase()
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!host||host.length>253||net.isIP(host)||host==='localhost'||host.endsWith('.local'))throw Error('Realm pack URL must use a public HTTPS host')
 return u
}
export async function downloadRealmCdn({url,dest,maxBytes,expectedBytes,signal,onProgress=()=>{}}){
 let current=checkCdnUrl(url),redirects=0
 for(;;){
  const result=await new Promise((resolve,reject)=>{
   const lookup=(host,opts,cb)=>dns.lookup(host,{all:true},(err,list)=>{
    if(err)return cb(err)
    const safe=(list||[]).filter(x=>isPublic(x.address))
    if(!safe.length)return cb(Error('Realm CDN has no public network address'))
    const address=safe.find(x=>x.family===4)||safe[0]
    cb(null,address.address,address.family)
   })
   const req=https.get(current,{lookup,timeout:DEADLINE_MS,headers:{accept:'application/octet-stream','accept-encoding':'identity'}},async res=>{
    const status=res.statusCode||0
    if([301,302,303,307,308].includes(status)){
     const next=res.headers.location;res.resume()
     if(!next)return reject(Error('CDN redirect missing location'))
     return resolve({redirect:new URL(next,current).href})
    }
    if(status!==200){res.resume();return reject(Error('CDN returned HTTP '+status))}
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.resume();return reject(Error('Compressed CDN response is not supported'))}
    const stated=Number(res.headers['content-length']||0)
    if(stated&&(stated>maxBytes||expectedBytes&&stated!==expectedBytes)){res.resume();return reject(Error('CDN pack response length mismatch'))}
    let count=0, fd;const digest=crypto.createHash('sha256')
    try{
     fd=await fsp.open(dest,'w',0o600)
     for await(const part of res){
      if(signal?.aborted)throw Error('CDN transfer canceled')
      count+=part.length
      if(count>maxBytes||expectedBytes&&count>expectedBytes)throw Error('CDN pack exceeds permitted size')
      let offset=0
      while(offset<part.length){const r=await fd.write(part,offset,part.length-offset);if(r.bytesWritten<=0)throw Error('Local CDN pack write failed');offset+=r.bytesWritten}
      digest.update(part);onProgress(count)
     }
     if(expectedBytes&&count!==expectedBytes)throw Error('CDN pack download incomplete')
     resolve({bytes:count,sha256:digest.digest('hex')})
    }catch(e){reject(e)}finally{await fd?.close().catch(()=>{})}
   })
   req.on('timeout',()=>req.destroy(Error('CDN timed out')))
   req.on('error',reject)
   if(signal){if(signal.aborted)req.destroy(Error('CDN transfer canceled'));else signal.addEventListener('abort',()=>req.destroy(Error('CDN transfer canceled')),{once:true})}
  })
  if(result.redirect){if(++redirects>MAX_REDIRECTS)throw Error('Too many CDN redirects');current=checkCdnUrl(result.redirect);continue}
  return result
 }
}
