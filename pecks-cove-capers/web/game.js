/* Pek's Plunder: offline pixel-art restaurant game, day cycle and manual tactile work. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cvs = $('world'), mainCtx = cvs.getContext('2d'), sky=$('sky'), sc=sky.getContext('2d'), demoCanvas=$('menuWorld'), demoCtx=demoCanvas.getContext('2d');
let ctx=mainCtx;
ctx.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;demoCtx.imageSmoothingEnabled=false;
const W=960,H=540,MAP_W=1480,MAP_H=1040,TAU=Math.PI*2;
const C={sea:'#318aa0',sea2:'#6aafaf',sand:'#dfbd81',plank:'#ab7754',plank2:'#c39268',plankLine:'#8b5c4e',wall:'#f5dea9',wallShadow:'#a77c5d',floor:'#d4ac7c',seaDark:'#205e78',mint:'#b4e4bd',foam:'#def7d6',yellow:'#ffe4a0',coral:'#e98a70',ink:'#1b3e4b',white:'#fff2d3'};
const roles=[
 {id:'dishes',name:'Dizzy Dishes',short:'Dizzy',job:'Dish Runner',emoji:'🍽️',skin:'#d5a277',hair:'#5e3b31',shirt:'#ffc16b',hat:'#ffe5a3',accent:'#ef6e68',desc:'Scoop up stray dishes, dodge guests, and race them to the bubbling dish pit.',tasks:[['Grab the plates','Collect dirty plates at table 2',490,304,'🍽',1.1],['Scrub-a-dub','Scrub the plate at the three-sink dish pit',151,351,'🫧',1.5],['Stack the sparkle','Stack dishes at the drying rack',302,230,'✨',1.2]]},
 {id:'cook',name:'Crispin Skillet',short:'Crispin',job:'Seafood Cook',emoji:'🍳',skin:'#9b634f',hair:'#3e3743',shirt:'#fff0bd',hat:'#ffffff',accent:'#dc765a',desc:'Chop the catch, stir the chowder, and plate a five-star seafood feast.',tasks:[['Fresh catch!','Collect fish at the seafood prep table',245,401,'🐟',1.0],['Fryer rescue','Clean the visible hot-line fryer and drain crumbs',127,204,'🧽',1.7],['Order up!','Plate the special at the service hatch',312,257,'🍤',1.2]]},
 {id:'waiter',name:'Tilly Tray',short:'Tilly',job:'Waiter',emoji:'🧑‍🍳',skin:'#e3b891',hair:'#8d4650',shirt:'#77c8b5',hat:'#f8e0a2',accent:'#ffe2a0',desc:'Balance a packed tray, serve patio guests, and collect cheerful tips.',tasks:[['Pick up order','Collect a freshly cooked order',315,254,'🍛',1.0],['Table service','Bring dinner to the sea-view table',804,284,'🍤',1.4],['Happy guests','Pick up the tip and a big thank-you',804,284,'⭐',.9]]},
 {id:'boss',name:'Captain Cleo',short:'Cleo',job:'The Boss',emoji:'⭐',skin:'#bd8361',hair:'#403c52',shirt:'#9fc3d4',hat:'#315c7a',accent:'#ffc875',desc:'Run a tight ship: check supplies, encourage the crew, and approve the rush.',tasks:[['Supply check','Check the inventory in cold storage',254,398,'📦',1.1],['Crew huddle','Cheer on the team near the kitchen',361,243,'📋',1.4],['Shipshape!','Balance the register at the front desk',706,194,'💰',1.2]]},
 {id:'host',name:'Hattie Hello',short:'Hattie',job:'Greeter',emoji:'👋',skin:'#8f5945',hair:'#2e4247',shirt:'#ff9c91',hat:'#ffc46a',accent:'#fce6ae',desc:'Welcome hungry visitors, find sunny seats, and make everyone feel at home.',tasks:[['Warm welcome','Greet the party at the entrance',705,187,'👋',1.1],['Find a seat','Show guests to the dining table',521,204,'🪑',1.4],['Menus, please','Place menus on the table',521,204,'📖',.9]]},
 {id:'drinks',name:'Mina Mixer',short:'Mina',job:'Tiki Bartender',emoji:'🍹',skin:'#bb886a',hair:'#a05046',shirt:'#ffbd7b',hat:'#77dbb0',accent:'#eb8085',desc:'Mix tropical lemonade, chill the glasses, and serve fruity island treats.',tasks:[['Pick fresh fruit','Gather juicy limes from the supply stand',746,400,'🍋',1.0],['Mix magic','Shake the fruit cooler at the tiki bar',852,358,'🍹',1.5],['Serve sunshine','Serve a cold drink on the deck',811,285,'🧃',1.0]]},
 {id:'busser',name:'Benny Bus',short:'Benny',job:'Table Busser',emoji:'🧹',skin:'#cc9c79',hair:'#a56438',shirt:'#adc8e2',hat:'#4b7895',accent:'#f3c779',desc:'Clear crowded tables, sweep up crumbs, and reset the nicest seats in town.',tasks:[['Table patrol','Gather plates from the busy corner',585,322,'🍽',1.2],['Crumb patrol','Sweep up the crumbs by table 1',494,209,'🧹',1.4],['Ready for more','Reset napkins at table 3',595,327,'🧻',1.1]]},
 {id:'fish',name:'Finn Fillet',short:'Finn',job:'Fish Prep',emoji:'🐟',skin:'#d9a17c',hair:'#404b5c',shirt:'#78b6b5',hat:'#54aaba',accent:'#ecad6f',desc:'Sort the day’s catch, ice the cooler, and send ocean-fresh seafood to the chef.',tasks:[['Dock delivery','Pick up the fresh catch basket',834,455,'🐟',1.0],['Keep it cool','Pack the seafood in the ice chest',238,400,'🧊',1.5],['Prep the catch','Carry the sorted fish to the counter',203,205,'🔪',1.2]]},
 {id:'decor',name:'Dottie Decor',short:'Dottie',job:'Decorator',emoji:'🌺',skin:'#d6ad8f',hair:'#8c5b3f',shirt:'#ef98b2',hat:'#fff0a1',accent:'#91e7ba',desc:'Brighten up the cove with flowers, bunting, and the best sunset photo spot.',tasks:[['Flower power','Water the patio flower boxes',759,439,'🌷',1.2],['Party flags','Fix the colorful pennants on the deck',712,136,'🎏',1.5],['Picture perfect','Polish the sunset photo corner',868,462,'📸',1.0]]},
 {id:'fix',name:'Wrenchy Wade',short:'Wade',job:'Fix-It Expert',emoji:'🔧',skin:'#986c57',hair:'#483c38',shirt:'#f5b27f',hat:'#ffe3a2',accent:'#b7d7e0',desc:'Repair rattling fans, rescue flickering lights, and keep the kitchen working.',tasks:[['Lights out','Fix the dining room hanging lamp',616,142,'💡',1.2],['Fan-tastic','Tighten the ceiling fan near the dock',704,264,'🔧',1.7],['All systems go','Check the kitchen power panel',57,287,'⚡',1.3]]}
];
// Uniforms reflect restaurant job families; accessories and faces remain individual.
for(const r of roles){
 if(['cook','fish'].includes(r.id)){r.shirt='#232b39';r.accent='#9fa9b5';}
 else if(['waiter','host','busser'].includes(r.id)){r.shirt='#3285bb';r.accent='#c4e9ff';}
 else if(r.id==='dishes'){r.shirt='#2b4649';r.accent='#67bfc4';}
 else if(r.id==='drinks'){r.shirt='#29898e';r.accent='#f3c780';}
}
// Hand-authored walkable station anchors. Each role has a coherent three-stage work circuit.
const ROLE_STATIONS=[
 [[758,404],[249,746],[422,733]], // dish collecting, wash next to three sinks, clean plate storage
 [[270,701],[179,328],[429,442]], // fish prep, real fryer, pass
 [[927,454],[1260,466],[1260,466]], // order collection and deck service
 [[347,704],[523,470],[938,260]], // supplies, team, register
 [[1217,250],[920,452],[920,452]], // greet, seating, menus
 [[1151,809],[1376,526],[1398,584]], // fruit, tiki mix, drink run
 [[931,793],[735,441],[756,785]], // clear, sweep, reset
 [[1367,849],[292,699],[260,322]], // dock fish, ice, fish prep
 [[1036,826],[1091,247],[1334,842]], // flower, pennants, photo
 [[795,410],[1081,481],[102,479]] // lamps, fan, electrical panel
];
roles.forEach((r,i)=>r.tasks.forEach((task,j)=>{task[2]=ROLE_STATIONS[i][j][0];task[3]=ROLE_STATIONS[i][j][1]}));
// Earnable fictional placeholders for future, consenting real-restaurant staff.
// They share the base role's mechanics and NEVER claim to portray a real person.
const PREMIUM_CREW=[
 {base:1,cost:240,name:'Kitchen Spotlight',short:'Spotlight',job:'Special Chef'},
 {base:2,cost:360,name:'Deck Spotlight',short:'Spotlight',job:'Special Server'},
 {base:0,cost:480,name:'Dish Pit Spotlight',short:'Spotlight',job:'Special Dishwasher'},
 {base:5,cost:620,name:'Tiki Spotlight',short:'Spotlight',job:'Special Bartender'}
];
const BASE_ROLE_COUNT=roles.length;
const STARS_ID='peks-plunder-progress-v08';
function loadProfile(){try{const v=JSON.parse(localStorage.getItem(STARS_ID)||'null');return {coins:Math.max(0,Math.floor(Number(v?.coins)||0)),days:Math.max(0,Math.floor(Number(v?.days)||0)),unlocked:Array.isArray(v?.unlocked)?v.unlocked.filter(n=>Number.isInteger(n)&&n>=BASE_ROLE_COUNT&&n<BASE_ROLE_COUNT+4):[]}}catch{return {coins:0,days:0,unlocked:[]}}}
let profile=loadProfile();
function saveProfile(){try{localStorage.setItem(STARS_ID,JSON.stringify(profile))}catch{}}
PREMIUM_CREW.forEach((p,i)=>{
 const original=roles[p.base];roles.push({...original,premium:true,cost:p.cost,baseIndex:p.base,name:p.name,short:p.short,job:p.job,desc:'Reserved spotlight slot for a real team member. A fictional stand-in is playable until we receive their name, likeness permission and details.',shirt:original.shirt,hat:'#f6d58b'});
});
function isUnlocked(i){return i<BASE_ROLE_COUNT||profile.unlocked.includes(i)}
function refreshWallet(){for(const id of ['frontWallet','crewWallet']){const e=$(id);if(e)e.textContent=`🪙 ${profile.coins} · DAY ${profile.days+1}`}const c=$('frontContinue');if(c){c.disabled=!hasSavedShift();c.textContent=hasSavedShift()?'▶ CONTINUE SHIFT':'CONTINUE (NO SAVE)'}}
const SAVE_ID='peks-plunder-shift-v08';
function hasSavedShift(){try{const s=JSON.parse(localStorage.getItem(SAVE_ID)||'null');return s&&s.version===8&&s.game&&Number.isInteger(s.game.role)&&s.game.role>=0&&s.game.role<roles.length&&isUnlocked(s.game.role)&&s.game.elapsed>=0&&s.game.elapsed<SHIFT_LENGTH}catch{return false}}
function clearSavedShift(){try{localStorage.removeItem(SAVE_ID)}catch{}}
function saveShift(){if(!game||state!=='playing')return;try{
 const snap={...game,paused:false,boardOpen:false,work:false,mini:null,progress:0,particles:[],floats:[],speech:null,cheerUntil:0};
 localStorage.setItem(SAVE_ID,JSON.stringify({version:8,game:snap,when:Date.now()}));
 }catch{}}
function resumeSavedShift(){if(!hasSavedShift()){toast('NO SAVED SHIFT YET');return false}try{
 const data=JSON.parse(localStorage.getItem(SAVE_ID));game=data.game;
 if(!Number.isFinite(game.x)||!Number.isFinite(game.y)||!Number.isFinite(game.elapsed))throw Error('Invalid save');
 game.x=clamp(game.x,80,1400);game.y=clamp(game.y,183,909);
 game.particles=[];game.floats=[];game.paused=false;game.work=false;game.boardOpen=false;game.mini=null;game.progress=0;
 game.camX=game.x;game.camY=game.y;game.cheerUntil=0;game.customers=Array.isArray(game.customers)?game.customers:[];
 game.customers.forEach(c=>{if(c.table){c.table=DINER_TABLES.find(t=>t.x===c.table.x&&t.y===c.table.y)||null}});
 state='playing';chosen=game.role;introDone=true;keys={};dpad=null;
 $('frontMenu').classList.add('hidden');$('titleScreen').classList.add('hidden');$('sunriseIntro').classList.add('hidden');
 $('creditsScreen').classList.add('hidden');$('finish').classList.add('hidden');$('gameScreen').classList.remove('hidden');
 $('taskBoard').classList.add('hidden');$('minigameOverlay').classList.add('hidden');
 $('pauseBtn').textContent='Ⅱ';updateHud();screenFade();toast('WELCOME BACK TO YOUR SHIFT!');return true;
 }catch{clearSavedShift();toast('COULD NOT RESTORE SHIFT');return false}}
const PICKUP={x:938,y:454};
const EXIT={x:1231,y:187};
const CREW_SPOTS=[[225,736],[249,337],[856,446],[571,474],[1178,255],[1352,529],[762,772],[310,682],[1111,794],[555,324]];
const sites=[{x:721,y:423},{x:184,y:501},{x:1224,y:487},{x:760,y:438},{x:1176,y:786},{x:555,y:305},{x:876,y:825}];
let chosen=0, state='front',game=null,stars=[],sound=true,audio=null,tick=0,last=0,keys={},dpad=null,toastDeadline=0;
const SHIFT_LENGTH=720,DAILY_JOBS=8,DAILY_GUESTS=6;
const shiftDifficulty=t=>t<240?0:t<480?1:2;
const phaseName=t=>['SUNRISE','LUNCH RUSH','SUNSET RUSH'][shiftDifficulty(t)];
const crowdDelay=t=>[49,29,16][shiftDifficulty(t)];
const prankDelay=t=>[120,82,48][shiftDifficulty(t)];
let introStarted=0,introDone=true,miniPointerActive=false;
const DINER_TABLES=[{x:656,y:304},{x:847,y:306},{x:672,y:714},{x:850,y:716},{x:1146,y:315},{x:1335,y:315},{x:1152,y:714},{x:1346,y:716}];
const TABLE_COLLISION={rx:75,ry:68};
const WALL_ZONES=[
 // Hot line and dish machine are solid; open central galley allows passing from prep to dish pit.
 {x:80,y:205,w:388,h:76},{x:85,y:805,w:390,h:70},
 {x:941,y:336,w:33,h:96},{x:1350,y:407,w:58,h:84},
 {x:1063,y:846,w:152,h:35}
];
function ellipseCollision(x,y,t,margin=0){const dx=(x-t.x)/(TABLE_COLLISION.rx+margin),dy=(y-t.y)/(TABLE_COLLISION.ry+margin);return dx*dx+dy*dy<1}
function canStand(x,y){
 const r=13;
 const inKitchen=x>=78&&x<=473&&y>=182&&y<=910;
 const inDining=x>=506&&x<=974&&y>=182&&y<=910;
 const onDeck=x>=1007&&x<=1416&&y>=209&&y<=910;
 const corridorA=x>465&&x<517&&y>=368&&y<=577;
 const corridorB=x>966&&x<1022&&y>=368&&y<=577;
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
 const wave=pose==='cheer';
 const workPose=pose==='work' ? Math.sin(t*18)*3 : 0;
 c.translate(0,Math.round(bob+(wave?-8-Math.abs(Math.sin(t*10))*9:0)));
 ellipse(c,0,10,17,5,'#173e4a55');
 // legs and boots
 rect(c,-10,6+step,8,11,'#3e5460');rect(c,2,6-step,8,11,'#3e5460');rect(c,-11,13+step,9,5,'#263c4e');rect(c,2,13-step,9,5,'#263c4e');
 // arms with pose
 rect(c,-17,-18-(wave?22:0)+workPose,7,21,r.skin);rect(c,10,-17-(wave?22:0)-workPose,7,21,r.skin);
 rect(c,-13,-21,27,31,r.shirt);rect(c,-13,-21,27,5,r.accent);rect(c,-6,-14,13,22,'#fff2d77a');
 rect(c,-5,-16,10,3,r.accent); // apron bow
 rect(c,-11,-44,23,24,r.skin);rect(c,-12,-42,3,15,'#ae6e52');rect(c,-9,-44,23,7,r.hair);
 rect(c,-5,-35,3,3,'#2f414d');rect(c,5,-35,3,3,'#2f414d');if(wave){rect(c,-6,-35,4,2,'#2f414d');rect(c,5,-35,4,2,'#2f414d');rect(c,-2,-28,7,5,'#993b48');rect(c,0,-26,3,1,'#ffe1ca')}else rect(c,0,-29,6,2,'#973f45');
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
function makeCards(){const box=$('crew');box.replaceChildren();roles.forEach((r,i)=>{
 const b=document.createElement('button');const locked=!isUnlocked(i);
 b.className='crewCard'+(i===chosen?' selected':'')+(locked?' locked':'');
 b.setAttribute('aria-label',locked?`Locked staff spotlight. Costs ${r.cost} coins`:`Play as ${r.name}, ${r.job}`);
 b.innerHTML=`<span class="jobPill">${r.premium?(locked?'🔒 '+r.cost+' 🪙':'★ VIP'):(i+1)+'/10'}</span><canvas class="portrait" width="104" height="100"></canvas><b>${r.name}</b><small>${locked?'UNLOCK WITH COINS':r.job}</small>`;
 b.onclick=()=>choose(i);box.appendChild(b);portrait(b.querySelector('canvas'),r,0)
 });choose(chosen)}
function choose(i){chosen=i;document.querySelectorAll('.crewCard').forEach((e,n)=>e.classList.toggle('selected',n===i));
 const r=roles[i],locked=!isUnlocked(i);
 $('roleTitle').textContent=r.name+' · '+r.job;
 $('roleDesc').textContent=locked?`🔒 Spend ${r.cost} shift coins to unlock this fictional staff spotlight. Real employee likenesses will be added only with permission.`:r.desc;
 $('play').textContent=locked?`UNLOCK · ${r.cost} 🪙`:'START THE SHIFT →';
 $('best').textContent='★ TOP SCORE '+best();refreshWallet()}
function startOrUnlock(){if(isUnlocked(chosen)){begin();return}const r=roles[chosen];
 if(profile.coins<r.cost){toast(`NEED ${r.cost-profile.coins} MORE COINS`);return}
 profile.coins-=r.cost;profile.unlocked.push(chosen);saveProfile();makeCards();
 toast(`${r.name.toUpperCase()} UNLOCKED!`);burstConfetti();refreshWallet();}
function openCredits(){state='credits';$('frontMenu').classList.add('hidden');$('creditsScreen').classList.remove('hidden');screenFade()}
function closeCredits(){state='front';$('creditsScreen').classList.add('hidden');$('frontMenu').classList.remove('hidden');refreshWallet();screenFade()}

function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');toastDeadline=performance.now()+2150}
function say(msg){$('message').textContent=msg}
function beep(note=520,len=.1,type='sine'){if(!sound)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;oscillator.type=type;oscillator.frequency.setValueAtTime(note,now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(60,note*.78),now+len);gain.gain.setValueAtTime(.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+len);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+len)}catch{}}
function confetti(x,y,n=17,col='#ffe0a2'){if(!game)return;for(let i=0;i<n;i++)game.particles.push({x,y,vx:rnd(-65,65),vy:rnd(-110,-22),life:rnd(.6,1.2),max:1.2,col:Math.random()<.35?'#9fe1ba':col,size:rnd(3,7)})}
function goal(){const r=roles[game.role];return r.tasks[game.done%r.tasks.length]}
function customersWaiting(){return game?game.customers.filter(c=>c.state==='ordered'):[]}
function serviceTarget(){return game&&game.carryMeal?game.customers.find(c=>c.id===game.carryMeal.id&&c.state==='ordered'):null}
function near(x,y,d=73){return Math.hypot(game.x-x,game.y-y)<d}
/* One non-ghost objective at a time. A complete guest delivery is two sequential
 * steps: collect the order, THEN serve that guest. Background orders remain
 * visible but cannot steal WORK input or spawn extra ! markers. */
function target(){
 if(!game)return null;
 if(game.serviceStage==='pickup'){
  const guest=customersWaiting()[0];
  if(guest)return {kind:'pickup',x:PICKUP.x,y:PICKUP.y,label:'Pick up '+guest.order[0],sub:'Collect '+guest.name+"'s meal",icon:guest.order[1],duration:.75,guest};
  game.serviceStage=null;
 }
 if(game.serviceStage==='serve'){
  const c=serviceTarget();if(c)return {kind:'serve',x:c.tx,y:c.ty,label:'Serve '+c.name,sub:'Deliver '+c.order[0],icon:c.order[1],duration:.65,guest:c};
  game.serviceStage=null;game.carryMeal=null;
 }
 const g=goal();return {kind:'job',x:g[2],y:g[3],label:g[0],sub:g[1],icon:g[4],duration:g[5],isMess:false};
}
function activeTask(){
 if(!game)return null;
 // Ghost events may be completed during ANY job or customer delivery.
 if(game.mess&&near(game.mess.x,game.mess.y,78))return {...game.mess,kind:'ghost'};
 const t=target();
 if(!t)return null;
 const radius=t.kind==='serve'?109:t.kind==='pickup'?84:72;
 return near(t.x,t.y,radius)?t:null;
}
function maybeScheduleService(){
 if(!game||game.serviceStage||game.carryMeal||!customersWaiting().length)return false;
 if(game.done>0&&(game.done%2===0||game.done>=DAILY_JOBS)&&game.served<DAILY_GUESTS){game.serviceStage='pickup';return true}
 return false;
}
function spawnCustomer(){
 if(!game||game.customers.filter(c=>c.state!=='leaving').length>=8)return;
 const id=game.spawned++,table=DINER_TABLES.find(t=>!game.customers.some(c=>c.table===t&&c.state!=='leaving'))||null;
 const guest={id,name:DINER_NAMES[id%DINER_NAMES.length],x:EXIT.x,y:EXIT.y,tx:table?.x||1250,ty:table?.y||280,table,state:table?'entering':'queue',order:DISHES[id%DISHES.length],wait:0,eat:0,route:0,pathIndex:0};game.customers.push(guest);
 if(table){toast(`${guest.name.toUpperCase()} ARRIVED!`);say(`Hattie: Welcome, ${guest.name}! Grab a seat by the water.`)}
}
function moveGuest(c,x,y,dt,speed=64){const dx=x-c.x,dy=y-c.y,dist=Math.hypot(dx,dy);if(dist<speed*dt){c.x=x;c.y=y;return true}c.x+=dx/dist*dt*speed;c.y+=dy/dist*dt*speed;return false}
function updateCustomers(dt){
 if(game.elapsed>game.nextCustomer){spawnCustomer();game.nextCustomer=game.elapsed+crowdDelay(game.elapsed)}
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
 const i=(Math.floor(game.elapsed/8)+game.role+3)%BASE_ROLE_COUNT;
 const spots=CREW_SPOTS;
 if(i!==game.role&&Math.hypot(spots[i][0]-game.x,spots[i][1]-game.y)<265){const messages=CREW_DIALOGUE[roles[i].id];game.speech={role:i,text:messages[Math.floor(game.elapsed/8)%messages.length],until:game.elapsed+3.7};}
}
function updateHud(){
 if(!game)return;
 const r=roles[game.role],t=target(),remaining=Math.max(0,Math.ceil(SHIFT_LENGTH-game.elapsed));
 $('roleEmoji').textContent=r.emoji;$('roleJob').textContent=r.job.toUpperCase();$('roleHudName').textContent=r.short;
 $('time').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
 $('done').textContent=`${Math.min(game.done,DAILY_JOBS)}/${DAILY_JOBS} · 🍽${Math.min(game.served,DAILY_GUESTS)}/${DAILY_GUESTS}`;
 $('score').textContent=game.score;
 $('dayLabel').textContent=phaseName(game.elapsed);
 $('dayMeterFill').style.width=`${Math.min(100,game.elapsed/SHIFT_LENGTH*100)}%`;
 $('progressText').textContent=game.mess?'👻 GHOST PRANK! · '+t.label.toUpperCase():('❗ '+t.label.toUpperCase());
 if(game.boardOpen)refreshTaskBoard();
}
function refreshTaskBoard(){if(!game)return;
 const r=roles[game.role],completed=Math.min(game.done,DAILY_JOBS),current=target();
 const rows=[`<li>🎯 ACTIVE TASK: ${current.icon||'❗'} ${current.label} — ${current.sub||''}</li>`,
 `<li>${completed>=DAILY_JOBS?'✅':'⬜'} ${r.job}: ${completed}/${DAILY_JOBS} tasks</li>`,
 `<li>${game.served>=DAILY_GUESTS?'✅':'⬜'} Guests served: ${Math.min(game.served,DAILY_GUESTS)}/${DAILY_GUESTS}</li>`,
 `<li>👻 Ghost pranks fixed: ${game.ghostCount}</li>`,
 `<li>💰 Coins earned: ${game.score}</li>`];
 if(game.mess)rows.splice(1,0,'<li>👻 BONUS INTERRUPT: Clean up the ghost mess!</li>');
 $('taskItems').innerHTML=rows.join('');
 $('boardHint').textContent=`${phaseName(game.elapsed)} · ${Math.max(0,Math.ceil((SHIFT_LENGTH-game.elapsed)/60))} min left · Finish a task to unlock the next`;
}
function toggleBoard(force){if(!game||state!=='playing')return;game.boardOpen=typeof force==='boolean'?force:!game.boardOpen;
 $('taskBoard').classList.toggle('hidden',!game.boardOpen);if(game.boardOpen){game.work=false;keys={};dpad=null;refreshTaskBoard()}}

function startingSpot(role){const choices=[[706,464],[345,478],[843,487],[445,490],[1050,297],[1263,816],[931,504],[1240,842],[1265,835],[940,294]];const [x,y]=choices[roles[role]?.baseIndex??role];return canStand(x,y)?{x,y}:{x:567,y:464}}
function openFront(){
 state='front';game=null;keys={};dpad=null;introDone=true;introStarted=0;
 $('sunriseIntro').classList.add('hidden');$('sunriseIntro').classList.remove('introFade');
 $('finish').classList.add('hidden');$('gameScreen').classList.add('hidden');$('titleScreen').classList.add('hidden');
 $('frontMenu').classList.remove('hidden');$('creditsScreen').classList.add('hidden');$('taskBoard').classList.add('hidden');$('minigameOverlay').classList.add('hidden');refreshWallet();screenFade();
}
function openCrew(){
 state='menu';game=null;keys={};dpad=null;introDone=true;
 $('sunriseIntro').classList.add('hidden');$('sunriseIntro').classList.remove('introFade');
 $('finish').classList.add('hidden');$('gameScreen').classList.add('hidden');$('frontMenu').classList.add('hidden');
 $('titleScreen').classList.remove('hidden');$('taskBoard').classList.add('hidden');$('minigameOverlay').classList.add('hidden');
 makeCards();refreshWallet();screenFade();
}
function begin(){
 if(!isUnlocked(chosen))return;clearSavedShift();
 const r=roles[chosen],spawn=startingSpot(chosen);
 game={role:chosen,x:spawn.x,y:spawn.y,lastFacing:1,done:0,score:0,progress:0,work:false,mess:null,ghost:null,nextGhost:115,elapsed:0,particles:[],paused:true,ghostCount:0,streak:0,carry:null,carryMeal:null,serviceStage:null,served:0,spawned:0,nextCustomer:8,customers:[],speech:null,nextSpeech:7,camX:spawn.x,camY:spawn.y,completedStations:[],floats:[],jobVisuals:{},combo:0,mini:null,boardOpen:false,peakPhase:0,cheerUntil:0,saveDue:0};
 state='intro';$('creditsScreen').classList.add('hidden');$('frontMenu').classList.add('hidden');$('titleScreen').classList.add('hidden');
 $('gameScreen').classList.remove('hidden');$('finish').classList.add('hidden');$('taskBoard').classList.add('hidden');
 $('pauseBtn').textContent='Ⅱ';say(`${r.name}: ${CREW_DIALOGUE[r.id][0]} Follow the ! to your first job.`);
 updateHud();replayIntro();
}
function finish(won){
 if(state!=='playing')return;state='finish';game.paused=true;game.cheerUntil=tick+6;
 saveBest(game.score);clearSavedShift();
 const reward=won?100+Math.min(game.done,DAILY_JOBS)*12+Math.min(game.served,DAILY_GUESTS)*20:0;
 if(won){profile.days++;profile.coins+=reward;saveProfile()}
 $('finish').classList.remove('hidden');
 $('finishIcon').textContent=won?'🏆':'🌅';$('finishTitle').textContent=won?'HOORAY! SHIFT COMPLETE!':'SUNSET CELEBRATION!';
 $('finishBody').textContent=`${roles[game.role].name} finished ${game.done} jobs, served ${game.served} guests, fixed ${game.ghostCount} ghost pranks, and earned ${game.score} coins. ${won?`You earned ${reward} persistent coins! Day ${profile.days} completed.`:'The crew is proud of your hard work! Reach both goals to earn persistent shift coins.'}`;
 confetti(game.x,game.y,95,'#fff09b');burstConfetti();burstConfetti();screenFade();beep(won?920:740,.32);
}
function ghostPrank(){if(!game||game.mess||state!=='playing')return;const s=sites[Math.floor(rnd(0,sites.length))];game.ghost={x:s.x,y:s.y-52,t:0};game.mess={x:s.x,y:s.y,label:['Ghostly spill!','Flying cutlery!','Mysterious mess!'][Math.floor(rnd(0,3))],sub:'Clean up the ghost prank before it spreads',icon:'👻',duration:1.5,isMess:true,ttl:22};game.progress=0;say('BOO! The cove ghost made a mess. Hurry over and clean it!');toast('👻 GHOST IN THE RESTAURANT!');beep(244,.3,'sawtooth')}
function completeTask(action=activeTask()){
 if(!game||!action)return false;
 if(action.kind==='ghost'&&!game.mess)return false;
 if(action.kind!=='ghost'&&target().kind!==action.kind)return false;
 confetti(action.x,action.y,48,action.kind==='ghost'?'#bdedff':'#ffdf82');burstConfetti();
 game.progress=0;game.work=false;game.cheerUntil=tick+1.85;const role=roles[game.role];
 if(action.kind==='ghost'){
  game.mess=null;game.ghost=null;game.ghostCount++;game.score+=50;game.floats.push({x:action.x,y:action.y-95,label:'CLEAN! +50',life:1.8});
  say('Wade: Whew! That pesky ghost made a fine mess. Thanks for fixing it!');toast('+50 · PRANK FIXED!');beep(750,.17);
 }else if(action.kind==='pickup'){
  const c=action.guest||customersWaiting()[0];if(!c)return false;
  game.carryMeal={id:c.id,name:c.name,icon:c.order[1]};game.serviceStage='serve';say(`${role.short}: ${c.order[0]} for ${c.name}, coming right up!`);toast('TAKE DINNER TO THE ! TABLE');beep(630,.13);
 }else if(action.kind==='serve'){
  const c=action.guest;if(!game.carryMeal||game.carryMeal.id!==c.id)return false;
  c.state='eating';c.eat=0;game.carryMeal=null;game.serviceStage=null;game.served++;game.score+=150;game.floats.push({x:action.x,y:action.y-97,label:'THANK YOU! +150',life:1.7});
  say(`${c.name}: Thank you! This ${c.order[0].toLowerCase()} looks wonderful!`);toast('+150 · HAPPY GUEST!');beep(880,.14);
 }else if(action.kind==='job'){
  const stage=game.done%3;game.carry=stage===2?null:role.tasks[stage][4];game.done++;game.score+=100;maybeScheduleService();
  game.completedStations.push({x:action.x,y:action.y,icon:action.icon,role:role.id,stage,cycle:Math.floor((game.done-1)/3),doneAt:game.elapsed});
  game.jobVisuals[role.id]=Math.max(game.jobVisuals[role.id]||0,stage+1);
  game.floats.push({x:action.x,y:action.y-95,label:'+100  '+action.icon,life:1.7});
  say(`${role.short}: ${CREW_DIALOGUE[role.id][game.done%3]} ${game.done<DAILY_JOBS?'Find the next ! marker.':'The daily job goal is done—extra work earns more coins!'}`);
  toast('+'+100+' · '+action.label.toUpperCase()+' ✓');beep(640+stage*100,.16);
 }
 if(game.done===DAILY_JOBS||game.served===DAILY_GUESTS){confetti(game.x,game.y,55,'#ffdc84');toast('🎉 DAILY GOAL COMPLETE! KEEP GOING!')}
 updateHud();return true;
}
function update(dt){
 if(!game||game.paused||game.boardOpen||game.mini||state!=='playing')return;
 game.elapsed=Math.min(SHIFT_LENGTH,game.elapsed+dt);
 if(game.elapsed>=(game.saveDue||0)){game.saveDue=game.elapsed+4;saveShift()}
 if(game.elapsed>=SHIFT_LENGTH){finish(game.done>=DAILY_JOBS&&game.served>=DAILY_GUESTS);return}
 const phase=shiftDifficulty(game.elapsed);if(phase>game.peakPhase){game.peakPhase=phase;toast(phase===1?'🍽 LUNCH RUSH! MORE DINERS!':'🌙 DINNER RUSH! ALL HANDS!');beep(780,.16)}
 updateCustomers(dt);
 if(game.elapsed>=game.nextGhost){ghostPrank();game.nextGhost=game.elapsed+prankDelay(game.elapsed)+rnd(-6,7)}
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
  const kind=miniKind(task);if(kind){startMini(task,kind);return}
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
function kitchen(t){
 floorPattern(61,159,422,768,'#ebd3a6','#d5b281');pRect(61,159,422,16,'#755c52');pRect(61,913,422,15,'#896950');
 // Hot line: five recognizable, individually labeled machines. Equipment is collidable.
 pRect(80,205,388,76,'#83929a');pRect(81,205,386,10,'#f4e2bd');
 for(const st of [{x:90,w:72,name:'FRYER'},{x:166,w:71,name:'FRYER'},{x:239,w:73,name:'FLAT TOP'},{x:315,w:70,name:'GRILL'},{x:390,w:73,name:'OVEN'}]){
   rounded(ctx,st.x,214,st.w,55,5,'#53636d');pRect(st.x+5,216,st.w-10,6,'#cdd7d5');
   if(st.name==='FRYER'){
     rounded(ctx,st.x+9,226,st.w-18,28,4,'#343b45');pRect(st.x+13,230,st.w-26,18,'#ba8d4b');
     for(let k=0;k<4;k++){ellipse(ctx,st.x+16+k*10,232+Math.sin(t*5+k)*3,3,2,'#ffe3aa')}
     pRect(st.x+25,219,4,12,'#a9c9ca');pRect(st.x+22,219,22,4,'#d4e2dd');
   }else if(st.name==='FLAT TOP'){
     pRect(st.x+8,225,st.w-16,29,'#393e46');pRect(st.x+11,232,st.w-22,16,'#7d8080');
     for(let k=0;k<3;k++)ellipse(ctx,st.x+19+k*14,237,7,5,'#d6a271');
   }else if(st.name==='GRILL'){
     pRect(st.x+8,225,st.w-16,28,'#30343b');for(let k=0;k<7;k++)line(ctx,st.x+14+k*8,228,st.x+14+k*8,250,'#9fa9a8',3);
     ellipse(ctx,st.x+28,238,12,6,'#ab634e');
   }else{
     pRect(st.x+8,226,st.w-16,29,'#252f38');pRect(st.x+12,230,st.w-24,19,'#e2a36d');pRect(st.x+19,235,st.w-38,9,'#bd7956');
   }
   text(ctx,st.name,st.x+st.w/2,199,st.name==='FLAT TOP'?11:12,'#254957','center',false);
 }
 // Open prep room with refrigerated fish prep, grill prep, food bins, and clear floor lanes.
 rounded(ctx,92,626,135,43,6,'#a5c6c5');rounded(ctx,247,626,190,43,6,'#d3b18a');
 for(let i=0;i<4;i++)ellipse(ctx,108+i*27,645,10,6,'#9ed4d6');
 pRect(262,634,44,18,'#c8916b');ellipse(ctx,323,645,23,12,'#bdd6d0');text(ctx,'FRESH CATCH / PREP',287,612,12,'#315b69','center',false);
 // Deep dish pit: exactly three stainless sinks, side by side, and a full dishwasher.
 pRect(84,805,390,72,'#8aaab0');pRect(84,807,390,9,'#eaf0e5');
 for(let i=0;i<3;i++){
   const x=94+i*66;pRect(x,819,60,42,'#c2dfe0');pRect(x+5,823,50,33,'#527e92');pRect(x+13,828,33,22,i===1?'#6aa8b0':'#86babc');
   pRect(x+31,810,4,15,'#e1e8e7');pRect(x+24,812,18,4,'#e9f4ee');
   for(let b=0;b<4;b++)ellipse(ctx,x+14+b*10,830+Math.sin(t*4+b+i)*6,3,3,'#e2fcf4');
 }
 rounded(ctx,297,819,168,45,5,'#d5e0df');rounded(ctx,307,825,142,27,3,'#3f6875');
 pRect(319,830,48,15,'#b9ced0');for(let k=0;k<3;k++)ellipse(ctx,399+k*12,838,4,4,k===0?'#8ee4b4':'#fbca82');
 text(ctx,'DISHWASHER',380,897,16,'#27576c','center',false);
 sign(122,763,260,'DISH PIT • 3 SINKS');
 // Drain racks and stacked clean dish piles flank the machine.
 for(let i=0;i<4;i++){ellipse(ctx,345+i*19,789,13,5,'#fbf4dd');ellipse(ctx,345+i*19,785,9,4,'#bddadc')}
 sign(135,113,240,'GALLEY • HOT LINE');
 sign(165,561,208,'SEAFOOD PREP');
 // Service pass has real plating shelf beside dining doorway.
 pRect(396,397,79,24,'#a87858');pRect(396,396,79,7,'#fce3b1');for(let i=0;i<3;i++)ellipse(ctx,414+i*21,406,9,5,'#fff9de');
}
function dining(t){floorPattern(501,160,479,768,'#e4c295','#c79d7b');pRect(501,160,479,15,'#755c52');pRect(501,914,479,14,'#7d5d53');pRect(494,160,13,206,'#9a7159');pRect(494,579,13,348,'#9a7159');pRect(971,160,12,206,'#8f6b58');pRect(971,579,12,348,'#8f6b58');pRect(580,162,7,96,'#966448');pRect(580,255,144,8,'#b18b70');pRect(755,162,7,85,'#966448');pRect(762,247,155,9,'#b18b70');
 // Two room atmospheres, inspired by the restaurant's family / chowder rooms.
 pRect(517,189,110,27,'#d3e2d0');pRect(525,195,29,15,'#8cc8c2');pRect(562,195,28,15,'#8cc8c2');pRect(598,195,22,15,'#8cc8c2');
 pRect(809,190,134,31,'#d5c09e');pRect(815,196,119,20,'#3d6572');text(ctx,'CHOWDER ROOM',874,210,10,'#f3ddbb','center');
 table(656,304);table(847,306);table(672,714);table(850,716);
 for(const x of [548,750,927]){pRect(x-2,178,5,20,'#88604c');ellipse(ctx,x,207,18,8,'#ffce84');ellipse(ctx,x,208+Math.sin(t*3+x)*2,8,3,'#ffebb1')}
 // Pass / register facing a spacious center aisle.
 pRect(944,336,30,96,'#b88861');pRect(944,336,30,13,'#f2cc8b');text(ctx,'PASS',960,384,11,'#fce4a9','center');sign(600,122,240,'THE FAMILY DINING ROOM');
 // Floor rugs and nautical artwork.
 pRect(771,416,87,12,'#659e9c');pRect(789,415,49,13,'#bedcd3');pRect(802,411,23,16,'#e1ba72');pRect(513,863,98,14,'#6faaa7');pRect(517,866,90,8,'#afdfc6');
}
function patio(t){pRect(998,173,441,756,'#806556');floorPattern(1008,192,420,725,'#bc906f','#9c735c');pRect(995,168,452,18,'#e6c383');pRect(1002,916,439,14,'#e5c18b');for(const x of [1012,1083,1164,1246,1328,1416]){pRect(x,189,9,727,'#957258');pRect(x,177,10,12,'#f2e4bc')}for(let y=215;y<910;y+=120){pRect(1002,y,9,12,'#ecd8a8');pRect(1424,y,9,12,'#ecd8a8')}
 table(1146,315);table(1335,315);table(1152,714);table(1346,716);
 pRect(1350,407,61,84,'#886351');pRect(1347,407,70,13,'#fae0a2');for(let i=0;i<3;i++){pRect(1358+i*16,425,9,20,['#80ddb0','#f6c47c','#ec9e95'][i]);ellipse(ctx,1363+i*16,425,6,3,'#fcf1cc')}
 sign(1246,402,167,'TIKI BAR');pRect(1063,846,152,36,'#679a76');for(let i=0;i<11;i++){ellipse(ctx,1074+i*12,844,8,7,['#ffcb87','#f59cb1','#8ddbb3'][i%3]);pRect(1074+i*12,847,2,8,'#517c5f')}
 pRect(1350,841,65,39,'#b38d62');pRect(1350,841,65,8,'#efc484');text(ctx,'DOCK',1381,867,14,'#fff0cb','center');
 for(let x=1020;x<=1400;x+=46){line(ctx,x,171,x+14,184,'#bfa88d',1);ctx.fillStyle=['#f8c57b','#f29eac','#a3e8c9','#ccaedf'][(x/46|0)%4];ctx.beginPath();ctx.moveTo(x+5,169);ctx.lineTo(x+30,169);ctx.lineTo(x+15,188);ctx.fill();ellipse(ctx,x+14,176,4+Math.sin(t*4+x)*1,4,'#ffe4a9')}
 sign(1037,212,135,'THE DECK');palm(1450,919,1.3);
}
function supplies(t){ // actual restaurant: several rooms connect to a covered waterside patio; walkway is interpretation, not surveyed geometry.
 pRect(1165,73,139,132,'#7e6e5d');floorPattern(1173,85,120,116,'#bc966c','#997353');pRect(1145,73,175,20,'#efd3a0');sign(1153,98,155,"PECK'S COVE");pRect(1225,145,32,48,'#8bbeb0');for(const [x,y] of [[522,691],[918,696],[1028,664],[1191,726]]){pRect(x-9,y-7,18,19,'#da9377');ellipse(ctx,x,y-14,16,16,'#5a946b');ellipse(ctx,x-4,y-20,8,9,'#a5cd7d')}
 for(const [x,y] of [[501,143],[969,143],[998,151],[1435,163]]){pRect(x-4,y-14,8,17,'#765a4b');pRect(x-10,y-4,20,24,'#d7a866');pRect(x-6,y,12,16,'#ffe4a0');pRect(x-10,y+20,20,4,'#5e7975')}
}
function fishAndNature(t){for(let i=0;i<5;i++){const fx=(i*277+t*(i%2?8:-11)+MAP_W*5)%MAP_W,fy=38+i*22;ellipse(ctx,fx,fy,17,5,'#85c9c6');ctx.fillStyle='#85c9c6';ctx.beginPath();ctx.moveTo(fx-12,fy);ctx.lineTo(fx-24,fy-6);ctx.lineTo(fx-24,fy+6);ctx.fill()}for(let i=0;i<9;i++){const x=55+i*161,y=795+Math.sin(t+i)*5;line(ctx,x,y,x+21,y-3,'#b3e5e0',3)}palm(36,185,1.5);palm(1460,100,1.2)}
function world(t){water(t);fishAndNature(t);pRect(50,145,937,790,'#775e54');pRect(55,153,926,775,'#997457');kitchen(t);dining(t);patio(t);supplies(t);
 // Explicit wide connecting doorways to avoid collisions around interior walls.
 floorPattern(480,368,27,210,'#d0af83','#b68c6d');floorPattern(970,368,36,210,'#cf9f78','#b98968');
 for(const door of [{x:490,y:466,a:'KITCHEN',b:'DINING'},{x:992,y:467,a:'DINING',b:'DECK'}]){
   pRect(door.x-26,door.y-100,52,9,'#8d654e');pRect(door.x-26,door.y-100,7,192,'#8d654e');pRect(door.x+18,door.y-100,7,192,'#8d654e');
   rounded(ctx,door.x-56,door.y-95,112,20,5,'#fff0bd');text(ctx,'⇄ DOORWAY',door.x,door.y-81,12,'#295369','center',false);
   pRect(door.x-10,door.y+68,20,6,'#9bd9c7');text(ctx,'⇄',door.x,door.y+56,22,'#fff1bd','center');
 }

 for(let i=0;i<10;i++){ellipse(ctx,1085+i*23,969+Math.sin(t*2+i)*2,12,3,'#9edbd7')}
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
 const q=target();if(q)workMarker(q.x,q.y,q.label,t,q.kind==='job'?'#ffcc73':'#b4ebd3');
 if(game.mess)workMarker(game.mess.x,game.mess.y,'GHOST MESS',t,'#b6dcff');
 const task=activeTask();if(task&&game.progress>0){rounded(ctx,task.x-39,task.y+24,78,12,4,'#1b5261');rounded(ctx,task.x-37,task.y+26,74*game.progress,8,3,'#f5d990');for(let i=0;i<5;i++){const bx=task.x-22+i*11,by=task.y-4-Math.sin(t*6+i)*15;ellipse(ctx,bx,by,3+game.progress*3,3+game.progress*3,task.kind==='ghost'?'#c9f6ffb9':'#fffae0b9')}}
}
function ghost(x,y,t){for(let i=0;i<5;i++){const a=t*3+i*TAU/5;ellipse(ctx,x+Math.cos(a)*31,y+Math.sin(a)*24,3+i%2,3+i%2,'#d0f5ff90')}ctx.save();ctx.translate(x,y+Math.sin(t*4)*6);ellipse(ctx,0,23,18,6,'#1d576052');ellipse(ctx,0,0,24,29,'#bbf6ec55');ellipse(ctx,0,-5,17,22,'#e2faf2');pRect(-17,-2,34,18,'#d6fcf3');pRect(-17,12,10,11,'#d6fcf3');pRect(-1,15,10,14,'#d6fcf3');pRect(12,9,6,15,'#d6fcf3');pRect(-8,-13,5,7,'#34526b');pRect(6,-13,5,7,'#34526b');pRect(-2,-4,6,5,'#f2929c');ctx.restore()}
function npcCharacters(t){if(!game)return;roles.slice(0,BASE_ROLE_COUNT).forEach((r,i)=>{if(i===game.role)return;const spots=CREW_SPOTS;const [x,y]=CREW_SPOTS[i];const sway=Math.sin(t*.65+i*7)*5;sprite(ctx,x+sway,y+Math.cos(t*.8+i)*2,r,.77,t,'idle')})}
function drawCharacter(t){const r=roles[game.role],moving=(keys['arrowleft']||keys['arrowright']||keys['arrowup']||keys['arrowdown']||keys['a']||keys['d']||keys['w']||keys['s']||dpad);const cheering=game.cheerUntil>t;sprite(ctx,game.x,game.y,r,cheering?1.32:1.17,t,cheering?'cheer':moving?'walk':game.work?'work':'idle');if(cheering){for(let i=0;i<5;i++){const a=i*TAU/5+t*3;const xx=game.x+Math.cos(a)*36,yy=game.y-68-Math.abs(Math.sin(a))*28;text(ctx,i%2?'♥':'✦',xx,yy,18,i%2?'#ffb4c0':'#ffeb92','center',false)}}
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
 if(!game)return;const q=target(),px=(q.x-camX)*zoom+W/2,py=(q.y-camY)*zoom+H/2;
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
 drawDaylight(game?.elapsed||0);
 drawObjectiveCompass(camX,camY,zoom);
 if(game?.paused&&state==='playing'){rect(ctx,0,0,W,H,'#092f3eac');rounded(ctx,350,182,260,120,18,'#245d68');text(ctx,'PAUSED',480,244,39,'#ffe9a8','center');text(ctx,'Tap Ⅱ to continue',480,274,17,'#d1f2e9','center')}
}
/* Zero-input attract mode: the actual restaurant scene renderer and shared character sprites
   keep bustling behind the main menu. Entirely independent of the player's active shift.
   Guests and workers repeatedly enter, move, cook, eat, clean and wave. */
const DEMO_PERIOD=40;
const DEMO_ROUTES=[
 [[150,500],[245,515],[206,351],[310,371],[155,500]],
 [[235,355],[310,352],[307,255],[220,351],[235,355]],
 [[930,410],[935,455],[1014,463],[1215,520],[1321,536],[1018,448],[930,410]],
 [[540,420],[700,414],[924,438],[938,260],[540,420]],
 [[1220,252],[1244,439],[1213,460],[1220,252]],
 [[1367,446],[1314,473],[1367,446]],
 [[745,532],[912,525],[924,443],[741,535]],
 [[1377,677],[1250,671],[1068,615],[1377,677]],
 [[1163,646],[1200,626],[1090,661],[1163,646]],
 [[1035,461],[1024,510],[1350,476],[1035,461]]
];
function demoPath(nodes,t,duration=19,offset=0){
 let phase=((t+offset)%duration+duration)%duration / duration * nodes.length;
 const a=Math.floor(phase), f=phase-a, x=nodes[a%nodes.length], y=nodes[(a+1)%nodes.length];
 const smooth=f*f*(3-2*f);return [x[0]+(y[0]-x[0])*smooth,x[1]+(y[1]-x[1])*smooth];
}
function menuAttract(t){
 if(!['menu','front','credits'].includes(state))return;
 // Simulated shift is not the player's game object; it can never award or save points.
 const oldCtx=ctx,oldGame=game;
 const m=t%DEMO_PERIOD;
 ctx=demoCtx;
 try{
  ctx.clearRect(0,0,W,H);
  ctx.save();ctx.translate(W/2,H/2);ctx.scale(.97,.97);
  const camX=760+195*Math.sin(t*.075),camY=451+48*Math.sin(t*.11);
  ctx.translate(-camX,-camY);
  world(t);
  for(let i=0;i<BASE_ROLE_COUNT;i++){
   const r=roles[i],nodes=DEMO_ROUTES[i],moving=i!==5;
   const [x,y]=demoPath(nodes,t,13+i%4*3,i*3.17);
   sprite(ctx,x,y,r,i===2?1.20:.99,t,moving?'walk':'work');
   if(i===2){ // waiter carrying a fresh plate
    ellipse(ctx,x+29,y-29,16,6,'#fff5d3');text(ctx,'🍤',x+29,y-29,16,'#28566a','center',false)
   }
   if(i===1){ // chef cooking: rising steam and golden pan sparks
    for(let k=0;k<4;k++){ellipse(ctx,x+Math.cos(t*3+k*2)*14,y-51-(t*21+k*17)%50,3,7,'#f8efce95')}
   }
   if(i===6){text(ctx,'✦',x-15,y-42+Math.sin(t*3)*4,17,'#ffe09d','center',false)}
  }
  const colors=['#e9bf9e','#a5cfd8','#e8a6a0','#dbd6a7'];
  DINER_TABLES.forEach((table,i)=>{
   const phase=(m+(i*5.3))%DEMO_PERIOD;
   let x=table.x+(i%2===0?-85:85),y=table.y-1;
   let bubble='';
   if(phase<5){const start=[EXIT.x,EXIT.y],target=[x,y];const a=phase/5;x=start[0]+(target[0]-start[0])*a;y=start[1]+(target[1]-start[1])*a;bubble='…';}
   else if(phase<16){bubble='🍲';}
   else if(phase<28){bubble='♥';}
   else if(phase<34){const a=(phase-28)/6;x=x+(EXIT.x-x)*a;y=y+(EXIT.y-y)*a;bubble='';}
   else{ x=EXIT.x+(i%3)*19;y=EXIT.y+12; }
   ellipse(ctx,x,y+12,14,4,'#1b394a70');rect(ctx,x-9,y-16,18,24,colors[i%4]);
   rect(ctx,x-8,y-33,16,19,['#d7a17a','#c6a38b','#a66d55','#e1c0a2'][i%4]);rect(ctx,x-9,y-35,18,5,'#665450');
   if(bubble){rounded(ctx,x-18,y-64,36,25,7,'#fff2c5');text(ctx,bubble,x,y-45,17,'#285369','center',false)}
  });
  if((m>10&&m<23)||(m>31&&m<38)){
   const x=680+130*Math.sin(t*1.25),y=265+56*Math.sin(t*.6);
   ghost(x,y,t);
   for(let k=0;k<5;k++){const a=t*4+k*TAU/5;ellipse(ctx,x+Math.cos(a)*35,y+Math.sin(a)*30,4,5,'#c5f8ffa0')}
  }
  // Dining bustle: steam, little service sparkle, occasional job urgency.
  for(let i=0;i<8;i++){const xx=151+i%4*16,yy=320-Math.abs((t*22+i*16)%69);ellipse(ctx,xx,yy,2+i%2,6,'#fff4d1a2')}
  if(m>22&&m<29){text(ctx,'!',845,245+Math.sin(t*5)*4,34,'#ffe4a3','center');}
  ctx.restore();
  // Small non-intrusive demonstration label; menu remains fully interactive.
  rounded(ctx,734,505,215,26,8,'#0b3946c8');text(ctx,'● LIVE DINNER RUSH',842,524,15,'#ffe6aa','center',false);
 }finally{ctx=oldCtx;game=oldGame}
}

function drawDaylight(elapsed){
 const d=clamp(elapsed/SHIFT_LENGTH,0,1);
 if(d>.44){const dark=(d-.44)/.56;ctx.save();ctx.fillStyle=`rgba(19,32,75,${(dark*.44).toFixed(3)})`;ctx.fillRect(0,0,W,H);ctx.restore()}
 else if(d<.22){ctx.save();ctx.fillStyle=`rgba(255,208,129,${(.18*(1-d/.22)).toFixed(3)})`;ctx.fillRect(0,0,W,H);ctx.restore()}
 // Warm dusk glows and window lights when the evening gets busy.
 if(d>.66){ctx.save();ctx.globalAlpha=Math.min(.7,(d-.66)*2);for(let i=0;i<5;i++){const x=94+i*192;ellipse(ctx,x,70,33,11,'#f4c975')}ctx.restore()}
}
function drawSky(t){sc.clearRect(0,0,480,270);const g=sc.createLinearGradient(0,0,0,270);g.addColorStop(0,'#529aab');g.addColorStop(.63,'#f3b385');g.addColorStop(1,'#144e64');sc.fillStyle=g;sc.fillRect(0,0,480,270);ellipse(sc,370,82,47,47,'#fceab5');cloud(41+Math.sin(t/5)*10,65,1.3);cloud(247-Math.sin(t/9)*9,25,.8);for(let i=0;i<8;i++){line(sc,0,193+i*10,480,193+i*10,i%2?'#7bc9b2':'#52979e',3)}for(let i=0;i<10;i++)line(sc,340+i*3,190+i*4,402-i*5,193+i*4,'#ebd7a1',3);palm(30,215,2.1);palm(470,260,2)}
function loop(now){const dt=Math.min(.05,(now-last||16)/1000);last=now;tick+=dt;drawSky(tick);if(['menu','front','credits'].includes(state))menuAttract(tick);if(state==='playing')update(dt);if(game?.mini)updateMini(dt);if(state!=='menu'&&state!=='front'&&game)render(tick);if(state==='finish')drawVictory(tick);if(game?.mini)paintMini();if(!introDone)drawIntro(now);if(toastDeadline&&now>toastDeadline){$('toast').classList.remove('show');toastDeadline=0}requestAnimationFrame(loop)}
function drawVictory(t){
 if(!game||state!=='finish')return;
 const canvas=$('victoryCanvas');if(!canvas)return;const c=canvas.getContext('2d');if(!c)return;
 c.clearRect(0,0,360,190);c.save();
 for(let i=0;i<12;i++){const a=i*TAU/12+t*.35;ellipse(c,180+Math.cos(a)*118,92+Math.sin(a)*72,4,4,i%2?'#ffdd81':'#b3eed5')}
 ellipse(c,180,150,81,17,'#123d4a55');
 sprite(c,180,141,roles[game.role],2.16,t,'cheer');
 for(let i=0;i<7;i++){let x=180+Math.cos(t*1.8+i)*82,y=68+Math.sin(t*1.8+i*1.3)*31;text(c,i%2?'♥':'✦',x,y,21,i%2?'#ff8c9e':'#fff0a0','center',false)}
 c.restore();
}
function nearbyDialogue(){
 if(!game)return false;
 const spots=CREW_SPOTS;
 for(let i=0;i<BASE_ROLE_COUNT;i++){
  if(i!==game.role&&near(spots[i][0],spots[i][1],70)){
   const lines=CREW_DIALOGUE[roles[i].id];const v=lines[Math.floor(game.elapsed/3)%lines.length];
   game.speech={role:i,text:v,until:game.elapsed+4};say(`${roles[i].short}: ${v}`);beep(430,.08);return true;
  }
 }
 return false;
}
function pressWork(){if(!game||game.paused||game.boardOpen||game.mini||state!=='playing')return;
 if(activeTask()){const a=activeTask(),kind=miniKind(a);if(kind){startMini(a,kind);return}game.work=true;return}
 if(nearbyDialogue())return;
 toast('FIND A ! MARKER AND MOVE CLOSE');
}

/* Scene presentation: short fade curtain plus a scripted 3.8-second sunrise over the cove. */
function screenFade(){const el=$('sceneFade');el.classList.remove('wipe');void el.offsetWidth;el.classList.add('wipe')}
function replayIntro(){introDone=false;introStarted=0;$('sunriseIntro').classList.remove('hidden','introFade')}
function finishIntro(){if(introDone)return;introDone=true;const el=$('sunriseIntro');el.classList.add('introFade');if(state==='intro'&&game){state='playing';game.paused=false;screenFade();toast('☀️ THE SHIFT BEGINS!');beep(660,.1)}setTimeout(()=>{if(introDone)el.classList.add('hidden')},540)}
function drawIntro(now){if(!introStarted)introStarted=now;const elapsed=now-introStarted,p=clamp(elapsed/3800,0,1),c=$('sunriseCanvas').getContext('2d');if(!c)return;
 const w=640,h=360;c.clearRect(0,0,w,h);
 const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,p<.35?'#162f59':'#3c8faa');bg.addColorStop(.57,'#f4a776');bg.addColorStop(1,'#f4dcac');c.fillStyle=bg;c.fillRect(0,0,w,h);
 const sunY=220-p*161;c.fillStyle='#ffecac';c.beginPath();c.arc(426,sunY,46,0,TAU);c.fill();c.fillStyle='#fffcdf88';c.beginPath();c.arc(426,sunY,64,0,TAU);c.fill();
 for(let i=0;i<8;i++){c.fillStyle=i%2?'#4fa6b0':'#77c1bd';c.fillRect(0,249+i*15,w,15)}
 for(let i=0;i<15;i++){c.fillStyle=i%2?'#f7d18c':'#d3f0c6';c.fillRect(315+i*11,255+i*4,110-i*6,3)}
 c.fillStyle='#513b45';c.fillRect(42,188,330,90);c.fillRect(352,228,160,45);c.fillStyle='#b57553';c.fillRect(55,202,300,62);c.fillStyle='#244b5e';c.beginPath();c.moveTo(29,190);c.lineTo(206,129);c.lineTo(390,192);c.fill();
 for(let i=0;i<6;i++){c.fillStyle='#ffd38e';c.fillRect(70+i*49,219,28,28);c.fillStyle='#3f5964';c.fillRect(74+i*49,225,19,17)}
 c.fillStyle='#f6dc99';c.fillRect(111,151,192,30);c.font='bold 20px sans-serif';c.textAlign='center';c.fillStyle='#284458';c.fillText("PEK'S PLUNDER",206,173);
 for(let i=0;i<10;i++){c.fillStyle='#4d3d43';c.fillRect(350+i*27,265,8,60)}c.fillStyle='#947259';c.fillRect(342,273,295,14);
 c.fillStyle='#d6f1d4';c.font='bold 20px sans-serif';c.fillText(p<.5?'A NEW DAY AT THE COVE…':'TIME TO GET TO WORK!',320,331);
 $('introMeter').style.width=`${Math.round(p*100)}%`;if(p>=1)finishIntro();
}
/* Confetti is pinned to the game viewport; it cannot block touches. */
function burstConfetti(){const layer=$('celebrateFX');if(!layer)return;const colors=['#ffd66d','#ff8c8f','#9fe6d4','#b6abfc','#fff6cd'];
 for(let n=0;n<26;n++){const p=document.createElement('i');p.className='confettiPiece';p.style.left=(22+Math.random()*56)+'%';p.style.top=(20+Math.random()*30)+'%';p.style.backgroundColor=colors[n%colors.length];p.style.setProperty('--flyX',`${(Math.random()-.5)*360}px`);p.style.setProperty('--flyY',`${90+Math.random()*210}px`);p.style.animationDelay=(n%7*25)+'ms';layer.appendChild(p);setTimeout(()=>p.remove(),1450)}
}
/* V0.8 tactile-work library: every staff objective runs a minigame, each with
 * five differing visual layouts. The clock pauses, and failure never awards credit.
 * The same engine supports more recipes and jobs without changing the game loop. */
const MINI_ROLE_KINDS={
 dishes:['sort','dish','stack'],cook:['prep','fryer','plate'],waiter:['tray','tray','tip'],
 boss:['count','tap','count'],host:['tap','seat','sort'],drinks:['sort','shake','tray'],
 busser:['sort','sweep','stack'],fish:['sort','chill','prep'],
 decor:['water','tap','polish'],fix:['trace','dial','trace']
};
const FOOD_RESIDUES=[
 {name:'FRIED GROUPER CRUMBS',food:'grouper',color:'#c37b42'},
 {name:'SHRIMP TAILS & SAUCE',food:'shrimp',color:'#ef9b7a'},
 {name:'SEAFOOD CHOWDER',food:'chowder',color:'#e4c283'},
 {name:'KEY LIME PIE CRUMBS',food:'pie',color:'#d5cb69'},
 {name:'CRAB SHELLS & BUTTER',food:'crab',color:'#dd735c'}
];
const MINI_LABELS={dish:['🫧 WASH THE DISH','Swipe away every leftover piece.'],fryer:['🍟 CLEAR THE FRYER','Slide the pole left and right. Reverse repeatedly to loosen food debris.'],
 tray:['🍽️ BALANCE THE TRAY','Touch and drag to follow the moving balance target. Food falls if the tray tilts too far!'],
 sort:['📦 SORT THE ITEMS','Tap the glowing items in numbered order.'],stack:['🍽️ STACK THE DISHES','Tap each item in order to arrange a neat stack.'],
 prep:['🔪 PREP THE CATCH','Tap the ingredients in order to finish the preparation.'],plate:['🍤 PLATE THE ORDER','Tap the ingredients in order to build the plate.'],
 tip:['💰 COLLECT THE TIP','Tap the coins in order to count the tip.'],count:['📋 CHECK THE INVENTORY','Count and tap the highlighted items.'],
 tap:['✨ GET TO WORK','Tap the numbered markers to finish the job.'],seat:['🪑 SET THE TABLE','Arrange the table settings in order.'],
 shake:['🍹 SHAKE THE MIXER','Quickly slide left and right until the drink is perfectly mixed.'],
 sweep:['🧹 SWEEP UP','Swipe across all the crumbs and stains.'],chill:['🧊 PACK IT ON ICE','Tap the ice and fish boxes in order.'],
 water:['🌺 WATER THE FLOWERS','Tap the planters in the highlighted order.'],
 polish:['🧽 POLISH IT CLEAN','Swipe across every dusty spot.'],trace:['🔧 FOLLOW THE REPAIR STEPS','Tap each connection in numbered order.'],
 dial:['⚡ TUNE THE SYSTEM','Tap the marked controls in order.']};
const MINI_ICONS={sort:['🐟','🦀','🍋','🍤','🥬'],stack:['🍽','🥣','🥄','🍴','✨'],prep:['🐟','🍋','🔪','🧂','🌿'],plate:['🍤','🐟','🍋','🌿','🥣'],tip:['🪙','💰','💵','⭐','🪙'],count:['📦','🧊','🥫','🐟','📋'],
 tap:['⭐','🧽','📋','🪛','✨'],seat:['🪑','🍴','🥣','📖','🌸'],chill:['🧊','🐟','🧊','❄','🐟'],water:['🌷','🌺','🌿','🌼','🌻'],trace:['⚡','🔧','🔌','💡','🪛'],dial:['⚡','🔋','🔧','💡','✓']};
const lastMiniVariant={};
function nextVariant(kind){let n=Math.floor(Math.random()*5);if(n===lastMiniVariant[kind])n=(n+1+Math.floor(Math.random()*4))%5;lastMiniVariant[kind]=n;return n}
function miniKind(action){if(!game||!action)return null;
 if(action.kind==='ghost')return 'sweep';
 if(action.kind==='pickup')return 'plate';
 if(action.kind==='serve')return 'tray';
 if(action.kind!=='job')return null;
 return (MINI_ROLE_KINDS[roles[game.role].id]||MINI_ROLE_KINDS.boss)[game.done%3];
}
function constructMini(action,kind,attempt=1){
 const variant=nextVariant(kind),a=variant*.62,offsets=[[-43,-24],[3,-38],[47,-21],[-46,19],[7,36],[49,19]];
 const grime=offsets.map(([ox,oy],i)=>{
  const ang=a+i*.24;return {x:180+ox*Math.cos(ang)-oy*Math.sin(ang),y:147+ox*Math.sin(ang)*.56+oy*Math.cos(ang)*.76,dirty:1,type:(i+variant)%5};
 });
 const spots=Array.from({length:4+variant%2},(_,i)=>{
  const theta=i*2.4+variant*.81,r=variant%2?70:58;
  return {x:185+Math.cos(theta)*r,y:141+Math.sin(theta)*r*.66,icon:(MINI_ICONS[kind]||MINI_ICONS.tap)[(i+variant)%5]};
 });
 return {action,kind,variant,attempt,progress:0,grime,spots,index:0,last:null,lastDir:0,swing:0,switches:0,
  touched:false,touchX:230,stable:0,failTime:0,failed:0,showFall:0,feedback:'',lastProgressSound:0};
}
function startMini(action,kind){if(!game||game.mini||!action||!kind||game.boardOpen)return;
 game.mini=constructMini(action,kind);game.work=false;keys={};dpad=null;miniPointerActive=false;
 const m=game.mini;
 $('minigameTitle').textContent=kind==='dish'?'🫧 '+FOOD_RESIDUES[m.variant].name:MINI_LABELS[kind]?.[0]||'WORK TIME';
 $('minigameHelp').textContent=MINI_LABELS[kind]?.[1]||'Tap the numbered icons.';
 $('minigameProgress').style.width='0%';$('minigameStatus').textContent=`VARIANT ${m.variant+1} OF 5 · ATTEMPT 1`;
 $('minigameOverlay').classList.remove('hidden');saveShift();screenFade();paintMini();
}
function exitMini(success=false){if(!game?.mini)return;
 const mini=game.mini;game.mini=null;miniPointerActive=false;
 $('minigameOverlay').classList.add('hidden');screenFade();
 if(success){completeTask(mini.action);toast('🌟 '+(mini.kind==='dish'?'SPARKLING CLEAN!':mini.kind==='tray'?'TRAY DELIVERED!':'SUPERB WORK!'));beep(990,.23)}
 else toast('TASK NOT FINISHED — RETURN TO TRY AGAIN!');
 saveShift();
}
function miniPos(e){const bounds=$('miniCanvas').getBoundingClientRect();return {x:(e.clientX-bounds.left)/bounds.width*460,y:(e.clientY-bounds.top)/bounds.height*280}}
function pointSegDist(ax,ay,bx,by,x,y){const dx=bx-ax,dy=by-ay,v=dx*dx+dy*dy;const t=v?clamp(((x-ax)*dx+(y-ay)*dy)/v,0,1):0;return Math.hypot(ax+dx*t-x,ay+dy*t-y)}
function applyMini(x,y,tap=false){const m=game?.mini;if(!m||m.showFall>0)return;const prev=m.last;
 if(m.kind==='tray'){
  m.touched=true;m.touchX=clamp(x,48,412);
 }else if(['dish','sweep','polish'].includes(m.kind)){
  const travel=prev?Math.hypot(x-prev.x,y-prev.y):0;
  if(tap||travel>2){for(const dirt of m.grime){const distance=prev?pointSegDist(prev.x,prev.y,x,y,dirt.x,dirt.y):Math.hypot(x-dirt.x,y-dirt.y);
   if(distance<29)dirt.dirty=Math.max(0,dirt.dirty-(tap?.22:.12+Math.min(travel,60)*.007));}}
  m.progress=1-m.grime.reduce((sum,d)=>sum+d.dirty,0)/m.grime.length;
 }else if(['fryer','shake'].includes(m.kind)){
  if(prev){m.swing+=x-prev.x;
   if(Math.abs(m.swing)>=(m.kind==='fryer'?23:27)){const dir=Math.sign(m.swing);if(m.lastDir&&dir!==m.lastDir){m.switches++;beep(240+m.switches*22,.04,'triangle')}m.lastDir=dir;m.swing=0;}
  }
  m.progress=Math.min(1,m.switches/(8+m.variant*2));
 }else{ // ordered gesture/tap mini-game, used by every other job
  const o=m.spots[m.index];if(o&&Math.hypot(x-o.x,y-o.y)<38&&tap){m.index++;m.progress=m.index/m.spots.length;beep(470+55*m.index,.055,'sine');}
 }
 m.last={x,y};updateMiniStatus();if(m.progress>=.99)exitMini(true);
}
function updateMiniStatus(){const m=game?.mini;if(!m)return;
 $('minigameProgress').style.width=`${Math.min(100,Math.round(m.progress*100))}%`;
 $('minigameStatus').textContent=m.feedback||(m.kind==='tray'?`${Math.round(m.progress*100)}% BALANCED · ATTEMPT ${m.attempt}`:
 ['dish','sweep','polish'].includes(m.kind)?`${Math.round(m.progress*100)}% CLEAN · DESIGN ${m.variant+1}/5`:
 ['fryer','shake'].includes(m.kind)?`${m.switches}/${8+m.variant*2} REVERSES · DESIGN ${m.variant+1}/5`:
 `${m.index}/${m.spots.length} STEPS · DESIGN ${m.variant+1}/5`);
}
function updateMini(dt){const m=game?.mini;if(!m||m.kind!=='tray')return;
 if(m.showFall>0){m.showFall-=dt;if(m.showFall<=0){const n=constructMini(m.action,m.kind,m.attempt+1);game.mini=n;
  $('minigameStatus').textContent=`RETRY ${n.attempt} · NEW TRAY PATTERN ${n.variant+1}/5`;beep(470,.14);}
  return;
 }
 m.stable+=dt*.001; // time still advances only after the user starts balancing
 const tempo=1.35+m.variant*.15;
 const idealX=230+Math.sin(tick*tempo+m.variant*1.4)*69+Math.sin(tick*(tempo*2.15)+m.variant)*24;
 m.targetX=idealX;
 if(!m.touched)return;
 const err=Math.abs(m.touchX-idealX);
 if(err<54){m.stable+=dt;m.failTime=Math.max(0,m.failTime-dt*.7)}
 else if(err<84){m.stable+=dt*.22;m.failTime=Math.max(0,m.failTime-dt*.2)}
 else {m.failTime+=dt*(err>108?1.4:1)}
 m.progress=Math.min(1,m.stable/(4.3+m.variant*.35));
 if(m.failTime>.63){m.showFall=1.05;m.feedback='💥 FOOD FELL! TRY AGAIN — GUEST IS STILL WAITING';beep(140,.28,'sawtooth');}
 else if(m.progress>=1){exitMini(true);return}
 updateMiniStatus();
}
function drawFoodLeftovers(c,m,d){const r=FOOD_RESIDUES[m.variant];const x=d.x,y=d.y;
 c.save();c.globalAlpha=d.dirty;
 // Food pieces are distinct and recipe-specific, not identical brown blotches.
 switch(r.food){
 case 'grouper':
   ellipse(c,x,y,12,8,'#d9944e');ellipse(c,x+3,y-2,7,4,'#f1c97a');
   for(let k=0;k<4;k++)rect(c,x-12+k*6,y-5+k%2*6,4,3,'#a65e32');break;
 case 'shrimp':
   ellipse(c,x,y,13,8,'#f7ac86');ellipse(c,x+6,y-2,7,5,'#e87561');
   line(c,x-13,y+1,x-19,y-6,'#d66a5c',4);line(c,x-13,y+1,x-20,y+7,'#d66a5c',3);break;
 case 'chowder':
   ellipse(c,x,y,14,10,'#f7e1a7');ellipse(c,x+4,y+3,8,4,'#c3b382');
   for(let k=0;k<4;k++)ellipse(c,x-9+k*6,y+(k%2)*5-3,3,2,k%2?'#79a481':'#e0ac7c');break;
 case 'pie':
   ellipse(c,x,y,15,9,'#c89e5f');rect(c,x-8,y-4,15,8,'#c6d985');
   ellipse(c,x+2,y-5,6,3,'#fff4dc');for(let k=0;k<4;k++)rect(c,x-12+k*7,y+4-k%2*4,3,3,'#947346');break;
 case 'crab':
   ellipse(c,x,y,13,9,'#dc7655');ellipse(c,x+7,y+3,6,4,'#af473b');
   line(c,x-11,y-4,x-20,y-11,'#d87859',3);line(c,x-14,y+2,x-19,y+9,'#dc7655',3);break;
 }
 // Grease is thin enough to reveal food silhouettes below it.
 ellipse(c,x+4,y+5,9,3,'#ac824966');c.restore();
}
function paintMini(){const m=game?.mini;if(!m)return;const c=$('miniCanvas').getContext('2d');if(!c)return;
 c.clearRect(0,0,460,280);
 const palette=['#dac5a2','#d4b28d','#dfc79f','#cdb49b','#e5bd91'];rect(c,0,0,460,280,palette[m.variant]);
 for(let yy=15;yy<280;yy+=25)rect(c,0,yy,460,2,'#fff3d02b');
 // Always use large high-contrast chunky shapes suited to a phone screen.
 if(m.kind==='dish'){
  rounded(c,18,26,422,228,14,'#376b7c');rounded(c,27,35,404,210,11,'#6eabb4');
  ellipse(c,180,147,132,102,'#b1d6d3');ellipse(c,180,147,118,91,'#eff4dc');
  ellipse(c,180,147,91,65,'#c8d6cd');ellipse(c,180,147,83,58,'#fff7e5');
  for(const d of m.grime)if(d.dirty>0)drawFoodLeftovers(c,m,d);
  rounded(c,295,89,133,75,10,'#225264');text(c,FOOD_RESIDUES[m.variant].name.substring(0,15),361,113,11,'#ffe8b7','center',false);
  text(c,'TAP & SWIPE',361,143,16,'#fcf4d5','center',false);
  for(let i=0;i<8;i++)ellipse(c,58+i*37,68+Math.sin(tick*5+i)*8,4+i%3,4,'#f0fff1aa');
 }else if(['sweep','polish'].includes(m.kind)){
  rounded(c,35,36,390,203,8,m.kind==='sweep'?'#7b9a89':'#9cc3bb');
  for(let i=0;i<10;i++){const x=47+i*35;line(c,x,36,x,238,'#b5cfbb',1)}
  for(const d of m.grime)if(d.dirty>0){c.save();c.globalAlpha=d.dirty;ellipse(c,d.x+41,d.y,16,10,m.kind==='sweep'?'#7a6046':'#ddebd7');
   for(let k=0;k<4;k++)ellipse(c,d.x+33+k*6,d.y-5+k%2*9,3,2,m.kind==='sweep'?'#443e3b':'#fafbdf');c.restore()}
  text(c,'SWIPE AWAY THE MARKS',228,267,16,'#2e5763','center',false);
 }else if(['fryer','shake'].includes(m.kind)){
  rounded(c,47,34,370,207,12,'#5a7078');rounded(c,61,46,343,176,10,m.kind==='fryer'?'#262f39':'#386878');
  if(m.kind==='fryer'){
   rounded(c,72,59,321,144,8,'#ad8150');
   for(let i=0;i<19+m.variant*4;i++){const x=81+(i*43+m.variant*17)%301,y=70+(i*19+m.variant*11)%112;
    const fade=clamp(1-m.progress*(1+i%3*.08),0,1);c.save();c.globalAlpha=fade;rect(c,x,y,3+i%4,3+i%3,i%4===0?'#563b2f':'#65432e');c.restore()}
   rect(c,71,182,325*(1-m.progress),19,'#533a2a');
   const poleX=m.last?clamp(m.last.x,100,350):230;line(c,234,0,poleX,184,'#e6eff0',15);line(c,234,0,poleX,184,'#8498a3',4);
  }else{
   rounded(c,193+(m.last?clamp(m.last.x-230,-68,68):0),82,74,107,13,'#eef0d0');
   rect(c,212+(m.last?clamp(m.last.x-230,-68,68):0),94,33,73,'#e2a568');
   text(c,'🍹',229+(m.last?clamp(m.last.x-230,-68,68):0),145,40,'#fff0c3','center',false);
  }
  text(c,'⇆  LEFT / RIGHT',230,267,17,'#2f5460','center',false);
 }else if(m.kind==='tray'){
  const target=m.targetX??230,px=m.touchX;
  rounded(c,27,28,406,220,12,'#2c596e');
  // A moving yellow ring is the ideal counterbalance; drag the blue hand beneath it.
  ellipse(c,target,126,51,48,'#ffe9ad66');ellipse(c,target,126,31,31,'#fff4bb80');
  const error=m.touched?clamp((px-target)*.30,-44,44):0;
  c.save();c.translate(230,158);c.rotate(error*.009);
  ellipse(c,0,30,131,31,'#647886');ellipse(c,0,18,127,34,'#bccbd0');ellipse(c,0,13,119,26,'#f1e7c9');
  const food=['🍤','🐟','🍲','🦀','🍰'];
  for(let i=0;i<3+m.variant%2;i++){const xx=-75+i*49,fy=m.showFall>0?22+m.showFall*-35:0;
   ellipse(c,xx,12+fy,21,12,'#ffffff');text(c,food[(i+m.variant)%5],xx,15+fy,21,'#315263','center',false)}
  c.restore();
  rounded(c,px-19,205,38,27,10,'#c3e6f1');text(c,'☝',px,225,23,'#274854','center',false);
  text(c,m.showFall>0?'💥 FOOD FELL!': 'DRAG TO MATCH THE GOLD RING',230,269,15,'#fff0bc','center',false);
 }else{
  rounded(c,34,31,393,219,14,'#366778');
  // Five arrangements are based on the same task but change order, placement and icons.
  for(let i=0;i<m.spots.length;i++){
   const o=m.spots[i],selected=i===m.index,complete=i<m.index;
   ellipse(c,o.x,o.y+7,29,24,'#1c445b77');ellipse(c,o.x,o.y,29,24,complete?'#92c7ad':selected?'#ffe6a0':'#739cad');
   text(c,o.icon,o.x,o.y+6,25,'#254a58','center',false);
   rounded(c,o.x+15,o.y-31,23,19,6,complete?'#71c5af':'#efc37d');text(c,complete?'✓':String(i+1),o.x+26,o.y-17,13,'#244d5e','center',false);
  }
  text(c,'TAP THE HIGHLIGHTED NUMBER',230,270,14,'#315364','center',false);
 }
}
const miniCanvas=$('miniCanvas');
miniCanvas.addEventListener('pointerdown',e=>{e.preventDefault();miniPointerActive=true;miniCanvas.setPointerCapture?.(e.pointerId);const p=miniPos(e);if(game?.mini)game.mini.last=null;applyMini(p.x,p.y,true)});
miniCanvas.addEventListener('pointermove',e=>{if(!miniPointerActive)return;e.preventDefault();const p=miniPos(e);applyMini(p.x,p.y)});
for(const k of ['pointerup','pointercancel','lostpointercapture'])miniCanvas.addEventListener(k,()=>{miniPointerActive=false;if(game?.mini)game.mini.last=null});
$('quitMini').onclick=()=>exitMini(false);

$('frontPlay').onclick=openCrew;$('frontContinue').onclick=resumeSavedShift;$('frontCredits').onclick=openCredits;$('creditsBack').onclick=closeCredits;$('crewBack').onclick=openFront;$('play').onclick=startOrUnlock;$('again').onclick=begin;$('change').onclick=openCrew;$('menuBtn').onclick=()=>{saveShift();openFront()};
$('taskBtn').onclick=()=>toggleBoard();$('closeBoard').onclick=()=>toggleBoard(false);$('skipIntro').onclick=finishIntro;
$('pauseBtn').onclick=()=>{if(!game)return;game.paused=!game.paused;$('pauseBtn').textContent=game.paused?'▶':'Ⅱ';say(game.paused?'Shift paused. Tap play to continue.':'Back to work!')};$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'♪':'♪̸';if(sound)beep(600,.08)};
// No screen-tap movement or task autopathing; use physical controls only.
$('action').addEventListener('pointerdown',e=>{e.preventDefault();pressWork();$('action').setPointerCapture?.(e.pointerId)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('action').addEventListener(event,()=>{if(game)game.work=false});
for(const b of document.querySelectorAll('#dpad button')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();dpad=b.dataset.dir;b.setPointerCapture?.(e.pointerId)});
 for(const a of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(a,()=>{if(dpad===b.dataset.dir)dpad=null});
}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter'].includes(k))e.preventDefault();keys[k]=true;if((k==='e'||k===' '||k==='enter')&&game&&!game.paused&&state==='playing'&&!game.boardOpen&&!game.mini){if(activeTask()){const a=activeTask(),kind=miniKind(a);if(kind){startMini(a,kind);return}}else nearbyDialogue();}if(k==='escape'&&game&&state==='playing')$('pauseBtn').click()});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
// Android long-press accessibility still works elsewhere; gameplay control surfaces never select/copy text.
for(const e of ['contextmenu','selectstart','dragstart'])document.addEventListener(e,event=>{if(event.target.closest?.('#controls, #world, #frame'))event.preventDefault()});
for(const e of ['touchstart','touchmove'])document.querySelector('#controls').addEventListener(e,event=>event.preventDefault(),{passive:false});
window.addEventListener('blur',()=>{keys={};dpad=null;if(game)game.work=false;saveShift()});window.addEventListener('pagehide',saveShift);
window.__coveTest={SHIFT_LENGTH,DAILY_JOBS,DAILY_GUESTS,shiftDifficulty,phaseName,crowdDelay,prankDelay,miniKind,get introDone(){return introDone},get mini(){return game?.mini||null},exitMini,constructMini,updateMini,nextVariant,FOOD_RESIDUES,MINI_ROLE_KINDS,toggleBoard,openCrew,openFront,finishIntro,startMini,applyMini,roles,DEMO_ROUTES,get demoEnabled(){return state==='menu'||state==='front'},DINER_TABLES,PICKUP,canStand,moveWithCollision,get state(){return state},get game(){return game},profile,saveShift,resumeSavedShift,hasSavedShift,startOrUnlock,openCredits,closeCredits,PREMIUM_CREW,BASE_ROLE_COUNT,choose,begin,goal,target,activeTask,update,ghostPrank,spawnCustomer,updateCustomers,maybeScheduleService,completeTask,finish,pressWork};makeCards();refreshWallet();requestAnimationFrame(loop);
})();
