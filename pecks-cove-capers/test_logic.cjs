'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const canvasCtx={fillRect(){},strokeRect(){},beginPath(){},ellipse(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){},roundRect(){},clearRect(){},save(){},restore(){},translate(){},scale(){},setLineDash(){},quadraticCurveTo(){},closePath(){},createLinearGradient(){return {addColorStop(){}}}};
const ids=new Map(),cards=[];
function el(id){if(!ids.has(id)){const e={id,dataset:{},classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',listeners:{},appendChild(x){cards.push(x)},replaceChildren(){cards.length=0},querySelector(){return el('portrait')},getContext(){return canvasCtx},addEventListener(t,f){this.listeners[t]=f},setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}};ids.set(id,e)}return ids.get(id)}
global.document={addEventListener(){},querySelector:el,getElementById:el,createElement:()=>({classList:{add(){},remove(){},toggle(){}},querySelector(){return el('portrait')},setAttribute(){},innerHTML:'',onclick:null}),querySelectorAll:q=>q==='#dpad button'?[]:cards};
global.window={addEventListener(){}};global.localStorage={getItem(){return null},setItem(){}};global.performance={now:()=>0};global.requestAnimationFrame=()=>{};
eval(fs.readFileSync(__dirname+'/web/game.js','utf8'));
const h=window.__coveTest;
assert.equal(h.roles.length,10);
assert.equal(h.canStand(656,304),false,'table core must be solid');
assert.equal(h.canStand(705,305),false,'chairs and table apron have clearance');
assert.equal(h.canStand(751,305),true,'outer serving aisle must be open');
assert.equal(h.canStand(140,435),true,'kitchen walkway is open');
assert.equal(h.canStand(486,440),true,'kitchen-to-dining doorway is open');
assert.equal(h.canStand(990,450),true,'dining-to-deck doorway is open');
for(let i=0;i<10;i++){
 h.choose(i);h.begin();assert.equal(h.state,'playing');assert.equal(h.game.role,i);
 const before=h.game.x;h.update(.05);assert.equal(h.game.x,before,'no auto movement');
 const tasks=h.roles[i].tasks;assert.equal(tasks.length,3);
 for(let j=0;j<6;j++){
  const t=h.target();h.game.x=t.x;h.game.y=t.y;
  assert.equal(h.activeTask()?.kind,'job');assert.ok(h.completeTask(h.activeTask()));
 }
 assert.equal(h.game.done,6);assert.equal(h.state,'playing','cannot finish without serving guests');
 h.spawnCustomer();for(let j=0;j<650;j++)h.update(.05);
 assert.equal(h.game.customers[0].state,'ordered');
 const c=h.game.customers[0];for(let j=0;j<800;j++)h.update(.05);
 assert.equal(c.state,'ordered','unserved guests never leave');
 h.game.x=h.PICKUP.x;h.game.y=h.PICKUP.y;assert.equal(h.activeTask()?.kind,'pickup');h.completeTask(h.activeTask());
 h.game.x=c.tx;h.game.y=c.ty;assert.equal(h.activeTask()?.kind,'serve');h.completeTask(h.activeTask());
 assert.equal(h.game.served,1);
 h.ghostPrank();assert.ok(h.game.mess);for(let j=0;j<600;j++)h.update(.05);assert.ok(h.game.mess,'ghost prank persists');
 h.game.x=h.game.mess.x;h.game.y=h.game.mess.y;
 assert.equal(h.activeTask()?.kind,'ghost');h.completeTask(h.activeTask());assert.equal(h.game.ghostCount,1);
}
console.log('PASS: all 10 roles, manual interactions, guests stay until served, service pickup, ghost persistence');
