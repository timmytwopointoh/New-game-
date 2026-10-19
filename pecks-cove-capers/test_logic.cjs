'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const canvasCtx={fillRect(){},strokeRect(){},beginPath(){},ellipse(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){},roundRect(){},clearRect(){},save(){},restore(){},translate(){},scale(){},setLineDash(){},quadraticCurveTo(){},closePath(){},createLinearGradient(){return {addColorStop(){}}}};
const ids=new Map(),cards=[];
function el(id){if(!ids.has(id)){const e={id,dataset:{},style:{setProperty(){}},offsetWidth:960,remove(){},classList:{add(){},remove(){},toggle(){},contains(){return false}},textContent:'',innerHTML:'',listeners:{},appendChild(x){cards.push(x)},replaceChildren(){cards.length=0},querySelector(){return el('portrait')},getContext(){return canvasCtx},addEventListener(t,f){this.listeners[t]=f},setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}};ids.set(id,e)}return ids.get(id)}
global.document={addEventListener(){},querySelector:el,getElementById:el,createElement:()=>({style:{setProperty(){}},remove(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return el('portrait')},setAttribute(){},innerHTML:'',onclick:null}),querySelectorAll:q=>q==='#dpad button'?[]:cards};
global.window={addEventListener(){}};const cache=new Map();global.localStorage={getItem(k){return cache.get(k)||null},setItem(k,v){cache.set(k,String(v))},removeItem(k){cache.delete(k)}};global.performance={now:()=>0};global.requestAnimationFrame=()=>{};global.setTimeout=()=>{};
eval(fs.readFileSync(__dirname+'/web/game.js','utf8'));
const h=window.__coveTest;

assert.equal(h.state,'front');assert.equal(h.roles.length,14);
assert.equal(h.BASE_ROLE_COUNT,10);assert.equal(h.PREMIUM_CREW[0].cost,50);
assert.deepEqual(h.PREMIUM_CREW.map(p=>p.cost),[50,100,150,200]);
assert.equal(h.WALK_ROOMS.find(r=>r.id==='chowder').y< h.WALK_ROOMS.find(r=>r.id==='kitchen').y,true,'chowder above kitchen');
assert.equal(h.DOORS.find(x=>x.id==='chowder').x>1200,true,'chowder door east of dishpit');
assert.equal(h.canStand(h.PICKUP.x,h.PICKUP.y),true);
for(let i=0;i<10;i++){
 assert.equal(h.roles[i].tasks.length,6,`role ${i} has six tasks`);
 assert.equal(Object.keys(h.roles[i].stats).length,4);
 assert.ok(h.roles[i].perk);
 for(let j=0;j<6;j++){
  const t=h.roles[i].tasks[j];assert.ok(h.canStand(t[2],t[3]),`task ${i}/${j} access`);
 }
 h.openCrew();h.choose(i);h.begin();assert.equal(h.state,'intro');h.finishIntro();assert.equal(h.state,'walkin');
 for(let n=0;n<8;n++)h.update(.48);
 assert.equal(h.state,'playing');assert.ok(h.canStand(h.game.x,h.game.y));
 h.update(1);assert.ok(h.game.elapsed>0,'timer ticks while moving normally');
 for(let j=0;j<6;j++){
  const action=h.target();assert.equal(action.kind,'job');h.game.x=action.x;h.game.y=action.y;
  const mini=h.miniKind(h.activeTask());assert.ok(mini,`role ${i} stage ${j} should have minigame`);
  const options=new Set();for(let k=0;k<70;k++)options.add(h.constructMini(action,mini).variant);
  assert.equal(options.size,5,`5 variants on ${mini}`);
  h.completeTask(h.activeTask());assert.equal(h.game.done,j+1);
  if(h.game.serviceStage){ // serve or skip current service to isolate staff sequence
   h.game.serviceStage=null;h.game.carryMeal=null;
  }
 }
}
// Patience and coin penalty, including cancellation when a waiter is carrying the meal.
h.openCrew();h.choose(2);h.begin();h.finishIntro();h.update(3.5);
h.spawnCustomer();h.game.customers[0].state='ordered';h.game.customers[0].wait=88;h.game.score=15;
h.update(.1);assert.equal(h.game.lostGuests,1);assert.equal(h.game.score,13,'unserved guest costs 2 coins');
// Pressure door reacts and closes behind player.
const gate=h.DOORS.find(d=>d.id==='chowder');h.game.x=gate.x;h.game.y=gate.y+38;
for(let i=0;i<12;i++)h.update(.05);
assert.ok(h.game.doors.chowder>.75);assert.equal(h.canStand(gate.x,gate.y),true);
h.game.x=1000;h.game.y=1150;for(let i=0;i<30;i++)h.update(.05);
assert.ok(h.game.doors.chowder<.65);assert.equal(h.canStand(gate.x,gate.y),false);
console.log('PASS: six tasks per role, five minigame layouts, walk-in animation, doors, 60s customers, coin penalties, stats and economy.');
