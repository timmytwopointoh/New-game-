/* Pek's Plunder: offline pixel-art restaurant game, day cycle and manual tactile work. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cvs = $('world'), mainCtx = cvs.getContext('2d'), sky=$('sky'), sc=sky.getContext('2d'), demoCanvas=$('menuWorld'), demoCtx=demoCanvas.getContext('2d');
let ctx=mainCtx;
ctx.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;demoCtx.imageSmoothingEnabled=false;
const W=960,H=540,MAP_W=2240,MAP_H=1550,TAU=Math.PI*2;
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

// v0.9: six distinct staff assignments per job family.
const EXTRA_SHIFTS={"dishes": [["Scrape seafood", "Swipe the grouper crumbs from dirty dishes", 505, 1170, "🦐", 1.1], ["Rinse & sanitize", "Rinse plates at the triple sink", 1106, 845, "🫧", 1.2], ["Load dishwasher", "Load the rack and start the dishwasher", 945, 850, "🍽", 1.2]], "cook": [["Grill the grouper", "Grill today's fish at the hot line", 1164, 920, "🐟", 1.2], ["Flip the flat top", "Turn burgers and shrimp on the griddle", 1084, 920, "🍳", 1.2], ["Oven timing", "Bake bread until perfectly golden", 1358, 920, "🍞", 1.2]], "waiter": [["Refill drinks", "Bring cold drinks back to the table", 743, 955, "🥤", 1.0], ["Clear a plate", "Collect leftovers from the guests", 520, 1190, "🍽", 1.2], ["Dessert run", "Balance the key lime pie tray", 1275, 485, "🥧", 1.2]], "boss": [["Inspect prep", "Check the prep-room stations", 1660, 1120, "📋", 1], ["Check the freezer", "Inspect frozen seafood stock", 1900, 895, "🧊", 1.1], ["Closing report", "Finish the shift paperwork at the office", 782, 788, "📑", 1.2]], "host": [["Check waitlist", "Update the entrance wait list", 320, 1140, "📋", 1.1], ["Help a family", "Bring menus to the chowder room", 1030, 528, "📖", 1], ["Guest goodbye", "Wave goodbye near the entrance", 330, 1065, "👋", 1.1]], "drinks": [["Crush ice", "Fill ice at the tiki counter", 1850, 740, "🧊", 1], ["Fruit garnish", "Prepare colorful drink garnishes", 1610, 720, "🍋", 1], ["Clean glassware", "Polish the tiki glasses", 1990, 720, "🍹", 1.1]], "busser": [["Wipe down booth", "Clean the waterfront booth", 742, 1160, "🧽", 1.1], ["Refill napkins", "Replace supplies by the bar", 762, 790, "🧻", 1.0], ["Take trash out", "Carry trash to the employee yard", 1500, 1330, "🗑", 1.1]], "fish": [["Scale grouper", "Scale the grouper on the prep board", 1600, 1180, "🐟", 1.1], ["Walk-in stock", "Put seafood in the walk-in cooler", 1870, 1160, "🧊", 1.1], ["Freezer rotation", "Rotate seafood in the freezer", 1870, 900, "❄", 1.1]], "decor": [["Brighten the chowder room", "Hang bunting in the chowder room", 1250, 580, "🎏", 1], ["Set pier lights", "Light up the colorful pier rail", 290, 400, "💡", 1], ["Flower refresh", "Water plants by the front entrance", 357, 1290, "🌺", 1.1]], "fix": [["Fryer check", "Repair the kitchen fryer controls", 948, 920, "🔧", 1], ["Walk-in thermostat", "Calibrate the refrigerator thermostat", 1920, 1170, "🌡", 1], ["Pier lanterns", "Fix the glowing pier lanterns", 300, 550, "💡", 1.2]]};
for(const r of roles)r.tasks.push(...EXTRA_SHIFTS[r.id]);
const CREW_ABILITIES={"dishes": [4, 5, 2, 3, "Quick Hands"], "cook": [3, 5, 2, 3, "Chef’s Precision"], "waiter": [5, 3, 5, 4, "Big Tips"], "boss": [3, 4, 5, 4, "Rush Leader"], "host": [3, 3, 5, 3, "Patient Guests"], "drinks": [4, 4, 5, 4, "Smooth Pour"], "busser": [5, 4, 3, 3, "Fast Reset"], "fish": [3, 5, 2, 4, "Fresh Catch"], "decor": [4, 3, 4, 5, "Sparkle Boost"], "fix": [3, 5, 3, 4, "Steady Hands"]};
for(const r of roles){const [speed,skill,charm,luck,perk]=CREW_ABILITIES[r.id];r.stats={speed,skill,charm,luck};r.perk=perk;}
// Uniforms reflect restaurant job families; accessories and faces remain individual.
for(const r of roles){
 if(['cook','fish'].includes(r.id)){r.shirt='#232b39';r.accent='#9fa9b5';}
 else if(['waiter','host','busser'].includes(r.id)){r.shirt='#3285bb';r.accent='#c4e9ff';}
 else if(r.id==='dishes'){r.shirt='#2b4649';r.accent='#67bfc4';}
 else if(r.id==='drinks'){r.shirt='#29898e';r.accent='#f3c780';}
}
// Hand-authored walkable station anchors. Each role has a coherent three-stage work circuit.
const ROLE_STATIONS=[[[510, 965], [1010, 850], [1130, 835], [505, 1170], [1106, 845], [945, 850]], [[1600, 1100], [945, 925], [855, 900], [1164, 920], [1084, 920], [1358, 920]], [[835, 940], [1050, 500], [1050, 500], [743, 955], [520, 1190], [1275, 485]], [[1610, 1080], [1330, 1120], [760, 820], [1660, 1120], [1900, 895], [782, 788]], [[355, 1080], [510, 962], [740, 965], [320, 1140], [1030, 528], [330, 1065]], [[1660, 718], [1850, 720], [1875, 595], [1850, 740], [1610, 720], [1990, 720]], [[520, 958], [740, 960], [740, 1192], [742, 1160], [762, 790], [1530, 1402]], [[305, 455], [1885, 1170], [1640, 1130], [1600, 1180], [1870, 1160], [1870, 900]], [[1600, 630], [370, 420], [1970, 700], [1250, 580], [290, 400], [357, 1290]], [[1060, 610], [1680, 650], [1510, 1280], [948, 920], [1920, 1170], [300, 550]]];
roles.forEach((r,i)=>r.tasks.forEach((task,j)=>{task[2]=ROLE_STATIONS[i][j][0];task[3]=ROLE_STATIONS[i][j][1]}));
// Earnable fictional placeholders for future, consenting real-restaurant staff.
// They share the base role's mechanics and NEVER claim to portray a real person.
const PREMIUM_CREW=[
 {base:1,cost:50,name:'Kitchen Spotlight',short:'Spotlight',job:'Special Chef'},
 {base:2,cost:100,name:'Deck Spotlight',short:'Spotlight',job:'Special Server'},
 {base:0,cost:150,name:'Dish Pit Spotlight',short:'Spotlight',job:'Special Dishwasher'},
 {base:5,cost:200,name:'Tiki Spotlight',short:'Spotlight',job:'Special Bartender'}
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
const SAVE_ID='peks-plunder-shift-v09';
function hasSavedShift(){try{const s=JSON.parse(localStorage.getItem(SAVE_ID)||'null');return s&&s.version===9&&s.game&&Number.isInteger(s.game.role)&&s.game.role>=0&&s.game.role<roles.length&&isUnlocked(s.game.role)&&s.game.elapsed>=0&&s.game.elapsed<SHIFT_LENGTH}catch{return false}}
function clearSavedShift(){try{localStorage.removeItem(SAVE_ID)}catch{}}
function saveShift(){if(!game||state!=='playing')return;try{
 const snap={...game,paused:false,boardOpen:false,work:false,mini:null,progress:0,particles:[],floats:[],speech:null,cheerUntil:0};
 localStorage.setItem(SAVE_ID,JSON.stringify({version:9,game:snap,when:Date.now()}));
 }catch{}}
function resumeSavedShift(){if(!hasSavedShift()){toast('NO SAVED SHIFT YET');return false}try{
 const data=JSON.parse(localStorage.getItem(SAVE_ID));game=data.game;
 if(!Number.isFinite(game.x)||!Number.isFinite(game.y)||!Number.isFinite(game.elapsed))throw Error('Invalid save');
 game.x=clamp(game.x,280,2010);game.y=clamp(game.y,370,1360);
 game.particles=[];game.floats=[];game.paused=false;game.work=false;game.boardOpen=false;game.mini=null;game.progress=0;
 game.camX=game.x;game.camY=game.y;game.cheerUntil=0;game.customers=Array.isArray(game.customers)?game.customers:[];
 game.customers.forEach(c=>{if(c.table){c.table=DINER_TABLES.find(t=>t.x===c.table.x&&t.y===c.table.y)||null}});
 state='playing';chosen=game.role;introDone=true;keys={};dpad=null;
 $('frontMenu').classList.add('hidden');$('titleScreen').classList.add('hidden');$('sunriseIntro').classList.add('hidden');
 $('creditsScreen').classList.add('hidden');$('finish').classList.add('hidden');$('gameScreen').classList.remove('hidden');
 $('taskBoard').classList.add('hidden');$('minigameOverlay').classList.add('hidden');
 $('pauseBtn').textContent='Ⅱ';updateHud();screenFade();toast('WELCOME BACK TO YOUR SHIFT!');return true;
 }catch{clearSavedShift();toast('COULD NOT RESTORE SHIFT');return false}}
const PICKUP={x:905,y:1015};
const EXIT={x:346,y:1090};
const CREW_SPOTS=[[1085,851],[1040,929],[722,916],[1244,1123],[358,1109],[1795,703],[648,1109],[1630,1135],[1569,642],[1490,1282]];
const sites=[{x:743,y:943},{x:1020,y:893},{x:1300,y:558},{x:1720,y:613},{x:1663,y:1140},{x:515,y:1190},{x:1500,y:1300}];
let chosen=0, state='front',game=null,stars=[],sound=true,audio=null,tick=0,last=0,keys={},dpad=null,toastDeadline=0;
const SHIFT_LENGTH=720,DAILY_JOBS=9,DAILY_GUESTS=4;
const shiftDifficulty=t=>t<240?0:t<480?1:2;
const phaseName=t=>['SUNRISE','LUNCH RUSH','SUNSET RUSH'][shiftDifficulty(t)];
const crowdDelay=t=>[52,39,28][shiftDifficulty(t)];
const prankDelay=t=>[120,82,48][shiftDifficulty(t)];
let introStarted=0,introDone=true,miniPointerActive=false;
const DINER_TABLES=[{x:495,y:961},{x:737,y:969},{x:495,y:1200},{x:740,y:1195},{x:1021,y:500},{x:1293,y:505},{x:1610,y:532},{x:1882,y:532}];
const TABLE_COLLISION={rx:72,ry:63};
const WALK_ROOMS=[
 {id:'customer',x:281,y:844,w:568,h:505},{id:'bar',x:565,y:633,w:283,h:260},
 {id:'kitchen',x:865,y:713,w:568,h:617},{id:'chowder',x:860,y:359,w:588,h:352},
 {id:'tiki',x:1450,y:354,w:602,h:459},{id:'hall',x:1422,y:807,w:138,h:547},
 {id:'prep',x:1536,y:992,w:289,h:338},{id:'fridge',x:1783,y:965,w:250,h:365},
 {id:'freezer',x:1783,y:782,w:250,h:246},
 {id:'staff-passage',x:740,y:1307,w:820,h:142},{id:'pier',x:210,y:292,w:190,h:550},{id:'entrance-bridge',x:280,y:825,w:105,h:38}
];
// Solid equipment and walls; main doors have animated pressure sensors.
const WALL_ZONES=[
 {x:893,y:752,w:313,h:73}, // dish pit: dishwasher + three-sink bench
 {x:901,y:884,w:460,h:70}, // cooking line: fryer, flat top, grill, oven
 {x:740,y:726,w:96,h:48}, // bar counter
 {x:1650,y:384,w:165,h:44}, // tiki back bar
 {x:1570,y:1235,w:125,h:48}, // prep cabinet
];
const DOORS=[
 {id:'chowder',x:1262,y:709,axis:'h',name:'CHOWDER ROOM'},
 {id:'employee',x:1428,y:1100,axis:'v',name:'KITCHEN'},
 {id:'customer',x:800,y:1340,axis:'h',name:'DINING ACCESS'},
 {id:'bar',x:854,y:860,axis:'v',name:'BAR'},
 {id:'public',x:281,y:1085,axis:'v',name:'ENTRANCE'},
 {id:'staff',x:1491,y:1338,axis:'h',name:'STAFF ENTRY'},
 {id:'tiki',x:1450,y:573,axis:'v',name:'TIKI'}
];
const NO_DOOR_OPENINGS=[{x:1548,y:1130},{x:1806,y:1148},{x:1900,y:1004}];
function inRect(x,y,r,extra=0){return x>=r.x-extra&&x<=r.x+r.w+extra&&y>=r.y-extra&&y<=r.y+r.h+extra}
function ellipseCollision(x,y,t,margin=0){const dx=(x-t.x)/(TABLE_COLLISION.rx+margin),dy=(y-t.y)/(TABLE_COLLISION.ry+margin);return dx*dx+dy*dy<1}
function canStand(x,y){
 if(!(WALK_ROOMS.some(r=>inRect(x,y,r))||inRect(x,y,{x:232,y:990,w:62,h:220})))return false;
 for(const t of DINER_TABLES)if(ellipseCollision(x,y,t,5))return false;
 for(const b of WALL_ZONES)if(inRect(x,y,b,12))return false;
 // Wall boundaries are collidable except at designated pressure doors and open cold storage.
 if(x>843&&x<875&&y>715&&y<1330 && Math.abs(y-860)>45 && Math.abs(y-1113)>48)return false; // bar/kitchen
 if(y>687&&y<714&&x>863&&x<1447 && Math.abs(x-1262)>49)return false; // galley/chowder
 if(x>1415&&x<1450&&y>829&&y<1326 && Math.abs(y-1100)>48)return false; // kitchen/employee hall
 if(x>1435&&x<1459&&y>355&&y<802 && Math.abs(y-573)>49)return false; // chowder/tiki
 for(const d of DOORS){
  if(game?.doors&&game.doors[d.id]!==undefined&&game.doors[d.id]<.67){
   const inside=d.axis==='h'?Math.abs(y-d.y)<13&&Math.abs(x-d.x)<42:Math.abs(x-d.x)<13&&Math.abs(y-d.y)<42;
   if(inside)return false;
  }
 }
 return true;
}
function updateDoors(dt){if(!game)return;game.doors=game.doors||{};
 for(const d of DOORS){const pressure=Math.hypot(game.x-d.x,game.y-d.y)<64;
  const old=game.doors[d.id]||0;game.doors[d.id]=Math.min(1,Math.max(0,old+(pressure?8:-1.7)*dt));
 }
}
// Find an accessible standing point near each drawn station, including table edges.
// The furniture itself remains solid; interaction happens at its front edge.
function alignRoleStations(){
 const find=(x,y)=>{if(canStand(x,y))return [x,y];
  for(let r=18;r<=135;r+=9)for(let a=0;a<32;a++){
   const phi=a*Math.PI/16,tx=Math.round(x+Math.cos(phi)*r),ty=Math.round(y+Math.sin(phi)*r);
   if(canStand(tx,ty))return [tx,ty];
  }return [x,y];};
 roles.slice(0,BASE_ROLE_COUNT).forEach((r,i)=>r.tasks.forEach((t,j)=>{const [x,y]=find(t[2],t[3]);t[2]=x;t[3]=y;ROLE_STATIONS[i][j]=[x,y]}));
}
alignRoleStations();
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
 $('best').textContent='★ TOP SCORE '+best();
 const bars=$('abilityBars');if(bars)bars.innerHTML=Object.entries(r.stats).map(([k,v])=>`<div class="ability"><span>${k.toUpperCase()}</span><div class="abilityRail"><i style="width:${v*20}%"></i></div><b>${v}/5</b></div>`).join('')+`<div class="perk">✦ ${r.perk}</div>`;
 refreshWallet()}
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
 if(!game||game.customers.filter(c=>c.state!=='leaving').length>=7)return;
 const id=game.spawned++,table=DINER_TABLES.find(t=>!game.customers.some(c=>c.table===t&&c.state!=='leaving'))||null;
 const guest={id,name:DINER_NAMES[id%DINER_NAMES.length],x:EXIT.x,y:EXIT.y,tx:table?.x||495,ty:table?.y||960,table,state:table?'entering':'queue',order:DISHES[id%DISHES.length],wait:0,eat:0,route:0,pathIndex:0};
 game.customers.push(guest);if(table)toast(`${guest.name.toUpperCase()} ARRIVED!`);
}
function moveGuest(c,x,y,dt,speed=71){const dx=x-c.x,dy=y-c.y,dist=Math.hypot(dx,dy);if(dist<speed*dt){c.x=x;c.y=y;return true}c.x+=dx/dist*dt*speed;c.y+=dy/dist*dt*speed;return false}
function guestLeaves(c){
 c.state='leaving';c.route=0;game.lostGuests=(game.lostGuests||0)+1;game.score=Math.max(0,game.score-2);
 if(game.carryMeal?.id===c.id){game.carryMeal=null;game.serviceStage=null}
 say(`${c.name}: I've waited long enough, sorry!`);toast('😢 GUEST LEFT · −2 COINS');
}
function updateCustomers(dt){
 if(game.elapsed>game.nextCustomer){spawnCustomer();game.nextCustomer=game.elapsed+crowdDelay(game.elapsed)}
 for(const c of game.customers){
  if(c.state==='queue'){
   const table=DINER_TABLES.find(t=>!game.customers.some(o=>o!==c&&o.table===t&&o.state!=='leaving'));
   if(table){c.table=table;c.tx=table.x;c.ty=table.y;c.state='entering'}
   else {c.wait+=dt;if(c.wait>60+roles[game.role].stats.charm*2)guestLeaves(c)}
  }else if(c.state==='entering'){
   const seatX=c.tx+(c.id%2?81:-81),seatY=c.ty+21;
   if(moveGuest(c,seatX,seatY,dt,144)){c.state='seated';c.wait=0}
  }else if(c.state==='seated'){
   c.wait+=dt;if(c.wait>=1.8){c.state='ordered';c.wait=0;say(`${c.name}: Could I have ${c.order[0]}?`)}
  }else if(c.state==='ordered'){
   c.wait+=dt;
   if(c.wait>=60+roles[game.role].stats.charm*2+(roles[game.role].id==='host'?12:0))guestLeaves(c);
  }else if(c.state==='eating'){
   c.eat+=dt;if(c.eat>5){c.state='leaving';c.route=0;say(`${c.name}: Delicious! See you soon!`)}
  }else if(c.state==='leaving'){
   if(moveGuest(c,EXIT.x,EXIT.y,dt,169))c.route=1;
  }
 }
 game.customers=game.customers.filter(c=>!(c.state==='leaving'&&c.route===1));
 if(!game.serviceStage)maybeScheduleService();
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
 `<li>🪙 Coins: ${game.score} · Guests lost: ${game.lostGuests||0}</li>`];
 if(game.mess)rows.splice(1,0,'<li>👻 BONUS INTERRUPT: Clean up the ghost mess!</li>');
 $('taskItems').innerHTML=rows.join('');
 $('boardHint').textContent=`${phaseName(game.elapsed)} · ${Math.max(0,Math.ceil((SHIFT_LENGTH-game.elapsed)/60))} min left · Finish a task to unlock the next`;
}
function toggleBoard(force){if(!game||state!=='playing')return;game.boardOpen=typeof force==='boolean'?force:!game.boardOpen;
 $('taskBoard').classList.toggle('hidden',!game.boardOpen);if(game.boardOpen){game.work=false;keys={};dpad=null;refreshTaskBoard()}}

function startingSpot(role){return {x:1501,y:1340}}
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
 game={role:chosen,x:spawn.x,y:spawn.y,lastFacing:1,done:0,score:0,progress:0,work:false,mess:null,ghost:null,nextGhost:115,elapsed:0,particles:[],paused:true,ghostCount:0,streak:0,carry:null,carryMeal:null,serviceStage:null,served:0,spawned:0,nextCustomer:8,customers:[],speech:null,nextSpeech:7,camX:spawn.x,camY:spawn.y,completedStations:[],floats:[],jobVisuals:{},combo:0,mini:null,boardOpen:false,peakPhase:0,cheerUntil:0,saveDue:0,doors:{},introWalk:0,lostGuests:0};
 state='intro';$('creditsScreen').classList.add('hidden');$('frontMenu').classList.add('hidden');$('titleScreen').classList.add('hidden');
 $('gameScreen').classList.remove('hidden');$('finish').classList.add('hidden');$('taskBoard').classList.add('hidden');
 $('pauseBtn').textContent='Ⅱ';say(`${r.name}: ${CREW_DIALOGUE[r.id][0]} Follow the ! to your first job.`);
 updateHud();replayIntro();
}
function finish(won){
 if(state!=='playing')return;state='finish';game.paused=true;game.cheerUntil=tick+6;
 saveBest(game.score);clearSavedShift();
 const reward=won?Math.max(0,game.score+6):0;
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
 confetti(action.x,action.y,roles[game.role].id==='decor'?82:48,action.kind==='ghost'?'#bdedff':'#ffdf82');burstConfetti();
 game.progress=0;game.work=false;game.cheerUntil=tick+1.85;const role=roles[game.role];
 if(action.kind==='ghost'){
  game.mess=null;game.ghost=null;game.ghostCount++;game.score+=2;game.floats.push({x:action.x,y:action.y-95,label:'CLEAN! +2',life:1.8});
  say('Wade: Whew! That pesky ghost made a fine mess. Thanks for fixing it!');toast('+2 · PRANK FIXED!');beep(750,.17);
 }else if(action.kind==='pickup'){
  const c=action.guest||customersWaiting()[0];if(!c)return false;
  game.carryMeal={id:c.id,name:c.name,icon:c.order[1]};game.serviceStage='serve';say(`${role.short}: ${c.order[0]} for ${c.name}, coming right up!`);toast('TAKE DINNER TO THE ! TABLE');beep(630,.13);
 }else if(action.kind==='serve'){
  const c=action.guest;if(!game.carryMeal||game.carryMeal.id!==c.id)return false;
  c.state='eating';c.eat=0;game.carryMeal=null;game.serviceStage=null;game.served++;game.score+=Math.max(2,2+(role.stats.charm>=5?1:0)+(role.id==='waiter'?1:0));game.floats.push({x:action.x,y:action.y-97,label:'THANK YOU! +TIP',life:1.7});
  say(`${c.name}: Thank you! This ${c.order[0].toLowerCase()} looks wonderful!`);toast('🪙 HAPPY GUEST!');beep(880,.14);
 }else if(action.kind==='job'){
  const stage=game.done%role.tasks.length;game.carry=stage===role.tasks.length-1?null:role.tasks[stage][4];game.done++;game.score+=2+(role.stats.luck>=5?1:0)+(role.id==='fish'&&miniKind(action)==='prep'?1:0);maybeScheduleService();
  game.completedStations.push({x:action.x,y:action.y,icon:action.icon,role:role.id,stage,cycle:Math.floor((game.done-1)/role.tasks.length),doneAt:game.elapsed});
  game.jobVisuals[role.id]=Math.max(game.jobVisuals[role.id]||0,stage+1);
  game.floats.push({x:action.x,y:action.y-95,label:'+COINS  '+action.icon,life:1.7});
  say(`${role.short}: ${CREW_DIALOGUE[role.id][game.done%3]} ${game.done<DAILY_JOBS?'Find the next ! marker.':'The daily job goal is done—extra work earns more coins!'}`);
  toast('🪙 +TASK · '+action.label.toUpperCase()+' ✓');beep(640+stage*100,.16);
 }
 if(game.done===DAILY_JOBS||game.served===DAILY_GUESTS){confetti(game.x,game.y,55,'#ffdc84');toast('🎉 DAILY GOAL COMPLETE! KEEP GOING!')}
 updateHud();return true;
}
function update(dt){
 if(!game)return;
 if(state==='walkin'){
  game.introWalk=(game.introWalk||0)+dt;
  const t=game.introWalk;
  if(t<1.25){game.x=1501;game.y=1340-210*t;}
  else if(t<2.25){game.x=1501-(t-1.25)*110;game.y=1077;}
  else if(t<3.15){game.x=1391-(t-2.25)*65;game.y=1077;}
  else {game.x=1332;game.y=1077;state='playing';game.paused=false;toast('🦀 CLOCKED IN — LET’S WORK!');}
  game.camX=game.x;game.camY=game.y;updateDoors(dt);return;
 }
 if(game.paused||game.boardOpen||game.mini||state!=='playing')return;
 game.elapsed=Math.min(SHIFT_LENGTH,game.elapsed+dt);
 if(game.elapsed>=(game.saveDue||0)){game.saveDue=game.elapsed+4;saveShift()}
 if(game.elapsed>=SHIFT_LENGTH){finish(game.done>=DAILY_JOBS&&game.served>=DAILY_GUESTS);return}
 const phase=shiftDifficulty(game.elapsed);if(phase>game.peakPhase){game.peakPhase=phase;toast(phase===1?'🍽 LUNCH RUSH! MORE DINERS!':'🌙 DINNER RUSH! ALL HANDS!');beep(780,.16)}
 updateCustomers(dt);
 if(game.elapsed>=game.nextGhost){ghostPrank();game.nextGhost=game.elapsed+prankDelay(game.elapsed)+(roles[game.role].id==='boss'?36:0)+rnd(-6,7)}
 if(game.ghost){game.ghost.t+=dt;if(game.ghost.t>5)game.ghost=null}
 let dx=0,dy=0;const speed=145+roles[game.role].stats.speed*17;
 if(keys['arrowleft']||keys['a']||dpad==='left')dx-=1;
 if(keys['arrowright']||keys['d']||dpad==='right')dx+=1;
 if(keys['arrowup']||keys['w']||dpad==='up')dy-=1;
 if(keys['arrowdown']||keys['s']||dpad==='down')dy+=1;
 if(dx||dy){const m=Math.hypot(dx,dy);dx/=m;dy/=m;moveWithCollision(dx*speed*dt,dy*speed*dt)}
 if(dx)game.lastFacing=dx>0?1:-1;
 updateDoors(dt);
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
function colorfulRoom(x,y,w,h,main,edge,label,tx,ty){
 floorPattern(x,y,w,h,main,'#ffffff24');pRect(x,y,w,12,edge);pRect(x,y+h-10,w,10,edge);
 pRect(x,y,10,h,edge);pRect(x+w-10,y,10,h,edge);
 if(label)sign(tx,ty,Math.min(w-35,Math.max(152,label.length*13+32)),label);
}
function shinySteel(x,y,w,h){rounded(ctx,x+3,y+5,w,h,8,'#3e6875');rounded(ctx,x,y,w,h-3,8,'#9fcbd0');pRect(x+5,y+5,w-10,7,'#f3fbec');pRect(x+6,y+h-12,w-12,4,'#6593a3')}
function labels(){
 sign(940,640,230,'🫧 DISH PIT');sign(1035,326,225,'CHOWDER ROOM');
 sign(975,1280,240,'★ THE KITCHEN');sign(610,600,200,'🍹 BAR');
 sign(335,801,250,'FRONT DINING');sign(1661,328,200,'TIKI BAR');
 sign(1552,973,213,'PREP ROOM');sign(1815,974,194,'WALK-IN COOLER');
 sign(1808,823,200,'FREEZER');sign(1427,1331,160,'STAFF ENTRANCE');
}
function dishPit(t){
 shinySteel(892,756,316,71);
 // Facing north along the top kitchen wall: machine LEFT, 3 separate sinks RIGHT.
 rounded(ctx,902,767,87,47,4,'#4b7583');pRect(915,774,63,28,'#d8f1e7');
 ellipse(ctx,948,785,19,12,'#789bad');pRect(912,796,67,9,'#a6d1d5');
 text(ctx,'DISHWASHER',947,747,12,'#29556a','center',false);
 for(let i=0;i<3;i++){const x=1005+i*66;
  rounded(ctx,x,770,60,40,5,'#567986');rounded(ctx,x+6,775,48,25,5,'#3a8097');
  for(let k=0;k<3;k++)ellipse(ctx,x+13+k*14,788+Math.sin(t*3+i+k)*2,4,4,'#e9fff6');
  pRect(x+30,763,5,16,'#d7f8f3');
  text(ctx,['WASH','RINSE','SANITIZE'][i],x+29,744,10,'#245468','center',false)
 }
 for(let i=0;i<5;i++){ellipse(ctx,1111+i*9,841,12,5,'#fff9da')}
}
function kitchen(t){
 colorfulRoom(864,712,568,620,'#f5dab2','#a67163','',0,0);
 // L-shaped hot line: two fryers, flat top, grill, oven.
 shinySteel(900,882,461,74);
 const ranges=[['FRYER',908,77],['FRYER',988,76],['FLAT TOP',1066,91],['GRILL',1160,90],['OVEN',1254,98]];
 for(const [name,x,w] of ranges){rounded(ctx,x+6,890,w-10,44,5,'#445965');
  if(name==='FRYER'){rounded(ctx,x+13,900,w-27,22,3,'#be834e');pRect(x+21,895,w-44,5,'#ffe6ae');for(let j=0;j<5;j++)ellipse(ctx,x+18+j*9,905+Math.sin(t*6+j)*2,3,2,'#fff4b3');}
  else if(name==='FLAT TOP'){pRect(x+10,898,w-20,27,'#3d424c');for(let j=0;j<3;j++)ellipse(ctx,x+28+j*17,908,11,5,'#f5b57b')}
  else if(name==='GRILL'){for(let j=0;j<9;j++)line(ctx,x+12+j*8,897,x+12+j*8,924,'#c8d9db',3);ellipse(ctx,x+34,911,20,8,'#b9614e')}
  else {pRect(x+13,898,w-25,27,'#313e51');pRect(x+20,903,w-40,14,'#ffb276')}
  text(ctx,name,x+w/2,872,11,'#225a6c','center',false);
 }
 dishPit(t);
 // Shelves on the east side with piles of dry dishes.
 shinySteel(1331,1191,83,74);for(let i=0;i<4;i++)ellipse(ctx,1354+i*13,1208,12,5,'#fff7e5');
 // order pickup window between left bar and kitchen, not a walk through
 rounded(ctx,851,788,23,142,5,'#fff2bc');pRect(858,793,10,133,'#44a9a9');
 text(ctx,'ORDER',863,786,12,'#185468','center',false);
 // Color details/texture
 for(let i=0;i<8;i++)ellipse(ctx,912+i*61,1050+Math.sin(i)*5,10,5,'#fae8bc');
}
function chowder(t){
 colorfulRoom(860,359,588,351,'#ffebb9','#c98776','',0,0);
 table(1021,500);table(1293,505);
 for(let j=0;j<4;j++){ellipse(ctx,926+j*115,395,16,8,'#ffcf7c');ellipse(ctx,926+j*115,395,8,4,'#fff7b0')}
 // actual north entrance is to the RIGHT of dish pit at x1262
 pRect(1251,691,24,25,'#bceade');
}
function bar(t){
 colorfulRoom(564,635,283,259,'#c8eff2','#46aabb','',0,0);
 shinySteel(606,719,228,66);for(let i=0;i<8;i++){
  pRect(610+i*24,717,14,31,['#f9a7a3','#ffc86d','#a1e6c4','#93ceef'][i%4]);
  ellipse(ctx,617+i*24,715,10,4,'#fff7dc');
 }
 text(ctx,'PICKUP WINDOW →',799,888,12,'#225469','right',false);
}
function dining(t){
 colorfulRoom(282,840,565,506,'#ffedc0','#d88984','',0,0);
 for(const tb of DINER_TABLES.slice(0,4))table(tb.x,tb.y);
 for(let i=0;i<4;i++){ellipse(ctx,335+i*139,860,12,6,'#ffeaa4')}
 // bright family dining seaside photos
 for(let i=0;i<4;i++){pRect(363+i*116,864,45,34,'#fff4e6');pRect(370+i*116,870,32,21,['#6adad0','#7ecef2','#92e1ae','#f7b4b5'][i])}
}
function tiki(t){
 colorfulRoom(1472,374,562,433,'#f8d7bd','#df8b94','',0,0);
 table(1610,532);table(1882,532);
 shinySteel(1660,395,300,49);for(let i=0;i<10;i++){
  pRect(1676+i*26,400,14,32,['#fa9c96','#f5d575','#73ddd5','#9fc9f0'][i%4]);
  ellipse(ctx,1683+i*26,400,9,5,'#fff6dc');
 }
 for(let x=1480;x<2015;x+=45){line(ctx,x,374,x+18,390,'#8f8b97',2);pRect(x,384,22,13,['#ffc872','#fc94a2','#89edcf'][Math.floor(x/45)%3])}
}
function coldStorage(t){
 colorfulRoom(1544,1001,263,330,'#e7e9c4','#80b6a4','',0,0);
 for(let i=0;i<4;i++){shinySteel(1590+i*40,1240,31,36)}
 colorfulRoom(1806,1000,226,331,'#caeff0','#659eb2','',0,0);
 for(let i=0;i<4;i++){rounded(ctx,1840+i*44,1210,31,53,5,'#9bc5d5');pRect(1845+i*44,1215,21,12,'#fff9dc')}
 colorfulRoom(1806,801,226,200,'#d6eaff','#82adce','',0,0);
 for(let i=0;i<5;i++)text(ctx,'❄',1830+i*38,882+(i%2)*49,25,'#e4faff','center',false);
 // no door collision on any of these cold room entries: teal open gap markers
 pRect(1792,1100,36,120,'#b5e9d6');pRect(1864,986,116,35,'#bdebf9');
 text(ctx,'OPEN',1808,1128,13,'#2b856a','center',false);text(ctx,'❄ OPEN TO FREEZER',1922,1012,11,'#2b7385','center',false);
}
function employeeHall(t){
 // A service passage connects the employees' back entrance to public dining.
 floorPattern(750,1332,812,96,'#daf3dc','#88c8bd');
 pRect(756,1337,798,9,'#75baa8');pRect(759,1412,790,8,'#75baa8');
 sign(949,1372,260,'STAFF HALL → DINING');
 pRect(788,1320,23,44,'#dcf8cc');pRect(1478,1320,27,40,'#dcf8cc');
 colorfulRoom(1427,807,132,542,'#daf2dc','#72b9b1','',0,0);
 // corridor to prep, walk-in and open freezer; customer door at north wall
 pRect(1550,1065,27,124,'#b3e8c8');
 pRect(1412,1054,45,90,'#b3e8c8');
 pRect(1459,806,65,24,'#b3e8c8');
 for(let y=866;y<1290;y+=73)ellipse(ctx,1490,y,18,7,'#bce8d6');
}
function pierAndOutside(t){
 // Dry land almost everywhere, water only north of the raised tiki boardwalk.
 pRect(0,0,MAP_W,MAP_H,'#a9da9f');
 for(let i=0;i<180;i++){const x=(i*137)%MAP_W,y=296+(i*89)%(MAP_H-310);ellipse(ctx,x,y,9,4,i%3?'#bce6a0':'#96d6a3')}
 pRect(0,0,MAP_W,298,'#55c2d9');
 for(let i=0;i<94;i++){const x=(i*159+Math.sin(t+i)*16)%MAP_W,y=(i*37)%285;line(ctx,x,y,x+36,y,'#c5f2e1',2)}
 // Elevated waterside boardwalk across north edge, turns down the west to public entrance.
 floorPattern(210,284,1835,100,'#d8a878','#c48b64');
 floorPattern(205,284,201,805,'#d8a878','#c48b64');
 // Classic true dock out over water in upper-left corner.
 floorPattern(85,105,170,330,'#e4b785','#bf906c');
 for(let x=100;x<260;x+=44){pRect(x,117,10,300,'#845e52')}
 for(let y=132;y<426;y+=64){pRect(79,y,185,8,'#fff4b5')}
 // Parking lot sits beyond land near restaurant entrance.
 pRect(42,1094,200,371,'#92b8b8');for(let y=1120;y<1446;y+=78){pRect(62,y,149,4,'#fff5d9');pRect(73,y+8,7,50,'#ffe8bb')}
 for(let i=0;i<3;i++){rounded(ctx,107,1144+i*94,90,47,12,['#f6b5a2','#81cce7','#ffe1a0'][i]);pRect(128,1152+i*94,47,16,'#c8eaf6')}
 text(ctx,'PARKING',131,1070,20,'#296075','center',false);
 pRect(245,1075,83,42,'#fff3bf');text(ctx,'WELCOME',285,1105,14,'#235469','center',false);
}
function wallsAndDoors(t){
 // Make room connections conspicuous; sensor-operated restaurant doors open on contact.
 for(const d of DOORS){
  const a=game?.doors?.[d.id]||0;
  const x=d.x,y=d.y;
  rounded(ctx,x-52,y-71,104,22,6,'#245c73');text(ctx,d.name,x,y-55,11,'#fff4b9','center',false);
  if(d.axis==='v'){
   rounded(ctx,x-7,y-42,14,84,5,'#fcefc6');
   if(a>.01){pRect(x-5,y-40,5,39*(1-a),'#ffa965');pRect(x-5,y+1+39*a,5,39*(1-a),'#ffa965')}
   else pRect(x-6,y-38,12,76,'#f49d74');
  }else{
   rounded(ctx,x-43,y-6,86,13,4,'#fff4c0');pRect(x-40,y-5,40*(1-a),10,'#ffae79');pRect(x+40*a,y-5,40*(1-a),10,'#ffae79');
  }
  if(a>.7)text(ctx,'⇆',x,y+32,22,'#a3f4d8','center',false);
 }
 // Open cold storage portals are framed without door objects.
 for(const d of NO_DOOR_OPENINGS)text(ctx,'↔',d.x,d.y,22,'#60d1ba','center',false);
}
function world(t){
 pierAndOutside(t);bar(t);dining(t);chowder(t);tiki(t);kitchen(t);employeeHall(t);coldStorage(t);
 // Connect chowder wall to galley only to the RIGHT of the three sinks.
 pRect(1218,703,91,21,'#fff2c5');
 // No door at prep/refrigerator/freezer room thresholds by design.
 wallsAndDoors(t);labels();
 for(let i=0;i<17;i++){const x=225+i*99;ellipse(ctx,x,311+Math.sin(t*2+i)*3,4,4,'#fff7c0')}
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
 rounded(ctx,x-52,y-16,104,34,10,'#184b59e8');text(ctx,'!  '+Math.ceil(Math.hypot(q.x-game.x,q.y-game.y)/32)+' TILES',x,y+6,17,'#ffe7a1','center',false);
 ctx.save();ctx.translate(x+Math.cos(ang)*44,y+Math.sin(ang)*12);ctx.rotate(ang);ctx.fillStyle='#ffd088';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-4,-7);ctx.lineTo(-4,7);ctx.closePath();ctx.fill();ctx.restore()
}
function render(t){
 ctx.clearRect(0,0,W,H);
 const zoom=1.20,halfW=W/(2*zoom),halfH=H/(2*zoom);
 const camX=clamp(game?.camX||700,halfW,MAP_W-halfW),camY=clamp(game?.camY||425,halfH,MAP_H-halfH);
 ctx.save();ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-camX,-camY);
 world(t);drawWorkResults(t);npcCharacters(t);drawCustomers(t);if(state==='playing')drawPickup(t);
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
 [[1103,846],[1050,874],[1204,839],[1103,846]],
 [[1040,930],[1240,955],[1341,1160],[1040,930]],
 [[850,918],[1045,511],[520,961],[850,918]],
 [[1330,1100],[1608,1120],[1120,1040],[1330,1100]],
 [[350,1084],[480,955],[1030,500],[350,1084]],
 [[1750,725],[1800,595],[1680,688],[1750,725]],
 [[735,961],[490,1190],[739,1190],[735,961]],
 [[1615,1130],[1885,1130],[1720,1040],[1615,1130]],
 [[1595,620],[1285,525],[1635,640],[1595,620]],
 [[1500,1280],[1400,1100],[1910,1150],[1500,1280]]
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
  const camX=1090+500*Math.sin(t*.075),camY=816+260*Math.sin(t*.11);
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
function loop(now){const dt=Math.min(.05,(now-last||16)/1000);last=now;tick+=dt;drawSky(tick);if(['menu','front','credits'].includes(state))menuAttract(tick);if(state==='playing'||state==='walkin')update(dt);if(game?.mini)updateMini(dt);if(state!=='menu'&&state!=='front'&&game)render(tick);if(state==='finish')drawVictory(tick);if(game?.mini)paintMini();if(!introDone)drawIntro(now);if(toastDeadline&&now>toastDeadline){$('toast').classList.remove('show');toastDeadline=0}requestAnimationFrame(loop)}
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
function finishIntro(){if(introDone)return;introDone=true;const el=$('sunriseIntro');el.classList.add('introFade');if(state==='intro'&&game){state='walkin';game.introWalk=0;game.paused=true;screenFade();toast('☀️ CREW ARRIVING FOR THE SHIFT!');beep(660,.1)}setTimeout(()=>{if(introDone)el.classList.add('hidden')},540)}
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
 dishes:['sort','dish','stack','sweep','dish','stack'],cook:['prep','fryer','plate','tap','shake','dial'],waiter:['tray','tray','tip','tray','sort','tray'],
 boss:['count','tap','count','trace','chill','count'],host:['tap','seat','sort','count','seat','tap'],drinks:['sort','shake','tray','chill','prep','polish'],
 busser:['sort','sweep','stack','polish','stack','sweep'],fish:['sort','chill','prep','prep','chill','sort'],
 decor:['water','tap','polish','stack','trace','water'],fix:['trace','dial','trace','fryer','dial','trace']
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
// Skills have two parts: four visible stats and a distinct job-family perk.
const specialPerks={dishes:'Dish residue scrubs faster',cook:'Fryer reversals are easier',waiter:'Earn bonus customer tips',boss:'Ghosts interrupt less often',host:'Guests are more patient',drinks:'Mixers finish sooner',busser:'Wiping removes more crumbs',fish:'Prep work earns a bonus coin',decor:'More celebratory sparkles',fix:'Repairs have larger touch targets'};
function miniReverseGoal(m){return Math.max(5,8+m.variant*2-(m.kind==='fryer'&&roles[game.role].id==='cook'?2:0)-(m.kind==='shake'&&roles[game.role].id==='drinks'?2:0))}
const MINI_ICONS={sort:['🐟','🦀','🍋','🍤','🥬'],stack:['🍽','🥣','🥄','🍴','✨'],prep:['🐟','🍋','🔪','🧂','🌿'],plate:['🍤','🐟','🍋','🌿','🥣'],tip:['🪙','💰','💵','⭐','🪙'],count:['📦','🧊','🥫','🐟','📋'],
 tap:['⭐','🧽','📋','🪛','✨'],seat:['🪑','🍴','🥣','📖','🌸'],chill:['🧊','🐟','🧊','❄','🐟'],water:['🌷','🌺','🌿','🌼','🌻'],trace:['⚡','🔧','🔌','💡','🪛'],dial:['⚡','🔋','🔧','💡','✓']};
const lastMiniVariant={};
function nextVariant(kind){let n=Math.floor(Math.random()*5);if(n===lastMiniVariant[kind])n=(n+1+Math.floor(Math.random()*4))%5;lastMiniVariant[kind]=n;return n}
function miniKind(action){if(!game||!action)return null;
 if(action.kind==='ghost')return 'sweep';
 if(action.kind==='pickup')return 'plate';
 if(action.kind==='serve')return 'tray';
 if(action.kind!=='job')return null;
 return (MINI_ROLE_KINDS[roles[game.role].id]||MINI_ROLE_KINDS.boss)[game.done%roles[game.role].tasks.length];
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
   if(distance<29)dirt.dirty=Math.max(0,dirt.dirty-(tap?.22:.12+Math.min(travel,60)*.007+roles[game.role].stats.skill*.017+(roles[game.role].id==='dishes'?0.05:0)+(roles[game.role].id==='busser'?0.04:0)));}}
  m.progress=1-m.grime.reduce((sum,d)=>sum+d.dirty,0)/m.grime.length;
 }else if(['fryer','shake'].includes(m.kind)){
  if(prev){m.swing+=x-prev.x;
   if(Math.abs(m.swing)>=(m.kind==='fryer'?23:27)){const dir=Math.sign(m.swing);if(m.lastDir&&dir!==m.lastDir){m.switches++;beep(240+m.switches*22,.04,'triangle')}m.lastDir=dir;m.swing=0;}
  }
  m.progress=Math.min(1,m.switches/miniReverseGoal(m));
 }else{ // ordered gesture/tap mini-game, used by every other job
  const o=m.spots[m.index];if(o&&Math.hypot(x-o.x,y-o.y)<(roles[game.role].id==='fix'?50:38)&&tap){m.index++;m.progress=m.index/m.spots.length;beep(470+55*m.index,.055,'sine');}
 }
 m.last={x,y};updateMiniStatus();if(m.progress>=.99)exitMini(true);
}
function updateMiniStatus(){const m=game?.mini;if(!m)return;
 $('minigameProgress').style.width=`${Math.min(100,Math.round(m.progress*100))}%`;
 $('minigameStatus').textContent=m.feedback||(m.kind==='tray'?`${Math.round(m.progress*100)}% BALANCED · ATTEMPT ${m.attempt}`:
 ['dish','sweep','polish'].includes(m.kind)?`${Math.round(m.progress*100)}% CLEAN · DESIGN ${m.variant+1}/5`:
 ['fryer','shake'].includes(m.kind)?`${m.switches}/${miniReverseGoal(m)} REVERSES · DESIGN ${m.variant+1}/5`:
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
 if(err<46+roles[game.role].stats.skill*2){m.stable+=dt;m.failTime=Math.max(0,m.failTime-dt*.7)}
 else if(err<84){m.stable+=dt*.22;m.failTime=Math.max(0,m.failTime-dt*.2)}
 else {m.failTime+=dt*(err>108?1.4:1)}
 m.progress=Math.min(1,m.stable/(4.3+m.variant*.35));
 if(m.failTime>(.48+roles[game.role].stats.skill*.036)){m.showFall=1.05;m.feedback='💥 FOOD FELL! TRY AGAIN — GUEST IS STILL WAITING';beep(140,.28,'sawtooth');}
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
window.__coveTest={SHIFT_LENGTH,DAILY_JOBS,DAILY_GUESTS,shiftDifficulty,phaseName,crowdDelay,prankDelay,miniKind,get introDone(){return introDone},get mini(){return game?.mini||null},exitMini,constructMini,updateMini,nextVariant,FOOD_RESIDUES,MINI_ROLE_KINDS,toggleBoard,openCrew,openFront,finishIntro,startMini,applyMini,roles,DEMO_ROUTES,get demoEnabled(){return state==='menu'||state==='front'},DINER_TABLES,PICKUP,DOORS,WALK_ROOMS,NO_DOOR_OPENINGS,CREW_ABILITIES,miniReverseGoal,specialPerks,canStand,moveWithCollision,get state(){return state},get game(){return game},profile,saveShift,resumeSavedShift,hasSavedShift,startOrUnlock,openCredits,closeCredits,PREMIUM_CREW,BASE_ROLE_COUNT,choose,begin,goal,target,activeTask,update,ghostPrank,spawnCustomer,updateCustomers,maybeScheduleService,completeTask,finish,pressWork};makeCards();refreshWallet();requestAnimationFrame(loop);
})();
