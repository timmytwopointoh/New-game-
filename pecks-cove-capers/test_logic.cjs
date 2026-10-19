'use strict';
const fs=require('fs'),assert=require('node:assert/strict');
const c={fillRect(){},strokeRect(){},beginPath(){},ellipse(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){},clearRect(){},save(){},restore(){},translate(){},scale(){},quadraticCurveTo(){},closePath(){},createLinearGradient(){return {addColorStop(){}}}};
const ids=new Map(),cards=[];
function el(id){if(!ids.has(id)){ids.set(id,{id,dataset:{},style:{setProperty(){}},offsetWidth:960,remove(){},classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',appendChild(v){cards.push(v)},replaceChildren(){cards.length=0},querySelector(){return el('portrait')},getContext(){return c},addEventListener(){},setAttribute(){}})}return ids.get(id)}
global.document={addEventListener(){},querySelector:el,getElementById:el,createElement:()=>({style:{setProperty(){}},remove(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return el('portrait')},setAttribute(){},innerHTML:'',onclick:null}),querySelectorAll:q=>q==='#dpad button'?[]:cards};
global.window={addEventListener(){}};const store=new Map();global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
global.performance={now:()=>0};global.requestAnimationFrame=()=>{};global.setTimeout=()=>{};
eval(fs.readFileSync(__dirname+'/web/game.js','utf8'));const h=window.__coveTest;
assert.equal(h.state,'front');assert.equal(h.roles.length,14);assert.equal(h.BASE_ROLE_COUNT,10);assert.equal(h.PREMIUM_CREW.length,4);assert.equal(h.FOOD_RESIDUES.length,5);
assert.equal(h.canStand(656,304),false);assert.equal(h.canStand(672,714),false);
assert.equal(h.canStand(486,440),true);assert.equal(h.canStand(486,540),true);assert.equal(h.canStand(990,450),true);
assert.equal(h.canStand(180,328),true);assert.equal(h.canStand(205,757),true);assert.equal(h.canStand(200,840),false);
for(let i=0;i<10;i++)for(let stage=0;stage<3;stage++){const a=h.roles[i].tasks[stage];assert.ok(h.canStand(a[2],a[3]),'Blocked job '+i+'/'+stage)}
for(let i=0;i<10;i++){h.openCrew();h.choose(i);h.begin();assert.equal(h.state,'intro');h.finishIntro();assert.equal(h.state,'playing');
 for(let stage=0;stage<3;stage++){const a=h.target();h.game.x=a.x;h.game.y=a.y;assert.equal(h.activeTask()?.kind,'job');const kind=h.miniKind(a);assert.ok(kind);assert.ok(h.constructMini(a,kind).variant>=0);assert.equal(h.completeTask(h.activeTask()),true)}
 h.game.elapsed=719.99;h.update(.1);assert.equal(h.state,'finish')}
console.log('PASS: expanded rooms, 30 mini-enabled role tasks, restaurant stations, menus, full-day close.');
