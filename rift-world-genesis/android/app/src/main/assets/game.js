/* RIFTCORE / 0.2 - THE LIVING ATLAS: original, offline, deterministic touch-first Rift World adventure.
 * This deliberately contains the game loop, simulation, procedural art, entity AI, UI and save model.
 * No server, external assets, tracking, ads, external JavaScript or network access.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const canvas=$('world'),c=canvas.getContext('2d',{alpha:false});
let SW=1280,SH=720,DPR=1,unit=57,clock=0,scene='menu',last=0,shake=0,noticeTime=0,hudTimer=0,menuOrbit=0,quality=1;
const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rnd=(a,b,s=0)=>{let v=Math.sin(a*127.1+b*311.7+s*19.19)*43758.5453;return v-Math.floor(v);};
const noise=(x,y,s=0)=>{let ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);return mix(mix(rnd(ix,iy,s),rnd(ix+1,iy,s),fx),mix(rnd(ix,iy+1,s),rnd(ix+1,iy+1,s),fx),fy)};
const fract=(x,y,s=0)=>(noise(x*.075,y*.075,s)*.55+noise(x*.23,y*.23,s+7)*.3+noise(x*.6,y*.6,s+17)*.15);
const PALETTES=[
 {name:'LUMEN REACH',ground:['#153947','#1a4651','#173c4b'],leaf:'#64bba4',dark:'#244d54',accent:'#71ebdd',sky:'#091b32'},
 {name:'VERDANT HOLLOW',ground:['#173c35','#1d4c42','#214e40'],leaf:'#7dc788',dark:'#2d6454',accent:'#9df7b2',sky:'#0e302d'},
 {name:'EMBERFALL',ground:['#4e2c34','#58323b','#60363b'],leaf:'#c98566',dark:'#653d43',accent:'#ffab70',sky:'#281322'},
 {name:'MIRROR TIDES',ground:['#164456','#1c5564','#1c5162'],leaf:'#74d7cb',dark:'#216175',accent:'#8af0fa',sky:'#0a2335'},
 {name:'NIGHTGLASS',ground:['#2e2e52','#373255','#302d55'],leaf:'#9c9bdf',dark:'#46456a',accent:'#c0a4ff',sky:'#171531'}
];
const portals=[
 {id:0,x:10,y:-4,zone:0,name:'THE FIRST WOUND',reward:80},
 {id:1,x:-56,y:-46,zone:1,name:'THE HOLLOW HEART',reward:125},
 {id:2,x:61,y:-51,zone:2,name:'THE EMBER CROWN',reward:145},
 {id:3,x:-58,y:56,zone:3,name:'THE DROWNED MIRROR',reward:160},
 {id:4,x:63,y:60,zone:4,name:'THE NIGHTGLASS EYE',reward:200}
];
const ENEMY={
 stalker:{name:'Glimmerfang',hp:40,speed:2.0,damage:8,range:1.25,color:'#f0759a',xp:9},
 wisp:{name:'Fracture Wisp',hp:27,speed:1.5,damage:6,range:5.5,color:'#69e8ef',xp:10},
 brute:{name:'Shardback',hp:105,speed:.83,damage:16,range:1.6,color:'#d9b787',xp:20},
 sentinel:{name:'Hollow Sentinel',hp:280,speed:1.15,damage:18,range:6,color:'#d9a0fa',xp:95}
};
const saveKey='riftworld.shattered-atlas.slot1.v1';
let state=null,enemies=[],projectiles=[],particles=[],rings=[],floaters=[],weather=[],input={x:0,y:0,attack:false},keys=new Set(),camera={x:0,y:0},arena=null,heroHit=0,interactTarget=null;
const baseState=()=>({seed:69217,p:{x:0,y:0,hp:100,maxHp:100,energy:100,maxEnergy:100,level:1,xp:0,shards:0,attack:17,defense:0,expTo:65,face:1},closed:[],kills:0,steps:0,deaths:0,upgrade:0,playtime:0,phase:0,phaseTime:0,phaseCd:0,attackCd:0,dashCd:0,pulseCd:0,combo:0,surges:0,unlocked:false,skillPoints:0,skills:{blade:0,sentinel:0,rift:0},relics:[],landmarks:[],bossDefeats:0,savedArena:null});
function load(){try{let raw=localStorage.getItem(saveKey);if(!raw)return null;let d=JSON.parse(raw),s=baseState();if(!d||d.schema!==1||!d.player)return null;s.p={...s.p,...d.player};for(let k of ['seed','closed','kills','steps','deaths','upgrade','playtime','surges','skillPoints','skills','relics','landmarks','bossDefeats'])if(d[k]!=null)s[k]=d[k];s.skills={blade:clamp(Number(s.skills?.blade)||0,0,4),sentinel:clamp(Number(s.skills?.sentinel)||0,0,4),rift:clamp(Number(s.skills?.rift)||0,0,4)};s.relics=Array.isArray(s.relics)?s.relics.filter(v=>Number.isInteger(v)&&v>=0&&v<10):[];s.landmarks=Array.isArray(s.landmarks)?s.landmarks.filter(v=>Number.isInteger(v)&&v>=0&&v<10):[];s.savedArena=d.arena&&Number.isInteger(d.arena.portal)&&d.arena.portal>=0&&d.arena.portal<5?d.arena:null;s.closed=Array.isArray(s.closed)?s.closed.filter(n=>Number.isInteger(n)&&n>=0&&n<=4):[];s.p.hp=clamp(s.p.hp,1,s.p.maxHp);s.p.energy=clamp(s.p.energy,0,s.p.maxEnergy);return s;}catch(_){return null;}}
function save(){if(!state)return false;let d={schema:1,seed:state.seed,player:state.p,closed:state.closed,kills:state.kills,steps:state.steps,deaths:state.deaths,upgrade:state.upgrade,playtime:state.playtime,surges:state.surges,skillPoints:state.skillPoints,skills:state.skills,relics:state.relics,landmarks:state.landmarks,bossDefeats:state.bossDefeats,arena:arena&&!arena.won&&scene!=='death'?{portal:arena.portal,zone:arena.zone,origin:arena.origin,name:arena.name,killed:arena.killed,wave:arena.wave,boss:arena.boss,won:false,winTimer:0,reward:arena.reward,phase:arena.phase||1,pattern:arena.pattern||0,enemies:enemies.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,boss:e.boss}))}:null};try{localStorage.setItem(saveKey,JSON.stringify(d));return true;}catch(_){toast('Local save unavailable on this device');return false;}}
function resize(){SW=Math.max(320,innerWidth);SH=Math.max(200,innerHeight);DPR=Math.min(2,devicePixelRatio||1);quality=SW*SH>2000000?.75:1;canvas.width=Math.round(SW*DPR*quality);canvas.height=Math.round(SH*DPR*quality);c.setTransform(DPR*quality,0,0,DPR*quality,0,0);unit=clamp(SH*.088,33,70)}
addEventListener('resize',resize);resize();
function show(id){for(const n of ['menu','howto','hud','pause','mapScreen','death','skillsScreen'])$(n).classList.add('hidden');$(id).classList.remove('hidden')}
function toast(text){$('notifications').textContent=text;$('notifications').classList.add('active');noticeTime=2.7}
function sound(freq=350,type='sine',length=.15,gain=.06,endFreq=null){try{let A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!sound.ctx)sound.ctx=new A();let a=sound.ctx;if(a.state==='suspended')a.resume();let o=a.createOscillator(),v=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq),a.currentTime+length);v.gain.setValueAtTime(gain,a.currentTime);v.gain.exponentialRampToValueAtTime(.001,a.currentTime+length);o.connect(v);v.connect(a.destination);o.start();o.stop(a.currentTime+length);}catch(_){}}
function start(fresh){state=fresh?baseState():load()||baseState();scene='game';arena=null;enemies=[];projectiles=[];particles=[];rings=[];floaters=[];weather=[];state.p.hp=Math.max(20,state.p.hp);camera.x=state.p.x;camera.y=state.p.y;show('hud');toast('WELCOME TO THE SHATTERED ATLAS');sound(420,'triangle',.4,.035,800);if(state.savedArena){const restored=state.savedArena;arena={...restored};enemies=[];for(let old of restored.enemies||[]){if(!ENEMY[old.type])continue;newEnemy(old.type,old.x,old.y,!!old.boss);let e=enemies[enemies.length-1];e.hp=clamp(old.hp,1,old.maxHp);e.maxHp=old.maxHp;}if(!enemies.length&&arena.boss)newEnemy('sentinel',0,-6,true);state.savedArena=null;toast('RIFT SANCTUM RESTORED');}else spawnWorld(9);updateHUD();console.log('RIFTCORE_WORLD_STARTED')}
function back(){if(scene==='game')pause();else if(scene==='pause'||scene==='map')resume();else if(scene==='help')mainMenu();else if(scene==='skills')resume();else if(scene==='death')respawn()}
function mainMenu(){if(scene==='game'||scene==='pause'||scene==='map'||scene==='skills')save();scene='menu';show('menu');$('continue').disabled=!load();$('continue').style.opacity=load()?1:.42;}
function pause(){if(scene!=='game')return;scene='pause';save();$('pauseStats').innerHTML=`LEVEL ${state.p.level} WAYFINDER<br>STAR SHARDS ${state.p.shards}<br>RIFTS SEALED ${state.closed.length} / 5<br>CREATURES DEFEATED ${state.kills}<br>TIME EXPLORED ${Math.floor(state.playtime/60)} MIN`;show('pause')}
function resume(){if(!state)return mainMenu();scene='game';show('hud');input.x=input.y=0;updateHUD()}
function respawn(){if(!state)return mainMenu();state.p.x=0;state.p.y=0;state.p.hp=state.p.maxHp;state.p.energy=state.p.maxEnergy;state.deaths++;arena=null;enemies=[];particles=[];projectiles=[];scene='game';show('hud');toast('THE ANCHOR REKINDLES YOUR SOUL');save()}
function gameOver(){if(scene!=='game')return;scene='death';input.x=input.y=0;save();show('death');sound(190,'sawtooth',1,.04,45)}
$('continue').onclick=()=>start(false);$('start').onclick=()=>start(true);$('help').onclick=()=>{scene='help';show('howto')};$('howBack').onclick=mainMenu;
$('pauseButton').onclick=pause;$('resume').onclick=resume;$('save').onclick=()=>{save();toast('JOURNEY SAVED')};$('menuReturn').onclick=mainMenu;$('respawn').onclick=respawn;
$('mapButton').onclick=()=>{if(scene==='game'){scene='map';show('mapScreen');drawMap()}};$('closeMap').onclick=resume;
$('interactButton').onclick=interact;
const joy=$('joy'),knob=$('knob');let joyPointer=null;
function readJoy(ev){const r=joy.getBoundingClientRect(),x=ev.clientX-(r.left+r.width/2),y=ev.clientY-(r.top+r.height/2),len=Math.hypot(x,y),cap=r.width*.32,k=Math.min(1,cap/(len||1));input.x=x*k/cap;input.y=y*k/cap;knob.style.transform=`translate(${x*k}px,${y*k}px)`}
joy.addEventListener('pointerdown',ev=>{if(scene!=='game')return;joyPointer=ev.pointerId;joy.setPointerCapture(ev.pointerId);readJoy(ev);ev.preventDefault()});joy.addEventListener('pointermove',ev=>{if(ev.pointerId===joyPointer)readJoy(ev)});
function stopJoy(ev){if(ev.pointerId!==joyPointer)return;joyPointer=null;input.x=input.y=0;knob.style.transform='translate(0,0)'}joy.addEventListener('pointerup',stopJoy);joy.addEventListener('pointercancel',stopJoy);
function actionButton(id,action){let b=$(id);b.addEventListener('pointerdown',ev=>{ev.preventDefault();if(scene==='game')action();b.setPointerCapture(ev.pointerId)})}
actionButton('strikeButton',strike);actionButton('dashButton',dash);actionButton('pulseButton',pulse);actionButton('shiftButton',shift);
addEventListener('keydown',ev=>{keys.add(ev.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(ev.code))ev.preventDefault();if(ev.repeat)return;if(scene==='game'){if(ev.code==='Space')strike();if(ev.code==='ShiftLeft'||ev.code==='ShiftRight')dash();if(ev.code==='KeyQ')pulse();if(ev.code==='KeyF')shift();if(ev.code==='KeyE')interact();if(ev.code==='KeyM')$('mapButton').click();if(ev.code==='Escape')pause()}else if(ev.code==='Escape')back()});addEventListener('keyup',ev=>keys.delete(ev.code));
function region(x,y){if(Math.hypot(x,y)<22)return 0;return x<0?(y<0?1:3):(y<0?2:4)}
function palette(x,y){return PALETTES[arena?arena.zone:region(x,y)]}
function scr(x,y,z=0){return {x:SW/2+(x-camera.x)*unit,y:SH/2+(y-camera.y)*unit*.73-z*unit}}
function circle(x,y,r,color,alpha=1){c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.fill();c.globalAlpha=1}
function strokeCircle(x,y,r,color,width=1,alpha=1,start=0,end=TAU){c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(.1,r),start,end);c.stroke();c.globalAlpha=1}
function polygon(pts,fill,stroke=null){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke()}}
function line(x1,y1,x2,y2,col,w){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
function glow(x,y,r,color,alpha=1){let g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.globalAlpha=alpha;c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.globalAlpha=1}
function terrainColor(z,t){let p=PALETTES[z];return p.ground[Math.floor(t*3)%3]}

// RIFTCORE COLLISION SYSTEM — authored landmarks and deterministic biome props.
const LANDMARKS=[
 {id:0,x:5.2,y:-8.1,kind:'observatory',name:'THE FALLEN OBSERVATORY',radius:2.1},
 {id:1,x:-8.8,y:5.6,kind:'lake',name:'MIRRORWELL',radius:2.0},
 {id:2,x:-10.6,y:-5.5,kind:'bridge',name:'THE PHASE BRIDGE',radius:1.7},
 {id:3,x:7.5,y:7.8,kind:'sanctuary',name:'MOONVEIL SHRINE',radius:1.4}
];
function blockerAt(x,y){
 if(arena)return Math.abs(x)>11.5||Math.abs(y)>9.4;
 if(Math.hypot(x,y)<4.5||portals.some(o=>Math.hypot(o.x-x,o.y-y)<3.3))return false;
 for(let o of LANDMARKS){let d=Math.hypot(o.x-x,o.y-y);if(o.kind==='lake'&&d<1.55)return !state?.phase;if(o.kind==='bridge'&&d<.95)return !state?.phase;if(o.kind==='observatory'&&d<1.05)return true;}
 let r=region(x,y),h=fract(x,y,state?.seed||69217);
 if(r===3&&h>.735)return !state?.phase;
 if(r===2&&h>.76)return true;
 let bx=Math.round(x/2)*2,by=Math.round(y/2)*2;
 let rr=rnd(bx,by,6),hh=fract(bx,by,state?.seed||69217),d=Math.hypot(bx,by);
 if(d>5&&hh<.70&&rr>.84&&Math.hypot(x-bx,y-by)<.48)return true;
 return false;
}
function moveBody(p,dx,dy,r=.28){
 let x=clamp(p.x+dx,-114,114),y=clamp(p.y+dy,-114,114);
 if(!blockerAt(x+r,y)&&!blockerAt(x-r,y)&&!blockerAt(x,y+r)&&!blockerAt(x,y-r)) {p.x=x;p.y=y;return true;}
 if(!blockerAt(x+r,p.y)&&!blockerAt(x-r,p.y)){p.x=x;return true;}
 if(!blockerAt(p.x,y+r)&&!blockerAt(p.x,y-r)){p.y=y;return true;}
 return false;
}
function drawLandmark(o){let s=scr(o.x,o.y),u=unit,t=clock;
 if(o.kind==='lake'){
  c.save();c.translate(s.x,s.y);c.scale(1,.74);glow(0,0,u*3.2,'#40bdd7',.25);
  for(let k=0;k<5;k++)strokeCircle(0,0,u*(1.25+k*.27)+Math.sin(t*1.7+k)*3,'#88eff2',1.5,.3);
  circle(0,0,u*1.5,'#174d63',.94);circle(0,0,u*1.12,'#276c7d',.85);
  for(let k=0;k<8;k++){let a=k*TAU/8;polygon([[Math.cos(a)*u*1.5,Math.sin(a)*u*1.5],[Math.cos(a+.16)*u*2,Math.sin(a+.16)*u*2],[Math.cos(a-.13)*u*1.9,Math.sin(a-.13)*u*1.9]],'#6c92a0');}
  c.restore();
 }else if(o.kind==='observatory'){
  c.save();c.translate(s.x,s.y);glow(0,-u,u*3,'#69ead7',.25);circle(0,0,u*1.45,'#051b2a99');
  for(let i=0;i<7;i++){let a=i*TAU/7;let xx=Math.cos(a)*u*1.9,yy=Math.sin(a)*u*.95;polygon([[xx-u*.27,yy],[xx,yy-u*(1.5+i%2*.3)],[xx+u*.27,yy]],'#3e6374','#88b2b4');}
  polygon([[-u*1.1,0],[-u*.72,-u*1.2],[u*.61,-u*1.55],[u*1.13,-u*.35],[u*.9,u*.2]],'#315061','#97b8ba');
  polygon([[-u*.72,-u*.6],[0,-u*1.12],[u*.65,-u*.6],[0,-u*.22]],'#102c4b','#5de3e0');
  strokeCircle(0,-u*.85,u*.48,'#72fff3',3,.75,clock*.15,clock*.15+TAU*.86);c.restore();
 }else if(o.kind==='bridge'){
  c.save();c.translate(s.x,s.y);c.scale(1,.75);
  circle(0,0,u*2.05,'#071626');for(let i=-3;i<=3;i++){let x=i*u*.47;
    c.fillStyle=state?.phase?'#ac8bfa':'#304458';c.fillRect(x-u*.19,-u*1.85,u*.38,u*3.7);
    line(x-u*.1,-u*1.8,x-u*.1,u*1.8,state?.phase?'#e0c3ff':'#4b6275',2);
  }glow(0,0,u*2.3,state?.phase?'#cba9ff':'#65b7da',state?.phase?.45:.12);c.restore();
 }else{
  c.save();c.translate(s.x,s.y);glow(0,-u,u*2.4,'#c3a7ff',.22);for(let i=0;i<6;i++){let a=i*TAU/6;let x=Math.cos(a)*u*1.1,y=Math.sin(a)*u*.6;polygon([[x-u*.15,y],[x,y-u*(.6+i%2*.2)],[x+u*.15,y]],'#a2a3bd');}
  polygon([[-u*.6,0],[0,-u*1.7],[u*.55,0],[0,-u*.4]],'#9269bd','#e7c4ff');circle(0,-u*.75,u*.14,'#fff7dc');c.restore();
 }
 c.textAlign='center';c.fillStyle='#e4fffa';c.shadowColor='#071221';c.shadowBlur=9;c.font=`900 ${clamp(u*.19,10,16)}px system-ui`;c.fillText(o.name,s.x,s.y-u*2.5);c.shadowBlur=0;
}
function drawAtmosphere(){
 let glowTint=state?.phase?'#ba7afa':'#61dbbf';
 for(let i=0;i<23;i++){let x=(rnd(i,0,4)*SW+clock*(6+i%4*3))%(SW+120)-60,y=rnd(i,1,4)*SH,sz=(1+rnd(i,2,4)*2)*quality;
 circle(x,y+Math.sin(clock+i)*12,sz,glowTint,.12+Math.sin(clock*1.2+i)*.09);
 }
 let mist=c.createLinearGradient(0,SH*.25,0,SH);mist.addColorStop(0,'#13294100');mist.addColorStop(.75,state?.phase?'#55267312':'#3c9e8620');mist.addColorStop(1,'#06101c44');c.fillStyle=mist;c.fillRect(0,0,SW,SH);
}

function drawTerrain(){
 let z=arena?arena.zone:region(camera.x,camera.y),p=PALETTES[z];c.fillStyle=p.sky;c.fillRect(0,0,SW,SH);
 const xa=Math.floor(camera.x-SW/(2*unit))-2,xb=Math.ceil(camera.x+SW/(2*unit))+2;
 const ya=Math.floor(camera.y-SH/(2*unit*.73))-3,yb=Math.ceil(camera.y+SH/(2*unit*.73))+3;
 for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){
   let q=scr(x,y),r=arena?arena.zone:region(x,y),h=fract(x,y,state?.seed||69217),b=PALETTES[r],n=rnd(x,y,18),u=unit+1,v=unit*.73+1;
   c.fillStyle=terrainColor(r,clamp(h*.77+n*.38,0,.999));c.fillRect(q.x-u/2,q.y-v/2,u,v);
   let groundShade=clamp((h-.47)*1.6,0,.28);if(groundShade>.04){c.fillStyle=`rgba(4,15,30,${groundShade})`;c.fillRect(q.x-u/2,q.y-v/2,u,v)}
   if(arena){if(n>.83){strokeCircle(q.x,q.y,u*.17,b.accent,1,.13)}continue}
   if(r===3&&h>.69){c.fillStyle='#20566f';c.fillRect(q.x-u/2,q.y-v/2,u,v);line(q.x-u*.3,q.y+Math.sin(clock*2+x)*2,q.x+u*.3,q.y+Math.sin(clock*2+x)*2,'#74c9c980',1.2)}
   else if(r===2&&h>.72){c.fillStyle='#9c4938';c.fillRect(q.x-u/2,q.y-v/2,u,v);line(q.x-u*.45,q.y+u*.15,q.x+u*.2,q.y-u*.12,'#ffad6a44',1.5)}
   else if(h>.71){c.fillStyle=b.dark;c.fillRect(q.x-u/2,q.y-v/2,u,v);line(q.x-u*.46,q.y+v*.39,q.x+u*.41,q.y+v*.39,'#06132276',2.7)}
   if(h<.68&&n>.26){let a=rnd(x,y,33),bx=q.x+(a-.5)*u*.7,by=q.y+(rnd(x,y,42)-.5)*v*.8;
     c.globalAlpha=.13+(n*.16);c.fillStyle=b.leaf;c.beginPath();c.ellipse(bx,by,u*(.06+a*.1),v*.045,a*6,0,TAU);c.fill();c.globalAlpha=1;
     if(n>.72){for(let i=0;i<3;i++)line(bx+(i-1)*u*.05,by,bx+(i-1)*u*.06+Math.sin(clock+i+x)*2,by-u*.13,b.leaf,1.4)}
   }
   if(n<.065){circle(q.x,q.y,1+rnd(x,y,8)*1.8,b.accent,.36)}
 }
 // Ground-level illuminated pathways wind between the Anchor and the first gate.
 if(!arena&&Math.hypot(camera.x,camera.y)<35){
   c.save();let points=[];for(let k=0;k<=36;k++){let v=k/3.6;points.push(scr(v,Math.sin(v*.43)*.57-v*.43));}
   c.lineJoin='round';c.lineCap='round';c.beginPath();points.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));
   c.strokeStyle='#091b294d';c.lineWidth=unit*.98;c.stroke();c.strokeStyle='#8fb6a31b';c.lineWidth=unit*.71;c.stroke();
   c.setLineDash([unit*.14,unit*.18]);c.strokeStyle='#e9d7ad55';c.lineWidth=1.6;c.stroke();c.setLineDash([]);c.restore();
 }
 let layer=c.createLinearGradient(0,0,0,SH);layer.addColorStop(0,'#080b1e25');layer.addColorStop(.6,'transparent');layer.addColorStop(1,'#02061855');c.fillStyle=layer;c.fillRect(0,0,SW,SH);
 if(!arena){let a=scr(0,0);glow(a.x,a.y,unit*9,'#49ffdb',.09)}
}
function drawWorldObject(x,y,r){let pos=scr(x,y),p=PALETTES[r],h=rnd(x,y,24),sz=.88+rnd(x,y,25)*.77,u=unit;
  if(h<.54){c.save();c.translate(pos.x,pos.y);c.scale(sz,sz);
   c.fillStyle='#020d1a88';c.beginPath();c.ellipse(u*.12,u*.15,u*.55,u*.19,-.2,0,TAU);c.fill();
   polygon([[-u*.14,0],[u*.2,0],[u*.13,-u*.96],[-u*.09,-u*.92]],'#503f46','#a68f77');
   for(let i=0;i<4;i++){let dy=-u*(.63+i*.28),w=u*(.65-i*.11),wind=Math.sin(clock*.65+x*.51+i)*u*.022;
     polygon([[-w,dy+u*.25],[wind,dy-u*.53],[w*.84,dy+u*.25],[u*.05,dy+u*.10]],i%2?p.leaf:p.dark);
     polygon([[wind,dy-u*.48],[w*.8,dy+u*.22],[u*.05,dy+u*.11]],p.leaf);
     if(i%2===0)line(-w*.7,dy+u*.17,wind,dy-u*.41,'#bbffeb66',1.3);
   }glow(0,-u*1.4,u*.45,p.accent,.1);c.restore();
  }else if(h<.82){
    c.save();c.translate(pos.x,pos.y);c.fillStyle='#04121e99';c.beginPath();c.ellipse(0,u*.11,u*.45,u*.17,0,0,TAU);c.fill();
    polygon([[-u*.49,0],[-u*.29,-u*.25],[u*.14,-u*.39],[u*.48,-u*.04],[u*.24,u*.13]],p.dark);
    polygon([[-u*.30,-u*.17],[-u*.1,-u*.46],[u*.13,-u*.4],[u*.22,-u*.15]],'#8da5ac','#263f5e');c.restore();
  }else{
    c.save();c.translate(pos.x,pos.y);glow(0,-u*.22,u*.84,p.accent,.18);
    polygon([[-u*.2,0],[-u*.12,-u*.53],[u*.11,-u*.86],[u*.23,-u*.05]],p.accent,p.leaf);
    polygon([[0,-u*.16],[u*.12,-u*.65],[u*.21,-u*.15]],'#f4e8fa90');
    for(let i=0;i<4;i++){let a=clock*.5+i*TAU/4;circle(Math.cos(a)*u*.37,-u*.32+Math.sin(a)*u*.27,u*.025,'#f9f8e9',.6)}c.restore();
  }
}
function drawAnchor(){let pos=scr(0,0),sc=unit;glow(pos.x,pos.y-sc,sc*3.2,'#44f4df40',.65);
 for(let n=0;n<12;n++){let a=n*TAU/12+clock*.02;let t=scr(Math.cos(a)*3.4,Math.sin(a)*3.4);circle(t.x,t.y,sc*.13,'#75e3d4',.75);strokeCircle(t.x,t.y,sc*.15,'#c3fbf2',1,.55)}
 c.save();c.translate(pos.x,pos.y);polygon([[-sc*.9,sc*.2],[0,-sc*.4],[sc*.9,sc*.2],[0,sc*.5]],'#2c6880','#4dc7bf');
 polygon([[-sc*.45,-sc*.02],[0,-sc*.6],[sc*.45,-sc*.02],[0,sc*.30]],'#1d3b61','#8adbdc');
 polygon([[-sc*.25,-sc*.15],[0,-sc*1.65],[sc*.3,-sc*.17],[0,sc*.13]],'#4fece3','#cafff9');
 polygon([[0,-sc*1.55],[sc*.27,-sc*.12],[0,sc*.03]],'#198bb9');
 c.restore();glow(pos.x,pos.y-sc*.95,sc*1.6,'#8fffe6',.18);
 for(let i=0;i<4;i++){let a=clock*.6+i*TAU/4,b=scr(Math.cos(a)*1.4,Math.sin(a)*1.1,1.05+Math.sin(clock*2+i)*.2);circle(b.x,b.y,3,'#e7fff9',.75)}
}
function drawPortal(pt){let x=pt.x,y=pt.y,pos=scr(x,y),sc=unit,active=state&&!state.closed.includes(pt.id),color=PALETTES[pt.zone].accent;
 c.save();c.translate(pos.x,pos.y);glow(0,-sc*.9,sc*2.2,color,active?.4:.08);c.scale(1,.84);
 strokeCircle(0,-sc*.9,sc*1.2,'#000917',sc*.25,.9);
 strokeCircle(0,-sc*.9,sc*1.0,active?color:'#66818a',sc*.20,.85);
 if(active){for(let i=0;i<5;i++){let a=clock*(i%2?-.48:.35)+i*TAU/5;strokeCircle(0,-sc*.9,sc*(.63+i*.085),i%2?'#c0fdf6':color,1.8,.8,a,a+2.4)}
  glow(0,-sc*.9,sc*.8,color,.25);for(let i=0;i<9;i++){let a=i*2.4+clock*(.7+i*.02),rx=Math.sin(a)*sc*.78,ry=Math.cos(a)*sc*.68-sc*.9;circle(rx,ry,1.4+i%3,color,.6)}
 }else{strokeCircle(0,-sc*.9,sc*.75,'#9ef7df',2,.25);polygon([[-sc*.22,-sc*.85],[0,-sc*1.15],[sc*.24,-sc*.85],[0,-sc*.54]],'#77edc0')}
 polygon([[-sc*1.0,sc*.06],[-sc*.75,-sc*.28],[-sc*.78,-sc*1.6],[-sc*.55,-sc*1.85],[-sc*.46,sc*.05]],'#586378','#8aa5a6');
 polygon([[sc*1.0,sc*.06],[sc*.75,-sc*.28],[sc*.78,-sc*1.6],[sc*.55,-sc*1.85],[sc*.46,sc*.05]],'#4b536b','#8aa5a6');
 c.restore();c.textAlign='center';c.font=`800 ${clamp(unit*.16,9,15)}px system-ui`;c.fillStyle='#d3fbf2';c.fillText(active?pt.name:'RIFT SEALED',pos.x,pos.y-sc*2.1)
}
function drawHero(){if(!state)return;let p=state.p,s=scr(p.x,p.y),u=unit,walking=movementIntensity,walk=Math.sin(clock*12.8)*walking,face=p.face||0;
 c.save();c.translate(s.x,s.y);c.scale(1.16,1.16);
 c.fillStyle='#020919aa';c.beginPath();c.ellipse(0,u*.08,u*.39,u*.14,0,0,TAU);c.fill();
 glow(0,-u*.52,u*1.38,state.phase?'#b77afd':'#4edcc8',state.phase?.35:.13);
 c.save();c.translate(0,-u*.63);c.rotate(Math.sin(face)*.16);
 // Split-cloak panels, knees, gilded boots and shoulder plates
 polygon([[-u*.34,u*.28],[-u*.20,u*.68+walk*u*.07],[-u*.03,u*.51],[0,u*.20]],state.phase?'#442c68':'#133750','#6bc7c7');
 polygon([[u*.32,u*.28],[u*.19,u*.68-walk*u*.07],[u*.03,u*.51],[0,u*.20]],state.phase?'#594075':'#204e60','#63a4b7');
 for(let i of [-1,1]){let sway=walk*(i===1?-1:1)*u*.09;polygon([[i*u*.07,u*.2],[i*u*.2,u*.23],[i*u*.21+sway,u*.65],[i*u*.06+sway,u*.65]],'#18283d','#849ca9');polygon([[i*u*.06+sway,u*.59],[i*u*.25+sway,u*.59],[i*u*.25+sway,u*.74],[i*u*.06+sway,u*.74]],'#b59c79')}
 polygon([[-u*.23,-u*.34],[0,-u*.51],[u*.26,-u*.30],[u*.20,u*.30],[0,u*.39],[-u*.23,u*.30]],'#284e67','#91ced4');
 polygon([[-u*.2,-u*.34],[0,-u*.48],[u*.08,-u*.27],[0,u*.17],[-u*.19,u*.08]],'#70b7b3');
 line(0,-u*.25,0,u*.28,'#edc686',u*.045);
 // Shoulders, arm gauntlets
 polygon([[-u*.38,-u*.31],[-u*.24,-u*.53],[-u*.08,-u*.30],[-u*.26,-u*.10]],'#9fbbc1','#3d6674');
 polygon([[u*.38,-u*.31],[u*.24,-u*.53],[u*.08,-u*.30],[u*.26,-u*.10]],'#a8d6d4','#3d6674');
 polygon([[-u*.31,-u*.12],[-u*.45,u*.2],[-u*.31,u*.26],[-u*.18,-u*.08]],'#305778','#6adaca');
 polygon([[u*.31,-u*.12],[u*.45,u*.2],[u*.31,u*.26],[u*.18,-u*.08]],'#3f6b83','#90e5d6');
 // Helm silhouette with expressive illuminated faceplate, crown crest and cheek guards
 polygon([[-u*.22,-u*.45],[-u*.27,-u*.85],[0,-u*1.06],[u*.28,-u*.85],[u*.22,-u*.46]],'#111c37','#b5e6e8');
 polygon([[-u*.19,-u*.77],[0,-u*.94],[u*.20,-u*.76],[u*.12,-u*.55],[-u*.13,-u*.55]],'#375c82','#8fe7db');
 polygon([[-u*.19,-u*.73],[0,-u*.68],[u*.19,-u*.73],[u*.13,-u*.60],[-u*.13,-u*.60]],'#d8f1e0');
 polygon([[-u*.065,-u*.99],[0,-u*1.20],[u*.07,-u*.99],[0,-u*.83]],'#e1cb8d');
 // Directional enchanted blade: rotation follows player heading and swings through real hit arc
 c.save();c.translate(u*.33,-u*.12);c.rotate(Math.sin(face)*.3 + (attackVisual>0?Math.sin((1-attackVisual/.25)*Math.PI)*1.25-.75:.18));
 polygon([[-u*.08,u*.20],[u*.08,u*.20],[u*.095,-u*.57],[0,-u*.95],[-u*.08,-u*.55]],state.phase?'#b995f9':'#b9f7e5','#effff8');
 line(-u*.26,u*.19,u*.26,u*.19,'#dfbd87',u*.10);circle(0,u*.23,u*.10,'#f8dca0');
 glow(0,-u*.45,u*.42,state.phase?'#c5a0ff':'#9cfceb',.30);c.restore();
 c.restore();
 if(attackVisual>0){let alpha=attackVisual/.25;let a=face;strokeCircle(0,-u*.58,u*1.04,alpha>.6?'#fff2c4':'#68fbe6',u*.12,alpha,a-.75,a+.93);strokeCircle(0,-u*.58,u*.90,'#ffffff',u*.035,alpha,a-.70,a+.94)}
 if(heroHit>0)glow(0,-u*.65,u,'#ff5775',Math.min(.38,heroHit*.6));
 c.restore();
}
function drawEnemy(e){let s=scr(e.x,e.y),v=ENEMY[e.type],u=unit*(e.type==='brute'?1.3:e.type==='sentinel'?2.05:.87),t=clock*3+e.id,col=v.color;
 c.save();c.translate(s.x,s.y);
 c.fillStyle='#020a14a3';c.beginPath();c.ellipse(0,u*.06,u*.5,u*.19,0,0,TAU);c.fill();
 if(e.windup>0){glow(0,-u*.6,u*1.55,'#ff5c73',.26);strokeCircle(0,0,u*1.23,'#ff6376',3,.48+Math.sin(t*5)*.2)}
 if(e.type==='wisp'){
   let yy=-u*(.77+Math.sin(t)*.12);glow(0,yy,u*.97,col,.31);for(let i=0;i<4;i++){let a=t*.3+i*TAU/4;polygon([[Math.cos(a)*u*.54,yy+Math.sin(a)*u*.3],[Math.cos(a)*u*.99,yy+Math.sin(a)*u*.63],[Math.cos(a+.2)*u*.34,yy+Math.sin(a+.2)*u*.2]],'#5b9dae');}
   polygon([[-u*.37,yy],[0,yy-u*.54],[u*.38,yy],[0,yy+u*.36]],'#a2fcf2','#e2ffff');circle(0,yy-u*.11,u*.115,'#ffffff');
 }else if(e.type==='stalker'){
   let cy=-u*.50,bob=Math.sin(t*2)*u*.07;
   polygon([[-u*.48,0],[-u*.44,cy+bob],[0,cy-u*.29+bob],[u*.48,cy+bob],[u*.39,0]],'#792b5f',col);
   for(let i of [-1,1]){
     polygon([[i*u*.38,cy],[i*u*.6,cy-u*.67],[i*u*.03,cy-u*.25]],col,'#ffd3dc');
     line(i*u*.2,cy+u*.22,i*u*.42,cy+u*.53+Math.sin(t+i)*u*.09,'#e7809b',u*.09);
     circle(i*u*.12,cy-bob,u*.067,'#fff7e6');
   }line(-u*.1,cy+u*.15,u*.11,cy+u*.15,'#c9bbbe',1);
 }else if(e.type==='brute'){
   polygon([[-u*.45,0],[-u*.57,-u*.95],[0,-u*1.35],[u*.57,-u*.95],[u*.45,0]],'#665d69','#dbc6ac');
   for(let i of [-1,1]){polygon([[i*u*.34,-u*1.01],[i*u*.75,-u*1.36],[i*u*.66,-u*.42],[i*u*.39,-u*.23]],'#9b8274','#e2c39c');circle(i*u*.18,-u*.84,u*.055,'#fff3d4');}
   polygon([[-u*.32,-u*.88],[0,-u*1.56],[u*.34,-u*.88],[0,-u*.6]],'#bca58c','#f6e4cd');
 }else{
   const fury=e.boss&&e.hp/e.maxHp<.58,beat=Math.sin(t*.8)*u*.08;
   glow(0,-u*1.0,u*1.65,fury?'#fb6896':'#b49eff',fury?.35:.24);
   // Massive articulated rune-plate guardian, claws and horns
   for(let i of [-1,1]){
     let reach=i*u*(.70+Math.sin(t*.7+i)*.07);
     polygon([[i*u*.38,-u*1.35],[reach,-u*1.12+beat],[i*u*.91,-u*.35],[i*u*.58,-u*.22]],'#534e80','#b5a5c7');
     for(let k=0;k<3;k++)polygon([[i*u*(.75+k*.08),-u*.37],[i*u*(.90+k*.12),u*.13],[i*u*(.66+k*.12),-u*.1]],fury?'#f67a96':'#ad95d9');
   }
   polygon([[-u*.53,0],[-u*.48,-u*1.16],[-u*.3,-u*1.59],[u*.28,-u*1.59],[u*.52,-u*1.1],[u*.53,0]],'#3a3b70','#9fa6d9');
   polygon([[-u*.54,-u*1.36],[-u*.35,-u*1.98],[0,-u*1.75],[u*.35,-u*1.98],[u*.54,-u*1.36],[0,-u*1.08]],fury?'#ab4c82':'#665d9c','#e3c7f4');
   for(let i of [-1,1])polygon([[i*u*.35,-u*1.78],[i*u*.71,-u*2.48],[i*u*.50,-u*1.36]],'#ceb3df','#eee9ff');
   polygon([[-u*.34,-u*1.55],[0,-u*1.83],[u*.34,-u*1.55],[0,-u*1.24]],'#1c2349','#eccdff');
   circle(0,-u*1.51,u*.11,fury?'#ff9eb3':'#c8fff1');
   for(let k=0;k<6;k++){let a=t*.11+k*TAU/6;circle(Math.cos(a)*u*.72,-u*1.1+Math.sin(a)*u*.48,u*.035,fury?'#ff89b1':'#d4b8ff')}
 }
 if(e.flash>0)glow(0,-u*.7,u*.9,'#ffffff',e.flash*.9);
 c.restore();
 if(e.boss){let w=clamp(SW*.36,250,480),bx=(SW-w)/2,by=SH*.11;
  c.fillStyle='#050b18dd';c.fillRect(bx-12,by-27,w+24,45);c.fillStyle='#eee3fa';c.font='800 12px system-ui';c.textAlign='center';c.fillText(e.hp/e.maxHp<.58?'ASTRAL WARDEN  ·  FRACTURE FURY':'ASTRAL WARDEN  ·  THE FIRST SEAL',SW/2,by-8);
  c.fillStyle='#342548';c.fillRect(bx,by,w,9);c.fillStyle=e.hp/e.maxHp<.58?'#fa718f':'#b8a0ff';c.fillRect(bx,by,w*clamp(e.hp/e.maxHp,0,1),9);
 }else if(e.hp<e.maxHp){c.fillStyle='#081322';c.fillRect(s.x-u*.42,s.y-u*1.74,u*.84,5);c.fillStyle=col;c.fillRect(s.x-u*.42,s.y-u*1.74,u*.84*clamp(e.hp/e.maxHp,0,1),5)}
}
function addParticle(x,y,color,amount=10,speed=2,life=.6){if(particles.length>250)return;for(let i=0;i<amount;i++){let a=Math.random()*TAU,r=(.3+Math.random())*speed;particles.push({x,y,z:.3+Math.random()*.6,vx:Math.cos(a)*r,vy:Math.sin(a)*r,vz:Math.random()*2,life:life*(.55+Math.random()),max:life,color,size:2+Math.random()*3})}}
function ring(x,y,color,radius=.4,speed=4){rings.push({x,y,color,r:radius,speed,life:.6,max:.6})}
function floater(x,y,text,color='#f7dfaa'){floaters.push({x,y,text,color,life:1.25})}
function newEnemy(type,x,y,boss=false){let v=ENEMY[type],scale=1+Math.min(3,(state?.closed.length||0)*.18);enemies.push({type,x,y,hp:v.hp*scale,maxHp:v.hp*scale,id:Math.random()*10,cd:1.5+Math.random()*2,flash:0,boss,stun:0,mode:0,windup:0})}
function spawnWorld(n=1){if(!state||arena)return;for(let i=0;i<n;i++){let a=Math.random()*TAU,d=8+Math.random()*11,x=state.p.x+Math.cos(a)*d,y=state.p.y+Math.sin(a)*d;if(Math.hypot(x,y)<7)continue;if(enemies.some(e=>Math.hypot(e.x-x,e.y-y)<2.5))continue;let r=region(x,y),v=Math.random();newEnemy(v<.17?'brute':v<.49?'wisp':'stalker',x,y);}}
function nearest(max=5){if(!state)return null;let best=null,d=max;for(let e of enemies){let t=Math.hypot(e.x-state.p.x,e.y-state.p.y);if(t<d){d=t;best=e}}return best}
function damageEnemy(e,n,hitx, hity){if(!e||e.hp<=0)return;e.hp-=n;e.flash=.25;e.stun=.18;let d=Math.hypot(e.x-hitx,e.y-hity)||1;e.x+=(e.x-hitx)/d*.28;e.y+=(e.y-hity)/d*.28;addParticle(e.x,e.y,ENEMY[e.type].color,8,2.2,.45);floater(e.x,e.y,n.toFixed(0),'#fff7ce');if(e.hp<=0)kill(e)}
function kill(e){let i=enemies.indexOf(e);if(i>=0)enemies.splice(i,1);addParticle(e.x,e.y,ENEMY[e.type].color,e.boss?48:19,4.5,1.2);ring(e.x,e.y,ENEMY[e.type].color,.15,5);state.kills++;let v=ENEMY[e.type],gain=Math.round(v.xp*(e.boss?2:1)),money=Math.round((e.boss?75:3+Math.random()*6)* (1+state.closed.length*.15));state.p.shards+=money;gainXp(gain);floater(e.x,e.y,`+${money} ✦`,'#ffdd9d');sound(e.boss?110:160,'triangle',e.boss?.75:.2,.045,50);
 if(arena){arena.killed++;if(e.boss){arena.won=true;arena.winTimer=3.7;state.p.shards+=arena.reward;state.closed.push(arena.portal);state.surges++;state.bossDefeats++;state.skillPoints+=2;toast('RIFT SEALED  ·  THE WORLD GROWS QUIETER');save();}}
 else if(state.kills%15===0){toast('HUNTER MILESTONE  ·  +30 STAR SHARDS');state.p.shards+=30}
}
function gainXp(n){let p=state.p;p.xp+=n;while(p.xp>=p.expTo){p.xp-=p.expTo;p.level++;p.expTo=Math.round(p.expTo*1.27+15);p.maxHp+=12;p.maxEnergy+=5;p.attack+=2;state.skillPoints++;p.hp=p.maxHp;p.energy=p.maxEnergy;toast(`ASCENSION  ·  LEVEL ${p.level} · +1 SKILL POINT`);sound(490,'sine',.75,.09,980);ring(p.x,p.y,'#ffdb9c',.6,6)}}
function strike(){if(scene!=='game'||state.attackCd>0)return;
 state.attackCd=.32;attackVisual=.25;state.combo=(state.combo+1)%3;let p=state.p;
 let aims=input.x||input.y?Math.atan2(input.y,input.x):p.face;
 if(!(input.x||input.y)){let target=nearest(2.5);if(target){let angle=Math.atan2(target.y-p.y,target.x-p.x),d=Math.atan2(Math.sin(angle-aims),Math.cos(angle-aims));if(Math.abs(d)<.57)aims=angle;}}
 p.face=aims;let hits=0;
 for(let e of [...enemies]){let d=Math.hypot(e.x-p.x,e.y-p.y);let a=Math.atan2(e.y-p.y,e.x-p.x),diff=Math.atan2(Math.sin(a-aims),Math.cos(a-aims));
   if(d<=2.2+ (state.combo===0?.22:0) && Math.abs(diff)<.83){let bonus=1+state.skills.blade*.16;let dmg=p.attack*bonus*(state.phase?1.35+state.skills.rift*.12:1)*(state.combo===0?1.5:1);damageEnemy(e,dmg,p.x,p.y);hits++;ring(e.x,e.y,'#e9f8df',.10,3);}
 }
 if(hits){shake=Math.min(10,3+hits*2);sound(155+state.combo*70,'triangle',.18,.055,65)}else sound(370,'triangle',.09,.026,130);
 addParticle(p.x+Math.cos(aims)*.9,p.y+Math.sin(aims)*.9,state.phase?'#d8b5ff':'#f4f0ce',8,2,.24);
}
function dash(){if(scene!=='game'||state.dashCd>0)return;state.dashCd=2.15-state.skills.sentinel*.18;let vx=input.x,vy=input.y;if(Math.hypot(vx,vy)<.05){vx=Math.cos(state.p.face);vy=Math.sin(state.p.face)}let d=Math.hypot(vx,vy)||1;for(let i=0;i<10;i++)moveBody(state.p,vx/d*.35,vy/d*.35);invuln=.36;state.p.face=Math.atan2(vy,vx);shake=4;ring(state.p.x,state.p.y,'#93f6f4',.2,7);addParticle(state.p.x,state.p.y,'#8bffe9',22,3,.45);sound(480,'sawtooth',.12,.035,120)}
function pulse(){if(scene!=='game'||state.pulseCd>0)return;if(state.p.energy<30){toast('NOT ENOUGH RIFT ENERGY');return}state.pulseCd=7;state.p.energy-=30;shake=8;ring(state.p.x,state.p.y,state.phase?'#daaeff':'#7effe2',.1,12);addParticle(state.p.x,state.p.y,state.phase?'#d5b3ff':'#78f7df',44,5,.65);for(let e of [...enemies])if(Math.hypot(e.x-state.p.x,e.y-state.p.y)<4.8)damageEnemy(e,state.p.attack*(2.4+state.skills.rift*.27),state.p.x,state.p.y);sound(130,'sawtooth',.55,.06,680)}
function shift(){if(scene!=='game'||state.phaseCd>0)return;if(state.p.energy<20){toast('RIFT ENERGY TOO LOW');return}state.phase=1;state.phaseTime=7+state.skills.rift*.65;state.phaseCd=15-state.skills.rift*.75;state.p.energy-=20;shake=6;ring(state.p.x,state.p.y,'#ce98ff',.1,11);toast('RIFTSHIFT  ·  PHASE BREAKER ACTIVE');addParticle(state.p.x,state.p.y,'#c39fff',36,4,.75);sound(180,'sine',.8,.08,840)}

function nearestRelic(){if(!state||arena)return null;return LANDMARKS.find(o=>!state.relics.includes(o.id)&&Math.hypot(state.p.x-o.x,state.p.y-o.y)<2.8)}
function relicCollect(o){if(state.relics.includes(o.id))return;state.relics.push(o.id);state.p.shards+=45;gainXp(30);toast(`${o.name} DISCOVERED  ·  +45 SHARDS`);ring(o.x,o.y,'#e9ca86',.2,8);save()}
function openSkills(){if(!state||scene!=='game'&&scene!=='pause')return;scene='skills';show('skillsScreen');refreshSkills()}
function refreshSkills(){if(!state)return;const d=$('skillPoints');if(d)d.textContent=state.skillPoints+' POINTS AVAILABLE';for(let name of ['blade','sentinel','rift']){let n=$('skill-'+name);if(n){n.textContent=`${state.skills[name]} / 4 · ${state.skills[name]>=4?'MAXIMUM':state.skillPoints?'UPGRADE':'LOCKED'}`;n.disabled=state.skillPoints<1||state.skills[name]>=4;}}}
function applySkill(name){if(scene!=='skills'||state.skillPoints<1||!Object.hasOwn(state.skills,name)||state.skills[name]>=4)return;
 state.skillPoints--;state.skills[name]++;if(name==='sentinel'){state.p.maxHp+=12;state.p.hp+=12;}if(name==='rift'){state.p.maxEnergy+=10;state.p.energy+=10;}
 sound(510,'sine',.45,.05,880);save();refreshSkills();}
$('skillsButton').onclick=openSkills;$('skillsClose').onclick=resume;
for(let name of ['blade','sentinel','rift'])$('skill-'+name).onclick=()=>applySkill(name);

function interact(){if(scene!=='game'||!state)return;let p=state.p;
 if(arena){if(arena.won){exitArena();return}toast('DEFEAT THE RIFT GUARDIAN');return}
 let relic=nearestRelic();if(relic){relicCollect(relic);return;}if(Math.hypot(p.x,p.y)<3.7){if(p.shards<35){toast('ANCHOR UPGRADE REQUIRES 35 SHARDS');return}p.shards-=35;state.upgrade++;p.attack+=4;p.maxHp+=11;p.hp=p.maxHp;ring(0,0,'#bafff4',.3,8);toast(`ANCHOR FORGED  ·  POWER +4  ·  VITALITY +11`);save();sound(530,'sine',.55,.06,930);return}
 let port=portals.find(pt=>!state.closed.includes(pt.id)&&Math.hypot(pt.x-p.x,pt.y-p.y)<3.3);if(port)enterArena(port);
}
function enterArena(pt){arena={portal:pt.id,zone:pt.zone,origin:{x:state.p.x,y:state.p.y},name:pt.name,killed:0,wave:1,boss:false,won:false,winTimer:0,reward:pt.reward};state.p.x=0;state.p.y=0;enemies=[];projectiles=[];particles=[];ring(0,0,'#e6aaff',.2,7);toast('RIFT SANCTUM  ·  ELIMINATE THE GUARDIANS');for(let i=0;i<5;i++){let a=i*TAU/5;newEnemy(i===1?'brute':i%2?'wisp':'stalker',Math.cos(a)*7,Math.sin(a)*6)}sound(160,'sawtooth',.9,.06,50)}
function exitArena(){if(!arena)return;let old=arena;state.p.x=old.origin.x+1.6;state.p.y=old.origin.y+1.5;arena=null;enemies=[];projectiles=[];particles=[];toast('THE ATLAS WELCOMES YOU BACK');save();spawnWorld(5)}
function updateEnemies(dt){let p=state.p;
 for(let e of [...enemies]){
  if(e.hp<=0)continue;e.cd-=dt;e.stun=Math.max(0,e.stun-dt);e.flash=Math.max(0,e.flash-dt);
  let v=ENEMY[e.type],dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
  if(!arena&&d>29){enemies.splice(enemies.indexOf(e),1);continue}
  if(e.type==='sentinel'&&e.boss){
   if(e.hp/e.maxHp<.57 && !e.enraged){e.enraged=true;arena.phase=2;e.cd=.4;ring(e.x,e.y,'#fc6da6',.1,8);toast('FRACTURE FURY  ·  WATCH THE RUNES');}
   if(e.windup>0){e.windup-=dt;if(e.windup<=0){
      if(e.mode===1){for(let k=0;k<12;k++){let a=k*TAU/12+clock*.01;projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*(e.enraged?6:4.8),vy:Math.sin(a)*(e.enraged?6:4.8),r:.26,color:'#e5adff',damage:e.enraged?15:12,life:3,from:'enemy'});}}
      else if(e.mode===2){let t=e.target||{x:p.x,y:p.y};ring(t.x,t.y,'#ff698e',.1,7);if(Math.hypot(p.x-t.x,p.y-t.y)<1.85)hurt(e.enraged?26:20);addParticle(t.x,t.y,'#fa8ca7',25,4,.65);}
      else{let a=Math.atan2(dy,dx);for(let k of [-.25,0,.25])projectiles.push({x:e.x,y:e.y,vx:Math.cos(a+k)*6.2,vy:Math.sin(a+k)*6.2,r:.29,color:'#ceabff',damage:14,life:3,from:'enemy'});}
      shake=5;
   }}
   if(e.stun<=0&&e.windup<=0){let speed=e.enraged?1.7:1.12;if(d>3.8)moveBody(e,dx/d*speed*dt,dy/d*speed*dt,.36);
     if(e.cd<=0){e.mode=(e.mode+1)%3;e.windup=e.enraged?.72:1.05;e.cd=(e.enraged?1.8:2.4)+e.windup;
       if(e.mode===2)e.target={x:p.x,y:p.y};sound(112,'sawtooth',.27,.022,70);}
   }
   continue;
  }
  if(e.windup>0){e.windup-=dt;if(e.windup<=0&&d<v.range+.45){hurt(v.damage);addParticle(p.x,p.y,'#fa8ca7',6,2,.28);}continue;}
  if(e.stun>0)continue;
  if(e.type==='wisp'){
    let vx=d>4.2?dx/d:d<3?-dx/d*.7:0,vy=d>4.2?dy/d:d<3?-dy/d*.7:0;
    moveBody(e,vx*v.speed*dt,vy*v.speed*dt,.15);
    if(e.cd<=0&&d<9){e.cd=2.5;let a=Math.atan2(dy,dx);projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*4.9,vy:Math.sin(a)*4.9,r:.18,color:v.color,damage:v.damage,life:3,from:'enemy'});sound(270,'triangle',.15,.018,90);}
  }else{
    if(d>v.range*.88)moveBody(e,dx/d*v.speed*dt,dy/d*v.speed*dt,.25);
    if(e.cd<=0&&d<v.range+.35){e.cd=e.type==='brute'?2.6:1.35;e.windup=e.type==='brute'?.62:.35;}
  }
 }
}
function hurt(n){if(scene!=='game'||heroHit>0||invuln>0)return;let p=state.p,damage=Math.max(1,n-p.defense);p.hp=Math.max(0,p.hp-damage);heroHit=.65;shake=7;ring(p.x,p.y,'#ff5775',.2,4);floater(p.x,p.y,`−${damage}`,'#ff8ca9');sound(130,'sawtooth',.27,.07,70);if(p.hp<=0)gameOver()}
function updateProjectiles(dt){for(let b of [...projectiles]){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.hypot(b.x-state.p.x,b.y-state.p.y)<b.r+.43){hurt(b.damage);b.life=0}if(b.life<=0)projectiles.splice(projectiles.indexOf(b),1)}}
function updateFX(dt){for(let a of [...particles]){a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.z+=a.vz*dt;a.vz-=3*dt;if(a.life<=0)particles.splice(particles.indexOf(a),1)}for(let a of [...rings]){a.life-=dt;a.r+=a.speed*dt;if(a.life<=0)rings.splice(rings.indexOf(a),1)}for(let f of [...floaters]){f.life-=dt;f.y-=dt*.85;if(f.life<=0)floaters.splice(floaters.indexOf(f),1)}}
let spawnTimer=2,autosaveTimer=12,attackVisual=0,movementIntensity=0,invuln=0,hitstop=0,gamepadLatch=[false,false,false,false];
function update(dt){if(scene!=='game'||!state)return;state.playtime+=dt;state.p.energy=clamp(state.p.energy+dt*(3.1+state.skills.rift*.5),0,state.p.maxEnergy);state.attackCd=Math.max(0,state.attackCd-dt);state.dashCd=Math.max(0,state.dashCd-dt);state.pulseCd=Math.max(0,state.pulseCd-dt);state.phaseCd=Math.max(0,state.phaseCd-dt);heroHit=Math.max(0,heroHit-dt);attackVisual=Math.max(0,attackVisual-dt);invuln=Math.max(0,invuln-dt);if(state.phase){state.phaseTime-=dt;if(state.phaseTime<=0){state.phase=0;toast('PHASE RESTORED')}}
 let gp=typeof navigator!=='undefined'&&navigator.getGamepads?navigator.getGamepads()?.[0]:null;if(gp){const buttons=[0,1,2,3].map(i=>!!gp.buttons?.[i]?.pressed);if(buttons[0]&&!gamepadLatch[0])strike();if(buttons[1]&&!gamepadLatch[1])dash();if(buttons[2]&&!gamepadLatch[2])pulse();if(buttons[3]&&!gamepadLatch[3])shift();gamepadLatch=buttons;}let mx=(gp&&Math.abs(gp.axes?.[0]||0)>.18?gp.axes[0]:0)+input.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),my=(gp&&Math.abs(gp.axes?.[1]||0)>.18?gp.axes[1]:0)+input.y+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);let len=Math.hypot(mx,my);movementIntensity=clamp(len,0,1);if(len>.08){mx/=Math.max(1,len);my/=Math.max(1,len);let sp=(state.phase?5.9:4.4)*(1+state.skills.sentinel*.055);moveBody(state.p,mx*dt*sp,my*dt*sp);state.steps+=dt*sp;state.p.face=Math.atan2(my,mx)}
 if(arena){state.p.x=clamp(state.p.x,-11.5,11.5);state.p.y=clamp(state.p.y,-9.4,9.4);if(arena.won){arena.winTimer-=dt;if(arena.winTimer<=0)exitArena()}else if(enemies.length===0){if(arena.killed>=6&&!arena.boss){arena.boss=true;newEnemy('sentinel',0,-6,true);arena.phase=1;arena.pattern=0;toast('THE ASTRAL WARDEN AWAKENS');shake=10;sound(70,'sawtooth',1,.065,45)}else if(!arena.boss){arena.wave++;for(let i=0;i<4;i++){let a=i*TAU/4+Math.random()*.6;newEnemy(i===0?'brute':i%2?'wisp':'stalker',Math.cos(a)*8,Math.sin(a)*6)}toast(`RIFT WAVE ${arena.wave}`)}}}
 else{spawnTimer-=dt;if(spawnTimer<=0){spawnTimer=1.8;if(enemies.length<14)spawnWorld(2)}}
 updateEnemies(dt);updateProjectiles(dt);updateFX(dt);
 camera.x=mix(camera.x,state.p.x,Math.min(1,dt*4));camera.y=mix(camera.y,state.p.y,Math.min(1,dt*4));
 autosaveTimer-=dt;if(autosaveTimer<=0){autosaveTimer=12;save()}
 if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)$('notifications').classList.remove('active')}
 hudTimer-=dt;if(hudTimer<=0){hudTimer=.17;updateHUD()}
}
function updateHUD(){if(!state)return;let p=state.p,z=arena?PALETTES[arena.zone].name:region(p.x,p.y)===0?'THE ANCHOR':PALETTES[region(p.x,p.y)].name;
 $('level').textContent=`LV ${p.level}`;$('hpbar').style.width=`${100*p.hp/p.maxHp}%`;$('mpbar').style.width=`${100*p.energy/p.maxEnergy}%`;$('shards').textContent=`✦ ${p.shards}`;$('zone').textContent=arena?`⟡ ${arena.name}`:z;
 let near=portals.find(pt=>!state.closed.includes(pt.id)&&Math.hypot(p.x-pt.x,p.y-pt.y)<3.3),anc=!arena&&Math.hypot(p.x,p.y)<3.7,relic=!arena&&nearestRelic();
 interactTarget=arena?arena.won?'exit':null:relic?'relic':anc?'anchor':near?'portal':null;
 $('interaction').classList.toggle('hidden',!interactTarget);$('interactButton').textContent=interactTarget==='anchor'?`✦ FORGE UPGRADE · 35 SHARDS`:interactTarget==='relic'?'✦ DISCOVER RELIC':interactTarget==='portal'?'◈ ENTER RIFT':'↝ RETURN TO ATLAS';
 $('quest').textContent=arena?arena.won?'Rift stabilized · returning to Atlas':arena.boss?'Defeat the Astral Warden':`Survive the guardians · ${arena.killed} / 6`:state.closed.length===5?'All fractures sealed. The world endures.':`Seal the rifts · ${state.closed.length}/5 · Forge your strength at the Anchor`;
 $('progress').textContent=`${state.closed.length} / 5 RIFTS SEALED  ·  ${state.relics.length} / 4 RELICS`;if($('skillNotify'))$('skillNotify').textContent=state.skillPoints?`✧ ${state.skillPoints}`:'✧';
 for(let [id,cd] of [['dashButton',state.dashCd],['pulseButton',state.pulseCd],['shiftButton',state.phaseCd],['strikeButton',state.attackCd]]){$(id).classList.toggle('disabled',cd>.1)}
}
function drawArena(){let b=arena?PALETTES[arena.zone]:PALETTES[0],center=scr(0,0);for(let i=0;i<3;i++)strokeCircle(center.x,center.y,unit*(6+i*2),b.accent,2,.2+(Math.sin(clock+i)*.11));for(let i=0;i<15;i++){let a=i*TAU/15,r=11.5,pt=scr(Math.cos(a)*r,Math.sin(a)*r);polygon([[pt.x-unit*.35,pt.y],[pt.x,pt.y-unit*(1.2+Math.sin(clock+i)*.2)],[pt.x+unit*.35,pt.y]],b.accent);glow(pt.x,pt.y-unit*.8,unit*.6,b.accent,.2)}glow(center.x,center.y,unit*7,b.accent,.06)}

function drawWarnings(){if(!state)return;for(let e of enemies){if(e.windup>0&&e.type==='sentinel'&&e.boss){let s=scr(e.x,e.y),r=unit*3;
  if(e.mode===2&&e.target){let k=scr(e.target.x,e.target.y);glow(k.x,k.y,unit*2.2,'#fb536f',.25);strokeCircle(k.x,k.y,unit*1.85,'#ff698d',3,.65);line(k.x-unit*.3,k.y,k.x+unit*.3,k.y,'#ffb7c2',3);line(k.x,k.y-unit*.3,k.x,k.y+unit*.3,'#ffb7c2',3)}
  else {strokeCircle(s.x,s.y,r,e.mode===1?'#c7a2ff':'#ff7d9d',4,.65);for(let j=0;j<(e.mode===1?12:3);j++){let a=j*TAU/(e.mode===1?12:3);line(s.x+Math.cos(a)*unit,s.y+Math.sin(a)*unit*.7,s.x+Math.cos(a)*r,s.y+Math.sin(a)*r*.7,'#f1a4cd88',2)}}
 }} }

function drawScene(){c.save();c.setTransform(DPR*quality,0,0,DPR*quality,0,0);c.clearRect(0,0,SW,SH);if(shake>0){c.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.88;if(shake<.25)shake=0}
 drawTerrain();drawWarnings();
 if(!arena){let minx=Math.floor(camera.x-SW/(2*unit))-2,maxx=Math.ceil(camera.x+SW/(2*unit))+2,miny=Math.floor(camera.y-SH/(2*unit*.73))-3,maxy=Math.ceil(camera.y+SH/(2*unit*.73))+3;
 let ents=[];for(let y=miny;y<=maxy;y+=2)for(let x=minx;x<=maxx;x+=2){let r=region(x,y),h=fract(x,y,state?.seed||69217),d=Math.hypot(x,y);if(d>4.5 && h<.70 && rnd(x,y,6)>.71 && Math.hypot(x,y)<110 && !portals.some(pt=>Math.hypot(x-pt.x,y-pt.y)<4.4))ents.push({y,fn:()=>drawWorldObject(x,y,r)})}
 for(let o of LANDMARKS)if(o.x>minx-4&&o.x<maxx+4&&o.y>miny-4&&o.y<maxy+4)ents.push({y:o.y,fn:()=>drawLandmark(o)});
 for(let pt of portals)if(pt.x>minx-3&&pt.x<maxx+3&&pt.y>miny-3&&pt.y<maxy+3)ents.push({y:pt.y,fn:()=>drawPortal(pt)});
 if(Math.hypot(camera.x,camera.y)<25)ents.push({y:0,fn:drawAnchor});
 for(let e of enemies)ents.push({y:e.y,fn:()=>drawEnemy(e)});
 if(state)ents.push({y:state.p.y,fn:drawHero});ents.sort((a,b)=>a.y-b.y);for(let a of ents)a.fn();
 }else{drawArena();for(let e of enemies)drawEnemy(e);drawHero()}
 for(let a of particles){let s=scr(a.x,a.y,a.z),alpha=clamp(a.life/a.max,0,1);circle(s.x,s.y,a.size*a.life/a.max,a.color,alpha)}
 for(let a of rings){let s=scr(a.x,a.y);strokeCircle(s.x,s.y,a.r*unit,a.color,2+(a.life/a.max)*3,a.life/a.max)}
 for(let f of floaters){let s=scr(f.x,f.y,.7);c.globalAlpha=clamp(f.life,0,1);c.fillStyle=f.color;c.textAlign='center';c.font=`bold 16px system-ui`;c.shadowColor='#000';c.shadowBlur=6;c.fillText(f.text,s.x,s.y);c.shadowBlur=0;c.globalAlpha=1}
 for(let b of projectiles){let s=scr(b.x,b.y,.35);glow(s.x,s.y,b.r*unit*3,b.color,.5);circle(s.x,s.y,b.r*unit,b.color,.9)}
 if(state?.phase){c.fillStyle='rgba(115,47,165,.18)';c.fillRect(0,0,SW,SH);let s=scr(state.p.x,state.p.y);for(let i=0;i<6;i++){let a=clock*.45+i*TAU/6;strokeCircle(s.x,s.y,unit*(3+i*.38),'#bc80fb',1,.13,a,a+1.6)}}
 drawAtmosphere();let vg=c.createRadialGradient(SW/2,SH/2,SH*.1,SW/2,SH/2,Math.max(SW,SH)*.71);vg.addColorStop(0,'#00000000');vg.addColorStop(1,'#0008188d');c.fillStyle=vg;c.fillRect(0,0,SW,SH);
 c.restore();}
function drawMenuBackdrop(){if(state){}else{state={seed:69217,p:{x:0,y:0},closed:[]}}let t=clock*.15;camera.x=11+Math.cos(t)*1.25;camera.y=-3+Math.sin(t)*.4;drawScene();let g=c.createLinearGradient(0,0,SW,0);g.addColorStop(0,'#030913e5');g.addColorStop(.48,'#0309138b');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,SW,SH)}
function drawMap(){let cv=$('miniMap'),k=cv.getContext('2d'),w=cv.width,h=cv.height;k.fillStyle='#07182b';k.fillRect(0,0,w,h);let color=['#20566a','#2c6851','#8c4a40','#2b7994','#545187'];for(let yy=0;yy<80;yy++)for(let xx=0;xx<120;xx++){let x=(xx-60)*2,y=(yy-40)*2,r=region(x,y),n=fract(x,y,state.seed);k.fillStyle=n>.72?'#112739':color[r];k.fillRect(xx*5,yy*5,5,5)}for(let pt of portals){let x=w/2+pt.x*2.5,y=h/2+pt.y*2.5;k.beginPath();k.arc(x,y,7,0,TAU);k.fillStyle=state.closed.includes(pt.id)?'#7d9b93':'#ffcb87';k.fill();k.lineWidth=2;k.strokeStyle='#f1faec';k.stroke()}k.fillStyle='#c8fff0';k.beginPath();k.arc(w/2,h/2,8,0,TAU);k.fill();k.fillStyle='#ffffff';k.beginPath();k.arc(w/2+state.p.x*2.5,h/2+state.p.y*2.5,5,0,TAU);k.fill()}
function frame(time){if(!last)last=time;let dt=Math.min(.045,(time-last)/1000);last=time;clock+=dt;try{update(dt);if(scene==='menu'||scene==='help'){drawMenuBackdrop()}else if(state){drawScene()}}catch(err){if(!frame.logged){frame.logged=true;console.error('RIFTCORE_RENDER_ERROR',err)}}requestAnimationFrame(frame)}
addEventListener('pagehide',save);addEventListener('visibilitychange',()=>{if(document.hidden&&scene==='game')save()});
window.RiftGame={back,save,version:'0.2.0-living-atlas-test',debug:()=>({scene,level:state?.p?.level,closed:state?.closed?.length,kills:state?.kills,enemies:enemies.length,arena:!!arena,skills:state?.skills,points:state?.skillPoints,relics:state?.relics,phase:state?.phase,bossPhase:arena?.phase})};
// QA-only inspection hooks. Unavailable in installed APK: MainActivity never supplies ?qa=1.
if(location.search.includes('qa=1'))window.RiftGame.qa={
 place:(x,y,face=0)=>{if(!state)start(true);state.p.x=x;state.p.y=y;state.p.face=face;},
 clearEnemies:()=>{enemies=[];projectiles=[];},
 spawn:(type,x,y)=>{if(ENEMY[type])newEnemy(type,x,y,false);},
 enemies:()=>enemies.map(e=>({type:e.type,hp:e.hp,maxHp:e.maxHp,x:e.x,y:e.y,windup:e.windup})),
 useStrike:()=>{state.attackCd=0;strike()},
 setBoss:()=>{if(!state)start(true);arena={portal:0,zone:0,origin:{x:10,y:-4},name:'FIRST WOUND',killed:9,wave:2,boss:true,won:false,winTimer:0,reward:80,phase:1,pattern:0};enemies=[];state.p.x=0;state.p.y=4;newEnemy('sentinel',0,-5,true);},
 bossHealth:f=>{let boss=enemies.find(e=>e.boss);if(boss)boss.hp=boss.maxHp*clamp(f,0.01,1);},
 invincible:()=>{invuln=600;state.p.hp=state.p.maxHp},
 collision:(x,y)=>blockerAt(x,y),phase:(flag)=>{state.phase=flag?1:0;state.phaseTime=20;},
 position:()=>({x:state.p.x,y:state.p.y})
};
if(location.search.includes('preview=world'))start(true);else mainMenu();console.log('RIFTCORE_MENU_READY');requestAnimationFrame(frame);
})();
