'use strict';
// Offline integration gate with deterministic synthetic frames and save migrations.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'android/app/src/main/assets');
const code=fs.readFileSync(path.join(assets,'game.js'),'utf8');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const gradle=fs.readFileSync(path.join(root,'android/app/build.gradle.kts'),'utf8');
assert(gradle.includes('versionCode = 2'),'must provide in-place Android upgrade');
assert(gradle.includes('com.veilforge.riftworld'),'must retain package identity');
assert(gradle.includes('RIFT_WORLD_KEYSTORE'),'must retain Rift signing identity');
for(const token of ['function blockerAt','function moveBody','function drawLandmark','function drawWarnings','function drawAtmosphere','function openSkills','function applySkill','function relicCollect','function updateEnemies','gamepadLatch','FRACTURE FURY','skillPoints','savedArena'])assert(code.includes(token),'missing major milestone system '+token);
for(const token of ['skillsButton','skill-blade','skill-sentinel','skill-rift','skillsClose','skillsScreen'])assert(html.includes(`id="${token}"`),'missing skill UI '+token);
assert(!/XMLHttpRequest|fetch\(|import\s*\(/.test(code),'offline-only game requirement');
function create(seed={}){
 let store={...seed},listeners={},raf=[],now=0;const events={};
 const gradient={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 function el(id){let l={};return {id,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener:(e,fn)=>l[e]=fn,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),getContext:()=>ctx,click(){if(this.onclick)this.onclick()},dispatch(name,obj){l[name]?.(obj)},textContent:'',innerHTML:'',disabled:false};}
 const nodes={};for(const match of html.matchAll(/id="([^"]+)"/g))nodes[match[1]]=el(match[1]);
 const win={console,document:{getElementById:id=>nodes[id],hidden:false},innerWidth:1120,innerHeight:650,devicePixelRatio:1,location:{search:'?qa=1'},requestAnimationFrame:f=>raf.push(f),addEventListener:(ev,fn)=>{listeners[ev]=fn},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},navigator:{getGamepads:()=>[]},Math,JSON,performance:{now:()=>now}};
 win.window=win;
 vm.runInNewContext(code,win,{filename:'game.js',timeout:5000});
 function tick(n=1){for(let i=0;i<n;i++){let cb=raf.shift();assert(cb,'raf required');now+=16.667;cb(now);}}
 return {win,nodes,tick,store,listeners};
}
const key='riftworld.shattered-atlas.slot1.v1';
const legacy={schema:1,seed:69217,player:{x:0,y:0,hp:67,maxHp:100,energy:70,maxEnergy:100,level:5,xp:15,shards:350,attack:27,defense:0,expTo:105,face:0},closed:[0],kills:10,upgrade:1,playtime:200,surges:1};
const migrated=create({[key]:JSON.stringify(legacy)});
migrated.nodes.continue.click();migrated.tick(3);
assert.equal(migrated.win.RiftGame.debug().level,5);
migrated.nodes.skillsButton.click();assert.equal(migrated.win.RiftGame.debug().scene,'skills');
assert.equal(migrated.nodes['skill-blade'].disabled,true,'Genesis save should initially have no unearned skill points');
migrated.nodes.skillsClose.click();assert.equal(migrated.win.RiftGame.debug().scene,'game');
// Test skill allocation and persistence with an earned point budget.
const skilled=structuredClone(legacy);skilled.skillPoints=3;skilled.skills={blade:0,sentinel:0,rift:0};
const b=create({[key]:JSON.stringify(skilled)});b.nodes.continue.click();b.nodes.skillsButton.click();
for(const name of ['blade','sentinel','rift'])b.nodes['skill-'+name].click();
assert.equal(b.win.RiftGame.debug().points,0);assert.equal(b.win.RiftGame.debug().skills.blade,1);assert.equal(b.win.RiftGame.debug().skills.sentinel,1);assert.equal(b.win.RiftGame.debug().skills.rift,1);
b.nodes.skillsClose.click();b.tick(20);assert(b.win.RiftGame.save());
const stored=JSON.parse(b.store[key]);assert.equal(stored.skills.sentinel,1);assert(stored.player.maxHp>100);assert(stored.player.maxEnergy>100);
const b2=create(b.store);b2.nodes.continue.click();assert.equal(b2.win.RiftGame.debug().skills.rift,1);
// Survive pause, save and resume while physically inside a rift — no checkpoint reset.
const forPortal=structuredClone(legacy);forPortal.closed=[];forPortal.player.x=10;forPortal.player.y=-4;
const c=create({[key]:JSON.stringify(forPortal)});c.nodes.continue.click();c.nodes.interactButton.click();c.tick(20);
assert.equal(c.win.RiftGame.debug().arena,true);c.nodes.pauseButton.click();assert.equal(c.win.RiftGame.debug().scene,'pause');
const inRift=JSON.parse(c.store[key]);assert.equal(inRift.arena.portal,0);assert(inRift.arena.enemies.length>0);
const afterRift=create(c.store);afterRift.nodes.continue.click();afterRift.tick(10);assert.equal(afterRift.win.RiftGame.debug().arena,true,'rift snapshot not restored');
// Directional hit arcs: a sword strike can damage foes in front, not behind the player's back.
const facing=create();facing.nodes.start.click();facing.win.RiftGame.qa.place(0,0,0);facing.win.RiftGame.qa.clearEnemies();
facing.win.RiftGame.qa.spawn('brute',1.1,0);facing.win.RiftGame.qa.spawn('brute',-1.1,0);
const before=facing.win.RiftGame.qa.enemies().map(e=>e.hp);
facing.win.RiftGame.qa.useStrike();const after=facing.win.RiftGame.qa.enemies().map(e=>e.hp);
assert(after[0]<before[0],'frontal sword hit missing');assert.equal(after[1],before[1],'backward enemy struck by frontal cone');
// Phase bridge physically exists in only one version of the world.
const phaseWorld=create();phaseWorld.nodes.start.click();phaseWorld.win.RiftGame.qa.place(-10.6,-5.5);
assert.equal(phaseWorld.win.RiftGame.qa.collision(-10.6,-5.5),true);
phaseWorld.win.RiftGame.qa.phase(true);
assert.equal(phaseWorld.win.RiftGame.qa.collision(-10.6,-5.5),false);
// Boss must cross an actual second phase and survive deterministic update ticks.
const boss=create();boss.nodes.start.click();boss.win.RiftGame.qa.setBoss();boss.win.RiftGame.qa.invincible();boss.win.RiftGame.qa.bossHealth(.48);
boss.tick(10);assert.equal(boss.win.RiftGame.debug().bossPhase,2,'boss fracture fury phase failed');
boss.tick(350);assert.equal(boss.win.RiftGame.debug().scene,'game');
// Simulated long continuous update should never throw while regular enemies are attacking.
afterRift.tick(500);assert.equal(typeof afterRift.win.RiftGame.debug().bossPhase,'number');
console.log('RIFTCORE_MILESTONE_QA_PASS: backwards saves, 3 skills, skill persistence, encounter recovery, frontal hit-cone, phase bridge, boss phase 2, 850 simulated frames');
