'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const canvasCtx={fillRect(){},strokeRect(){},beginPath(){},ellipse(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){},roundRect(){},clearRect(){},save(){},restore(){},translate(){},scale(){},setLineDash(){},quadraticCurveTo(){},closePath(){},createLinearGradient(){return {addColorStop(){}}}};
const ids=new Map(),cards=[];
function el(id){if(!ids.has(id)){const e={id,dataset:{},style:{setProperty(){}},offsetWidth:960,remove(){},classList:{add(){},remove(){},toggle(){},contains(){return false}},textContent:'',innerHTML:'',listeners:{},appendChild(x){cards.push(x)},replaceChildren(){cards.length=0},querySelector(){return el('portrait')},getContext(){return canvasCtx},addEventListener(t,f){this.listeners[t]=f},setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}};ids.set(id,e)}return ids.get(id)}
global.document={addEventListener(){},querySelector:el,getElementById:el,createElement:()=>({style:{setProperty(){}},remove(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return el('portrait')},setAttribute(){},innerHTML:'',onclick:null}),querySelectorAll:q=>q==='#dpad button'?[]:cards};
global.window={addEventListener(){}};global.localStorage={getItem(){return null},setItem(){}};global.performance={now:()=>0};global.requestAnimationFrame=()=>{};global.setTimeout=()=>{};
eval(fs.readFileSync(__dirname+'/web/game.js','utf8'));
const h=window.__coveTest;
assert.equal(h.state,'front','main menu before character select and sunrise');
assert.equal(h.introDone,true,'sunrise not running on app start');
assert.equal(h.roles.length,10);
assert.equal(h.canStand(656,304),false,'furniture blocks path');
assert.equal(h.canStand(751,305),true,'serving aisle open');
assert.equal(h.canStand(486,440),true,'doorway open');
assert.equal(h.canStand(990,450),true,'deck passage open');
for(let i=0;i<10;i++){
 h.openCrew();h.choose(i);h.begin();assert.equal(h.state,'intro');assert.equal(h.game.paused,true);
 h.finishIntro();assert.equal(h.state,'playing');assert.equal(h.game.paused,false);
 const first=h.target();assert.equal(first.kind,'job');assert.equal(h.game.x===first.x&&h.game.y===first.y,false);
 h.spawnCustomer();for(let j=0;j<550;j++)h.update(.05);
 const c=h.game.customers[0];assert.equal(c.state,'ordered');
 h.game.x=h.PICKUP.x;h.game.y=h.PICKUP.y;
 assert.notEqual(h.activeTask()?.kind,'pickup','service is gated until normal tasks finished');
 for(let j=0;j<2;j++){
  const t=h.target();assert.equal(t.kind,'job');h.game.x=t.x;h.game.y=t.y;
  assert.equal(h.activeTask()?.kind,'job');assert.equal(h.completeTask(h.activeTask()),true);
  assert.equal(h.game.done,j+1);assert.ok(h.game.cheerUntil>0);
 }
 assert.equal(h.target().kind,'pickup','service unlocks after 2 completed staff tasks');
 const locked=h.roles[i].tasks[2];h.game.x=locked[2];h.game.y=locked[3];assert.notEqual(h.activeTask()?.kind,'job','subsequent staff job stays locked');
 h.game.x=h.PICKUP.x;h.game.y=h.PICKUP.y;assert.equal(h.activeTask().kind,'pickup');h.completeTask(h.activeTask());
 assert.equal(h.target().kind,'serve');h.game.x=c.tx;h.game.y=c.ty;
 assert.equal(h.activeTask()?.kind,'serve');h.completeTask(h.activeTask());assert.equal(h.game.served,1);
 assert.equal(h.target().kind,'job');
 h.ghostPrank();assert.ok(h.game.mess);for(let j=0;j<550;j++)h.update(.05);assert.ok(h.game.mess,'ghost mess persists');
 h.game.x=h.game.mess.x;h.game.y=h.game.mess.y;assert.equal(h.activeTask()?.kind,'ghost');h.completeTask(h.activeTask());
 assert.equal(h.game.ghostCount,1);assert.equal(h.target().kind,'job','ghost cleanup does not skip regular objective');
 h.game.elapsed=719.99;h.update(.05);assert.equal(h.state,'finish');
 assert.ok(h.game.cheerUntil>0,'closing cheer animation scheduled');
}
console.log('PASS: menu/crew/sunrise/shift, 10 roles, single-step jobs, staged guest service, persistent ghost, task and closing celebrations');