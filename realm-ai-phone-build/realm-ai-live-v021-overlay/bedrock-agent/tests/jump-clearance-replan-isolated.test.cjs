const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
// Exercising exact production methods without installed game dependencies.
const source=fs.readFileSync(path.join(__dirname,'../src/survival/navigation.js'),'utf8')
function method(name){
 const start=source.indexOf('\n '+name+'(')
 assert(start>=0,`Missing method ${name}`)
 const open=source.indexOf('{',start),stack=[]
 for(let i=open;i<source.length;i++){
  if(source[i]==='{')stack.push(i)
  else if(source[i]==='}'&&!stack.pop())throw Error('Unbalanced method braces')
  if(!stack.length)return source.slice(start+2,i+1)
 }
 throw Error('Unterminated method')
}
const methods=['deferFlightRecovery','resumeFlightRecovery','flightStep']
const Harness=Function('key',`return class Harness { ${methods.map(method).join('\n')} }`)(p=>`${p.x},${p.y},${p.z}`)
function fixture(){
 const n=new Harness(),reports=[]
 n.world={position:{x:.5,y:65.62,z:.5},standPosition:()=>({x:0,y:64,z:0}),grounded:()=>false,terrainKnown:()=>true,clearBody:()=>false,bodyIssue:()=>null,supportHeight:()=>65,walkable:()=>true,requestNearby:()=>{}}
 n.report=m=>reports.push(m);n.note=(action,m)=>reports.push(action+': '+m)
 n.progress={reset(){}}
 n.blocked=new Map();n.job={kind:'follow',name:'Owner',goal:{x:5,y:64,z:0}}
 n.flight={target:{x:1,y:65,z:0},kind:'jump',vy:.26,started:100,first:false}
 n.afterJumpGoal={x:5,y:64,z:0};n.state='jumping';n.recoveryAttempts=0
 n.route=[{x:1,y:65,z:0}];n.routeTo=()=>({ok:true,path:[{x:0,y:64,z:0},{x:0,y:64,z:1}]})
 n.assignRoute=p=>{n.route=p.path.slice(1);n.state='walking'}
 n.stop=reason=>{n.job=null;n.state='stopped';reports.push(reason)}
 return {n,reports}
}
test('changed jump clearance defers without stopping Follow',()=>{
 const {n,reports}=fixture(),r=n.flightStep(150)
 assert.deepEqual(r.delta,{x:0,y:0,z:0});assert.equal(n.flight,null)
 assert.equal(n.job.kind,'follow');assert.equal(n.state,'landing-for-replan')
 assert(n.blocked.has('1,65,0'));assert.match(reports.join(' '),/replan/)
})
test('landing replans same Follow without a duplicate',()=>{
 const {n}=fixture();n.flightStep(150);n.world.grounded=()=>true;n.resumeFlightRecovery(300)
 assert.equal(n.job.kind,'follow');assert.equal(n.state,'walking')
 assert.equal(n.route.length,1);assert.equal(n.pendingFlightRecovery,null)
})
test('unreachable route waits safely and preserves Follow task',()=>{
 const {n}=fixture();n.flightStep(150);n.world.grounded=()=>true
 n.routeTo=()=>({ok:false,reason:'Observed wall with no passage.'})
 n.resumeFlightRecovery(300)
 assert.equal(n.job.kind,'follow');assert.equal(n.state,'blocked')
 assert.match(n.reason,/no alternate observed route/)
})
test('unverified landing stops rather than blindly moving',()=>{
 const {n}=fixture();n.flightStep(150);n.resumeFlightRecovery(5000)
 assert.equal(n.job,null);assert.equal(n.state,'stopped')
})
