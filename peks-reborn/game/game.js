/* Peks Plunder Reborn — progression, controls and task loop; independent of old game. */
(function(global){"use strict";
const D=global.PEKS_DATA,$=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),KEY="peks-reborn-prealpha-v1";
const S={errors:[],playing:false,paused:false,player:{x:15,z:20},roleId:"bailey",clock:.20,npcs:[],last:0};
let profile={coins:0,days:1,stars:0,completed:0,unlockedIds:[],selected:"bailey",shiftSeconds:0,taskIndex:0,x:15,z:20},engine,chosen="bailey",activeMini=null,toastTimer=0,uiTimer=0;
const byId=id=>D.crew.find(x=>x.id===id),station=id=>D.stations.find(s=>s.id===id);
function load(){try{let raw=localStorage.getItem(KEY);if(raw){let p=JSON.parse(raw);if(p&&Number.isFinite(p.coins)){profile=Object.assign(profile,p);profile.coins=Math.max(0,Math.floor(profile.coins));profile.unlockedIds=Array.isArray(profile.unlockedIds)?profile.unlockedIds.filter(id=>byId(id)&&byId(id).locked):[];profile.days=Math.max(1,Math.floor(profile.days));profile.shiftSeconds=Math.max(0,Math.min(100000,Number(profile.shiftSeconds)||0));profile.completed=Math.max(0,Math.floor(profile.completed||0));profile.taskIndex=Math.max(0,Math.floor(profile.taskIndex||0));profile.x=clamp(Number(profile.x)||15,1,46);profile.z=clamp(Number(profile.z)||20,2,34);}}}catch(e){console.warn("Save read failed",e);}}
function save(){if(S.playing){profile.x=S.player.x;profile.z=S.player.z;profile.shiftSeconds=Math.max(0,profile.shiftSeconds);}try{localStorage.setItem(KEY,JSON.stringify(profile));}catch(e){console.warn("Save write failed",e);}}
function show(id){for(let n of ["front","crewScreen","creditsScreen","miniScreen","pauseScreen"])$(n).classList.toggle("hide",n!==id);let playing=S.playing;$("hud").classList.toggle("hide",!playing);$("controlLayer").classList.toggle("hide",!playing||S.paused||!!activeMini);}
function note(text){const n=$("notice");n.textContent=text;n.style.opacity="1";toastTimer=performance.now()+3000;}
function crewCard(c){let locked=c.locked&&!profile.unlockedIds.includes(c.id),selected=chosen===c.id,icon=c.id==="jimothy"?"🦝":c.id==="spooderman"?"🕷️":c.id==="eddie"?"🏒":c.id==="tera"?"🍹":c.id==="tim"?"🪣":"🧑‍🍳";return '<button type="button" class="crewCard '+(selected?"active ":"")+(locked?"locked":"")+'" data-id="'+c.id+'" style="--personColor:'+c.color+'"><span class="portrait">'+icon+'</span><strong>'+c.name+'</strong><small>'+c.job+'</small><em>'+(locked?"🔒 "+c.cost+" coins":c.coinMult+"× COINS")+'</em></button>';}
function roster(){const box=$("crewCards");box.innerHTML=D.crew.map(crewCard).join("");box.querySelectorAll("[data-id]").forEach(el=>el.addEventListener("click",()=>{chosen=el.dataset.id;roster();}));let c=byId(chosen),locked=c.locked&&!profile.unlockedIds.includes(c.id);$("crewDetails").textContent=c.perk+" · "+c.coinMult+"× coins"+(locked?" · Unlock for "+c.cost+" coins":"")+" · Wallet "+profile.coins;
 $("startShift").textContent=locked?"UNLOCK CREW":"START SHIFT";{let selectedCard=box.querySelector(".crewCard.active");if(selectedCard)selectedCard.scrollIntoView({block:"nearest",inline:"nearest"});}}
function start(){let role=byId(chosen);if(!role)return;if(role.locked&&!profile.unlockedIds.includes(role.id)){if(profile.coins<role.cost){note("Earn "+(role.cost-profile.coins)+" more coins to unlock "+role.name);return;}profile.coins-=role.cost;profile.unlockedIds.push(role.id);save();roster();note(role.name+" unlocked!");return;}
 profile.selected=chosen;S.roleId=chosen;S.player.x=clamp(profile.x||15,1,46);S.player.z=clamp(profile.z||20,2,34);S.playing=true;S.paused=false;activeMini=null;S.clock=(.18+profile.shiftSeconds/170)%1;show(null);hud();save();note("Welcome to the cove, "+role.name+"!");}
function circuit(){let r=byId(S.roleId)||D.crew[0];return D.circuits[r.kind]||D.circuits.server;}
function target(){let path=circuit();return station(path[(profile.taskIndex||0)%path.length]);}
function nearest(){let n=null,d=Infinity;for(let s of D.stations){let v=Math.hypot(s.x-S.player.x,s.z-S.player.z);if(v<d){d=v;n=s;}}return {s:n,d};}
function hud(){let c=byId(S.roleId)||D.crew[0],s=target();$("hudName").textContent=c.name+" • DAY "+profile.days;$("hudTask").textContent="JOB "+((profile.taskIndex%6)+1)+"/6 • "+(s?s.name:"Explore");S.marker=s;const arrow=$("waypoint");if(s){let dx=s.x-S.player.x,dz=s.z-S.player.z;arrow.textContent="➤ "+Math.ceil(Math.hypot(dx,dz))+"m";arrow.style.transform="rotate(0deg)";arrow.title="Next task: "+s.name;}
 $("hudCoins").textContent="🪙 "+profile.coins;let hh=7+Math.floor((profile.shiftSeconds%170)/170*15),mm=Math.floor((profile.shiftSeconds%170)/170*60)%60;$("hudDay").textContent=(hh>=18?"🌙":"☀️")+" "+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");
 const n=nearest();$("nearby").textContent=n.d<2.6?n.s.name:"MOVE TO "+(s?s.name.toUpperCase():"TASK");}
function event(){const events=["A dolphin splashes by the dock!","An alligator glides beyond the pier.","The lemonade station sprays everywhere!","Dan & Diane inspect the restaurant — impress them!","A crab escaped its tank!","An eerie ghost shift breeze rolls through the cove."];let e=events[Math.floor(Math.random()*events.length)];if(S.roleId==="eddie"||Math.random()<.10)e='Eddie: "I found my underwear guys!" Coins spill across the pier!';note(e);}
/* A different interaction for each real job station. No reward for leaving early. */
function miniOpen(s){
 if(!global.PeksChallenges||!s)return;
 S.paused=true;activeMini={station:s,challenge:null};
 const titles={tiki:"TIKI COCKTAIL STATION",cook:"HOT LINE SERVICE",dishes:"WASH AND SANITIZE",prep:"FRESH SALAD PREP",server:"SEAFOOD TABLE SERVICE",manager:"RUN THE SHIFT",decor:"DECORATE THE COVE",crab:"CRAB CATCHING",truck:"DELIVERY TRUCK TETRIS",trash:"SORT THE WASTE",raccoon:"JIMOTHY'S SCAVENGER HUNT"};
 $("miniTitle").textContent=titles[s.kind]||s.name;
 $("miniHelp").textContent="Complete the activity to earn coins.";
 $("miniFill").style.width="0%";$("miniScore").textContent="0%";show("miniScreen");
 activeMini.challenge=global.PeksChallenges.create({
  stage:$("miniStage"),button:$("miniButton"),kind:s.kind,
  onProgress:(n,total,msg)=>{
   $("miniFill").style.width=Math.round(n/total*100)+"%";
   $("miniScore").textContent=n+"/"+total+" completed";
   if(msg)$("miniHelp").textContent=msg;
  },
  onComplete:(stats)=>{
   if(!activeMini)return;
   const role=byId(S.roleId),base=11+Math.min(profile.days,10);
   const quality=Math.max(.7,1-.04*Math.min(stats.errors,7));
   const coins=Math.max(1,Math.round(base*role.coinMult*quality));
   profile.coins+=coins;profile.stars+=1;profile.completed++;profile.taskIndex++;
   if(profile.taskIndex%6===0)profile.coins+=Math.round(12*role.coinMult);
   activeMini.challenge.stop();activeMini=null;S.paused=false;show(null);save();hud();
   note("JOB COMPLETE • +"+coins+" coins"+(profile.taskIndex%6===0?" • CIRCUIT BONUS!":""));
   if(profile.completed%4===0)event();
  }
 });
}
function pause(){if(!S.playing)return;if(activeMini){(activeMini.challenge&&activeMini.challenge.stop());activeMini=null;S.paused=false;}S.paused=true;save();show("pauseScreen");}
function resume(){if(!S.playing)return;S.paused=false;show(null);}
function menu(){save();activeMini=null;S.paused=false;S.playing=false;show("front");}
let joy={x:0,y:0},keys=new Set(),pointer=null;
function bindJoy(){const el=$("joystick"),knob=$("knob");function move(ev){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=ev.clientX-cx,dy=ev.clientY-cy,l=Math.max(1,Math.hypot(dx,dy)),range=r.width*.34,mag=Math.min(range,l);joy.x=dx/l*mag/range;joy.y=dy/l*mag/range;knob.style.left=(50+joy.x*32)+"%";knob.style.top=(50+joy.y*32)+"%";}
 function reset(){pointer=null;joy.x=joy.y=0;knob.style.left="50%";knob.style.top="50%";}
 el.addEventListener("pointerdown",e=>{pointer=e.pointerId;el.setPointerCapture(pointer);move(e);});el.addEventListener("pointermove",e=>{if(e.pointerId===pointer)move(e);});el.addEventListener("pointerup",reset);el.addEventListener("pointercancel",reset);}
/* Level bounds match connected restaurant zones; cabinets and tanks are solid. */
function walkable(x,z){
 const zone=D.zones.some(a=>x>=a.x&&x<=a.x+a.w&&z>=a.z&&z<=a.z+a.h);
 if(!zone)return false;
 const blocked=(cx,cz,rx,rz)=>Math.abs(x-cx)<rx&&Math.abs(z-cz)<rz;
 if(blocked(10,8,3.35,1.0))return false;
 for(const xx of [13.5,18,23])for(const zz of [18,24,29])if(blocked(xx,zz,1.25,.95))return false;
 for(const zz of [20,23,26])if(blocked(5,zz,1.18,.95))return false;
 for(const xx of [29.2,32.5,35.8])if(blocked(xx,13,1.48,1.25))return false;
 if(blocked(31.6,22.6,3.7,1.25))return false;
 for(const xx of [35.5,38.5,41.5])if(blocked(xx,27.7,1.28,1.1))return false;
 if(blocked(42,14.5,1.3,1.65))return false;
 return true;
}
function tick(t){if(S.last&&t-S.last<30){requestAnimationFrame(tick);return;}if(!S.last)S.last=t;const dt=Math.min(.05,(t-S.last)/1000);S.last=t;
 if(S.playing&&!S.paused){let x=joy.x+(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0),y=joy.y+(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0),len=Math.hypot(x,y);if(len>.05){x/=Math.max(1,len);y/=Math.max(1,len);const speed=5.5+((byId(S.roleId).stats[0]||0)*.12);let nx=S.player.x+(x+y)*.707*speed*dt,nz=S.player.z+(y-x)*.707*speed*dt;if(walkable(nx,S.player.z))S.player.x=nx;if(walkable(S.player.x,nz))S.player.z=nz;}
 profile.shiftSeconds+=dt;S.clock=(.18+profile.shiftSeconds/170)%1;if(profile.shiftSeconds>=170){profile.shiftSeconds=0;profile.days++;profile.coins+=12;note("DAY "+profile.days+" • Shift pay +12 coins");save();}
 for(let i=0;i<S.npcs.length;i++){let p=S.npcs[i];p.x+=Math.sin(t*.00041+i*3)*dt*.2;p.z+=Math.cos(t*.00039+i*2)*dt*.18;p.x=clamp(p.x,2,45);p.z=clamp(p.z,3,33);}
 if(t-uiTimer>180){uiTimer=t;hud();}if(profile.completed%3===0&&profile.completed>0&&Math.random()<dt*.001)event();}
 if(t>toastTimer)$("notice").style.opacity="0";
 S.marker=target();try{engine.render(t,S);}catch(err){console.error(err);$("notice").textContent="3D rendering error: "+err.message;$("notice").style.opacity="1";return;}
 requestAnimationFrame(tick);}
/* Owner-only test report. No credentials, precise location or private files are included. */
function exportReport(){
 const record={schema:1,game:"Peks Plunder",build:"Peks Engine 0.2 TEST",generatedAt:new Date().toISOString(),
  day:profile.days,coins:profile.coins,stars:profile.stars,completed:profile.completed,
  role:S.roleId,shiftSeconds:Math.round(profile.shiftSeconds),task:target()&&target().id||null,
  position:S.playing?{x:Math.round(S.player.x*100)/100,z:Math.round(S.player.z*100)/100}:null,
  viewport:{width:innerWidth,height:innerHeight},webgl2:!!(document.createElement("canvas").getContext("webgl2")),
  errors:(S.errors||[]).slice(-20)};
 const json=JSON.stringify(record,null,2);
 if(global.PeksNative&&typeof global.PeksNative.exportDiagnostics==="function"){
  global.PeksNative.exportDiagnostics(json);note("Choose where to save your Peks diagnostics");return;
 }
 const blob=new Blob([json],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="Peks-Plunder-DIAGNOSTICS.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 note("Saved browser diagnostics");
}
function init(){load();chosen=profile.selected&&byId(profile.selected)?profile.selected:"bailey";
 for(let i=0;i<10;i++){let p=D.crew[i],a=D.stations[(i*3+3)%D.stations.length];S.npcs.push({id:p.id,x:a.x+(i%3)*.6,z:a.z+((i+1)%3)*.5});}
 try{engine=new global.PeksEngine.Engine($("world"));}catch(err){console.error(err);$("notice").textContent="Peks Engine: "+err.message;$("notice").style.opacity="1";return;}
 $("newGame").addEventListener("click",()=>{if(profile.completed>0&&!confirm("Start a fresh profile? Existing rebuilt-game progress will be cleared."))return;profile={coins:0,days:1,stars:0,completed:0,unlockedIds:[],selected:"bailey",shiftSeconds:0,taskIndex:0,x:15,z:20};chosen="bailey";roster();show("crewScreen");save();});
 $("continueGame").addEventListener("click",()=>{chosen=profile.selected||"bailey";roster();show("crewScreen");});$("crewBack").addEventListener("click",()=>show("front"));$("startShift").addEventListener("click",start);
 $("creditsButton").addEventListener("click",()=>show("creditsScreen"));$("creditsBack").addEventListener("click",()=>show("front"));
 $("reportBtn").addEventListener("click",exportReport);$("pauseBtn").addEventListener("click",pause);$("resumeBtn").addEventListener("click",resume);$("menuBtn").addEventListener("click",menu);
 $("actionBtn").addEventListener("click",()=>{let n=nearest(),s=target();if(n.d>2.6){note("Move closer to a work station");return;}if(!s||n.s.id!==s.id){note("Your next task is at "+(s?s.name:"the cove"));return;}miniOpen(n.s);});
 $("miniLeave").addEventListener("click",()=>{if(activeMini)(activeMini.challenge&&activeMini.challenge.stop());activeMini=null;S.paused=false;show(null);});
 addEventListener("keydown",e=>{let k=e.key.toLowerCase();keys.add(k);if(k.startsWith("arrow")||k===" ")e.preventDefault();if(k==="escape"&&S.playing)pause();if(k==="e"&&S.playing&&!S.paused)$("actionBtn").click();});
 addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));addEventListener("blur",()=>{keys.clear();if(S.playing)save();});
 addEventListener("error",e=>{S.errors.push(String(e.message||"Unknown error").slice(0,240));if(S.errors.length>30)S.errors.shift();});bindJoy();roster();show("front");requestAnimationFrame(tick);}
global.PeksApp={save,pause,profile:()=>({...profile})};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window);
