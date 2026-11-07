'use strict';
/* This is a real headless JavaScript render-loop/simulation smoke, not a phone graphics test. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'android/app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const js=fs.readFileSync(path.join(assets,'game.js'),'utf8');
const css=fs.readFileSync(path.join(assets,'game.css'),'utf8');
const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle.kts'),'utf8');
const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
assert(!/https?:\/\//.test(html),'game must have no remote dependencies');
assert(!/fetch\(|XMLHttpRequest|import\s*\(/.test(js),'game cannot use runtime network');
assert(gradle.includes('com.veilforge.riftworld'));
assert(manifest.includes('android:screenOrientation="landscape"'));
new vm.Script(js,{filename:'game.js'});
for(const id of ['menu','hud','world','start','continue','joy','knob','strikeButton','dashButton','pulseButton','shiftButton','interactButton','pauseButton','pause','mapButton','miniMap','respawn','notifications','progress'])assert(html.includes('id="'+id+'"'),'missing control '+id);
assert(css.length>1000);
function harness(initialStore={}){
 const store={...initialStore},raf=[];
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})}, {get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
 function node(id){return {id,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setPointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:100,height:100}},getContext(){return ctx},click(){if(this.onclick)this.onclick()},textContent:'',innerHTML:'',disabled:false};}
 const nodes={};for(const m of html.matchAll(/id="([^"]+)"/g))nodes[m[1]]=node(m[1]);
 const document={getElementById:id=>nodes[id],hidden:false};
 let now=0;
 const sandbox={console,document,innerWidth:1120,innerHeight:650,devicePixelRatio:1,requestAnimationFrame:fn=>raf.push(fn),addEventListener:()=>{},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},Math,JSON,performance:{now:()=>now}};
 sandbox.window=sandbox;sandbox.window.AudioContext=class { constructor(){this.currentTime=0;this.state='running';this.destination={}}createOscillator(){return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}resume(){}};
 vm.runInNewContext(js,sandbox,{timeout:4000,filename:'game.js'});
 function tick(n=1){for(let i=0;i<n;i++){const fn=raf.shift();assert(fn,'animation loop missing');now+=16.67;fn(now)}}
 return {nodes,tick,sandbox,store};
}
const a=harness();a.tick(2);assert.equal(a.sandbox.RiftGame.debug().scene,'menu');a.nodes.start.click();a.tick(12);assert.equal(a.sandbox.RiftGame.debug().scene,'game');a.nodes.strikeButton.click();a.nodes.pulseButton.click();a.nodes.shiftButton.click();a.nodes.dashButton.click();a.tick(20);assert(a.sandbox.RiftGame.save(),'cannot save');assert(a.store['riftworld.shattered-atlas.slot1.v1'],'save key missing');a.nodes.pauseButton.click();assert.equal(a.sandbox.RiftGame.debug().scene,'pause');a.nodes.resume.click();assert.equal(a.sandbox.RiftGame.debug().scene,'game');a.nodes.mapButton.click();assert.equal(a.sandbox.RiftGame.debug().scene,'map');a.nodes.closeMap.click();
const b=harness(a.store);b.nodes.continue.click();b.tick(3);assert.equal(b.sandbox.RiftGame.debug().scene,'game','save load broken');
const portalState=JSON.parse(a.store['riftworld.shattered-atlas.slot1.v1']);portalState.player.x=10;portalState.player.y=-4;portalState.player.hp=100;const c=harness({'riftworld.shattered-atlas.slot1.v1':JSON.stringify(portalState)});c.nodes.continue.click();c.nodes.interactButton.click();c.tick(3);assert.equal(c.sandbox.RiftGame.debug().arena,true,'first portal did not enter combat arena');
console.log('RIFTCORE_TESTS_PASS: offline assets, syntax, render loop, controls, save/load, map, pause, rift portal, combat simulation');
