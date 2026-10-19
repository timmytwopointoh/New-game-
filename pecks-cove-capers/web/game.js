/* Peck's Cove Capers: original procedural pixel art and offline mini-game. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cvs = $('world'), ctx = cvs.getContext('2d'), sky=$('sky'), sc=sky.getContext('2d');
ctx.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;
const W=960,H=540,MAP_W=1480,MAP_H=850,TAU=Math.PI*2;
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
// Hand-authored walkable station anchors. Each role has a coherent three-stage work circuit.
const ROLE_STATIONS=[[[746, 302], [181, 541], [433, 374]], [[281, 533], [176, 334], [432, 374]], [[931, 406], [1410, 314], [1410, 314]], [[347, 537], [532, 431], [941, 260]], [[1219, 249], [923, 304], [923, 304]], [[1155, 646], [1372, 432], [1399, 548]], [[908, 535], [750, 305], [752, 548]], [[1375, 680], [297, 534], [267, 333]], [[1148, 641], [1089, 249], [1334, 673]], [[785, 235], [1084, 450], [103, 429]]];
roles.forEach((r,i)=>r.tasks.forEach((task,j)=>{task[2]=ROLE_STATIONS[i][j][0];task[3]=ROLE_STATIONS[i][j][1]}));
const PICKUP={x:937,y:403};
const EXIT={x:1231,y:187};
const CREW_SPOTS=[[181,490],[234,335],[842,424],[568,469],[1172,242],[1350,469],[765,609],[318,495],[1110,566],[561,295]];
const sites=[{x:721,y:423},{x:184,y:486},{x:1224,y:487},{x:760,y:438},{x:1176,y:673},{x:555,y:305},{x:876,y:627}];
let chosen=0, state='menu',game=null,stars=[],sound=true,audio=null,tick=0,last=0,keys={},dpad=null,toastDeadline=0;
const DINER_TABLES=[{x:656,y:304},{x:847,y:306},{x:672,y:559},{x:850,y:561},{x:1146,y:315},{x:1335,y:315},{x:1152,y:551},{x:1346,y:553}];
const TABLE_COLLISION={rx:73,ry:65};
const WALL_ZONES=[
 // Back-wall counters, kitchen ranges, sink bench, service bar and tiki counter.
 {x:77,y:195,w:390,h:90},{x:86,y:614,w:371,h:82},
 {x:941,y:336,w:33,h:96},{x:1350,y:407,w:58,h:84},
 {x:1063,y:659,w:152,h:35},
];
function ellipseCollision(x,y,t,margin=0){const dx=(x-t.x)/(TABLE_COLLISION.rx+margin),dy=(y-t.y)/(TABLE_COLLISION.ry+margin);return dx*dx+dy*dy<1}
function canStand(x,y){
 const r=13;
 const inKitchen=x>=78&&x<=473&&y>=182&&y<=728;
 const inDining=x>=506&&x<=974&&y>=182&&y<=728;
 const onDeck=x>=1007&&x<=1416&&y>=209&&y<=728;
 const corridorA=x>465&&x<517&&y>=384&&y<=505;
 const corridorB=x>966&&x<1022&&y>=385&&y<=512;
 const entrance=x>=1160&&x<=1305&&y>=168&&y<=219;
 if(!(inKitchen||inDining||onDeck||corridorA||corridorB||entrance))return false;
 for(const t of DINER_TABLES)if(ellipseCollision(x,y,t,0))return false;
 for(const b of WALL_ZONES)if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return false;
 return true;
}
function moveWithCollision(dx,dy){if(!game)return;const x=game.x,y=game.y;
 if(canStand(x+dx,y+dy)){game.x=x+dx;game.y=y+dy;return}
 if(canStand(x+dx,y))game.x=x+dx;
 if(canStand(game.x,game.y+dy))game.y=y+dy;
}

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
 if(served&&near(served.tx,served.ty,109))return {kind:'serve',x:served.tx,y:served.ty,duration:.65,label:'Serve '+served.order[0],guest:served};
 if(customersWaiting().length&&!game.carryMeal&&near(PICKUP.x,PICKUP.y,84))return {kind:'pickup',x:PICKUP.x,y:PICKUP.y,duration:.75,label:'Pick up dinner'};
 if(game.mess&&near(game.mess.x,game.mess.y,78))return {...game.mess,kind:'ghost'};
 const g=target();if(game.done<6&&near(g.x,g.y,72))return {...g,kind:'job'};
 return null;
}
function spawnCustomer(){
 if(!game||game.spawned>=7||game.customers.filter(c=>c.state!=='leaving').length>=6)return;
 const id=game.spawned++,table=DINER_TABLES.find(t=>!game.customers.some(c=>c.table===t&&c.state!=='leaving'))||null;
 const guest={id,name:DINER_NAMES[id%DINER_NAMES.length],x:EXIT.x,y:EXIT.y,tx:table?.x||1250,ty:table?.y||280,table,state:table?'entering':'queue',order:DISHES[id%DISHES.length],wait:0,eat:0,route:0,pathIndex:0};game.customers.push(guest);
 if(table){toast(`${guest.name.toUpperCase()} ARRIVED!`);say(`Hattie: Welcome, ${guest.name}! Grab a seat by the water.`)}
}
function moveGuest(c,x,y,dt,speed=64){const dx=x-c.x,dy=y-c.y,dist=Math.hypot(dx,dy);if(dist<speed*dt){c.x=x;c.y=y;return true}c.x+=dx/dist*dt*speed;c.y+=dy/dist*dt*speed;return false}
function updateCustomers(dt){
 if(game.elapsed>game.nextCustomer){spawnCustomer();game.nextCustomer=game.elapsed+8.5}
 for(const c of game.customers){
  if(c.state==='queue'){
   const table=DINER_TABLES.find(t=>!game.customers.some(o=>o!==c&&o.table===t&&o.state!=='leaving'));
   if(table){c.table=table;c.tx=table.x;c.ty=table.y;c.state='entering'}
   else moveGuest(c,1240-c.id%3*23,252,dt);
  }else if(c.state==='entering'){
   const seatX=c.tx+((c.id%2)?82:-82),seatY=c.ty-3;
   const indoor=c.tx<1000;
   const route=indoor?[[1234,451],[995,451],[937,470],[seatX,seatY]]:[[1234,447],[seatX,seatY]];
   const step=route[Math.min(c.pathIndex,route.length-1)];
   if(moveGuest(c,step[0],step[1],dt,85)){c.pathIndex++;if(c.pathIndex>=route.length){c.state='seated';c.wait=0}}
  }else if(c.state==='seated'){
   c.wait+=dt;if(c.wait>=1.8){c.state='ordered';say(`${c.name}: Could I please have ${c.order[0]}?`)}
  }else if(c.state==='eating'){
   c.eat+=dt;if(c.eat>4){c.state='leaving';c.route=0;say(`${c.name}: That was delicious! See you again!`)}
  }else if(c.state==='leaving'){
   if(c.route===0){if(moveGuest(c,1235,453,dt,92))c.route=1}
   else moveGuest(c,EXIT.x,EXIT.y,dt,92);
  }
 }
 game.customers=game.customers.filter(c=>!(c.state==='leaving'&&c.route===1&&c.y<=EXIT.y+3));
}
function nextDialogue(t){if(!game||game.elapsed<game.nextSpeech)return;game.nextSpeech=game.elapsed+9;
 const i=(Math.floor(game.elapsed/8)+game.role+3)%roles.length;
 const spots=CREW_SPOTS;
 if(i!==game.role&&Math.hypot(spots[i][0]-game.x,spots[i][1]-game.y)<265){const messages=CREW_DIALOGUE[roles[i].id];game.speech={role:i,text:messages[Math.floor(game.elapsed/8)%messages.length],until:game.elapsed+3.7};}
}
function updateHud(){if(!game)return;const r=roles[game.role],t=target();$('roleEmoji').textContent=r.emoji;$('roleJob').textContent=r.job.toUpperCase();$('roleHudName').textContent=r.short;$('time').textContent=`${Math.floor(game.elapsed/60)}:${String(Math.floor(game.elapsed%60)).padStart(2,'0')}`;$('done').textContent=`${game.done}/6 · 🍽${game.served}/3`;$('score').textContent=game.score;$('progressText').textContent=game.mess?'👻 FIX THE PRANK!':game.carryMeal?'🍽 DELIVER TO '+game.carryMeal.name.toUpperCase():game.done>=6?'🍤 SERVE 3 GUESTS':('❗ '+t.label.toUpperCase());}
function startingSpot(role){const choices=[[700,375],[350,431],[829,448],[445,468],[1050,270],[1263,647],[936,455],[1240,668],[1265,664],[937,264]];const [x,y]=choices[role];return canStand(x,y)?{x,y}:{x:567,y:464}}
function begin(){const r=roles[chosen],spawn=startingSpot(chosen);game={role:chosen,x:spawn.x,y:spawn.y,lastFacing:1,done:0,score:0,progress:0,work:false,mess:null,ghost:null,nextGhost:18,elapsed:0,particles:[],paused:false,ghostCount:0,streak:0,carry:null,carryMeal:null,served:0,spawned:0,nextCustomer:2,customers:[],speech:null,nextSpeech:7,camX:spawn.x,camY:spawn.y,completedStations:[],floats:[],jobVisuals:{},combo:0};state='playing';$('titleScreen').classList.add('hidden');$('gameScreen').classList.remove('hidden');$('finish').classList.add('hidden');$('pauseBtn').textContent='Ⅱ';say(`${r.name}: ${CREW_DIALOGUE[r.id][0]} Follow the ! to your next station. Hold WORK when close.`);toast('WELCOME TO THE COVE!');beep(660,.1);updateHud()}
function finish(won){if(state!=='playing')return;state='finish';game.paused=true;saveBest(game.score);$('finish').classList.remove('hidden');$('finishIcon').textContent=won?'🏆':'🌅';$('finishTitle').textContent=won?'YOU SAVED THE SHIFT!':'SUNSET AT THE COVE';$('finishBody').textContent=`${roles[game.role].name} finished ${game.done} jobs, served ${game.served} guests, fixed ${game.ghostCount} ghost pranks, and earned ${game.score} coins. ${won?'The crew wants an encore!':'Try another shift and beat your score.'}`;beep(won?880:420,.3)}
function ghostPrank(){if(!game||game.mess||state!=='playing')return;const s=sites[Math.floor(rnd(0,sites.length))];game.ghost={x:s.x,y:s.y-52,t:0};game.mess={x:s.x,y:s.y,label:['Ghostly spill!','Flying cutlery!','Mysterious mess!'][Math.floor(rnd(0,3))],sub:'Clean up the ghost prank before it spreads',icon:'👻',duration:1.5,isMess:true,ttl:22};game.progress=0;say('BOO! The cove ghost made a mess. Hurry over and clean it!');toast('👻 GHOST IN THE RESTAURANT!');beep(244,.3,'sawtooth')}
function completeTask(action=activeTask()){
 if(!game||!action)return false;
 confetti(action.x,action.y,17,action.kind==='ghost'?'#bdedff':'#ffdf82');
 game.progress=0;game.work=false;const role=roles[game.role];
 if(action.kind==='ghost'){
  game.mess=null;game.ghost=null;game.ghostCount++;game.score+=50;game.floats.push({x:action.x,y:action.y-95,label:'CLEAN! +50',life:1.8});
  say('Wade: Whew! That pesky ghost made a fine mess. Thanks for fixing it!');toast('+50 · PRANK FIXED!');beep(750,.17);
 }else if(action.kind==='pickup'){
  const c=customersWaiting()[0];if(!c)return false;
  game.carryMeal={id:c.id,name:c.name,icon:c.order[1]};say(`${role.short}: ${c.order[0]} for ${c.name}, coming right up!`);toast('TAKE DINNER TO THE ! TABLE');beep(630,.13);
 }else if(action.kind==='serve'){
  const c=action.guest;if(!game.carryMeal||game.carryMeal.id!==c.id)return false;
  c.state='eating';c.eat=0;game.carryMeal=null;game.served++;game.score+=150;game.floats.push({x:action.x,y:action.y-97,label:'THANK YOU! +150',life:1.7});
  say(`${c.name}: Thank you! This ${c.order[0].toLowerCase()} looks wonderful!`);toast('+150 · HAPPY GUEST!');beep(880,.14);
 }else if(action.kind==='job'){
  const stage=game.done%3;game.carry=stage===2?null:role.tasks[stage][4];game.done++;game.score+=100;
  game.completedStations.push({x:action.x,y:action.y,icon:action.icon,role:role.id,stage,cycle:Math.floor((game.done-1)/3),doneAt:game.elapsed});
  game.jobVisuals[role.id]=Math.max(game.jobVisuals[role.id]||0,stage+1);
  game.floats.push({x:action.x,y:action.y-95,label:'+100  '+action.icon,life:1.7});
  say(`${role.short}: ${CREW_DIALOGUE[role.id][game.done%3]} ${game.done<6?'Find the next ! marker.':'Our job board is finished—keep serving guests!'}`);
  toast('+'+100+' · '+action.label.toUpperCase()+' ✓');beep(640+stage*100,.16);
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
 if(dx||dy){const m=Math.hypot(dx,dy);dx/=m;dy/=m;moveWithCollision(dx*speed*dt,dy*speed*dt)}
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
 game.floats=game.floats.filter(f=>(f.life-=dt)>0);
 updateHud();
}
function pRect(x,y,w,h,color){rect(ctx,x,y,w,h,color)}
function cloud(x,y,s=1){pRect(x,y,56*s,13*s,'#d7f1d0');pRect(x+12*s,y-12*s,40*s,15*s,'#edfee0');pRect(x+30*s,y+3*s,32*s,9*s,'#b1dcda')}
function palm(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line(ctx,0,0,-10,-62,'#654e48',10);line(ctx,-9,-59,-22,-73,'#654e48',7);for(let i=0;i<7;i++){const a=i*TAU/7;line(ctx,-15,-73,-15+Math.cos(a)*44,-73+Math.sin(a)*24,'#376f58',9);line(ctx,-15,-73,-15+Math.cos(a)*48,-73+Math.sin(a)*31,'#4a9872',4)}pRect(-19,-77,9,9,'#8a563e');ctx.restore()}
function sign(x,y,w,label){rounded(ctx,x,y,w,26,4,'#27536a');rounded(ctx,x+3,y+3,w-6,20,2,'#e3c288');text(ctx,label,x+w/2,y+19,13,'#27495b','center',false)}
function water(t){pRect(0,0,MAP_W,MAP_H,'#2a788c');for(let i=0;i<130;i++){const x=(i*149+Math.sin(t*.45+i)*22+MAP_W)%MAP_W,y=(i*83+Math.sin(i*4)*11)%MAP_H;line(ctx,x,y,x+18+i%5*7,y,i%3?'#62a7ad':'#9bd9c3',i%3+1)}}
function floorPattern(x,y,w,h,col1,col2){pRect(x,y,w,h,col1);for(let yy=y;yy<y+h;yy+=27){line(ctx,x,yy,x+w,yy,col2,2);for(let xx=x+(Math.floor(yy/27)%2)*71;xx<x+w;xx+=142)line(ctx,xx,yy,xx,yy+27,col2,1)}}
function chair(x,y){pRect(x-18,y-10,36,7,'#694a42');pRect(x-16,y-4,32,20,'#ba8462');pRect(x-15,y+12,6,10,'#775344');pRect(x+9,y+12,6,10,'#775344')}
function table(x,y,food=true){ellipse(ctx,x+4,y+19,55,26,'#314a574f');chair(x-52,y-5);chair(x+52,y-5);chair(x,y-46);chair(x,y+43);ellipse(ctx,x,y,48,26,'#75513f');ellipse(ctx,x,y-4,44,23,'#bb8961');ellipse(ctx,x,y-7,38,16,'#efd29e');ellipse(ctx,x-20,y-9,9,6,'#fbf2df');ellipse(ctx,x+20,y-9,9,6,'#fbf2df');if(food){pRect(x-8,y-13,10,7,'#e08d64');pRect(x+6,y+3,10,4,'#f4be76')}pRect(x-3,y-22,6,11,'#609b7b');ellipse(ctx,x,y-22,6,5,'#86b989');for(const d of [-1,1]){pRect(x+d*29-2,y-12,2,11,'#d9e7db');pRect(x+d*30-5,y-10,2,5,'#9db0b0')}}
function kitchen(t){floorPattern(61,159,422,571,'#ebd3a6','#d5b281');pRect(61,159,422,16,'#755c52');pRect(61,716,422,13,'#896950');pRect(78,200,390,72,'#a3aeb1');pRect(79,202,387,14,'#e8ece4');for(let i=0;i<5;i++){ellipse(ctx,115+i*76,246,25,14,'#535c65');ellipse(ctx,115+i*76,242,17,10,'#627d88');if(i===1||i===3){ellipse(ctx,115+i*76,240,12,6,'#e8a469');for(let n=0;n<3;n++)ellipse(ctx,102+i*76+n*10,217+Math.sin(t*3+n)*8,3,5,'#f7f0cb99')}}
 pRect(84,607,376,70,'#83adb6');pRect(84,609,376,14,'#f5e9cf');pRect(100,624,110,41,'#95d7d2');pRect(109,631,92,30,'#438b96');for(let i=0;i<10;i++)ellipse(ctx,115+i*9,648+Math.sin(t*4+i)*2,4,4,'#ebfaf1');pRect(290,624,146,39,'#bad4d7');text(ctx,'ICE / CATCH',363,651,18,'#397586','center');
 for(let i=0;i<5;i++){pRect(109+i*66,170,39,15,'#f4d9a4');pRect(122+i*66,173,5,11,'#9f6f4c')}pRect(470,352,28,111,'#c49b70');pRect(474,357,23,9,'#ecd5a4');sign(129,119,235,'THE GALLEY • KITCHEN');
 // Counters and their functional props; workstations have clear standing space in front.
 pRect(389,323,85,22,'#d6b18a');pRect(390,324,84,7,'#f9dfae');for(let i=0;i<4;i++){ellipse(ctx,408+i*17,331,8,4,'#fff3da')}
}
function dining(t){floorPattern(501,160,479,571,'#e4c295','#c79d7b');pRect(501,160,479,15,'#755c52');pRect(501,716,479,14,'#7d5d53');pRect(494,160,13,211,'#9a7159');pRect(494,516,13,209,'#9a7159');pRect(971,160,12,216,'#8f6b58');pRect(971,525,12,204,'#8f6b58');pRect(580,162,7,96,'#966448');pRect(580,255,144,8,'#b18b70');pRect(755,162,7,85,'#966448');pRect(762,247,155,9,'#b18b70');
 // Two room atmospheres, inspired by the restaurant's family / chowder rooms.
 pRect(517,189,110,27,'#d3e2d0');pRect(525,195,29,15,'#8cc8c2');pRect(562,195,28,15,'#8cc8c2');pRect(598,195,22,15,'#8cc8c2');
 pRect(809,190,134,31,'#d5c09e');pRect(815,196,119,20,'#3d6572');text(ctx,'CHOWDER ROOM',874,210,10,'#f3ddbb','center');
 table(656,304);table(847,306);table(672,559);table(850,561);
 for(const x of [548,750,927]){pRect(x-2,178,5,20,'#88604c');ellipse(ctx,x,207,18,8,'#ffce84');ellipse(ctx,x,208+Math.sin(t*3+x)*2,8,3,'#ffebb1')}
 // Pass / register facing a spacious center aisle.
 pRect(944,336,30,96,'#b88861');pRect(944,336,30,13,'#f2cc8b');text(ctx,'PASS',960,384,11,'#fce4a9','center');sign(600,122,240,'THE FAMILY DINING ROOM');
 // Floor rugs and nautical artwork.
 pRect(771,416,87,12,'#659e9c');pRect(789,415,49,13,'#bedcd3');pRect(802,411,23,16,'#e1ba72');pRect(513,663,98,14,'#6faaa7');pRect(517,666,90,8,'#afdfc6');
}
function patio(t){pRect(998,173,441,559,'#806556');floorPattern(1008,192,420,535,'#bc906f','#9c735c');pRect(995,168,452,18,'#e6c383');pRect(1002,725,439,14,'#e5c18b');for(const x of [1012,1083,1164,1246,1328,1416]){pRect(x,189,9,535,'#957258');pRect(x,177,10,12,'#f2e4bc')}for(let y=215;y<716;y+=120){pRect(1002,y,9,12,'#ecd8a8');pRect(1424,y,9,12,'#ecd8a8')}
 table(1146,315);table(1335,315);table(1152,551);table(1346,553);
 pRect(1350,407,61,84,'#886351');pRect(1347,407,70,13,'#fae0a2');for(let i=0;i<3;i++){pRect(1358+i*16,425,9,20,['#80ddb0','#f6c47c','#ec9e95'][i]);ellipse(ctx,1363+i*16,425,6,3,'#fcf1cc')}
 sign(1246,402,167,'TIKI BAR');pRect(1063,659,152,36,'#679a76');for(let i=0;i<11;i++){ellipse(ctx,1074+i*12,657,8,7,['#ffcb87','#f59cb1','#8ddbb3'][i%3]);pRect(1074+i*12,660,2,8,'#517c5f')}
 pRect(1350,657,65,39,'#b38d62');pRect(1350,657,65,8,'#efc484');text(ctx,'DOCK',1381,683,14,'#fff0cb','center');
 for(let x=1020;x<=1400;x+=46){line(ctx,x,171,x+14,184,'#bfa88d',1);ctx.fillStyle=['#f8c57b','#f29eac','#a3e8c9','#ccaedf'][(x/46|0)%4];ctx.beginPath();ctx.moveTo(x+5,169);ctx.lineTo(x+30,169);ctx.lineTo(x+15,188);ctx.fill();ellipse(ctx,x+14,176,4+Math.sin(t*4+x)*1,4,'#ffe4a9')}
 sign(1037,212,135,'THE DECK');palm(1450,728,1.3);
}
function supplies(t){ // actual restaurant: several rooms connect to a covered waterside patio; walkway is interpretation, not surveyed geometry.
 pRect(1165,73,139,132,'#7e6e5d');floorPattern(1173,85,120,116,'#bc966c','#997353');pRect(1145,73,175,20,'#efd3a0');sign(1153,98,155,"PECK'S COVE");pRect(1225,145,32,48,'#8bbeb0');for(const [x,y] of [[522,691],[918,696],[1028,664],[1191,726]]){pRect(x-9,y-7,18,19,'#da9377');ellipse(ctx,x,y-14,16,16,'#5a946b');ellipse(ctx,x-4,y-20,8,9,'#a5cd7d')}
 for(const [x,y] of [[501,143],[969,143],[998,151],[1435,163]]){pRect(x-4,y-14,8,17,'#765a4b');pRect(x-10,y-4,20,24,'#d7a866');pRect(x-6,y,12,16,'#ffe4a0');pRect(x-10,y+20,20,4,'#5e7975')}
}
function fishAndNature(t){for(let i=0;i<5;i++){const fx=(i*277+t*(i%2?8:-11)+MAP_W*5)%MAP_W,fy=38+i*22;ellipse(ctx,fx,fy,17,5,'#85c9c6');ctx.fillStyle='#85c9c6';ctx.beginPath();ctx.moveTo(fx-12,fy);ctx.lineTo(fx-24,fy-6);ctx.lineTo(fx-24,fy+6);ctx.fill()}for(let i=0;i<9;i++){const x=55+i*161,y=795+Math.sin(t+i)*5;line(ctx,x,y,x+21,y-3,'#b3e5e0',3)}palm(36,185,1.5);palm(1460,100,1.2)}
function world(t){water(t);fishAndNature(t);pRect(50,145,937,598,'#775e54');pRect(55,153,926,583,'#997457');kitchen(t);dining(t);patio(t);supplies(t);
 // Explicit wide connecting doorways to avoid collisions around interior walls.
 floorPattern(480,386,27,122,'#d0af83','#b68c6d');floorPattern(970,386,36,123,'#cf9f78','#b98968');
 for(let i=0;i<10;i++){ellipse(ctx,1085+i*23,760+Math.sin(t*2+i)*2,12,3,'#9edbd7')}
}
function workMarker(x,y,label,t,color='#ffcc73'){
 const bob=Math.sin(t*5+x*.03)*3;
 ellipse(ctx,x,y+11,25,8,'#fff0ab55');
 rounded(ctx,x-13,y-61+bob,26,30,7,color);
 text(ctx,'!',x,y-37+bob,24,'#264a55','center',false);
 if(label){rounded(ctx,x-60,y-85+bob,120,20,6,'#1d4a56');text(ctx,label.substring(0,19).toUpperCase(),x,y-70+bob,11,'#fff1bb','center',false)}
}
function drawWorkResults(t){
 if(!game)return;const n=game.jobVisuals[roles[game.role].id]||0,r=roles[game.role];
 if(n){
  if(r.id==='dishes'){for(let i=0;i<Math.min(n,3);i++){ellipse(ctx,123+i*14,615-i*8,12,5,'#faf9d9');ellipse(ctx,123+i*14,613-i*8,8,3,'#b6dbd6')}}
  if(r.id==='cook'){for(let i=0;i<6;i++){ellipse(ctx,159+i*8,201-12*Math.sin(t*3+i),5,6,'#f6edcbb0')}if(n>=3){ellipse(ctx,434,360,24,13,'#fff7dc');text(ctx,'🍤',432,365,20,'#ffe9a4','center',false)}}
  if(r.id==='waiter')text(ctx,'🍤',1326,300,21,'#f8e6bd','center',false);
  if(r.id==='boss')text(ctx,'✓',933,253,26,'#a9ead2','center',false);
  if(r.id==='host'){for(const [x,y] of [[656,304],[847,306]]){pRect(x+13,y-12,12,15,'#f4efcf');pRect(x+13,y-12,10,3,'#a6c0bc')}}
  if(r.id==='drinks'){for(let i=0;i<n;i++)text(ctx,'🍹',1366+i*12,426,15,'#f7eac6','center',false)}
  if(r.id==='busser'){for(let i=0;i<8;i++){const a=t*3+i*TAU/8;ellipse(ctx,851+Math.cos(a)*25,539+Math.sin(a)*11,3,3,'#fffad8')}}
  if(r.id==='fish')text(ctx,'🐟',316,633,22,'#f7e4bd','center',false);
  if(r.id==='decor'){for(let i=0;i<12;i++){const a=i*TAU/12;ellipse(ctx,1088+i*9,648+Math.sin(t*3+i)*5,4,5,'#ffb4ce')}}
  if(r.id==='fix'){for(let i=0;i<7;i++){const a=i*TAU/7+t*2;ellipse(ctx,1084+Math.cos(a)*18,443+Math.sin(a)*18,3,5,'#c7edf3')}}
 }
 for(const job of game.completedStations){const age=game.elapsed-job.doneAt;ellipse(ctx,job.x,job.y+10,19,7,'#a8e3bc55');if(age<3){for(let i=0;i<4;i++){const a=i*TAU/4+t*4;ellipse(ctx,job.x+Math.cos(a)*20,job.y-12+Math.sin(a)*14,3,3,'#fff0a1')}}else if(age<18){ellipse(ctx,job.x,job.y-9,4,3,'#b2f7c4aa')}}
}
function drawFloatingResults(t){if(!game)return;for(const f of game.floats){const opacity=Math.min(1,f.life);ctx.save();ctx.globalAlpha=opacity;rounded(ctx,f.x-82,f.y-(1.7-f.life)*31,164,27,8,'#2b735df0');text(ctx,f.label,f.x,f.y+18-(1.7-f.life)*31,16,'#ffedb3','center',false);ctx.restore()}}
function drawPickup(t){
 if(!game)return;
 if(game.done<6){const q=target();workMarker(q.x,q.y,q.label,t)}
 if(game.mess)workMarker(game.mess.x,game.mess.y,'GHOST MESS',t,'#b6dcff');
 const waiting=customersWaiting();if(waiting.length&&!game.carryMeal)workMarker(PICKUP.x,PICKUP.y,'PICK UP MEAL',t,'#b5ecd5');
 const c=serviceTarget();if(c)workMarker(c.tx,c.ty,'SERVE '+c.name,t,'#f5e5a0');
 const task=activeTask();if(task&&game.progress>0){rounded(ctx,task.x-39,task.y+24,78,12,4,'#1b5261');rounded(ctx,task.x-37,task.y+26,74*game.progress,8,3,'#f5d990');for(let i=0;i<5;i++){const bx=task.x-22+i*11,by=task.y-4-Math.sin(t*6+i)*15;ellipse(ctx,bx,by,3+game.progress*3,3+game.progress*3,task.kind==='ghost'?'#c9f6ffb9':'#fffae0b9')}}
}
function ghost(x,y,t){for(let i=0;i<5;i++){const a=t*3+i*TAU/5;ellipse(ctx,x+Math.cos(a)*31,y+Math.sin(a)*24,3+i%2,3+i%2,'#d0f5ff90')}ctx.save();ctx.translate(x,y+Math.sin(t*4)*6);ellipse(ctx,0,23,18,6,'#1d576052');ellipse(ctx,0,0,24,29,'#bbf6ec55');ellipse(ctx,0,-5,17,22,'#e2faf2');pRect(-17,-2,34,18,'#d6fcf3');pRect(-17,12,10,11,'#d6fcf3');pRect(-1,15,10,14,'#d6fcf3');pRect(12,9,6,15,'#d6fcf3');pRect(-8,-13,5,7,'#34526b');pRect(6,-13,5,7,'#34526b');pRect(-2,-4,6,5,'#f2929c');ctx.restore()}
function npcCharacters(t){if(!game)return;roles.forEach((r,i)=>{if(i===game.role)return;const spots=CREW_SPOTS;const [x,y]=CREW_SPOTS[i];const sway=Math.sin(t*.65+i*7)*5;sprite(ctx,x+sway,y+Math.cos(t*.8+i)*2,r,.77,t,'idle')})}
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
 const [x,y]=CREW_SPOTS[game.speech.role];
 const v=game.speech.text;const w=Math.min(260,Math.max(140,v.length*6.7));
 rounded(ctx,x-w/2,y-125,w,36,9,'#fdf2d0');text(ctx,v,x,y-103,11,'#26515c','center',false);
}
function drawParticles(dt){if(!game)return;for(const p of game.particles)rect(ctx,p.x,p.y,p.size,p.size,p.col)}
function drawObjectiveCompass(camX,camY,zoom){
 if(!game||game.done>=6)return;const q=target(),px=(q.x-camX)*zoom+W/2,py=(q.y-camY)*zoom+H/2;
 const edge=78;if(px>edge&&px<W-edge&&py>edge&&py<H-edge)return;
 const x=clamp(px,edge,W-edge),y=clamp(py,edge,H-edge),ang=Math.atan2(py-H/2,px-W/2);
 rounded(ctx,x-52,y-16,104,34,10,'#184b59e8');text(ctx,'!  '+Math.round(Math.hypot(q.x-game.x,q.y-game.y))+'m',x,y+6,17,'#ffe7a1','center',false);
 ctx.save();ctx.translate(x+Math.cos(ang)*44,y+Math.sin(ang)*12);ctx.rotate(ang);ctx.fillStyle='#ffd088';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-4,-7);ctx.lineTo(-4,7);ctx.closePath();ctx.fill();ctx.restore()
}
function render(t){
 ctx.clearRect(0,0,W,H);
 const zoom=1.59,halfW=W/(2*zoom),halfH=H/(2*zoom);
 const camX=clamp(game?.camX||700,halfW,MAP_W-halfW),camY=clamp(game?.camY||425,halfH,MAP_H-halfH);
 ctx.save();ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-camX,-camY);
 world(t);drawWorkResults(t);npcCharacters(t);drawCustomers(t);drawPickup(t);
 if(game?.ghost)ghost(game.ghost.x,game.ghost.y,game.ghost.t);
 drawCharacter(t);drawCrewDialogue(t);drawParticles(t);drawFloatingResults(t);
 ctx.restore();
 drawObjectiveCompass(camX,camY,zoom);
 if(game?.paused&&state==='playing'){rect(ctx,0,0,W,H,'#092f3eac');rounded(ctx,350,182,260,120,18,'#245d68');text(ctx,'PAUSED',480,244,39,'#ffe9a8','center');text(ctx,'Tap Ⅱ to continue',480,274,17,'#d1f2e9','center')}
}
function drawSky(t){sc.clearRect(0,0,480,270);const g=sc.createLinearGradient(0,0,0,270);g.addColorStop(0,'#529aab');g.addColorStop(.63,'#f3b385');g.addColorStop(1,'#144e64');sc.fillStyle=g;sc.fillRect(0,0,480,270);ellipse(sc,370,82,47,47,'#fceab5');cloud(41+Math.sin(t/5)*10,65,1.3);cloud(247-Math.sin(t/9)*9,25,.8);for(let i=0;i<8;i++){line(sc,0,193+i*10,480,193+i*10,i%2?'#7bc9b2':'#52979e',3)}for(let i=0;i<10;i++)line(sc,340+i*3,190+i*4,402-i*5,193+i*4,'#ebd7a1',3);palm(30,215,2.1);palm(470,260,2)}
function loop(now){const dt=Math.min(.05,(now-last||16)/1000);last=now;tick+=dt;drawSky(tick);if(state==='playing')update(dt);if(state!=='menu')render(tick);if(toastDeadline&&now>toastDeadline){$('toast').classList.remove('show');toastDeadline=0}requestAnimationFrame(loop)}
function nearbyDialogue(){
 if(!game)return false;
 const spots=CREW_SPOTS;
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
// Android long-press accessibility still works elsewhere; gameplay control surfaces never select/copy text.
for(const e of ['contextmenu','selectstart','dragstart'])document.addEventListener(e,event=>{if(event.target.closest?.('#controls, #world, #frame'))event.preventDefault()});
for(const e of ['touchstart','touchmove'])document.querySelector('#controls').addEventListener(e,event=>event.preventDefault(),{passive:false});
window.addEventListener('blur',()=>{keys={};dpad=null;if(game)game.work=false});
window.__coveTest={roles,DINER_TABLES,PICKUP,canStand,moveWithCollision,get state(){return state},get game(){return game},choose,begin,goal,target,activeTask,update,ghostPrank,spawnCustomer,updateCustomers,completeTask,finish,pressWork};makeCards();requestAnimationFrame(loop);
})();
