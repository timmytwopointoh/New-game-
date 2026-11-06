/* Peks Plunder Reborn — progression, controls and task loop; independent of old game. */
(function(global){"use strict";
const D=global.PEKS_DATA,$=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),KEY="peks-reborn-prealpha-v1";
const S={playing:false,paused:false,player:{x:15,z:20},roleId:"bailey",clock:.20,npcs:[],last:0};
let profile={coins:0,days:1,stars:0,completed:0,unlockedIds:[],selected:"bailey",shiftSeconds:0,taskIndex:0,x:15,z:20},engine,chosen="bailey",activeMini=null,toastTimer=0,uiTimer=0;
const byId=id=>D.crew.find(x=>x.id===id),station=id=>D.stations.find(s=>s.id===id);
function load(){try{let raw=localStorage.getItem(KEY);if(raw){let p=JSON.parse(raw);if(p&&Number.isFinite(p.coins)){profile=Object.assign(profile,p);profile.coins=Math.max(0,Math.floor(profile.coins));profile.unlockedIds=Array.isArray(profile.unlockedIds)?profile.unlockedIds.filter(id=>byId(id)&&byId(id).locked):[];profile.days=Math.max(1,Math.floor(profile.days));profile.shiftSeconds=Math.max(0,Math.min(100000,Number(profile.shiftSeconds)||0));profile.completed=Math.max(0,Math.floor(profile.completed||0));profile.taskIndex=Math.max(0,Math.floor(profile.taskIndex||0));profile.x=clamp(Number(profile.x)||15,1,46);profile.z=clamp(Number(profile.z)||20,2,34);}}}catch(e){console.warn("Save read failed",e);}}
function save(){if(S.playing){profile.x=S.player.x;profile.z=S.player.z;profile.shiftSeconds=Math.max(0,profile.shiftSeconds);}try{localStorage.setItem(KEY,JSON.stringify(profile));}catch(e){console.warn("Save write failed",e);}}
function show(id){for(let n of ["front","crewScreen","creditsScreen","miniScreen","pauseScreen"])$(n).classList.toggle("hide",n!==id);let playing=S.playing;$("hud").classList.toggle("hide",!playing);$("controlLayer").classList.toggle("hide",!playing||S.paused||!!activeMini);}
function note(text){const n=$("notice");n.textContent=text;n.style.opacity="1";toastTimer=performance.now()+3000;}
function crewCard(c){let locked=c.locked&&!profile.unlockedIds.includes(c.id),selected=chosen===c.id,icon=c.id==="jimothy"?"🦝":c.id==="spooderman"?"🕷️":c.id==="eddie"?"🏒":c.id==="tera"?"🍹":c.id==="tim"?"🪣":"🧑‍🍳";return '<button type="button" class="crewCard '+(selected?"active ":"")+(locked?"locked":"")+'" data-id="'+c.id+'" style="--personColor:'+c.color+'"><span class="portrait">'+icon+'</span><strong>'+c.name+'</strong><small>'+c.job+'</small><em>'+(locked?"🔒 "+c.cost+" coins":c.coinMult+"× COINS")+'</em></button>';}
function roster(){const box=$("crewCards");box.innerHTML=D.crew.map(crewCard).join("");box.querySelectorAll("[data-id]").forEach(el=>el.addEventListener("click",()=>{chosen=el.dataset.id;roster();}));let c=byId(chosen),locked=c.locked&&!profile.unlockedIds.includes(c.id);$("crewDetails").textContent=c.perk+" · "+c.coinMult+"× coins"+(locked?" · Unlock for "+c.cost+" coins":"")+" · Wallet "+profile.coins;
 $("startShift").textContent=locked?"UNLOCK CREW":"START SHIFT";box.querySelector(".crewCard.active")?.scrollIntoView({block:"nearest",inline:"nearest"});}
function start(){let role=byId(chosen);if(!role)return;if(role.locked&&!profile.unlockedIds.includes(role.id)){if(profile.coins<role.cost){note("Earn "+(role.cost-profile.coins)+" more coins to unlock "+role.name);return;}profile.coins-=role.cost;profile.unlockedIds.push(role.id);save();roster();note(role.name+" unlocked!");return;}
 profile.selected=chosen;profile.taskIndex=0;S.roleId=chosen;S.player.x=clamp(profile.x||15,1,46);S.player.z=clamp(profile.z||20,2,34);S.playing=true;S.paused=false;activeMini=null;S.clock=(.18+profile.shiftSeconds/170)%1;show(null);hud();save();note("Welcome to the cove, "+role.name+"!");}
function circuit(){let r=byId(S.roleId)||D.crew[0];return D.circuits[r.kind]||D.circuits.server;}
function target(){let path=circuit();return station(path[(profile.taskIndex||0)%path.length]);}
function nearest(){let n=null,d=Infinity;for(let s of D.stations){let v=Math.hypot(s.x-S.player.x,s.z-S.player.z);if(v<d){d=v;n=s;}}return {s:n,d};}
function hud(){let c=byId(S.roleId)||D.crew[0],s=target();$("hudName").textContent=c.name+" • DAY "+profile.days;$("hudTask").textContent="JOB "+((profile.taskIndex%6)+1)+"/6 • "+(s?s.name:"Explore");
 $("hudCoins").textContent="🪙 "+profile.coins;let hh=7+Math.floor((profile.shiftSeconds%170)/170*15),mm=Math.floor((profile.shiftSeconds%170)/170*60)%60;$("hudDay").textContent=(hh>=18?"🌙":"☀️")+" "+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");
 const n=nearest();$("nearby").textContent=n.d<2.6?n.s.name:"MOVE TO "+(s?s.name.toUpperCase():"TASK");}
function event(){const events=["A dolphin splashes by the dock!","An alligator glides beyond the pier.","The lemonade station sprays everywhere!","Dan & Diane inspect the restaurant — impress them!","A crab escaped its tank!","An eerie ghost shift breeze rolls through the cove."];let e=events[Math.floor(Math.random()*events.length)];if(S.roleId==="eddie"||Math.random()<.10)e='Eddie: "I found my underwear guys!" Coins spill across the pier!';note(e);}
const symbols={tiki:["🍋","🍍","🍒","🍹"],cook:["🐟","🔥","🍤","🍽️"],dishes:["🫧","🍽️","🧽","✨"],prep:["🥬","🍅","🔪","🥗"],server:["🍽️","🏃","🍤","⭐"],manager:["📋","⏱️","🤝","✅"],decor:["🌺","🎏","🧽","✨"],crab:["🦀","🪣","🌊","🦀"],truck:["📦","⬛","🟧","📦"],trash:["🗑️","♻️","🧹","✨"],raccoon:["🦝","🪙","🦀","✨"]};
function miniOpen(s){activeMini={station:s,step:0,steps:8,started:performance.now()};S.paused=true;const t={tiki:"MIX THE TIKI COOLER",cook:"HOT LINE RUSH",dishes:"SCRUB AND SANITIZE",prep:"SALAD & PREP",server:"GUEST SERVICE",manager:"MANAGE THE RUSH",decor:"KEEP THE COVE BRIGHT",crab:"CATCH THE CRABS",truck:"LOAD THE DELIVERY TRUCK",trash:"TRASH RUN",raccoon:"JIMOTHY'S MIDNIGHT SCAVENGE"};let kind=s.kind;
 $("miniTitle").textContent=t[kind]||"COVE WORK";$("miniHelp").textContent=kind==="truck"?"Stack the delivery crates in order.":kind==="dishes"?"Clean every plate and rinse thoroughly.":kind==="crab"?"Catch the crabs before they scuttle away.":"Complete the station steps to earn your shift reward.";
 show("miniScreen");miniDraw();}
function miniDraw(){if(!activeMini)return;let m=activeMini,k=m.station.kind,a=symbols[k]||symbols.server;$("miniStage").textContent=a[(Math.floor(m.step/2))%a.length]+"   "+a[(m.step+1)%a.length]+"   "+a[(m.step+2)%a.length];
 $("miniFill").style.width=Math.round(m.step/m.steps*100)+"%";$("miniScore").textContent=Math.round(m.step/m.steps*100)+"%";$("miniButton").textContent=k==="dishes"?"SCRUB":k==="tiki"?"SHAKE":k==="truck"?"PLACE CRATE":k==="crab"?"CATCH":"DO TASK";}
function miniAdvance(){if(!activeMini)return;activeMini.step++;miniDraw();if(activeMini.step>=activeMini.steps){const role=byId(S.roleId),base=11+Math.min(profile.days,10),coins=Math.round(base*role.coinMult);
 profile.coins+=coins;profile.stars+=1;profile.completed++;profile.taskIndex++;if(profile.taskIndex%6===0)profile.coins+=Math.round(12*role.coinMult);
 note("JOB COMPLETE • +"+coins+" coins"+(profile.taskIndex%6===0?" • CIRCUIT BONUS!":""));activeMini=null;S.paused=false;show(null);save();if(profile.completed%4===0)event();hud();}}
function pause(){if(!S.playing)return;if(activeMini){activeMini=null;S.paused=false;}S.paused=true;save();show("pauseScreen");}
function resume(){if(!S.playing)return;S.paused=false;show(null);}
function menu(){save();activeMini=null;S.paused=false;S.playing=false;show("front");}
let joy={x:0,y:0},keys=new Set(),pointer=null;
function bindJoy(){const el=$("joystick"),knob=$("knob");function move(ev){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=ev.clientX-cx,dy=ev.clientY-cy,l=Math.max(1,Math.hypot(dx,dy)),range=r.width*.34,mag=Math.min(range,l);joy.x=dx/l*mag/range;joy.y=dy/l*mag/range;knob.style.left=(50+joy.x*32)+"%";knob.style.top=(50+joy.y*32)+"%";}
 function reset(){pointer=null;joy.x=joy.y=0;knob.style.left="50%";knob.style.top="50%";}
 el.addEventListener("pointerdown",e=>{pointer=e.pointerId;el.setPointerCapture(pointer);move(e);});el.addEventListener("pointermove",e=>{if(e.pointerId===pointer)move(e);});el.addEventListener("pointerup",reset);el.addEventListener("pointercancel",reset);}
function tick(t){if(!S.last)S.last=t;const dt=Math.min(.05,(t-S.last)/1000);S.last=t;
 if(S.playing&&!S.paused){let x=joy.x+(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0),y=joy.y+(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0),len=Math.hypot(x,y);if(len>.05){x/=Math.max(1,len);y/=Math.max(1,len);const speed=5.5+((byId(S.roleId).stats[0]||0)*.12);S.player.x=clamp(S.player.x+(x+y)*.707*speed*dt,1,46);S.player.z=clamp(S.player.z+(y-x)*.707*speed*dt,2,34);}
 profile.shiftSeconds+=dt;S.clock=(.18+profile.shiftSeconds/170)%1;if(profile.shiftSeconds>=170){profile.shiftSeconds=0;profile.days++;profile.coins+=12;note("DAY "+profile.days+" • Shift pay +12 coins");save();}
 for(let i=0;i<S.npcs.length;i++){let p=S.npcs[i];p.x+=Math.sin(t*.00041+i*3)*dt*.2;p.z+=Math.cos(t*.00039+i*2)*dt*.18;p.x=clamp(p.x,2,45);p.z=clamp(p.z,3,33);}
 if(t-uiTimer>180){uiTimer=t;hud();}if(profile.completed%3===0&&profile.completed>0&&Math.random()<dt*.001)event();}
 if(t>toastTimer)$("notice").style.opacity="0";
 try{engine.render(t,S);}catch(err){console.error(err);$("notice").textContent="3D rendering error: "+err.message;$("notice").style.opacity="1";return;}
 requestAnimationFrame(tick);}
function init(){load();chosen=profile.selected&&byId(profile.selected)?profile.selected:"bailey";
 for(let i=0;i<10;i++){let p=D.crew[i],a=D.stations[(i*3+3)%D.stations.length];S.npcs.push({id:p.id,x:a.x+(i%3)*.6,z:a.z+((i+1)%3)*.5});}
 try{engine=new global.PeksEngine.Engine($("world"));}catch(err){console.error(err);$("notice").textContent="Peks Engine: "+err.message;$("notice").style.opacity="1";return;}
 $("newGame").addEventListener("click",()=>{if(profile.completed>0&&!confirm("Start a fresh profile? Existing rebuilt-game progress will be cleared."))return;profile={coins:0,days:1,stars:0,completed:0,unlockedIds:[],selected:"bailey",shiftSeconds:0,taskIndex:0,x:15,z:20};chosen="bailey";roster();show("crewScreen");save();});
 $("continueGame").addEventListener("click",()=>{chosen=profile.selected||"bailey";roster();show("crewScreen");});$("crewBack").addEventListener("click",()=>show("front"));$("startShift").addEventListener("click",start);
 $("creditsButton").addEventListener("click",()=>show("creditsScreen"));$("creditsBack").addEventListener("click",()=>show("front"));
 $("pauseBtn").addEventListener("click",pause);$("resumeBtn").addEventListener("click",resume);$("menuBtn").addEventListener("click",menu);
 $("actionBtn").addEventListener("click",()=>{let n=nearest(),s=target();if(n.d>2.6){note("Move closer to a work station");return;}if(!s||n.s.id!==s.id){note("Your next task is at "+(s?s.name:"the cove"));return;}miniOpen(n.s);});
 $("miniButton").addEventListener("click",miniAdvance);$("miniLeave").addEventListener("click",()=>{activeMini=null;S.paused=false;show(null);});
 addEventListener("keydown",e=>{let k=e.key.toLowerCase();keys.add(k);if(k.startsWith("arrow")||k===" ")e.preventDefault();if(k==="escape"&&S.playing)pause();if(k==="e"&&S.playing&&!S.paused)$("actionBtn").click();});
 addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));addEventListener("blur",()=>{keys.clear();if(S.playing)save();});
 bindJoy();roster();show("front");requestAnimationFrame(tick);}
global.PeksApp={save,pause,profile:()=>({...profile})};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window);
