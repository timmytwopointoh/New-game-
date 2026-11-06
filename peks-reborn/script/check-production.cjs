/* Run from this project: node script/check-production.cjs
 * Offline source contract; this is not a substitute for Android GPU/device QA.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const scriptNames=["data.js","engine.js","minigames.js","game.js"];
scriptNames.forEach(s=>{new vm.Script(read("game/"+s),{filename:s});});
const html=read("game/index.html");
assert.match(html,/PEKS/ig);
for(let name of scriptNames)assert.ok(html.includes('src="'+name+'"'),"Missing "+name+" inclusion");
for(let id of ["world","front","crewScreen","creditsScreen","miniScreen","miniStage","reportBtn","actionBtn","joystick"]){
 assert.ok(html.includes('id="'+id+'"'),"Missing markup "+id);
}
const sandbox={window:{}};
vm.runInNewContext(read("game/data.js"),sandbox);
const D=sandbox.window.PEKS_DATA;
assert.equal(D.name,"Peks Plunder");
assert.equal(D.crew.length,19);
assert.equal(new Set(D.crew.map(x=>x.id)).size,19);
assert.equal(D.crew.filter(x=>!x.locked).length,13);
assert.deepEqual(Array.from(D.crew.slice(-6).map(x=>x.id)),["tim","tera","plan","eddie","jimothy","spooderman"]);
assert.equal(D.crew.find(x=>x.id==="eddie").coinMult,2);
assert.equal(D.crew.find(x=>x.id==="jimothy").coinMult,3);
assert.equal(D.crew.find(x=>x.id==="spooderman").coinMult,3);
assert.equal(D.crew.find(x=>x.id==="jimothy").kind,"raccoon");
assert.equal(D.crew.find(x=>x.id==="waiter").coinMult,1.5);
assert.ok(D.crew.some(x=>x.id==="decor"&&x.name==="Alisa"));
for(let c of D.crew){
 assert.ok(D.circuits[c.kind],"Missing circuit "+c.id);
 assert.equal(D.circuits[c.kind].length,6,"Circuit length "+c.id);
 for(let stationId of D.circuits[c.kind])
  assert.ok(D.stations.find(x=>x.id===stationId),"Missing station "+stationId);
}
const walkableStations=D.stations.filter(s=>D.zones.some(z=>s.x>z.x&&s.x<z.x+z.w&&s.z>z.z&&s.z<z.z+z.h));
assert.equal(walkableStations.length,D.stations.length,"All stations must be within a room/deck");
// Pathfinding reachability is a quality gate, not a mere zone-membership test.
const source=read("game/game.js");
const a=source.indexOf("function walkable(x,z){");
const b=source.indexOf("function tick(",a);
assert.ok(a>=0&&b>a,"Walkable function must remain extractable");
const walkable=vm.runInNewContext(source.slice(a,b)+"\nwalkable",{D});
const SCALE=4,NX=188,NZ=144;
const startX=15,startZ=20;
assert.ok(walkable(startX,startZ),"Spawn inside walkable zone");
const seen=new Uint8Array(NX*NZ),queue=[startZ*SCALE*NX+startX*SCALE];seen[queue[0]]=1;
let head=0;
while(head<queue.length){
 const cell=queue[head++],x=cell%NX,z=Math.floor(cell/NX);
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const nx=x+dx,nz=z+dz,idx=nz*NX+nx;
  if(nx<0||nz<0||nx>=NX||nz>=NZ||seen[idx]||!walkable(nx/SCALE,nz/SCALE))continue;
  seen[idx]=1;queue.push(idx);
 }
}
for(const s of D.stations){
 assert.ok(walkable(s.x,s.z),"Station physically blocked: "+s.id);
 const sx=Math.round(s.x*SCALE),sz=Math.round(s.z*SCALE);
 assert.ok(seen[sz*NX+sx],"Station disconnected from spawn: "+s.id);
}
const manifest=read("android/app/src/main/AndroidManifest.xml");
const gradle=read("android/app/build.gradle.kts");
const activity=read("android/app/src/main/java/com/peks/plunder/rebuilt/MainActivity.java");
assert.match(manifest,/peks_crab_icon/);
assert.match(activity,/ACTION_CREATE_DOCUMENT/);
assert.match(activity,/setAllowUniversalAccessFromFileURLs\(false\)/);
assert.match(activity,/startPage = "classic"\.equals\(getIntent\(\)\.getStringExtra\("peks_preview_mode"\)\)/);
assert.match(activity,/game\.loadUrl\("file:\/\/\/android_asset\/" \+ startPage\)/);
assert.match(gradle,/applicationId = "com.peks.plunder.rebuilt"/);
assert.match(gradle,/syncPeksGame/);

/* Preservation gate: legacy gameplay remains directly playable, offline, standalone. */
const classic=read("game/classic.html");
assert.ok(classic.length>250000,"The original complete game must be bundled, not a mock placeholder");
for(const marker of ["frontMenu","frontPlay","frontContinue","function resumeSavedShift",
 "function ghostPrank","function triggerPrepLemonade","function newEddieRun",
 "function spawnCustomer","function startMini","function moveWithCollision",
 "function drawTikiDolphin","function updateCustomers","function v40StructuralWalls",
 "function drawGuestEmotion","function saveShift","function miniKind"]){
 assert.ok(classic.includes(marker),"Classic feature missing: "+marker);
}
assert.ok(classic.includes('id="rebornClassicBack"')||classic.includes("btn.id='rebornClassicBack'"),"Classic mode lacks return route");
assert.ok(html.includes('id="classicShift"'),"3D menu lacks original game entry point");
assert.ok(html.includes('id="zoomIn"')&&html.includes('id="zoomOut"'),"3D camera zoom controls missing");
const stage={
 dataset:{},innerHTML:"",handlers:{},
 addEventListener(k,f){this.handlers[k]=f;},removeEventListener(k,f){if(this.handlers[k]===f)delete this.handlers[k];},
 contains(n){return true;},querySelector(){return null;},querySelectorAll(){return [];}
};
const button={hidden:true,textContent:"",handlers:{},addEventListener(k,f){this.handlers[k]=f;},removeEventListener(k,f){if(this.handlers[k]===f)delete this.handlers[k];}};
const challengeContext={window:{},document:{elementFromPoint(){return null;}},performance:{now:()=>1000},requestAnimationFrame(){}};
vm.runInNewContext(read("game/minigames.js"),challengeContext);
let completions=0,progress=0;
const ch=challengeContext.window.PeksChallenges.create({
 kind:"raccoon",stage,button,
 onProgress(n){progress=n;},onComplete(r){completions++;assert.equal(r.rounds,6);}
});
for(let choice of ["KEEP","LEAVE","KEEP","LEAVE","KEEP","LEAVE"]){
 let element={dataset:{choice},hasAttribute:x=>x==="data-choice"};
 stage.handlers.click({target:{closest:()=>element}});
}
assert.equal(completions,1);assert.equal(progress,6);
ch.stop();assert.equal(stage.handlers.click,undefined);
console.log("PASS: JS parse, UI bindings, 19-character progression, 15 connected stations, 6-step interactive challenge, offline Android application wiring.");
