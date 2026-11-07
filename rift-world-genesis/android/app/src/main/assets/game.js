/* RIFTCORE / 0.1: original, offline, deterministic touch-first Rift World adventure.
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
const baseState=()=>({seed:69217,p:{x:0,y:0,hp:100,maxHp:100,energy:100,maxEnergy:100,level:1,xp:0,shards:0,attack:17,defense:0,expTo:65,face:1},closed:[],kills:0,steps:0,deaths:0,upgrade:0,playtime:0,phase:0,phaseTime:0,phaseCd:0,attackCd:0,dashCd:0,pulseCd:0,combo:0,surges:0,unlocked:false});
function load(){try{let raw=localStorage.getItem(saveKey);if(!raw)return null;let d=JSON.parse(raw),s=baseState();if(!d||d.schema!==1||!d.player)return null;s.p={...s.p,...d.player};for(let k of ['seed','closed','kills','steps','deaths','upgrade','playtime','surges'])if(d[k]!=null)s[k]=d[k];s.closed=Array.isArray(s.closed)?s.closed.filter(n=>Number.isInteger(n)&&n>=0&&n<=4):[];s.p.hp=clamp(s.p.hp,1,s.p.maxHp);s.p.energy=clamp(s.p.energy,0,s.p.maxEnergy);return s;}catch(_){return null;}}
function save(){if(!state)return false;let d={schema:1,seed:state.seed,player:state.p,closed:state.closed,kills:state.kills,steps:state.steps,deaths:state.deaths,upgrade:state.upgrade,playtime:state.playtime,surges:state.surges};try{localStorage.setItem(saveKey,JSON.stringify(d));return true;}catch(_){toast('Local save unavailable on this device');return false;}}
function resize(){SW=Math.max(320,innerWidth);SH=Math.max(200,innerHeight);DPR=Math.min(2,devicePixelRatio||1);quality=SW*SH>2000000?.75:1;canvas.width=Math.round(SW*DPR*quality);canvas.height=Math.round(SH*DPR*quality);c.setTransform(DPR*quality,0,0,DPR*quality,0,0);unit=clamp(SH*.088,33,70)}
addEventListener('resize',resize);resize();
function show(id){for(const n of ['menu','howto','hud','pause','mapScreen','death'])$(n).classList.add('hidden');$(id).classList.remove('hidden')}
function toast(text){$('notifications').textContent=text;$('notifications').classList.add('active');noticeTime=2.7}
function sound(freq=350,type='sine',length=.15,gain=.06,endFreq=null){try{let A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!sound.ctx)sound.ctx=new A();let a=sound.ctx;if(a.state==='suspended')a.resume();let o=a.createOscillator(),v=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq),a.currentTime+length);v.gain.setValueAtTime(gain,a.currentTime);v.gain.exponentialRampToValueAtTime(.001,a.currentTime+length);o.connect(v);v.connect(a.destination);o.start();o.stop(a.currentTime+length);}catch(_){}}
function start(fresh){state=fresh?baseState():load()||baseState();scene='game';arena=null;enemies=[];projectiles=[];particles=[];rings=[];floaters=[];weather=[];state.p.hp=Math.max(20,state.p.hp);camera.x=state.p.x;camera.y=state.p.y;show('hud');toast('WELCOME TO THE SHATTERED ATLAS');sound(420,'triangle',.4,.035,800);spawnWorld(9);updateHUD();console.log('RIFTCORE_WORLD_STARTED')}
function back(){if(scene==='game')pause();else if(scene==='pause'||scene==='map')resume();else if(scene==='help')mainMenu();else if(scene==='death')respawn()}
function mainMenu(){if(scene==='game'||scene==='pause'||scene==='map')save();scene='menu';show('menu');$('continue').disabled=!load();$('continue').style.opacity=load()?1:.42;}
function pause(){if(scene!=='game')return;scene='pause';save();$('pauseStats').innerHTML=`LEVEL ${state.p.level} WAYFINDER<br>STAR SHARDS ${state.p.shards}<br>RIFTS SEALED ${state.closed.length} / 5<br>CREATURES DEFEATED ${state.kills}<br>TIME EXPLORED ${Math.floor(state.playtime/60)} MIN`;show('pause')}
function resume(){if(!state)return mainMenu();scene='game';show('hud');input.x=input.y=0}
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
function drawTerrain(){let z=arena?arena.zone:region(camera.x,camera.y),p=PALETTES[z];c.fillStyle=p.sky;c.fillRect(0,0,SW,SH);
  const xa=Math.floor(camera.x-SW/(2*unit))-2,xb=Math.ceil(camera.x+SW/(2*unit))+2;
  const ya=Math.floor(camera.y-SH/(2*unit*.73))-3,yb=Math.ceil(camera.y+SH/(2*unit*.73))+3;
  for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){
   let pos=scr(x,y),r=arena?arena.zone:region(x,y),h=fract(x,y,state?.seed||69217),tile=PALETTES[r],n=rnd(x,y,18),u=unit+1,v=unit*.73+1;
   c.fillStyle=terrainColor(r,clamp(h*.8+n*.5,0,.999));c.fillRect(pos.x-u/2,pos.y-v/2,u,v);
   if(r===3 && h>.69){c.fillStyle='#32778b';c.fillRect(pos.x-u/2,pos.y-v/2,u,v);line(pos.x-u/2,pos.y+Math.sin(clock*2+x*.4)*4,pos.x+u/2,pos.y+Math.sin(clock*2+x*.4)*4,'#80c5c455',1.7)}
   else if(r===2&&h>.70){c.fillStyle='#a94c42';c.fillRect(pos.x-u/2,pos.y-v/2,u,v);if(n>.35)glow(pos.x,pos.y,unit*.3,'#ed814247',.38)}
   else if(h>.72){c.fillStyle=tile.dark;c.fillRect(pos.x-u/2,pos.y-v/2,u,v)}
   if(n>.66&&h<.71){let sx=pos.x+(rnd(x,y,33)-.5)*unit*.55,sy=pos.y+(rnd(x,y,42)-.5)*unit*.4;line(sx,sy,sx+Math.sin(clock*1.2+x)*1.3,sy-unit*.08,tile.leaf,1.1)}
   if(n<.025)circle(pos.x,pos.y,1.5,tile.accent,.65);
  }
  let layer=c.createLinearGradient(0,0,0,SH);layer.addColorStop(0,'#080b1e14');layer.addColorStop(.6,'transparent');layer.addColorStop(1,'#00000036');c.fillStyle=layer;c.fillRect(0,0,SW,SH);
  if(!arena){let a=scr(0,0);glow(a.x,a.y,unit*9,'#49ffdb18',.8)}
}
function drawWorldObject(x,y,r){let pos=scr(x,y),p=PALETTES[r],h=rnd(x,y,24),sz=.75+rnd(x,y,25)*.8;
  if(h<.5){
   c.save();c.translate(pos.x,pos.y);c.scale(sz,sz);c.fillStyle='#00101d55';c.beginPath();c.ellipse(0,0,unit*.55,unit*.15,0,0,TAU);c.fill();
   polygon([[-unit*.11,0],[unit*.14,0],[unit*.12,-unit*.84],[-unit*.05,-unit*.76]],'#644b58');
   for(let i=0;i<3;i++){let dy=-unit*(.65+i*.30),w=unit*(.59-i*.13),s=Math.sin(clock*.7+x)*unit*.025;
    polygon([[-w*.82,dy+unit*.28],[s,dy-unit*.40],[w*.81,dy+unit*.28],[0,dy+unit*.13]],i===0?p.dark:i===1?p.leaf:p.accent)}
   circle(0,-unit*1.35,2,p.accent,.75);c.restore();
  }else if(h<.76){circle(pos.x,pos.y,unit*.35,'#000d204f');polygon([[pos.x-unit*.38,pos.y],[pos.x-unit*.25,pos.y-unit*.19],[pos.x+unit*.09,pos.y-unit*.23],[pos.x+unit*.4,pos.y-unit*.03],[pos.x+unit*.32,pos.y+unit*.09]],p.dark);line(pos.x-unit*.21,pos.y-unit*.17,pos.x+unit*.10,pos.y-unit*.19,p.leaf,1)}
  else {c.save();c.translate(pos.x,pos.y);glow(0,-unit*.22,unit*.63,p.accent,.16);polygon([[-unit*.2,0],[-unit*.12,-unit*.5],[unit*.13,-unit*.85],[unit*.22,-unit*.06]],p.accent,p.leaf);polygon([[0,-unit*.16],[unit*.12,-unit*.65],[unit*.21,-unit*.15]],'#f4e8fa90');c.restore()}
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
function drawHero(){if(!state)return;let p=state.p,s=scr(p.x,p.y),sc=unit,walk=Math.sin(clock*12)*Math.min(1,Math.abs(input.x)+Math.abs(input.y));
 c.save();c.translate(s.x,s.y);glow(0,-sc*.35,sc*1.15,state.phase?'#bd7aff':'#4be5f8',state.phase?.45:.24);circle(0,0,sc*.30,'#01071775');
 polygon([[-sc*.30,-sc*.07],[0,-sc*.78],[sc*.31,-sc*.09],[0,-sc*.12]],state.phase?'#3f246c':'#16365b','#b5e8ed');
 polygon([[-sc*.20,-sc*.08],[-sc*.08,sc*.11+walk*sc*.05],[sc*.06,0],[sc*.14,-sc*.21]],'#07152d');
 polygon([[-sc*.05,-sc*.23],[sc*.05,sc*.11-walk*sc*.05],[sc*.22,sc*.05],[sc*.13,-sc*.36]],'#172e49');
 polygon([[-sc*.19,-sc*.35],[-sc*.25,-sc*.78],[0,-sc*.98],[sc*.29,-sc*.73],[sc*.22,-sc*.32],[0,-sc*.21]],state.phase?'#6c49a0':'#2a7390','#abe8eb');
 polygon([[-sc*.18,-sc*.88],[-sc*.22,-sc*1.3],[0,-sc*1.49],[sc*.22,-sc*1.28],[sc*.18,-sc*.88]],'#091833','#66d4df');
 polygon([[-sc*.14,-sc*1.16],[0,-sc*1.29],[sc*.14,-sc*1.16],[0,-sc*1.1]],'#e6e9e0');
 polygon([[sc*.23,-sc*.53],[sc*.45,-sc*.87],[sc*.52,-sc*.83],[sc*.31,-sc*.43]],'#f2d5b1');
 line(sc*.49,-sc*.77,sc*(.52+Math.sin(clock*2)*.03),-sc*1.37,state.phase?'#d0a8ff':'#efffd7',sc*.08);circle(sc*.52,-sc*1.45,sc*.1,'#f5eecf');
 if(state.attackCd>.16){strokeCircle(0,-sc*.61,sc*.95,'#f9dfb9',sc*.12,(state.attackCd-.15)*2.9, (state.attackCd-.15)*2.9+2.1)}
 if(heroHit>0)glow(0,-sc*.7,sc,'#ff5375',heroHit*.65);
 c.restore();
}
function drawEnemy(e){let s=scr(e.x,e.y),v=ENEMY[e.type],sc=unit*(e.type==='brute'?1.35:e.type==='sentinel'?2.05:.8),color=v.color,t=clock*3+e.id;
 c.save();c.translate(s.x,s.y);circle(0,0,sc*.42,'#02061765');glow(0,-sc*.7,sc*1.1,color,.16);
 if(e.type==='wisp'){
  let yy=-sc*(.65+Math.sin(t)*.15);glow(0,yy,sc*.67,color,.38);polygon([[-sc*.38,yy],[0,yy-sc*.55],[sc*.4,yy],[0,yy+sc*.35]],'#84faf3','#eafcfc');for(let i=0;i<3;i++){let a=t+i*TAU/3;circle(Math.cos(a)*sc*.46,yy+Math.sin(a)*sc*.33,sc*.07,'#c8faff')}
 }else if(e.type==='stalker'){
  let cy=-sc*.60;polygon([[-sc*.45,0],[-sc*.35,cy],[0,cy-sc*.32],[sc*.44,cy],[sc*.39,0]],'#8c315f',color);polygon([[-sc*.45,cy-sc*.04],[-sc*.54,cy-sc*.65],[-sc*.11,cy-sc*.37],[0,cy-sc*.18]],color);polygon([[sc*.45,cy-sc*.04],[sc*.54,cy-sc*.65],[sc*.11,cy-sc*.37],[0,cy-sc*.18]],color);circle(-sc*.11,cy,sc*.05,'#fff5df');circle(sc*.11,cy,sc*.05,'#fff5df');
 }else{
  let yy=-sc*.85;polygon([[-sc*.32,0],[-sc*.58,yy],[-sc*.34,yy-sc*.38],[sc*.35,yy-sc*.38],[sc*.58,yy],[sc*.32,0]],e.type==='brute'?'#77625f':'#45417b',color);
  polygon([[-sc*.44,yy-sc*.26],[0,yy-sc*.94],[sc*.45,yy-sc*.26],[0,yy+sc*.03]],color,'#e4c8e1');
  polygon([[-sc*.23,yy-sc*.23],[0,yy-sc*.53],[sc*.22,yy-sc*.23],[0,yy]],'#111b38');circle(0,yy-sc*.23,sc*.085,'#fdf4e1');
  if(e.type==='sentinel'){for(let i=0;i<4;i++){let a=clock*.4+i*TAU/4;circle(Math.cos(a)*sc*.75,yy+Math.sin(a)*sc*.65,sc*.075,'#e9b5ff')}}
 }
 if(e.flash>0)glow(0,-sc*.7,sc*.78,'#ffffff',e.flash*.55);
 c.restore();
 if(e.hp<e.maxHp){c.fillStyle='#070c1d';c.fillRect(s.x-sc*.4,s.y-sc*1.72,sc*.8,4);c.fillStyle=color;c.fillRect(s.x-sc*.4,s.y-sc*1.72,sc*.8*clamp(e.hp/e.maxHp,0,1),4)}
}
function addParticle(x,y,color,amount=10,speed=2,life=.6){if(particles.length>250)return;for(let i=0;i<amount;i++){let a=Math.random()*TAU,r=(.3+Math.random())*speed;particles.push({x,y,z:.3+Math.random()*.6,vx:Math.cos(a)*r,vy:Math.sin(a)*r,vz:Math.random()*2,life:life*(.55+Math.random()),max:life,color,size:2+Math.random()*3})}}
function ring(x,y,color,radius=.4,speed=4){rings.push({x,y,color,r:radius,speed,life:.6,max:.6})}
function floater(x,y,text,color='#f7dfaa'){floaters.push({x,y,text,color,life:1.25})}
function newEnemy(type,x,y,boss=false){let v=ENEMY[type],scale=1+Math.min(3,(state?.closed.length||0)*.18);enemies.push({type,x,y,hp:v.hp*scale,maxHp:v.hp*scale,id:Math.random()*10,cd:1.5+Math.random()*2,flash:0,boss,stun:0,mode:0,windup:0})}
function spawnWorld(n=1){if(!state||arena)return;for(let i=0;i<n;i++){let a=Math.random()*TAU,d=8+Math.random()*11,x=state.p.x+Math.cos(a)*d,y=state.p.y+Math.sin(a)*d;if(Math.hypot(x,y)<7)continue;if(enemies.some(e=>Math.hypot(e.x-x,e.y-y)<2.5))continue;let r=region(x,y),v=Math.random();newEnemy(v<.17?'brute':v<.49?'wisp':'stalker',x,y);}}
function nearest(max=5){if(!state)return null;let best=null,d=max;for(let e of enemies){let t=Math.hypot(e.x-state.p.x,e.y-state.p.y);if(t<d){d=t;best=e}}return best}
function damageEnemy(e,n,hitx, hity){if(!e||e.hp<=0)return;e.hp-=n;e.flash=.25;e.stun=.18;let d=Math.hypot(e.x-hitx,e.y-hity)||1;e.x+=(e.x-hitx)/d*.28;e.y+=(e.y-hity)/d*.28;addParticle(e.x,e.y,ENEMY[e.type].color,8,2.2,.45);floater(e.x,e.y,n.toFixed(0),'#fff7ce');if(e.hp<=0)kill(e)}
function kill(e){let i=enemies.indexOf(e);if(i>=0)enemies.splice(i,1);addParticle(e.x,e.y,ENEMY[e.type].color,e.boss?48:19,4.5,1.2);ring(e.x,e.y,ENEMY[e.type].color,.15,5);state.kills++;let v=ENEMY[e.type],gain=Math.round(v.xp*(e.boss?2:1)),money=Math.round((e.boss?75:3+Math.random()*6)* (1+state.closed.length*.15));state.p.shards+=money;gainXp(gain);floater(e.x,e.y,`+${money} ✦`,'#ffdd9d');sound(e.boss?110:160,'triangle',e.boss?.75:.2,.045,50);
 if(arena){arena.killed++;if(e.boss){arena.won=true;arena.winTimer=3.7;state.p.shards+=arena.reward;state.closed.push(arena.portal);state.surges++;toast('RIFT SEALED  ·  THE WORLD GROWS QUIETER');save();}}
 else if(state.kills%15===0){toast('HUNTER MILESTONE  ·  +30 STAR SHARDS');state.p.shards+=30}
}
function gainXp(n){let p=state.p;p.xp+=n;while(p.xp>=p.expTo){p.xp-=p.expTo;p.level++;p.expTo=Math.round(p.expTo*1.27+15);p.maxHp+=14;p.maxEnergy+=5;p.attack+=3;p.hp=p.maxHp;p.energy=p.maxEnergy;toast(`ASCENSION  ·  WAYFINDER LEVEL ${p.level}`);sound(490,'sine',.75,.09,980);ring(p.x,p.y,'#ffdb9c',.6,6)}}
function strike(){if(scene!=='game'||state.attackCd>0)return;state.attackCd=.37;state.combo=(state.combo+1)%3;let e=nearest(4.1);if(e){let damage=state.p.attack*(state.phase?1.55:1)*(state.combo===0?1.38:1);damageEnemy(e,damage,state.p.x,state.p.y);let a=Math.atan2(e.y-state.p.y,e.x-state.p.x);state.p.face=a;ring(e.x,e.y,'#fcf0cf',.1,2);sound(240+state.combo*60,'triangle',.12,.065,90)}else{ring(state.p.x,state.p.y,'#e8f5e0',.2,2.2);sound(360,'triangle',.09,.035,130)}addParticle(state.p.x+Math.cos(state.p.face)*.9,state.p.y+Math.sin(state.p.face)*.9,'#fef3cd',5,1,.24)}
function dash(){if(scene!=='game'||state.dashCd>0)return;state.dashCd=2.15;let vx=input.x,vy=input.y;if(Math.hypot(vx,vy)<.05){vx=Math.cos(state.p.face);vy=Math.sin(state.p.face)}let d=Math.hypot(vx,vy)||1;state.p.x=clamp(state.p.x+vx/d*3.2,-115,115);state.p.y=clamp(state.p.y+vy/d*3.2,-115,115);shake=4;ring(state.p.x,state.p.y,'#93f6f4',.2,7);addParticle(state.p.x,state.p.y,'#8bffe9',22,3,.45);sound(480,'sawtooth',.12,.035,120)}
function pulse(){if(scene!=='game'||state.pulseCd>0)return;if(state.p.energy<30){toast('NOT ENOUGH RIFT ENERGY');return}state.pulseCd=7;state.p.energy-=30;shake=8;ring(state.p.x,state.p.y,state.phase?'#daaeff':'#7effe2',.1,12);addParticle(state.p.x,state.p.y,state.phase?'#d5b3ff':'#78f7df',44,5,.65);for(let e of [...enemies])if(Math.hypot(e.x-state.p.x,e.y-state.p.y)<4.8)damageEnemy(e,state.p.attack*2.4,state.p.x,state.p.y);sound(130,'sawtooth',.55,.06,680)}
function shift(){if(scene!=='game'||state.phaseCd>0)return;if(state.p.energy<20){toast('RIFT ENERGY TOO LOW');return}state.phase=1;state.phaseTime=7.0;state.phaseCd=15;state.p.energy-=20;shake=6;ring(state.p.x,state.p.y,'#ce98ff',.1,11);toast('RIFTSHIFT  ·  PHASE BREAKER ACTIVE');addParticle(state.p.x,state.p.y,'#c39fff',36,4,.75);sound(180,'sine',.8,.08,840)}
function interact(){if(scene!=='game'||!state)return;let p=state.p;
 if(arena){if(arena.won){exitArena();return}toast('DEFEAT THE RIFT GUARDIAN');return}
 if(Math.hypot(p.x,p.y)<3.7){if(p.shards<35){toast('ANCHOR UPGRADE REQUIRES 35 SHARDS');return}p.shards-=35;state.upgrade++;p.attack+=4;p.maxHp+=11;p.hp=p.maxHp;ring(0,0,'#bafff4',.3,8);toast(`ANCHOR FORGED  ·  POWER +4  ·  VITALITY +11`);save();sound(530,'sine',.55,.06,930);return}
 let port=portals.find(pt=>!state.closed.includes(pt.id)&&Math.hypot(pt.x-p.x,pt.y-p.y)<3.3);if(port)enterArena(port);
}
function enterArena(pt){arena={portal:pt.id,zone:pt.zone,origin:{x:state.p.x,y:state.p.y},name:pt.name,killed:0,wave:1,boss:false,won:false,winTimer:0,reward:pt.reward};state.p.x=0;state.p.y=0;enemies=[];projectiles=[];particles=[];ring(0,0,'#e6aaff',.2,7);toast('RIFT SANCTUM  ·  ELIMINATE THE GUARDIANS');for(let i=0;i<5;i++){let a=i*TAU/5;newEnemy(i===1?'brute':i%2?'wisp':'stalker',Math.cos(a)*7,Math.sin(a)*6)}sound(160,'sawtooth',.9,.06,50)}
function exitArena(){if(!arena)return;let old=arena;state.p.x=old.origin.x+1.6;state.p.y=old.origin.y+1.5;arena=null;enemies=[];projectiles=[];particles=[];toast('THE ATLAS WELCOMES YOU BACK');save();spawnWorld(5)}
function updateEnemies(dt){let p=state.p;for(let e of [...enemies]){if(e.hp<=0)continue;e.cd-=dt;e.stun=Math.max(0,e.stun-dt);e.flash=Math.max(0,e.flash-dt);let v=ENEMY[e.type],dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
 if(!arena&&d>28){enemies.splice(enemies.indexOf(e),1);continue}
 if(e.stun>0)continue;
 if(e.type==='wisp'||e.type==='sentinel'){
  let vx=d>v.range*.82?dx/d:-dx/d*.4,vy=d>v.range*.82?dy/d:-dy/d*.4;e.x+=vx*v.speed*dt;e.y+=vy*v.speed*dt;
  if(e.cd<=0&&d<9){e.cd=e.type==='sentinel'?1.35:2.25;projectiles.push({x:e.x,y:e.y,vx:dx/d*(e.type==='sentinel'?6:4.5),vy:dy/d*(e.type==='sentinel'?6:4.5),r:e.type==='sentinel'?.31:.18,color:v.color,damage:v.damage,life:3,from:'enemy'});if(e.type==='sentinel')for(let a of [-.32,.32])projectiles.push({x:e.x,y:e.y,vx:Math.cos(Math.atan2(dy,dx)+a)*5.3,vy:Math.sin(Math.atan2(dy,dx)+a)*5.3,r:.23,color:'#dbb4ff',damage:13,life:3,from:'enemy'});sound(230,'triangle',.15,.015,90)}
 }else{if(d>v.range*.8){e.x+=dx/d*v.speed*dt;e.y+=dy/d*v.speed*dt}if(e.cd<=0&&d<v.range+(.4)){e.cd=e.type==='brute'?2.3:1.2;e.windup=.24}if(e.windup>0){e.windup-=dt;if(e.windup<=0&&Math.hypot(p.x-e.x,p.y-e.y)<v.range+.55)hurt(v.damage)}}
 }}
function hurt(n){if(scene!=='game'||heroHit>0)return;let p=state.p,damage=Math.max(1,n-p.defense);p.hp=Math.max(0,p.hp-damage);heroHit=.65;shake=7;ring(p.x,p.y,'#ff5775',.2,4);floater(p.x,p.y,`−${damage}`,'#ff8ca9');sound(130,'sawtooth',.27,.07,70);if(p.hp<=0)gameOver()}
function updateProjectiles(dt){for(let b of [...projectiles]){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.hypot(b.x-state.p.x,b.y-state.p.y)<b.r+.43){hurt(b.damage);b.life=0}if(b.life<=0)projectiles.splice(projectiles.indexOf(b),1)}}
function updateFX(dt){for(let a of [...particles]){a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.z+=a.vz*dt;a.vz-=3*dt;if(a.life<=0)particles.splice(particles.indexOf(a),1)}for(let a of [...rings]){a.life-=dt;a.r+=a.speed*dt;if(a.life<=0)rings.splice(rings.indexOf(a),1)}for(let f of [...floaters]){f.life-=dt;f.y-=dt*.85;if(f.life<=0)floaters.splice(floaters.indexOf(f),1)}}
let spawnTimer=2,autosaveTimer=12;
function update(dt){if(scene!=='game'||!state)return;state.playtime+=dt;state.p.energy=clamp(state.p.energy+dt*3.1,0,state.p.maxEnergy);state.attackCd=Math.max(0,state.attackCd-dt);state.dashCd=Math.max(0,state.dashCd-dt);state.pulseCd=Math.max(0,state.pulseCd-dt);state.phaseCd=Math.max(0,state.phaseCd-dt);heroHit=Math.max(0,heroHit-dt);if(state.phase){state.phaseTime-=dt;if(state.phaseTime<=0){state.phase=0;toast('PHASE RESTORED')}}
 let mx=input.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),my=input.y+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);let len=Math.hypot(mx,my);if(len>.08){mx/=Math.max(1,len);my/=Math.max(1,len);let sp=state.phase?5.9:4.4;state.p.x=clamp(state.p.x+mx*dt*sp,-114,114);state.p.y=clamp(state.p.y+my*dt*sp,-114,114);state.steps+=dt*sp;state.p.face=Math.atan2(my,mx)}
 if(arena){state.p.x=clamp(state.p.x,-12,12);state.p.y=clamp(state.p.y,-10,10);if(arena.won){arena.winTimer-=dt;if(arena.winTimer<=0)exitArena()}else if(enemies.length===0){if(arena.killed>=8&&!arena.boss){arena.boss=true;newEnemy('sentinel',0,-7,true);toast('THE HOLLOW SENTINEL EMERGES');shake=10;sound(70,'sawtooth',1,.065,45)}else if(!arena.boss){arena.wave++;for(let i=0;i<4;i++){let a=i*TAU/4+Math.random()*.6;newEnemy(i===0?'brute':i%2?'wisp':'stalker',Math.cos(a)*8,Math.sin(a)*6)}toast(`RIFT WAVE ${arena.wave}`)}}}
 else{spawnTimer-=dt;if(spawnTimer<=0){spawnTimer=1.8;if(enemies.length<14)spawnWorld(2)}}
 updateEnemies(dt);updateProjectiles(dt);updateFX(dt);
 camera.x=mix(camera.x,state.p.x,Math.min(1,dt*4));camera.y=mix(camera.y,state.p.y,Math.min(1,dt*4));
 autosaveTimer-=dt;if(autosaveTimer<=0){autosaveTimer=12;save()}
 if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)$('notifications').classList.remove('active')}
 hudTimer-=dt;if(hudTimer<=0){hudTimer=.17;updateHUD()}
}
function updateHUD(){if(!state)return;let p=state.p,z=arena?PALETTES[arena.zone].name:region(p.x,p.y)===0?'THE ANCHOR':PALETTES[region(p.x,p.y)].name;
 $('level').textContent=`LV ${p.level}`;$('hpbar').style.width=`${100*p.hp/p.maxHp}%`;$('mpbar').style.width=`${100*p.energy/p.maxEnergy}%`;$('shards').textContent=`✦ ${p.shards}`;$('zone').textContent=arena?`⟡ ${arena.name}`:z;
 let near=portals.find(pt=>!state.closed.includes(pt.id)&&Math.hypot(p.x-pt.x,p.y-pt.y)<3.3),anc=!arena&&Math.hypot(p.x,p.y)<3.7;
 interactTarget=arena?arena.won?'exit':null:anc?'anchor':near?'portal':null;
 $('interaction').classList.toggle('hidden',!interactTarget);$('interactButton').textContent=interactTarget==='anchor'?`✦ FORGE UPGRADE · 35 SHARDS`:interactTarget==='portal'?'◈ ENTER RIFT':'↝ RETURN TO ATLAS';
 $('quest').textContent=arena?arena.won?'Rift stabilized · returning to Atlas':arena.boss?'Defeat the Hollow Sentinel':`Survive the guardians · ${arena.killed} / 8`:state.closed.length===5?'All fractures sealed. The world endures.':`Seal the rifts · ${state.closed.length}/5 · Forge your strength at the Anchor`;
 $('progress').textContent=`${state.closed.length} / 5 RIFTS SEALED`;
 for(let [id,cd] of [['dashButton',state.dashCd],['pulseButton',state.pulseCd],['shiftButton',state.phaseCd],['strikeButton',state.attackCd]]){$(id).classList.toggle('disabled',cd>.1)}
}
function drawArena(){let b=arena?PALETTES[arena.zone]:PALETTES[0],center=scr(0,0);for(let i=0;i<3;i++)strokeCircle(center.x,center.y,unit*(6+i*2),b.accent,2,.2+(Math.sin(clock+i)*.11));for(let i=0;i<15;i++){let a=i*TAU/15,r=11.5,pt=scr(Math.cos(a)*r,Math.sin(a)*r);polygon([[pt.x-unit*.35,pt.y],[pt.x,pt.y-unit*(1.2+Math.sin(clock+i)*.2)],[pt.x+unit*.35,pt.y]],b.accent);glow(pt.x,pt.y-unit*.8,unit*.6,b.accent,.2)}glow(center.x,center.y,unit*7,b.accent,.06)}
function drawScene(){c.save();c.setTransform(DPR*quality,0,0,DPR*quality,0,0);c.clearRect(0,0,SW,SH);if(shake>0){c.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.88;if(shake<.25)shake=0}
 drawTerrain();
 if(!arena){let minx=Math.floor(camera.x-SW/(2*unit))-2,maxx=Math.ceil(camera.x+SW/(2*unit))+2,miny=Math.floor(camera.y-SH/(2*unit*.73))-3,maxy=Math.ceil(camera.y+SH/(2*unit*.73))+3;
 let ents=[];for(let y=miny;y<=maxy;y+=2)for(let x=minx;x<=maxx;x+=2){let r=region(x,y),h=fract(x,y,state?.seed||69217),d=Math.hypot(x,y);if(d>4.5 && h<.70 && rnd(x,y,6)>.71 && Math.hypot(x,y)<110 && !portals.some(pt=>Math.hypot(x-pt.x,y-pt.y)<4.4))ents.push({y,fn:()=>drawWorldObject(x,y,r)})}
 for(let pt of portals)if(pt.x>minx-3&&pt.x<maxx+3&&pt.y>miny-3&&pt.y<maxy+3)ents.push({y:pt.y,fn:()=>drawPortal(pt)});
 if(Math.hypot(camera.x,camera.y)<25)ents.push({y:0,fn:drawAnchor});
 for(let e of enemies)ents.push({y:e.y,fn:()=>drawEnemy(e)});
 if(state)ents.push({y:state.p.y,fn:drawHero});ents.sort((a,b)=>a.y-b.y);for(let a of ents)a.fn();
 }else{drawArena();for(let e of enemies)drawEnemy(e);drawHero()}
 for(let a of particles){let s=scr(a.x,a.y,a.z),alpha=clamp(a.life/a.max,0,1);circle(s.x,s.y,a.size*a.life/a.max,a.color,alpha)}
 for(let a of rings){let s=scr(a.x,a.y);strokeCircle(s.x,s.y,a.r*unit,a.color,2+(a.life/a.max)*3,a.life/a.max)}
 for(let f of floaters){let s=scr(f.x,f.y,.7);c.globalAlpha=clamp(f.life,0,1);c.fillStyle=f.color;c.textAlign='center';c.font=`bold 16px system-ui`;c.shadowColor='#000';c.shadowBlur=6;c.fillText(f.text,s.x,s.y);c.shadowBlur=0;c.globalAlpha=1}
 for(let b of projectiles){let s=scr(b.x,b.y,.35);glow(s.x,s.y,b.r*unit*3,b.color,.5);circle(s.x,s.y,b.r*unit,b.color,.9)}
 if(state?.phase){c.fillStyle='rgba(115,47,165,.10)';c.fillRect(0,0,SW,SH);let s=scr(state.p.x,state.p.y);for(let i=0;i<6;i++){let a=clock*.45+i*TAU/6;strokeCircle(s.x,s.y,unit*(3+i*.38),'#bc80fb',1,.13,a,a+1.6)}}
 let vg=c.createRadialGradient(SW/2,SH/2,SH*.1,SW/2,SH/2,Math.max(SW,SH)*.71);vg.addColorStop(0,'#00000000');vg.addColorStop(1,'#0008188d');c.fillStyle=vg;c.fillRect(0,0,SW,SH);
 c.restore();}
function drawMenuBackdrop(){if(state){}else{state={seed:69217,p:{x:0,y:0},closed:[]}}let t=clock*.15;camera.x=11+Math.cos(t)*1.25;camera.y=-3+Math.sin(t)*.4;drawScene();let g=c.createLinearGradient(0,0,SW,0);g.addColorStop(0,'#030913e5');g.addColorStop(.48,'#0309138b');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,SW,SH)}
function drawMap(){let cv=$('miniMap'),k=cv.getContext('2d'),w=cv.width,h=cv.height;k.fillStyle='#07182b';k.fillRect(0,0,w,h);let color=['#20566a','#2c6851','#8c4a40','#2b7994','#545187'];for(let yy=0;yy<80;yy++)for(let xx=0;xx<120;xx++){let x=(xx-60)*2,y=(yy-40)*2,r=region(x,y),n=fract(x,y,state.seed);k.fillStyle=n>.72?'#112739':color[r];k.fillRect(xx*5,yy*5,5,5)}for(let pt of portals){let x=w/2+pt.x*2.5,y=h/2+pt.y*2.5;k.beginPath();k.arc(x,y,7,0,TAU);k.fillStyle=state.closed.includes(pt.id)?'#7d9b93':'#ffcb87';k.fill();k.lineWidth=2;k.strokeStyle='#f1faec';k.stroke()}k.fillStyle='#c8fff0';k.beginPath();k.arc(w/2,h/2,8,0,TAU);k.fill();k.fillStyle='#ffffff';k.beginPath();k.arc(w/2+state.p.x*2.5,h/2+state.p.y*2.5,5,0,TAU);k.fill()}
function frame(time){if(!last)last=time;let dt=Math.min(.045,(time-last)/1000);last=time;clock+=dt;try{update(dt);if(scene==='menu'||scene==='help'){drawMenuBackdrop()}else if(state){drawScene()}}catch(err){if(!frame.logged){frame.logged=true;console.error('RIFTCORE_RENDER_ERROR',err)}}requestAnimationFrame(frame)}
addEventListener('pagehide',save);addEventListener('visibilitychange',()=>{if(document.hidden&&scene==='game')save()});
window.RiftGame={back,save,version:'0.1.0-genesis-alpha',debug:()=>({scene,level:state?.p?.level,closed:state?.closed?.length,kills:state?.kills,enemies:enemies.length,arena:!!arena})};
mainMenu();console.log('RIFTCORE_MENU_READY');requestAnimationFrame(frame);
})();
