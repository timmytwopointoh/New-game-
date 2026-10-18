/* VOID BASTION: deterministic, offline, dependency-free rules engine.
 * Original game code. Can be loaded in a browser or imported into Node tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.VBEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const W=10,H=8;
const SPECS={trooper:{name:'Legionary',cost:2,hp:5,move:2,range:2,damage:2},scout:{name:'Pathfinder',cost:2,hp:3,move:3,range:2,damage:2},heavy:{name:'Iron Guard',cost:4,hp:9,move:1,range:3,damage:3},tower:{name:'Defense Turret',cost:4,hp:8,move:0,range:3,damage:2}};
const TERRAIN=new Set(['4,1','5,5','4,6','5,2']);
const sides=[{title:'IRON WARDENS',short:'WARDENS',color:'#6ec5e9'},{title:'ASH REAVERS',short:'REAVERS',color:'#f18c61'}];
const other=p=>1-p;
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const key=(x,y)=>x+','+y;
const copy=o=>JSON.parse(JSON.stringify(o));
function newGame(){return {phase:'menu',round:1,active:0,unitId:1,units:[],bases:[{p:0,x:0,y:3,hp:26,maxHp:26},{p:1,x:9,y:4,hp:26,maxHp:26}],supply:[14,14],orders:[],selectedKind:'trooper',selectedId:null,passTo:null,passPhase:null,lastEvents:[],log:['Awaiting your commanders.'],winner:null};}
function start(s){if(s.phase!=='menu'&&s.phase!=='victory')return false;Object.assign(s,newGame());s.phase='deploy';return true;}
function inBounds(x,y){return x>=0&&x<W&&y>=0&&y<H;}
function blocked(x,y){return TERRAIN.has(key(x,y));}
function at(s,x,y){return s.units.find(u=>u.hp>0&&u.x===x&&u.y===y)||s.bases.find(b=>b.hp>0&&b.x===x&&b.y===y)||null;}
function zone(p,x){return p===0?x<=2:x>=7;}
function canDeploy(s,kind,x,y){const spec=SPECS[kind];return s.phase==='deploy'&&!!spec&&Number.isInteger(x)&&Number.isInteger(y)&&inBounds(x,y)&&zone(s.active,x)&&!blocked(x,y)&&!at(s,x,y)&&s.supply[s.active]>=spec.cost;}
function deploy(s,kind,x,y){if(!canDeploy(s,kind,x,y))return {ok:false,reason:'Choose an open tile in your deployment zone with enough requisition.'};const spec=SPECS[kind];const u={id:s.unitId++,p:s.active,kind,x,y,hp:spec.hp,maxHp:spec.hp};s.units.push(u);s.supply[s.active]-=spec.cost;s.log.unshift(`${sides[s.active].short} deployed ${spec.name}.`);return {ok:true,unit:u};}
function finishDeploy(s){if(s.phase!=='deploy')return {ok:false,reason:'Not in deployment.'};if(s.units.filter(u=>u.p===s.active).length<2)return {ok:false,reason:'Deploy at least two units first.'};s.selectedId=null;if(s.active===0){s.passTo=1;s.passPhase='deploy';}else{s.passTo=0;s.passPhase='plan';}s.phase='pass';s.log.unshift('Deployment locked. Hand the device to the next commander.');return {ok:true};}
function resume(s){if(s.phase!=='pass'||s.passTo===null)return false;s.active=s.passTo;s.phase=s.passPhase;s.passTo=null;s.passPhase=null;s.orders=[];s.selectedId=null;return true;}
function orderFor(s,id){return s.orders.find(o=>o.id===id);}
function legalMove(s,u,x,y){if(!u||u.p!==s.active||!inBounds(x,y)||blocked(x,y)||at(s,x,y))return false;const spec=SPECS[u.kind];if(!spec.move||dist(u,{x,y})>spec.move||dist(u,{x,y})===0)return false;return !s.orders.some(o=>o.action==='move'&&o.id!==u.id&&o.x===x&&o.y===y);}
function issueOrder(s,id,x,y){if(s.phase!=='plan')return {ok:false,reason:'Orders are only accepted during planning.'};const u=s.units.find(u=>u.id===id&&u.p===s.active&&u.hp>0);if(!u)return {ok:false,reason:'Select one of your own units.'};const target=at(s,x,y);let order;if(target&&target.p!==s.active&&inBounds(x,y)){if(dist(u,target)>SPECS[u.kind].range)return {ok:false,reason:'Enemy is out of weapon range.'};order={id,action:'attack',targetId:target.id||null,base:target.id?false:true,p:target.p,x,y};}else if(legalMove(s,u,x,y)){order={id,action:'move',x,y};}else{return {ok:false,reason:'Target blocked, occupied, or outside movement range.'};}s.orders=s.orders.filter(o=>o.id!==id);s.orders.push(order);return {ok:true,order};}
function clearOrder(s,id){s.orders=s.orders.filter(o=>o.id!==id);}
function damage(s,target,amount,events,source){if(!target||target.hp<=0)return;const before=target.hp;target.hp=Math.max(0,target.hp-amount);events.push({type:'shot',from:{x:source.x,y:source.y},to:{x:target.x,y:target.y},damage:before-target.hp,targetId:target.id||null,defeated:target.hp===0,p:source.p});if(target.hp===0)s.log.unshift((target.id?SPECS[target.kind].name:'Fortress core')+' destroyed.');}
function checkVictory(s){const a=s.bases[0].hp,b=s.bases[1].hp;if(a<=0||b<=0){s.winner=a<=0?1:0;s.phase='victory';return true;}return false;}
function finishTurn(s){if(s.phase!=='plan')return {ok:false,reason:'Not your planning turn.'};const events=[];const current=s.active;const queue=copy(s.orders);for(const order of queue){const u=s.units.find(u=>u.id===order.id&&u.hp>0&&u.p===current);if(!u)continue;if(order.action==='move'){if(legalMove({...s,orders:[]},u,order.x,order.y)){const from={x:u.x,y:u.y};u.x=order.x;u.y=order.y;events.push({type:'move',id:u.id,from,to:{x:u.x,y:u.y},p:u.p});}}else{const t=at(s,order.x,order.y);if(t&&t.p!==current&&dist(u,t)<=SPECS[u.kind].range)damage(s,t,SPECS[u.kind].damage,events,u);}}
for(const u of s.units.filter(u=>u.p===current&&u.kind==='tower'&&u.hp>0)){const enemy=[...s.units.filter(v=>v.p!==current&&v.hp>0),s.bases[other(current)]].filter(t=>t.hp>0&&dist(u,t)<=SPECS.tower.range).sort((a,b)=>dist(u,a)-dist(u,b)||a.hp-b.hp)[0];if(enemy)damage(s,enemy,SPECS.tower.damage,events,u);}
s.units=s.units.filter(u=>u.hp>0);s.orders=[];s.selectedId=null;s.phase='resolve';s.lastEvents=events;s.log.unshift(`${sides[current].short} orders executed · ${events.length} actions.`);return {ok:true,events};}
function completeResolution(s){if(s.phase!=='resolve')return false;if(checkVictory(s))return true;if(s.active===1){s.round++;s.supply[0]+=3;s.supply[1]+=3;}s.passTo=other(s.active);s.passPhase='plan';s.phase='pass';return true;}
function available(s){return Object.keys(SPECS).filter(k=>s.supply[s.active]>=SPECS[k].cost);}
return {W,H,SPECS,TERRAIN,sides,newGame,start,at,dist,blocked,zone,canDeploy,deploy,finishDeploy,resume,legalMove,issueOrder,clearOrder,finishTurn,completeResolution,checkVictory,available,copy};
});
