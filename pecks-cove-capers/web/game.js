/* Peck's Cove Capers: original procedural pixel art and offline mini-game. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cvs = $('world'), ctx = cvs.getContext('2d'), sky=$('sky'), sc=sky.getContext('2d');
ctx.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;
const W=960,H=540,TAU=Math.PI*2;
const C={sea:'#318aa0',sea2:'#6aafaf',sand:'#dfbd81',plank:'#ab7754',plank2:'#c39268',plankLine:'#8b5c4e',wall:'#f5dea9',wallShadow:'#a77c5d',floor:'#d4ac7c',seaDark:'#205e78',mint:'#b4e4bd',foam:'#def7d6',yellow:'#ffe4a0',coral:'#e98a70',ink:'#1b3e4b',white:'#fff2d3'};
const roles=[
 {id:'dishes',name:'Dizzy Dishes',short:'Dizzy',job:'Dish Runner',emoji:'🍽️',skin:'#d5a277',hair:'#5e3b31',shirt:'#ffc16b',hat:'#ffe5a3',accent:'#ef6e68',desc:'Scoop up stray dishes, dodge guests, and race them to the bubbling dish pit.',tasks:[['Grab the plates','Collect dirty plates at table 2',490,304,'🍽',1.1],['Scrub-a-dub','Rush the plates to the dish pit',151,351,'🫧',1.5],['Stack the sparkle','Put clean plates on the service shelf',302,230,'✨',1.2]]},
 {id:'cook',name:'Crispin Skillet',short:'Crispin',job:'Seafood Cook',emoji:'🍳',skin:'#9b634f',hair:'#3e3743',shirt:'#fff0bd',hat:'#ffffff',accent:'#dc765a',desc:'Chop the catch, stir the chowder, and plate a five-star seafood feast.',tasks:[['Fresh catch!','Collect fish at the prep station',245,401,'🐟',1.0],['Chowder time','Stir the simmering soup on the stove',127,204,'🍲',1.7],['Order up!','Plate the special at the service hatch',312,257,'🍤',1.2]]},
 {id:'waiter',name:'Tilly Tray',short:'Tilly',job:'Waiter',emoji:'🧑‍🍳',skin:'#e3b891',hair:'#8d4650',shirt:'#77c8b5',hat:'#f8e0a2',accent:'#ffe2a0',desc:'Balance a packed tray, serve patio guests, and collect cheerful tips.',tasks:[['Pick up order','Collect a freshly cooked order',315,254,'🍛',1.0],['Table service','Bring dinner to the sea-view table',804,284,'🍤',1.4],['Happy guests','Pick up the tip and a big thank-you',804,284,'⭐',.9]]},
 {id:'boss',name:'Captain Cleo',short:'Cleo',job:'The Boss',emoji:'⭐',skin:'#bd8361',hair:'#403c52',shirt:'#9fc3d4',hat:'#315c7a',accent:'#ffc875',desc:'Run a tight ship: check supplies, encourage the crew, and approve the rush.',tasks:[['Supply check','Check the inventory in cold storage',254,398,'📦',1.1],['Crew huddle','Cheer on the team near the kitchen',361,243,'📋',1.4],['Shipshape!','Balance the register at the front desk',706,194,'💰',1.2]]},
 {id:'host',name:'Hattie Hello',short:'Hattie',job:'Greeter',emoji:'👋',skin:'#8f5945',hair:'#2e4247',shirt:'#ff9c91',hat:'#ffc46a',accent:'#fce6ae',desc:'Welcome hungry visitors, find sunny seats, and make everyone feel at home.',tasks:[['Warm welcome','Greet the party at the entrance',705,187,'👋',1.1],['Find a seat','Show guests to the dining table',521,204,'🪑',1.4],['Menus, please','Place menus on the table',521,204,'📖',.9]]},
 {id:'drinks',name:'Mina Mixer',short:'Mina',job:'Tiki Bartender',emoji:'🍹',skin:'#bb886a',hair:'#a05046',shirt:'#ffbd7b',hat:'#77dbb0',accent:'#eb8085',desc:'Mix tropical lemonade, chill the glasses, and serve fruity island treats.',tasks:[['Pick fresh fruit','Gather juicy limes from the supply stand',746,400,'🍋',1.0],['Mix magic','Shake the fruit cooler at the tiki bar',852,358,'🍹',1.5],['Serve sunshine','Serve a cold drink on the deck',811,285,'🧃',1.0]]},
 {id:'busser',name:'Benny Bus',short:'Benny',job:'Table Busser',emoji:'🧹',skin:'#cc9c79',hair:'#a56438',shirt:'#adc8e2',hat:'#4b7895',accent:'#f3c779',desc:'Clear crowded tables, sweep up crumbs, and reset the nicest seats in town.',tasks:[['Table patrol','Gather plates from the busy corner',585,322,'🍽',1.2],['Crumb patrol','Sweep up the crumbs by table 1',494,209,'🧹',1.4],['Ready for more','Reset napkins at table 3',595,327,'🧻',1.1]]},
 {id:'fish',name:'Finn Fillet',short:'Finn',job:'Fish Prep',emoji:'🐟',skin:'#d9a17c',hair:'#404b5c',shirt:'#78b6b5',hat:'#54aaba',accent:'#ecad6f',desc:'Sort the day’s catch, ice the cooler, and send ocean-fresh seafood to the chef.',tasks:[['Dock delivery','Pick up the fresh catch basket',834,455,'🐟',1.0],['Keep it cool','Pack the seafood in the ice chest',238,400,'🧊',1.5],['Prep the catch','Carry the sorted fish to the counter',203,205,'🔪',1.2]]},
 {id:'decor',name:'Dottie Decor',short:'Dottie',job:'Decorator',emoji:'🌺',skin:'#d6ad8f',hair:'#8c5b3f',shirt:'#ef98b2',hat:'#fff0a1',accent:'#91e7ba',desc:'Brighten up the cove with flowers, bunting, and the best sunset photo spot.',tasks:[['Flower power','Water the patio flower boxes',759,439,'🌷',1.2],['Party flags','Fix the colorful pennants on the deck',712,136,'🎏',1.5],['Picture perfect','Polish the sunset photo corner',868,462,'📸',1.0]]},
 {id:'fix',name:'Wrenchy Wade',short:'Wade',job:'Fix-It Expert',emoji:'🔧',skin:'#986c57',hair:'#483c38',shirt:'#f5b27f',hat:'#ffe3a2',accent:'#b7d7e0',desc:'Repair rattling fans, rescue flickering lights, and keep the kitchen working.',tasks:[['Lights out','Fix the dining room hanging lamp',616,142,'💡',1.2],['Fan-tastic','Tighten the ceiling fan near the dock',704,264,'🔧',1.7],['All systems go','Check the kitchen power panel',57,287,'⚡',1.3]]}
];
const sites=[{x:490,y:304},{x:151,y:351},{x:804,y:284},{x:585,y:322},{x:716,y:194},{x:845,y:359},{x:250,y:399}];
let chosen=0, state='menu',game=null,stars=[],sound=true,audio=null,tick=0,last=0,keys={},dpad=null,toastDeadline=0;
const DINER_TABLES=[{x:507,y:233},{x:587,y:339},{x:478,y:350},{x:815,y:288},{x:748,y:379}];
const DINER_NAMES=['Sunny','Mabel','Kai','Juniper','Otis','Pearl','Lou','Poppy'];
const DISHES=[['Grouper','🐟'],['Chowder','🍲'],['Shrimp','🍤'],['Key Lime','🥧']];
const CREW_DIALOGUE={dishes:['Table four made a mountain of plates!','The sink is my kingdom!','Clean plates coming right up!'],cook:['Fresh grouper, hot off the grill!','The chowder needs one more stir.','Order up! Careful, that pan is hot!'],waiter:['Welcome in! Table by the water?','Hot plates coming through!','Can I get you more lemonade?'],boss:['Great hustle, crew. Keep it shipshape!','The sunset rush is starting!','Happy guests keep the cove afloat.'],host:['Welcome to the cove!','There is a lovely table by the water.','Another party is at the door!'],drinks:['One tropical cooler, coming up!','More ice for the tiki bar!','A little lime makes it shine!'],busser:['Clear tables mean happy guests!','Found another fork under the chair.','These napkins are ready to go.'],fish:['Fresh catch from the dock!','Keep that fish on ice!','The chef asked for two more fillets.'],decor:['The flowers love this salty breeze.','A little sunshine for every table!','Those party flags look fabulous.'],fix:['That fan has a loose bolt.','I fixed the lights before dinner!','Even the ghost cannot stop my wrench!']};
function best(){try{return Number(localStorage.getItem('pecks-cove-best')||0)}catch{return 0}}
function saveBest(n){try{localStorage.setItem('pecks-cove-best',String(Math.max(best(),n)))}catch{}}
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill()}
function line(c,x,y,x2,y2,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke()}
function text(c,str,x,y,size=14,color='#fff4d1',align='left',shadow=true){c.font=`900 ${size}px Trebuchet MS,system-ui,sans-serif`;c.textAlign=align;if(shadow){c.fillStyle='#21404b';c.fillText(str,x+2,y+2)}c.fillStyle=color;c.fillText(str,x,y);c.textAlign='left'}
function rounded(c,x,y,w,h,r,color){const q=Math.min(r,w/2,h/2);c.fillStyle=color;c.beginPath();c.moveTo(x+q,y);c.lineTo(x+w-q,y);c.quadraticCurveTo(x+w,y,x+w,y+q);c.lineTo(x+w,y+h-q);c.quadraticCurveTo(x+w,y+h,x+w-q,y+h);c.lineTo(x+q,y+h);c.quadraticCurveTo(x,y+h,x,y+h-q);c.lineTo(x,y+q);c.quadraticCurveTo(x,y,x+q,y);c.closePath();c.fill()}
function sprite(c,x,y,r,s=1,t=0,pose='idle'){
 c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
 const moving=pose==='walk',step=moving?Math.sin(t*13)*2:0,bob=Math.sin(t*3+(roles.indexOf(r)))*.6;
 const wave=pose==='cheer'&&['host','boss','decor','drinks'].includes(r.id);
 const workPose=pose==='work' ? Math.sin(t*18)*3 : 0;
 c.translate(0,Math.round(bob));
 ellipse(c,0,10,17,5,'#173e4a55');
 // legs and boots
 rect(c,-10,6+step,8,11,'#3e5460');rect(c,2,6-step,8,11,'#3e5460');rect(c,-11,13+step,9,5,'#263c4e');rect(c,2,13-step,9,5,'#263c4e');
 // arms with pose
 rect(c,-17,-18-(wave?11:0)+workPose,7,21,r.skin);rect(c,10,-17-workPose,7,21,r.skin);
 rect(c,-13,-21,27,31,r.shirt);rect(c,-13,-21,27,5,r.accent);rect(c,-6,-14,13,22,'#fff2d77a');
 rect(c,-5,-16,10,3,r.accent); // apron bow
 rect(c,-11,-44,23,24,r.skin);rect(c,-12,-42,3,15,'#ae6e52');rect(c,-9,-44,23,7,r.hair);
 rect(c,-5,-35,3,3,'#2f414d');rect(c,5,-35,3,3,'#2f414d');rect(c,0,-29,6,2,'#973f45');
 // character-specific accessories, chunky pixel silhouette
 switch(r.id){
 case 'cook':rect(c,-12,-59,25,14,'#faf4dc');rect(c,-7,-67,18,13,'#fff');rect(c,-15,-49,30,5,'#d6e1d9');break;
 case 'boss':rect(c,-15,-50,30,7,r.hat);rect(c,-4,-58,15,11,r.hat);rect(c,4,-27,4,13,'#274b5a');break;
 case 'waiter':case 'busser':rect(c,-15,-50,28,6,r.hair);rect(c,14,-18,11,3,'#f5e7b7');rect(c,18,-22,14,5,'#b1e5db');break;
 case 'fish':rect(c,-16,-53,32,8,r.hat);rect(c,-7,-59,20,9,r.hat);rect(c,15,-13,15,6,'#86d4d9');break;
 case 'decor':rect(c,-17,-51,34,5,r.hat);rect(c,-8,-57,17,8,r.hat);rect(c,-12,-53,5,6,'#ee8ca7');rect(c,14,-15,8,7,'#f1a2aa');break;
 case 'fix':rect(c,-16,-53,33,7,r.hat);rect(c,-7,-59,17,7,r.hat);rect(c,15,-15,5,16,'#6b6b7d');rect(c,13,-17,10,5,'#b2d4d5');break;
 case 'host':rect(c,-11,-54,24,9,r.hair);rect(c,-16,-21,8,6,'#ffd690');break;
 case 'drinks':rect(c,-12,-50,26,9,r.hat);rect(c,-2,-57,9,9,'#bdf0c8');rect(c,15,-18,9,10,'#ffedb9');rect(c,18,-24,3,9,'#ff8b8a');break;
 default:rect(c,-14,-53,29,7,r.hat);rect(c,-5,-58,17,8,r.hat);break;
 }
 // Individually drawn job tools help the tiny crew read as distinct silhouettes.
 switch(r.id){
 case 'dishes':for(let i=0;i<3;i++){ellipse(c,20,-2-i*5,13,5,'#eef9e1');ellipse(c,20,-3-i*5,8,2,'#8dc2c3')}break;
 case 'cook':rect(c,13,-7,24,4,'#6e4e47');ellipse(c,14,-14,15,8,'#677b83');ellipse(c,13,-15,11,5,'#eea05b');break;
 case 'waiter':rect(c,10,-12,32,3,'#6a5762');ellipse(c,26,-18,15,5,'#d0e7d8');ellipse(c,24,-23,8,5,'#efad6f');break;
 case 'boss':rect(c,15,-23,16,20,'#f2dcac');rect(c,18,-19,10,3,'#6599a9');rect(c,18,-13,8,2,'#6599a9');break;
 case 'host':rect(c,15,-23,26,15,'#f6e2b1');rect(c,18,-20,20,3,'#89a5a0');rect(c,18,-14,13,2,'#89a5a0');break;
 case 'drinks':rect(c,14,-23,19,23,'#ddbc75');rect(c,16,-20,15,17,'#f4c77b');rect(c,22,-29,3,12,'#d9f3ee');ellipse(c,28,-25,7,3,'#9bd39b');break;
 case 'busser':rect(c,19,-35,4,45,'#a57b52');rect(c,11,5,21,8,'#f1bb77');break;
 case 'fish':ellipse(c,25,-10,16,8,'#a7d5d4');rect(c,20,-12,3,3,'#2c576a');rect(c,38,-15,9,10,'#80c2c1');break;
 case 'decor':rect(c,21,-14,3,22,'#56846a');for(let i=0;i<5;i++){const a=i*TAU/5;ellipse(c,22+Math.cos(a)*7,-22+Math.sin(a)*7,5,5,'#f6acc0')}ellipse(c,22,-22,4,4,'#ffe3a3');break;
 case 'fix':rect(c,19,-21,5,31,'#adbfc5');rect(c,13,-25,8,5,'#a9d4d9');rect(c,24,-28,7,10,'#a9d4d9');break;
 }
 c.restore();
}
function portrait(canvas,r,t){const a=canvas.getContext('2d');a.imageSmoothingEnabled=false;a.clearRect(0,0,canvas.width,canvas.height);ellipse(a,52,85,40,10,'#102d3750');for(let i=0;i<5;i++){const x=12+i*21,y=19+(i%2)*13;rect(a,x,y,4,4,'#f7d99388')}sprite(a,52,82,r,1.75,t,'cheer')}
function makeCards(){const box=$('crew');box.replaceChildren();roles.forEach((r,i)=>{const b=document.createElement('button');b.className='crewCard'+(i===chosen?' selected':'');b.setAttribute('aria-label',`Play as ${r.name}, ${r.job}`);b.innerHTML=`<span class="jobPill">${i+1}/10</span><canvas class="portrait" width="104" height="100"></canvas><b>${r.name}</b><small>${r.job}</small>`;b.onclick=()=>choose(i);box.appendChild(b);portrait(b.querySelector('canvas'),r,0)});choose(chosen)}
function choose(i){chosen=i;document.querySelectorAll('.crewCard').forEach((e,n)=>e.classList.toggle('selected',n===i));$('roleTitle').textContent=roles[i].name+' · '+roles[i].job;$('roleDesc').textContent=roles[i].desc;$('best').textContent='★ TOP SCORE '+best()}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');toastDeadline=performance.now()+2150}
function say(msg){$('message').textContent=msg}
function beep(note=520,len=.1,type='sine'){if(!sound)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;oscillator.type=type;oscillator.frequency.setValueAtTime(note,now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(60,note*.78),now+len);gain.gain.setValueAtTime(.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+len);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+len)}catch{}}
function confetti(x,y,n=17,col='#ffe0a2'){if(!game)return;for(let i=0;i<n;i++)game.particles.push({x,y,vx:rnd(-65,65),vy:rnd(-110,-22),life:rnd(.6,1.2),max:1.2,col:Math.random()<.35?'#9fe1ba':col,size:rnd(3,7)})}
function goal(){const r=roles[game.role];return r.tasks[game.done%r.tasks.length]}
function target(){if(!game)return null;const g=goal();return {x:g[2],y:g[3],label:g[0],sub:g[1],icon:g[4],duration:g[5],isMess:false}}
function customersWaiting(){return game?game.customers.filter(c=>c.state==='ordered'):[]}
function serviceTarget(){return game&&game.carryMeal?game.customers.find(c=>c.id===game.carryMeal.id&&c.state==='ordered'):null}
function near(x,y,d=73){return Math.hypot(game.x-x,game.y-y)<d}
function activeTask(){
 if(!game)return null;
 const served=serviceTarget();
 if(served&&near(served.tx,served.ty,92))return {kind:'serve',x:served.tx,y:served.ty,duration:.65,label:'Serve '+served.order[0],guest:served};
 if(game.mess&&near(game.mess.x,game.mess.y,78))return {...game.mess,kind:'ghost'};
 if(customersWaiting().length&&!game.carryMeal&&near(639,258,82))return {kind:'pickup',x:639,y:258,duration:.75,label:'Pick up dinner'};
 const g=target();if(game.done<6&&near(g.x,g.y,75))return {...g,kind:'job'};
 return null;
}
function spawnCustomer(){
 if(!game||game.spawned>=7||game.customers.filter(c=>c.state!=='leaving').length>=6)return;
 const id=game.spawned++,table=DINER_TABLES.find(t=>!game.customers.some(c=>c.table===t&&c.state!=='leaving'))||null;
 const guest={id,name:DINER_NAMES[id%DINER_NAMES.length],x:794,y:119,tx:table?.x||768,ty:table?.y||197,table,state:table?'entering':'queue',order:DISHES[id%DISHES.length],wait:0,eat:0,route:0};game.customers.push(guest);
 if(table){toast(`${guest.name.toUpperCase()} ARRIVED!`);say(`Hattie: Welcome, ${guest.name}! Grab a seat by the water.`)}
}
function moveGuest(c,x,y,dt,speed=64){const dx=x-c.x,dy=y-c.y,dist=Math.hypot(dx,dy);if(dist<speed*dt){c.x=x;c.y=y;return true}c.x+=dx/dist*dt*speed;c.y+=dy/dist*dt*speed;return false}
function updateCustomers(dt){
 if(game.elapsed>game.nextCustomer){spawnCustomer();game.nextCustomer=game.elapsed+8.5}
 for(const c of game.customers){
  if(c.state==='queue'){
   const table=DINER_TABLES.find(t=>!game.customers.some(o=>o!==c&&o.table===t&&o.state!=='leaving'));
   if(table){c.table=table;c.tx=table.x;c.ty=table.y;c.state='entering'}
   else moveGuest(c,771-c.id%3*19,177,dt);
  }else if(c.state==='entering'){
   const seatX=c.tx+((c.id%2)?39:-39),seatY=c.ty-18;
   if(moveGuest(c,seatX,seatY,dt,85)){c.state='seated';c.wait=0}
  }else if(c.state==='seated'){
   c.wait+=dt;if(c.wait>=1.8){c.state='ordered';say(`${c.name}: Could I please have ${c.order[0]}?`)}
  }else if(c.state==='eating'){
   c.eat+=dt;if(c.eat>4){c.state='leaving';c.route=0;say(`${c.name}: That was delicious! See you again!`)}
  }else if(c.state==='leaving'){
   if(c.route===0){if(moveGuest(c,775,180,dt,92))c.route=1}
   else moveGuest(c,792,114,dt,92);
  }
 }
 game.customers=game.customers.filter(c=>!(c.state==='leaving'&&c.route===1&&c.y<=115));
}
function nextDialogue(t){if(!game||game.elapsed<game.nextSpeech)return;game.nextSpeech=game.elapsed+9;
 const i=(Math.floor(game.elapsed/8)+game.role+3)%roles.length;
 const spots=[[95,307],[210,307],[432,391],[524,412],[701,226],[859,397],[582,272],[318,397],[770,245],[436,275]];
 if(i!==game.role&&Math.hypot(spots[i][0]-game.x,spots[i][1]-game.y)<265){const messages=CREW_DIALOGUE[roles[i].id];game.speech={role:i,text:messages[Math.floor(game.elapsed/8)%messages.length],until:game.elapsed+3.7};}
}
function updateHud(){if(!game)return;const r=roles[game.role],t=target();$('roleEmoji').textContent=r.emoji;$('roleJob').textContent=r.job.toUpperCase();$('roleHudName').textContent=r.short;$('time').textContent=`${Math.floor(game.elapsed/60)}:${String(Math.floor(game.elapsed%60)).padStart(2,'0')}`;$('done').textContent=`${game.done}/6 · 🍽${game.served}/3`;$('score').textContent=game.score;$('progressText').textContent=game.mess?'👻 FIX THE PRANK!':game.carryMeal?'🍽 DELIVER TO '+game.carryMeal.name.toUpperCase():game.done>=6?'🍤 SERVE 3 GUESTS':('❗ '+t.label.toUpperCase());}
function begin(){const r=roles[chosen];game={role:chosen,x:461,y:404,lastFacing:1,done:0,score:0,progress:0,work:false,mess:null,ghost:null,nextGhost:18,elapsed:0,particles:[],floats:[],paused:false,ghostCount:0,streak:0,carry:null,carryMeal:null,served:0,spawned:0,nextCustomer:2,customers:[],speech:null,nextSpeech:7,camX:461,camY:365};state='playing';$('titleScreen').classList.add('hidden');$('gameScreen').classList.remove('hidden');$('finish').classList.add('hidden');$('pauseBtn').textContent='Ⅱ';say(`${r.name}: ${CREW_DIALOGUE[r.id][0]} Find the ! marker and HOLD WORK nearby.`);toast('WELCOME TO THE COVE!');beep(660,.1);updateHud()}
function finish(won){if(state!=='playing')return;state='finish';game.paused=true;saveBest(game.score);$('finish').classList.remove('hidden');$('finishIcon').textContent=won?'🏆':'🌅';$('finishTitle').textContent=won?'YOU SAVED THE SHIFT!':'SUNSET AT THE COVE';$('finishBody').textContent=`${roles[game.role].name} finished ${game.done} jobs, served ${game.served} guests, fixed ${game.ghostCount} ghost pranks, and earned ${game.score} coins. ${won?'The crew wants an encore!':'Try another shift and beat your score.'}`;beep(won?880:420,.3)}
function ghostPrank(){if(!game||game.mess||state!=='playing')return;const s=sites[Math.floor(rnd(0,sites.length))];game.ghost={x:s.x,y:s.y-52,t:0};game.mess={x:s.x,y:s.y,label:['Ghostly spill!','Flying cutlery!','Mysterious mess!'][Math.floor(rnd(0,3))],sub:'Clean up the ghost prank before it spreads',icon:'👻',duration:1.5,isMess:true,ttl:22};game.progress=0;say('BOO! The cove ghost made a mess. Hurry over and clean it!');toast('👻 GHOST IN THE RESTAURANT!');beep(244,.3,'sawtooth')}
function completeTask(action=activeTask()){
 if(!game||!action)return false;
 confetti(action.x,action.y,17,action.kind==='ghost'?'#bdedff':'#ffdf82');
 game.progress=0;game.work=false;const role=roles[game.role];
 if(action.kind==='ghost'){
  game.mess=null;game.ghost=null;game.ghostCount++;game.score+=50;
  say('Wade: Whew! That pesky ghost made a fine mess. Thanks for fixing it!');toast('+50 · PRANK FIXED!');beep(750,.17);
 }else if(action.kind==='pickup'){
  const c=customersWaiting()[0];if(!c)return false;
  game.carryMeal={id:c.id,name:c.name,icon:c.order[1]};say(`${role.short}: ${c.order[0]} for ${c.name}, coming right up!`);toast('TAKE DINNER TO THE ! TABLE');beep(630,.13);
 }else if(action.kind==='serve'){
  const c=action.guest;if(!game.carryMeal||game.carryMeal.id!==c.id)return false;
  c.state='eating';c.eat=0;game.carryMeal=null;game.served++;game.score+=150;
  say(`${c.name}: Thank you! This ${c.order[0].toLowerCase()} looks wonderful!`);toast('+150 · HAPPY GUEST!');beep(880,.14);
 }else if(action.kind==='job'){
  const stage=game.done%3;game.carry=stage===2?null:role.tasks[stage][4];game.done++;game.score+=100;
  say(`${role.short}: ${CREW_DIALOGUE[role.id][game.done%3]} ${game.done<6?'Find the next ! marker.':'Our job board is finished—keep serving guests!'}`);
  toast('+100 · JOB FINISHED!');beep(740,.11);
 }
 if(game.done>=6&&game.served>=3){finish(true);return true}
 updateHud();return true;
}
function update(dt){
 if(!game||game.paused||state!=='playing')return;
 game.elapsed+=dt;updateCustomers(dt);
 if(game.elapsed>=game.nextGhost){ghostPrank();game.nextGhost=game.elapsed+rnd(25,34)}
 if(game.ghost){game.ghost.t+=dt;if(game.ghost.t>5)game.ghost=null}
 let dx=0,dy=0;const speed=195;
 if(keys['arrowleft']||keys['a']||dpad==='left')dx-=1;
 if(keys['arrowright']||keys['d']||dpad==='right')dx+=1;
 if(keys['arrowup']||keys['w']||dpad==='up')dy-=1;
 if(keys['arrowdown']||keys['s']||dpad==='down')dy+=1;
 if(dx||dy){const m=Math.hypot(dx,dy);dx/=m;dy/=m;game.x+=dx*speed*dt;game.y+=dy*speed*dt}
 game.x=clamp(game.x,61,899);game.y=clamp(game.y,169,462);
 if(dx)game.lastFacing=dx>0?1:-1;
 // A held button only works while the player is standing next to a marked task.
 const task=activeTask(),working=game.work||keys['e']||keys[' ']||keys['enter'];
 if(working&&task){
  if(game.workKind!==task.kind||game.workRef!==task.guest?.id){game.progress=0;game.workKind=task.kind;game.workRef=task.guest?.id}
  game.progress+=dt/(task.duration||1.2);
  if(game.progress>=1)completeTask(task);
 }else{game.progress=0;game.workKind=null;game.workRef=null}
 nextDialogue(dt);
 game.camX+=(game.x-game.camX)*Math.min(1,dt*6);
 game.camY+=(game.y-game.camY)*Math.min(1,dt*6);
 game.particles=game.particles.filter(p=>p.life>0);
 for(const p of game.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=95*dt;p.life-=dt}
 updateHud();
}
function pRect(x,y,w,h,color){rect(ctx,x,y,w,h,color)}
function cloud(x,y,s=1){pRect(x,y,56*s,13*s,'#d7f1d0');pRect(x+12*s,y-12*s,40*s,15*s,'#edfee0');pRect(x+30*s,y+3*s,32*s,9*s,'#b1dcda')}
function palm(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line(ctx,0,0,-10,-62,'#654e48',10);line(ctx,-9,-59,-22,-73,'#654e48',7);for(let i=0;i<7;i++){const a=i*TAU/7;line(ctx,-15,-73,-15+Math.cos(a)*44,-73+Math.sin(a)*24,'#376f58',9);line(ctx,-15,-73,-15+Math.cos(a)*48,-73+Math.sin(a)*31,'#4a9872',4)}pRect(-19,-77,9,9,'#8a563e');ctx.restore()}
function sign(x,y,w,label){rounded(ctx,x,y,w,26,4,'#27536a');rounded(ctx,x+3,y+3,w-6,20,2,'#e3c288');text(ctx,label,x+w/2,y+19,13,'#27495b','center',false)}
function water(t){pRect(0,0,W,H,C.seaDark);for(let i=0;i<32;i++){const x=(i*97+Math.sin(t*.6+i)*24+960)%960,y=(i*47+Math.sin(i*3)*11)%540;line(ctx,x,y,x+20+i%4*8,y,'#67a9b8',i%3+1)}for(let i=0;i<8;i++)line(ctx,12+i*135,518+Math.sin(t+i)*3,92+i*135,518+Math.sin(t+i)*3,'#89c9c1',2);}
function floorPattern(x,y,w,h,col1,col2){pRect(x,y,w,h,col1);for(let yy=y;yy<y+h;yy+=22){line(ctx,x,yy,x+w,yy,col2,2);for(let xx=x+(Math.floor(yy/22)%2)*61;xx<x+w;xx+=122){line(ctx,xx,yy,xx,yy+22,col2,2)}}}
function chair(x,y){pRect(x-16,y-9,32,6,'#754c47');pRect(x-14,y-5,27,18,'#a06e50');pRect(x-13,y+8,5,14,'#624b4a');pRect(x+8,y+8,5,14,'#624b4a')}
function table(x,y,food=true){ellipse(ctx,x+3,y+17,47,22,'#35505b44');chair(x-47,y-8);chair(x+48,y-8);chair(x,y-39);chair(x,y+37);ellipse(ctx,x,y,46,24,'#6c493d');ellipse(ctx,x,y-4,42,20,'#c28f63');ellipse(ctx,x,y-6,34,14,'#e5bc7d');ellipse(ctx,x-16,y-5,8,6,'#fff1d2');ellipse(ctx,x+17,y-5,8,6,'#fff1d2');if(food){pRect(x-3,y-13,7,7,'#d78564');pRect(x+6,y+1,8,5,'#f3d08d')}pRect(x-2,y-18,5,9,'#689c7a')}
function kitchen(){floorPattern(38,118,311,342,'#eed4a7','#ddba8d');pRect(37,116,314,15,'#fef0c7');pRect(345,115,12,337,'#7b6652');pRect(38,115,11,338,'#aa8470');pRect(51,145,284,44,'#d1a371');pRect(51,145,284,9,'#f5d7a0');for(let i=0;i<6;i++){pRect(54+i*48,153,43,8,i%2?'#f4c478':'#e1b987')} // metal ranges
 pRect(49,205,148,67,'#a6c7c5');pRect(56,211,134,15,'#e9e5d0');for(let i=0;i<3;i++){ellipse(ctx,80+i*43,240,16,12,'#455560');ellipse(ctx,80+i*43,240,10,7,'#69757d')}ellipse(ctx,125,217,24,13,'#d97d53');ellipse(ctx,125,215,16,7,'#f1d18c');pRect(208,201,125,76,'#b78355');pRect(213,205,115,10,'#f7d29a');for(let i=0;i<3;i++){ellipse(ctx,226+i*40,232,12,7,'#f8e4b2');pRect(219+i*40,243,18,5,'#75a79b')}
 // prep cooler & sink
 pRect(66,327,195,73,'#8aabb0');pRect(68,330,191,14,'#e5e7dc');pRect(72,348,67,38,'#a3d9d4');pRect(82,355,47,24,'#518993');for(let i=0;i<5;i++)ellipse(ctx,89+i*9,367,5,4,'#edf9da');pRect(193,357,59,37,'#b4d6d7');text(ctx,'ICE',222,382,18,'#32717d','center');pRect(49,423,281,26,'#9e7155');sign(66,123,169,'THE GALLEY  •  KITCHEN')}
function dining(){floorPattern(360,113,307,341,'#e4bd8e','#ce9d78');pRect(360,111,315,12,'#eecc9d');pRect(654,123,13,333,'#91634f');pRect(359,112,11,341,'#a9795d');pRect(362,168,280,12,'#be845d');pRect(386,130,30,20,'#69adbb');pRect(428,130,30,20,'#70c8d0');pRect(470,130,30,20,'#8bbdc4');pRect(588,131,36,26,'#acc4af');for(let i=0;i<4;i++){pRect(377+i*69,182,5,19,'#885d4b');ellipse(ctx,378+i*69,205,14,5,'#f8cd72')}table(507,233);table(587,339);table(478,350);sign(424,121,192,'THE DINING ROOM');pRect(626,221,33,65,'#8d664c');pRect(630,223,28,9,'#eac08b');text(ctx,'ORDER',643,256,9,'#ffe6a8','center');}
function patio(t){ // dock boards and rails
 pRect(669,160,256,334,'#795c50');floorPattern(680,172,231,309,'#bb8a68','#9a6d55');for(let x=696;x<=916;x+=54){pRect(x,154,8,12,'#efe2ba');pRect(x,162,7,322,'#8a6659')}pRect(666,145,268,15,'#e6bf79');pRect(675,140,258,8,'#af825d');pRect(669,473,261,13,'#e4b37e');for(let y=174;y<=443;y+=85){pRect(673,y,16,7,'#f0d19a');pRect(918,y,17,8,'#eacb94')}
 table(815,288);table(748,379,false);pRect(811,320,111,64,'#865b4e');pRect(814,320,105,13,'#fae0a2');for(let i=0;i<5;i++)pRect(820+i*18,327,9,12,['#80ddbf','#f6c47c','#f29a95'][i%3]);sign(795,337,118,'TIKI TREATS');pRect(730,424,103,39,'#729b84');pRect(732,426,99,6,'#c3ad7b');for(let i=0;i<8;i++)ellipse(ctx,742+i*11,428,6,5,['#f7c385','#f59caf','#90d2aa'][i%3]);pRect(861,436,49,27,'#bd8f5d');pRect(860,441,52,6,'#d8b275');text(ctx,'DOCK',889,457,13,'#ffe9b0','center');palm(939,480,1.3);
 for(let i=0;i<8;i++){const x=678+i*34;line(ctx,x,148,x+12,158,'#efb3a4',1);ctx.fillStyle=['#f8c57b','#f08f9a','#a3e1c9','#caacde'][i%4];ctx.beginPath();ctx.moveTo(x+5,148);ctx.lineTo(x+28,150);ctx.lineTo(x+14,165);ctx.fill()}sign(689,178,109,'THE DECK');}
function supplies(t){ // entrance and boardwalk
 pRect(688,70,205,79,'#517881');pRect(691,73,199,72,'#d7bf99');for(let i=0;i<4;i++)pRect(698+i*50,83,36,29,'#91c7bd');pRect(740,118,98,27,'#936b54');pRect(750,118,83,10,'#c5a37f');sign(710,86,159,"PECK'S COVE"); // boardwalk to entry
 floorPattern(678,95,10,54,'#ead6aa','#9f8d78');
 // potted plants and lanterns
 for(const [x,y] of [[377,435],[642,432],[675,471]]){pRect(x-7,y-6,14,15,'#dc9072');ellipse(ctx,x,y-8,14,13,'#638c6d');ellipse(ctx,x-4,y-15,8,7,'#96b97a')}
 for(const [x,y] of [[370,103],[658,106],[922,168]]){pRect(x-2,y-17,5,12,'#725845');pRect(x-8,y-6,18,22,'#f1c17d');pRect(x-5,y-2,12,14,'#ffe7a4');pRect(x-8,y+17,18,4,'#4f6c69')}
}
function fishAndNature(t){for(let i=0;i<3;i++){const fx=((i*240+t*(i%2?11:-9)+3000)%960),fy=35+i*16;ellipse(ctx,fx,fy,14,4,'#85c9c6');ctx.fillStyle='#85c9c6';ctx.beginPath();ctx.moveTo(fx-12,fy);ctx.lineTo(fx-22,fy-7);ctx.lineTo(fx-22,fy+6);ctx.fill()}for(let i=0;i<5;i++){const x=40+i*207,y=498+Math.sin(t+i)*5;line(ctx,x,y,x+17,y-3,'#b3e5e0',2)}palm(21,138,1.2);palm(962,94,1.05);}
function world(t){water(t);fishAndNature(t);pRect(28,108,641,360,'#775d52');pRect(35,111,633,346,'#956e58');kitchen();dining();patio(t);supplies(t);
 // corridor between kitchen and dining is navigable
 pRect(345,279,21,112,'#c39871');for(let y=285;y<391;y+=13)line(ctx,347,y,362,y,'#ab805f',1);
 text(ctx,'◈',330,296,22,'#edc08b'); // safe spot near station
 for(let i=0;i<5;i++){ellipse(ctx,795+i*22,505+Math.sin(t*2+i)*2,9,2,'#9edbd7')}
}
function workMarker(x,y,label,t,color='#ffcc73'){
 const bob=Math.sin(t*5+x*.03)*3;
 ellipse(ctx,x,y+11,25,8,'#fff0ab55');
 rounded(ctx,x-13,y-61+bob,26,30,7,color);
 text(ctx,'!',x,y-37+bob,24,'#264a55','center',false);
 if(label){rounded(ctx,x-60,y-85+bob,120,20,6,'#1d4a56');text(ctx,label.substring(0,19).toUpperCase(),x,y-70+bob,11,'#fff1bb','center',false)}
}
function drawPickup(t){
 if(!game)return;
 if(game.done<6){const q=target();workMarker(q.x,q.y,q.label,t)}
 if(game.mess)workMarker(game.mess.x,game.mess.y,'GHOST MESS',t,'#b6dcff');
 const waiting=customersWaiting();if(waiting.length&&!game.carryMeal)workMarker(639,258,'PICK UP MEAL',t,'#b5ecd5');
 const c=serviceTarget();if(c)workMarker(c.tx,c.ty,'SERVE '+c.name,t,'#f5e5a0');
 const task=activeTask();if(task&&game.progress>0){rounded(ctx,task.x-25,task.y+24,50,8,3,'#1b5261');rounded(ctx,task.x-24,task.y+25,48*game.progress,6,3,'#fff0b2')}
}
function ghost(x,y,t){for(let i=0;i<5;i++){const a=t*3+i*TAU/5;ellipse(ctx,x+Math.cos(a)*31,y+Math.sin(a)*24,3+i%2,3+i%2,'#d0f5ff90')}ctx.save();ctx.translate(x,y+Math.sin(t*4)*6);ellipse(ctx,0,23,18,6,'#1d576052');ellipse(ctx,0,0,24,29,'#bbf6ec55');ellipse(ctx,0,-5,17,22,'#e2faf2');pRect(-17,-2,34,18,'#d6fcf3');pRect(-17,12,10,11,'#d6fcf3');pRect(-1,15,10,14,'#d6fcf3');pRect(12,9,6,15,'#d6fcf3');pRect(-8,-13,5,7,'#34526b');pRect(6,-13,5,7,'#34526b');pRect(-2,-4,6,5,'#f2929c');ctx.restore()}
function npcCharacters(t){if(!game)return;roles.forEach((r,i)=>{if(i===game.role)return;const spots=[[95,307],[210,307],[432,391],[524,412],[701,226],[859,397],[582,272],[318,397],[770,245],[436,275]];const [x,y]=spots[i];const sway=Math.sin(t*.65+i*7)*5;sprite(ctx,x+sway,y+Math.cos(t*.8+i)*2,r,.77,t,'idle')})}
function drawCharacter(t){const r=roles[game.role],moving=(keys['arrowleft']||keys['arrowright']||keys['arrowup']||keys['arrowdown']||keys['a']||keys['d']||keys['w']||keys['s']||dpad);sprite(ctx,game.x,game.y,r,1.17,t,moving?'walk':game.work?'work':'idle');
 if(game.carry){const bob=Math.sin(t*5)*2;rounded(ctx,game.x+12,game.y-106+bob,29,26,7,'#fff2cd');text(ctx,game.carry,game.x+26,game.y-86+bob,17,'#345868','center',false)}
 rounded(ctx,game.x-36,game.y-86,72,19,6,'#1e5361');text(ctx,r.short,game.x,game.y-72,13,'#ffe7aa','center',false)
}
function drawCustomers(t){
 if(!game)return;
 for(const c of game.customers){
  const h=['#f2b487','#e9d7af','#a67967','#e2b89b'][c.id%4];
  ellipse(ctx,c.x,c.y+11,13,4,'#243f4955');
  const bob=(c.state==='entering'||c.state==='leaving')?Math.sin(t*13+c.id)*2:0;
  rect(ctx,c.x-10,c.y-18+bob,20,22,['#a6dacc','#ebb193','#b9b5de','#a2c7e6'][c.id%4]);
  rect(ctx,c.x-8,c.y-37+bob,16,20,h);rect(ctx,c.x-10,c.y-39+bob,19,6,['#765248','#a16f52','#544b62','#ad7455'][c.id%4]);
  rect(ctx,c.x-5,c.y-29+bob,3,3,'#345063');rect(ctx,c.x+5,c.y-29+bob,3,3,'#345063');
  if(c.state==='eating'){ellipse(ctx,c.tx,c.ty-7,12,6,'#faf5d4');text(ctx,c.order[1],c.tx,c.ty-9,15,'#245569','center',false)}
  if(c.state==='ordered'){
   rounded(ctx,c.x-23,c.y-70,46,27,8,'#fff0bb');text(ctx,c.order[1],c.x,c.y-50,18,'#234c59','center',false);
  }else if(c.state==='eating')text(ctx,'♥',c.x,c.y-51+Math.sin(t*5)*3,18,'#f7a4b6','center',false);
  if(c.state==='queue')text(ctx,'…',c.x,c.y-47,18,'#fff2bb','center',false);
 }
}
function drawCrewDialogue(t){
 if(!game?.speech||game.speech.until<game.elapsed)return;
 const [x,y]=[[95,307],[210,307],[432,391],[524,412],[701,226],[859,397],[582,272],[318,397],[770,245],[436,275]][game.speech.role];
 const v=game.speech.text;const w=Math.min(260,Math.max(140,v.length*6.7));
 rounded(ctx,x-w/2,y-125,w,36,9,'#fdf2d0');text(ctx,v,x,y-103,11,'#26515c','center',false);
}
function drawParticles(dt){if(!game)return;for(const p of game.particles)rect(ctx,p.x,p.y,p.size,p.size,p.col)}
function render(t){
 ctx.clearRect(0,0,W,H);
 const zoom=1.68,halfW=W/(2*zoom),halfH=H/(2*zoom);
 const camX=clamp(game?.camX||480,halfW,W-halfW),camY=clamp(game?.camY||270,halfH,H-halfH);
 ctx.save();ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-camX,-camY);
 world(t);npcCharacters(t);drawCustomers(t);drawPickup(t);
 if(game?.ghost)ghost(game.ghost.x,game.ghost.y,game.ghost.t);
 drawCharacter(t);drawCrewDialogue(t);drawParticles(t);
 ctx.restore();
 if(game?.paused&&state==='playing'){rect(ctx,0,0,W,H,'#092f3eac');rounded(ctx,350,182,260,120,18,'#245d68');text(ctx,'PAUSED',480,244,39,'#ffe9a8','center');text(ctx,'Tap Ⅱ to continue',480,274,17,'#d1f2e9','center')}
}
function drawSky(t){sc.clearRect(0,0,480,270);const g=sc.createLinearGradient(0,0,0,270);g.addColorStop(0,'#529aab');g.addColorStop(.63,'#f3b385');g.addColorStop(1,'#144e64');sc.fillStyle=g;sc.fillRect(0,0,480,270);ellipse(sc,370,82,47,47,'#fceab5');cloud(41+Math.sin(t/5)*10,65,1.3);cloud(247-Math.sin(t/9)*9,25,.8);for(let i=0;i<8;i++){line(sc,0,193+i*10,480,193+i*10,i%2?'#7bc9b2':'#52979e',3)}for(let i=0;i<10;i++)line(sc,340+i*3,190+i*4,402-i*5,193+i*4,'#ebd7a1',3);palm(30,215,2.1);palm(470,260,2)}
function loop(now){const dt=Math.min(.05,(now-last||16)/1000);last=now;tick+=dt;drawSky(tick);if(state==='playing')update(dt);if(state!=='menu')render(tick);if(toastDeadline&&now>toastDeadline){$('toast').classList.remove('show');toastDeadline=0}requestAnimationFrame(loop)}
function nearbyDialogue(){
 if(!game)return false;
 const spots=[[95,307],[210,307],[432,391],[524,412],[701,226],[859,397],[582,272],[318,397],[770,245],[436,275]];
 for(let i=0;i<roles.length;i++){
  if(i!==game.role&&near(spots[i][0],spots[i][1],70)){
   const lines=CREW_DIALOGUE[roles[i].id];const v=lines[Math.floor(game.elapsed/3)%lines.length];
   game.speech={role:i,text:v,until:game.elapsed+4};say(`${roles[i].short}: ${v}`);beep(430,.08);return true;
  }
 }
 return false;
}
function pressWork(){if(!game||game.paused||state!=='playing')return;
 if(activeTask()){game.work=true;return}
 if(nearbyDialogue())return;
 toast('FIND A ! MARKER AND MOVE CLOSE');
}
$('play').onclick=begin;$('again').onclick=begin;$('change').onclick=()=>{state='menu';game=null;$('finish').classList.add('hidden');$('titleScreen').classList.remove('hidden');$('gameScreen').classList.add('hidden');choose(chosen)};$('menuBtn').onclick=()=>{if(!game)return;state='menu';game=null;$('gameScreen').classList.add('hidden');$('titleScreen').classList.remove('hidden');choose(chosen)};
$('pauseBtn').onclick=()=>{if(!game)return;game.paused=!game.paused;$('pauseBtn').textContent=game.paused?'▶':'Ⅱ';say(game.paused?'Shift paused. Tap play to continue.':'Back to work!')};$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'♪':'♪̸';if(sound)beep(600,.08)};
// No screen-tap movement or task autopathing; use physical controls only.
$('action').addEventListener('pointerdown',e=>{e.preventDefault();pressWork();$('action').setPointerCapture?.(e.pointerId)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('action').addEventListener(event,()=>{if(game)game.work=false});
for(const b of document.querySelectorAll('#dpad button')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();dpad=b.dataset.dir;b.setPointerCapture?.(e.pointerId)});
 for(const a of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(a,()=>{if(dpad===b.dataset.dir)dpad=null});
}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter'].includes(k))e.preventDefault();keys[k]=true;if((k==='e'||k===' '||k==='enter')&&game&&!game.paused&&state==='playing'&&!activeTask())nearbyDialogue();if(k==='escape'&&game&&state==='playing')$('pauseBtn').click()});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
window.addEventListener('blur',()=>{keys={};dpad=null;if(game)game.work=false});
window.__coveTest={roles,get state(){return state},get game(){return game},choose,begin,goal,target,activeTask,update,ghostPrank,spawnCustomer,updateCustomers,completeTask,finish,pressWork};makeCards();requestAnimationFrame(loop);
})();
