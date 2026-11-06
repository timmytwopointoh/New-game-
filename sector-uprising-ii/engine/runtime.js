/* SECTOR UPRISING II : AFTERLIGHT
 * Original offline-first WebGL2 first-person survival shooter, v0.2 systems foundation.
 * No externally loaded shaders, images, fonts, libraries, analytics, or network calls.
 * Dynamic geometry + fixed-step simulation, adapted to Android WebView.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id), world=$('world'),radar=$('radar'),rg=radar.getContext('2d');
const TAU=Math.PI*2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),mix=(a,b,t)=>a+(b-a)*t;
let seed=1749;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
let gl=world.getContext('webgl2',{antialias:false,alpha:false,depth:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
if(!gl){$('mainMenu').querySelector('.intro').innerHTML='This device needs WebGL 2 support. Try the latest Android System WebView.';$('startButton').disabled=true;return;}
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;layout(location=2) in vec3 tint;layout(location=3) in float glow;layout(location=4) in vec2 uv;
uniform mat4 proj,view;uniform float clock;
out vec3 vWorld,vN,vColor;out float vGlow;out vec2 vUV;
void main(){vWorld=position;vN=normal;vColor=tint;vGlow=glow;vUV=uv;gl_Position=proj*view*vec4(position,1.0);}`;
const FS=`#version 300 es
precision highp float;
in vec3 vWorld,vN,vColor;in float vGlow;in vec2 vUV;
uniform vec3 eye,lightPos,sectorTint;uniform float clock,flash,overdrive,visualQuality;
out vec4 color;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
 vec3 n=normalize(vN),ld=normalize(vec3(-.34,.83,-.42));
 float diffuse=max(.0,dot(n,ld));float hemi=.48+.29*n.y;
 float pt=max(0.,1.-length(vWorld-lightPos)/9.5);pt=pt*pt;
 float pulse=max(0.,1.-length(vWorld-vec3(10.5,1.2,10.5))/6.0)*(.24+.18*sin(clock*1.6));
 float fleck=(hash(floor(vWorld*17.0))-.5)*.045;
 float stripe=pow(abs(sin(vUV.x*7.2)),42.)*.05;
 vec3 ambient=vec3(.33,.40,.61)+sectorTint*.12;
 vec3 linear=vColor*(ambient*(.52+hemi)+diffuse*vec3(.35,.38,.49)+pt*vec3(.70,.43,.90)+pulse*vec3(.33,.04,.63));
 linear+=vColor*(fleck+stripe);
 // Faux PBR: view-dependent metal glints, floor reflection streaks and edge wear.
 vec3 v=normalize(eye-vWorld);float metal=clamp((vColor.b-vColor.r)*1.2+.38,0.0,1.0);
 vec3 h=normalize(ld+v);
 float spec=pow(max(dot(n,h),0.0),mix(9.0,44.0,metal));
 float fres=pow(1.0-max(dot(v,n),0.0),3.0);
 float micro=hash(floor(vWorld*8.0));
 float edgeWear=smoothstep(.65,.95,abs(sin(vUV.x*3.7))*abs(sin(vUV.y*3.7)));
 linear+=visualQuality*(spec*mix(.08,.36,metal)*vec3(.50,.82,1.0)+fres*.045+edgeWear*.035);
 float wet=smoothstep(.92,.99,n.y)*(1.0-smoothstep(.05,.26,micro))*visualQuality;
 linear+=wet*(.06+.025*sin(clock*.6+vWorld.x*1.7))*vec3(.16,.5,.8);
 linear+=vColor*(fleck+stripe);
 linear+=vColor*(vGlow*(1.10+.14*sin(clock*2.7+vWorld.x*2.)));
 float dist=length(vWorld-eye);float fog=1.-exp(-pow(dist*.042,1.45));
 vec3 fogCol=vec3(.026,.034,.08)+sectorTint*.068;
 linear=mix(linear,fogCol,clamp(fog,0.,.90));
 linear+=vGlow*vec3(.095,.06,.13);
 linear*=1.+overdrive*.075;
 float smog=clamp((vWorld.y-1.0)*.0035,0.,.09);linear=mix(linear,vec3(.048,.048,.13),smog);
 linear+=flash*vec3(.25,.18,.31);
 color=vec4(pow(max(linear,0.),vec3(.89)),1.0);
}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
let prog;try{prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog))}catch(err){$('mainMenu').querySelector('.intro').textContent='The 3D renderer could not start: '+err.message;$('startButton').disabled=true;return}
gl.useProgram(prog);const U={};for(const n of ['proj','view','clock','eye','lightPos','sectorTint','flash','overdrive','visualQuality'])U[n]=gl.getUniformLocation(prog,n);
function meshBuffer(dynamic){const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,4, dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);const stride=12*4;for(const [i,len,off] of [[0,3,0],[1,3,3],[2,3,6],[3,1,9],[4,2,10]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,len,gl.FLOAT,false,stride,off*4)}gl.bindVertexArray(null);return {vao,vbo,count:0}}
const staticGPU=meshBuffer(false),dynamicGPU=meshBuffer(true);function upload(gpu,arr){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gpu===dynamicGPU?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);gpu.count=arr.length/12}
const HEX={metal:[.28,.35,.48],metal2:[.16,.22,.33],dark:[.07,.11,.19],rim:[.34,.41,.62],white:[.66,.80,.92],pink:[.86,.20,1.0],purple:[.49,.22,.96],cyan:[.12,.93,.87],blue:[.20,.51,.96],red:[1,.19,.36],orange:[1,.46,.18],gold:[1,.74,.25],black:[.035,.045,.075],floor:[.18,.22,.34],glass:[.17,.27,.37],green:[.13,1,.51],brass:[.62,.38,.17],rust:[.33,.16,.15],warm:[1,.59,.28],mist:[.12,.22,.33]};
class Mesh{constructor(){this.data=[]}v(p,n,c,e,u,v){this.data.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],e,u,v)}
 box(x,y,z,sx,sy,sz,color='metal',em=0,rot=0){if(sx<=0||sy<=0||sz<=0)return;const c=Array.isArray(color)?color:HEX[color],hx=sx/2,hy=sy/2,hz=sz/2,co=Math.cos(rot),si=Math.sin(rot);let points=[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]];points=points.map(p=>[x+co*p[0]+si*p[2],y+p[1],z-si*p[0]+co*p[2]]);
 const faces=[[0,3,2,1,[0,0,-1]],[4,5,6,7,[0,0,1]],[0,4,7,3,[-1,0,0]],[1,2,6,5,[1,0,0]],[3,7,6,2,[0,1,0]],[0,1,5,4,[0,-1,0]]];
 for(const f of faces){const n=[co*f[4][0]+si*f[4][2],f[4][1],-si*f[4][0]+co*f[4][2]],uv=[[0,0],[1,0],[1,1],[0,1]];for(const q of [0,1,2,0,2,3])this.v(points[f[q]],n,c,em,uv[q][0]*sx,uv[q][1]*sz)}}
 beam(x1,y1,z1,x2,y2,z2,width,color='cyan',em=1){const dx=x2-x1,dy=y2-y1,dz=z2-z1,len=Math.hypot(dx,dy,dz);if(len<.01)return;const c=Array.isArray(color)?color:HEX[color];let ax=-dz/len,az=dx/len;const h=width/2;const points=[[x1+ax*h,y1,z1+az*h],[x1-ax*h,y1,z1-az*h],[x2-ax*h,y2,z2-az*h],[x2+ax*h,y2,z2+az*h]];for(const seq of [[0,1,2],[0,2,3]])for(const q of seq)this.v(points[q],[0,1,0],c,em,0,0)}
}
const SECTORS=['THE BREACH','DEAD CITY','NULL CHAMBERS','FALLEN FOUNDRY','GLOOM DISTRICT','ORBITAL SPIRE','THE IRON HEART'];
const N=21, map=[];const edge=(x,z)=>x<0||z<0||x>=N||z>=N;
// All gameplay paths are on a 21x21 navigable, destructible-looking industrial tile grid.
// Nonblocking visual rails and skyline are drawn independently of collision.
function createMap(){map.length=0;for(let z=0;z<N;z++){const row=[];for(let x=0;x<N;x++){let wall=(x===0||z===0||x===N-1||z===N-1);if(!wall){wall=((x===5||x===15)&&(z>=3&&z<=7||z>=13&&z<=17)&&z!==5&&z!==15)||((z===5||z===15)&&(x>=3&&x<=7||x>=13&&x<=17)&&x!==5&&x!==15);if((x===10||z===10)||((x>=8&&x<=12)&&(z>=8&&z<=12)))wall=false;}row.push(wall?1:0)}map.push(row)} }
function tile(x,z){const ix=Math.floor(x),iz=Math.floor(z);return edge(ix,iz)?1:map[iz][ix]}
function free(x,z,r=.25){return !tile(x-r,z-r)&&!tile(x+r,z-r)&&!tile(x-r,z+r)&&!tile(x+r,z+r)}
function findRoute(x1,z1,x2,z2){
 const sx=Math.floor(x1),sz=Math.floor(z1),tx=Math.floor(x2),tz=Math.floor(z2);if(edge(sx,sz)||edge(tx,tz))return null;const start=sz*N+sx,end=tz*N+tx,seen=new Uint8Array(N*N),parent=new Int16Array(N*N);parent.fill(-1);let head=0,queue=[start];seen[start]=1;while(head<queue.length){const n=queue[head++];if(n===end)break;const x=n%N,z=Math.floor(n/N);for(const [xx,zz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){if(edge(xx,zz)||map[zz][xx])continue;const next=zz*N+xx;if(!seen[next]){seen[next]=1;parent[next]=n;queue.push(next)}}}if(!seen[end])return null;let curr=end,prev=parent[curr];while(prev!==start&&prev!==-1){curr=prev;prev=parent[curr]}return {x:(curr%N)+.5,z:Math.floor(curr/N)+.5};
}
function randomOpen(minDist=0){for(let q=0;q<200;q++){const x=1.5+Math.floor(rnd()*(N-2)),z=1.5+Math.floor(rnd()*(N-2));if(free(x,z,.32)&&Math.hypot(x-player.x,z-player.z)>minDist)return{x,z}}return{x:2.5,z:2.5}}
function addPanel(m,x,z,wallAxis,offset=0){const col=(x+z)%3===0?'metal2':'metal';if(wallAxis==='z'){m.box(x+.5,1.17,z+offset,1.0,2.3,.13,col);m.box(x+.5,1.18,z+offset+.073,.78,1.89,.037,'metal2');m.box(x+.5,1.18,z+offset+.105,.59,1.62,.018,'glass');for(const xx of [x+.12,x+.88])m.box(xx,1.14,z+offset+.12,.035,2.0,.09,'rim');m.box(x+.5,2.18,z+offset+.13,.85,.045,.08,'purple',1.6)}else{m.box(x+offset,1.17,z+.5,.13,2.3,1.0,col);m.box(x+offset+.073,1.18,z+.5,.037,1.89,.78,'metal2');m.box(x+offset+.105,1.18,z+.5,.018,1.62,.59,'glass');for(const zz of [z+.12,z+.88])m.box(x+offset+.12,1.14,zz,.09,2.0,.035,'rim');m.box(x+offset+.13,2.18,z+.5,.08,.045,.85,'cyan',1.4)}}
function buildStatic(){const m=new Mesh();seed=1749;for(let z=0;z<N;z++)for(let x=0;x<N;x++){
 m.box(x+.5,-.26,z+.5,1,.46,1,(x+z)%7===0?'metal2':'dark');
 if(tile(x+.5,z+.5)){
 m.box(x+.5,.86,z+.5,1,2.2,1,'metal2');
 if(!tile(x+.5,z-.5))addPanel(m,x,z,'z',-.01);
 if(!tile(x+.5,z+1.5))addPanel(m,x,z,'z',.99);
 if(!tile(x-.5,z+.5))addPanel(m,x,z,'x',-.01);
 if(!tile(x+1.5,z+.5))addPanel(m,x,z,'x',.99);
 m.box(x+.5,2.03,z+.5,.93,.055,.93,'rim');continue;
 }
 m.box(x+.5,-.006,z+.5,.96,.022,.96,(x+z)%4===0?'floor':'metal2');
 m.box(x+.5,-.01,z+.5,.93,.018,.93,'floor');
 if((x*3+z)%5===0){for(const a of [-.25,-.12,0,.12,.25])m.box(x+.5+a,.001,z+.5,.022,.008,.77,'dark')}
 if((x+2*z)%7===0){m.box(x+.5,.012,z+.5,.7,.026,.065,(x+z)%2===0?'purple':'cyan',.95)}
 if((x+z)%3===0)m.box(x+.5,.018,z+.5,.16,.025,.16,'metal');
 if((x+z)%4===0){m.box(x+.5,2.65,z+.5,.65,.04,.15,'rim');m.box(x+.5,2.59,z+.5,.4,.03,.08,(x+z)%2?'cyan':'purple',1.6)}
 if((x+z)%6===0){m.box(x+.5,2.72,z+.5,.12,.12,.12,'metal2');m.box(x+.5,2.67,z+.5,.11,.01,.32,'purple',.9)}
 }
 // AFTERLIGHT VISUAL KIT v0.3: modular panel seams, culverts, live cables, hazard glyphs.
 // Surface-only details: collision remains governed by the tested v0.2 map.
 for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++){
   if(tile(x+.5,z+.5))continue;
   if((x+z*3)%3===0){
     m.box(x+.5,-.001,z+.16,.79,.012,.021,'brass');
     m.box(x+.5,-.001,z+.84,.79,.012,.021,'rim');
     for(const sx of [.16,.84])m.box(x+sx,.003,z+.5,.026,.012,.56,'dark');
   }
   if((x*7+z*11)%13===0){
     // Floor drainage/grill with a cooled luminous trace and inset conduits.
     m.box(x+.5,.011,z+.5,.78,.023,.44,'black');
     for(let k=-2;k<=2;k++)m.box(x+.5+k*.13,.03,z+.5,.025,.01,.38,'rim');
     m.box(x+.5,.032,z+.67,.7,.012,.018,'orange',.35);
   }
   if((x*17+z*5)%19===0){
     for(let k=0;k<4;k++)m.box(x+.27+k*.15,.025,z+.5,.075,.012,.32,k%2?'black':'warm',.11);
   }
 }
 // High-mounted infrastructure uses no walk-blocking geometry.
 for(let z=3;z<N-2;z+=4){
   for(let x=2;x<N-2;x+=5){
     m.box(x+.5,3.25,z+.5,.14,1.25,.14,'rim');
     m.box(x+.5,3.84,z+.5,.47,.19,.47,'metal');
     m.box(x+.5,3.73,z+.5,.31,.045,.31,(x+z)%2?'warm':'cyan',2.1);
     m.box(x+.5,4.04,z+.5,.31,.04,.31,'purple',.5);
     // two suspended slack cables linking pieces of the grid
     if(x+5<N-2)for(let j=0;j<5;j++)m.beam(x+.5+j,3.70-.27*Math.sin((j/4)*Math.PI),z+.5,x+1.5+j,3.70-.27*Math.sin(((j+1)/4)*Math.PI),z+.5,.022,'black',0);
   }
 }
 // Relay landing markers and high-intensity aerial waypoints.
 for(const o of [{x:3.5,z:3.5},{x:17.5,z:3.5},{x:3.5,z:17.5}]){
   for(let a=0;a<TAU;a+=TAU/12){let b=a+TAU/12;
     m.beam(o.x+Math.cos(a)*1.08,.055,o.z+Math.sin(a)*1.08,o.x+Math.cos(b)*1.08,.055,o.z+Math.sin(b)*1.08,.036,'warm',.85);
   }
   m.box(o.x,2.42,o.z,.08,1.76,.08,'mist',.08);
   m.box(o.x,3.35,o.z,.25,.25,.25,'warm',1.85);
 }
 // Reactors: low physical cover, glowing toroids, suspended electromagnetic coils.
 const cx=10.5,cz=10.5;
 m.box(cx,.16,cz,2.35,.32,2.35,'metal');m.box(cx,.35,cz,1.65,.06,1.65,'rim');
 for(let i=0;i<12;i++){const a=TAU*i/12;const x=cx+Math.cos(a)*.73,z=cz+Math.sin(a)*.73;m.box(x,1.05,z,.18,1.75,.18,'rim',.05,a)}
 for(let y=.55;y<=2.45;y+=.34){const r=.52+Math.sin(y*3.3)*.10;for(let a=0;a<TAU;a+=TAU/24){const b=a+TAU/24;m.beam(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r,cx+Math.cos(b)*r,y,cz+Math.sin(b)*r,.045,y%2?'cyan':'purple',2.3)}}
 m.box(cx,1.3,cz,.5,1.55,.5,'pink',1.1);m.box(cx,2.15,cz,.95,.13,.95,'cyan',2.4);
 // Dramatic vertical megacity silhouettes beyond the playable area.
 for(let i=0;i<105;i++){let a=rnd()*TAU,r=14+rnd()*26,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,h=3+rnd()*13,w=.7+rnd()*2.7;m.box(x,h/2-1,z,w,h,w,'dark');m.box(x,h*.67,z,w*.65,.09,w*.65,'rim');if(i%2===0)for(let y=1;y<h-1;y+=.82){m.box(x,y,z+w*.51,w*.65,.045,.025,i%5?'purple':'cyan',.45);if(i%6===0)m.box(x+w*.51,y,z,.025,.045,w*.65,'warm',.6)} if(i%11===0){m.box(x,h-.62,z,w*.6,1.1,w*.6,'metal2');m.box(x,h-.02,z,.18,.12,.18,'warm',2.8)}}
 // Site perimeter searchlights & neon beacons.
 for(let i=1;i<N-1;i+=3){for(let z of [1,N-2]){m.box(i+.5,2.3,z+.5,.12,4.5,.12,'rim');m.box(i+.5,4.65,z+.5,.22,.34,.22,'cyan',2.6)}for(let x of [1,N-2]){m.box(x+.5,2.3,i+.5,.12,4.5,.12,'rim');m.box(x+.5,4.65,i+.5,.22,.34,.22,'purple',2.6)}}
 // Distant terrain and atmospheric horizon.
 m.box(10.5,-1.1,10.5,120,.38,120,'dark');
 upload(staticGPU,m.data);
}
// Minimal mat4 functions, column-major for GLSL.
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o}
function lookAt(ex,ey,ez,tx,ty,tz){let fx=tx-ex,fy=ty-ey,fz=tz-ez;let f=1/Math.hypot(fx,fy,fz);fx*=f;fy*=f;fz*=f;let sx=-fz,sz=fx,sl=1/Math.hypot(sx,sz);sx*=sl;sz*=sl;let ux=-fy*sz,uy=-fz*sx+fx*sz,uz=fy*sx;return new Float32Array([sx,ux,-fx,0,0,uy,-fy,0,sz,uz,-fz,0,-sx*ex-sz*ez,-ux*ex-uy*ey-uz*ez,fx*ex+fy*ey+fz*ez,1])}
// WebGL view up vector is explicitly Y-up, with cross(right,forward) preserving handedness.
function cameraView(){const fx=Math.sin(player.yaw),fz=-Math.cos(player.yaw),cy=clamp(player.pitch,-.58,.58),eyeY=1.64+player.height+Math.sin(player.bob)*.028;return lookAt(player.x,eyeY,player.z,player.x+fx,eyeY+cy,player.z+fz)}
function drawMesh(gpu){if(!gpu.count)return;gl.bindVertexArray(gpu.vao);gl.drawArrays(gl.TRIANGLES,0,gpu.count)}
const WEAPONS=[
 {name:'VOLT RIFLE',sub:'VX-7 // ELECTROMAGNETIC',dmg:17,rate:.16,spread:.045,shots:1,range:17,col:'cyan'},
 {name:'SHARD CANNON',sub:'S-12 // PARTICLE BURST',dmg:12,rate:.65,spread:.16,shots:6,range:10,col:'orange'},
 {name:'LANCER RAIL',sub:'L-09 // COIL ACCELERATOR',dmg:92,rate:1.25,spread:.009,shots:1,range:31,col:'pink'},
 {name:'NOVA LAUNCHER',sub:'N-4 // AREA PLASMA',dmg:49,rate:1.12,spread:.042,shots:1,range:17,col:'purple'}
];
const UPGRADES=[
 {tag:'SURVIVABILITY',icon:'⬡',name:'REACTIVE PLATING',text:'+30 maximum armor. Restore 40 armor immediately.',apply:()=>{player.maxHp+=30;player.hp=Math.min(player.maxHp,player.hp+40)}},
 {tag:'SURVIVABILITY',icon:'◇',name:'PHASE BARRIER',text:'+25 maximum shield. Fully replenish shield.',apply:()=>{player.maxShield+=25;player.shield=player.maxShield}},
 {tag:'ARMAMENT',icon:'↗',name:'HIGH-VOLT COILS',text:'All weapon damage increased by 22%.',apply:()=>{player.damageMult*=1.22}},
 {tag:'ARMAMENT',icon:'✦',name:'FERRO ROUNDS',text:'Fire rate improves by 16% across your arsenal.',apply:()=>{player.speedMult*=1.16}},
 {tag:'MOBILITY',icon:'≋',name:'BLINK MOTOR',text:'Run 12% faster. Dash cooldown reduced.',apply:()=>{player.moveMult*=1.12;player.dashMult*=.82}},
 {tag:'OVERDRIVE',icon:'⚡',name:'AFTERBURNER',text:'Overdrive charges 32% faster from damage.',apply:()=>{player.rageMult*=1.32}},
 {tag:'SYSTEM',icon:'⌬',name:'REGEN MATRIX',text:'Shields recover 35% faster between hits.',apply:()=>{player.regenMult*=1.35}},
 {tag:'SYSTEM',icon:'✴',name:'FIELD CACHE',text:'Gain 250 salvage and recover all armor.',apply:()=>{player.cash+=250;player.hp=player.maxHp}}
];
let phase='menu',player, enemies=[],projectiles=[],particles=[],tracers=[],pickups=[],wave=0,kills=0,totalScore=0,sector=0,last=0,stepDebt=0,time=0,announcedUntil=0,toastUntil=0,shake=0,damageUntil=0,gun=0,activeGun=[true,false,false,false],spawnPending=0,spawnClock=0,upgradeChoices=[],muted=false,ctxAudio=null;
const inputs={keys:new Set(),moveX:0,moveZ:0,shoot:false,look:null,joystick:null,interact:false,focus:false};
const defaultPlayer=()=>({x:10.5,z:16.5,yaw:0,pitch:0,bob:0,height:0,verticalVel:0,hp:100,maxHp:100,shield:75,maxShield:75,energy:100,rage:0,rageActive:0,rageMult:1,damageMult:1,speedMult:1,moveMult:1,regenMult:1,dashMult:1,dashCool:0,dashT:0,lastHit:-99,nextShot:0,cash:0});
const RELAYS=[{id:'NORTH',name:'NORTH GRID RELAY',x:3.5,z:3.5},{id:'EAST',name:'EAST GRID RELAY',x:17.5,z:3.5},{id:'SOUTH',name:'SOUTH GRID RELAY',x:3.5,z:17.5}];
let relayState={},coreOnline=false,interactProgress=0,saveTimer=0,missionFlash=0;
function activeRelays(){return RELAYS.filter(x=>relayState[x.id]).length}
function objective(){const pending=RELAYS.filter(x=>!relayState[x.id]);if(pending.length){pending.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));return {...pending[0],kind:'relay'}}return coreOnline?null:{name:'AFTERLIGHT CENTRAL CORE',id:'CORE',x:10.5,z:10.5,kind:'core'}}
function interactTarget(){const o=objective();return o&&Math.hypot(o.x-player.x,o.z-player.z)<=1.7?o:null}
function tryInteract(dt){const o=interactTarget();if(!o||!(inputs.interact||inputs.keys.has('e'))){interactProgress=Math.max(0,interactProgress-dt*2.6);return}
 interactProgress+=dt;const req=o.kind==='relay'?1.1:2.0;if(interactProgress<req)return;
 interactProgress=0;inputs.interact=false;
 if(o.kind==='relay'){relayState[o.id]=true;player.cash+=180;totalScore+=275;player.shield=Math.min(player.maxShield,player.shield+24);announce(o.id+' GRID REBOOTED',1.5);notice('GRID ONLINE +180 SALVAGE',2.4)}
 else {coreOnline=true;player.cash+=750;totalScore+=1200;player.hp=player.maxHp;player.shield=player.maxShield;player.rage=100;announce('AFTERLIGHT GRID RESTORED',3);notice('CORE POWERED +750 // OVERDRIVE CHARGED',3)}
 sound('upgrade');saveCheckpoint();updateHUD(true)
}
function jump(){if(phase!=='play'||player.height>.012||player.energy<8)return false;player.verticalVel=5.7;player.energy-=8;sound('upgrade');return true}
function updateObjectiveUI(){const o=objective();$('objectiveName').textContent=o?o.name:'GRID ONLINE // CITY POWER RESTORED';$('objectiveStatus').textContent=o?`${activeRelays()}/3 RELAYS ONLINE · ${Math.round(Math.hypot(o.x-player.x,o.z-player.z))}m TO TARGET`:'3/3 RELAYS · CORE RESTORED';let d=o?Math.atan2(o.x-player.x,-(o.z-player.z))-player.yaw:0;$('objectiveArrow').style.transform=`rotate(${d}rad)`;
 const near=!!interactTarget();$('interactButton').classList.toggle('hidden',!near);$('interactHint').textContent=near?'HOLD E / ACTIVATE':'';
 $('interactFill').style.width=clamp(interactProgress/(o?.kind==='core'?2:1.1)*100,0,100)+'%';$('objectiveCard').classList.toggle('restored',!o)
}

const screens=['mainMenu','upgradeScreen','pauseScreen','endScreen','loading'];function showScreen(id){for(let s of screens)$(s).classList.toggle('hidden',s!==id)}
function overlayPlay(on){$('combatScan').classList.toggle('hidden',!on);$('hud').classList.toggle('hidden',!on);$('aim').classList.toggle('hidden',!on);$('weaponHud').classList.toggle('hidden',!on);$('touchUI').classList.toggle('hidden',!on||!touch);$('objectiveCard').classList.toggle('hidden',!on)}
let touch=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad/i.test(navigator.userAgent);
function notice(text,secs=2){$('toast').textContent=text;$('toast').classList.remove('hidden');toastUntil=time+secs}
function announce(text,secs=2.2){$('waveAnnounce').textContent=text;$('waveAnnounce').classList.remove('hidden');announcedUntil=time+secs}
function sound(type){if(muted)return;try{ctxAudio??=new (window.AudioContext||window.webkitAudioContext)();if(ctxAudio.state==='suspended')ctxAudio.resume();const t=ctxAudio.currentTime,o=ctxAudio.createOscillator(),g=ctxAudio.createGain();o.type=type==='shot'?'sawtooth':type==='hit'?'triangle':'sine';o.frequency.setValueAtTime(type==='shot'?180:type==='hit'?360:560,t);o.frequency.exponentialRampToValueAtTime(type==='shot'?72:type==='hit'?140:820,t+.085);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.04,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.13);o.connect(g);g.connect(ctxAudio.destination);o.start(t);o.stop(t+.15)}catch(_){}}
function loadPrefs(){try{const data=JSON.parse(localStorage.getItem('su2-prefs')||'{}');muted=!!data.muted;if(['high','balanced','battery'].includes(data.quality))$('quality').value=data.quality;$('soundButton').textContent='SOUND: '+(muted?'OFF':'ON');$('bestScore').textContent='BEST RUN '+String(Number(data.best)||0).padStart(5,'0')}catch(_){}}
function savePrefs(){try{const data=JSON.parse(localStorage.getItem('su2-prefs')||'{}');data.muted=muted;data.quality=$('quality').value;data.best=Math.max(data.best||0,totalScore);localStorage.setItem('su2-prefs',JSON.stringify(data))}catch(_){}}
function saveCheckpoint(){if(phase!=='play'&&phase!=='upgrade')return;try{const data={schema:2,player:{...player},wave,sector,kills,totalScore,gun,activeGun,relayState:{...relayState},coreOnline};localStorage.setItem('su2-save',JSON.stringify(data));$('continueButton').disabled=false}catch(_){}}
function clearCheckpoint(){try{localStorage.removeItem('su2-save')}catch(_){}$('continueButton').disabled=true}
function checkCheckpoint(){try{const s=JSON.parse(localStorage.getItem('su2-save'));if(s&&s.player&&s.wave>0)$('continueButton').disabled=false}catch(_){}}
function resetGame(){seed=1749;player=defaultPlayer();enemies=[];projectiles=[];particles=[];tracers=[];pickups=[];time=0;wave=0;sector=0;kills=0;relayState={};coreOnline=false;interactProgress=0;saveTimer=0;inputs.interact=false;totalScore=0;gun=0;activeGun=[true,false,false,false];spawnPending=0;spawnClock=0;createMap();buildStatic();updateHUD()}
function startGame(resume=false){resetGame();if(resume){try{const save=JSON.parse(localStorage.getItem('su2-save'));if(save?.player&&save.wave>0){player={...defaultPlayer(),...save.player};wave=save.wave;sector=save.sector||0;kills=save.kills||0;totalScore=save.totalScore||0;gun=save.gun||0;activeGun=Array.isArray(save.activeGun)&&save.activeGun.length===4?save.activeGun:activeGun;
relayState=Object.fromEntries(RELAYS.map(r=>[r.id,!!save.relayState?.[r.id]]));coreOnline=!!save.coreOnline;
if(!Number.isFinite(player.x)||!Number.isFinite(player.z)||!free(player.x,player.z,.26)){player.x=10.5;player.z=16.5}player.hp=clamp(Number(player.hp)||100,1,Math.max(100,player.maxHp));player.height=0;player.verticalVel=0;}}catch(_){}}
 phase='play';showScreen(null);overlayPlay(true);world.focus();if(resume&&wave>0){beginWave(wave)}else beginWave(1);hudWeapon();resize();savePrefs();}
function beginWave(n){wave=n;sector=Math.min(6,Math.floor((wave-1)/3));spawnPending=5+Math.floor(wave*1.6)+Math.floor(wave/3);spawnClock=.15;enemies.length=0;projectiles.length=0;pickups.length=0;player.shield=Math.min(player.maxShield,player.shield+22);player.hp=Math.min(player.maxHp,player.hp+8);phase='play';announce(`WAVE ${String(wave).padStart(2,'0')} // ${SECTORS[sector]}`,2.7);updateHUD();saveCheckpoint()}
let enemyId=0;function newEnemy(pos,boss=false){const variant=boss?'warden':wave>3&&rnd()<.26?'drone':wave>2&&rnd()<.25?'crusher':'sentinel';const base={sentinel:45,crusher:90,drone:36,warden:700}[variant];return {id:enemyId++,x:pos.x,z:pos.z,y:0,type:variant,hp:base*(1+(wave-1)*.11),maxHp:base*(1+(wave-1)*.11),speed:{sentinel:.68,crusher:.42,drone:.87,warden:.36}[variant],attackT:1+rnd(),wander:rnd()*TAU,bob:rnd()*TAU,hit:0,pathT:0,sidestep:rnd()<.5?-1:1}}
function spawnEnemy(){let pos=randomOpen(5);if(Math.hypot(pos.x-player.x,pos.z-player.z)<3)pos={x:1.5,z:1.5};const boss=(wave%5===0||wave===21)&&spawnPending===1;enemies.push(newEnemy(pos,boss));if(boss)notice('WARDEN CLASS DETECTED // ELIMINATE',3)}
function collisionMove(obj,dx,dz,r=.26){if(free(obj.x+dx,obj.z,r))obj.x+=dx;if(free(obj.x,obj.z+dz,r))obj.z+=dz}
function lineClear(x1,z1,x2,z2){let dist=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(dist/.12);for(let s=1;s<steps;s++){const t=s/steps;if(tile(mix(x1,x2,t),mix(z1,z2,t)))return false}return true}
function nearestEnemyAlongRay(angle,range,spread){let best=null,closest=range;for(const e of enemies){const d=Math.hypot(e.x-player.x,e.z-player.z);if(d>range||d<.25)continue;const theta=Math.atan2(e.x-player.x,-(e.z-player.z));const diff=Math.atan2(Math.sin(theta-angle),Math.cos(theta-angle));const hitWidth=(e.type==='warden'?.85:e.type==='crusher'?.55:.36);if(Math.abs(diff)>Math.atan2(hitWidth,d)+spread*.35||!lineClear(player.x,player.z,e.x,e.z))continue;if(d<closest){best=e;closest=d}}return best}
function spark(x,z,col='purple',count=8){for(let i=0;i<count;i++)particles.push({x,y:.65+rnd()*1.4,z,vx:(rnd()-.5)*4,vy:rnd()*3,vz:(rnd()-.5)*4,life:.22+rnd()*.52,max:.75,col,size:.018+rnd()*.04});if(particles.length>240)particles.splice(0,particles.length-240)}
function damageEnemy(e,dmg){e.hp-=dmg;e.hit=.14;$('hitflash').style.opacity='1';setTimeout(()=>{$('hitflash').style.opacity='0'},90);spark(e.x,e.z,e.type==='crusher'?'orange':'cyan',3);player.rage=clamp(player.rage+dmg*.08*player.rageMult,0,100);if(e.hp<=0){kills++;totalScore+=e.type==='warden'?1500:e.type==='crusher'?180:100;player.cash+=e.type==='warden'?400:42;spark(e.x,e.z,'pink',30);if(rnd()<.14)pickups.push({x:e.x,z:e.z,life:20,type:rnd()<.45?'health':'shield'});enemies=enemies.filter(o=>o!==e);sound('hit')}}
function shoot(){if(phase!=='play'||time<player.nextShot)return;let w=WEAPONS[gun];player.nextShot=time+w.rate/player.speedMult;sound('shot');shake=Math.max(shake,gun===3?.09:.028);let facing=player.yaw;
 for(let i=0;i<w.shots;i++){const angle=facing+(rnd()-.5)*2*w.spread*(inputs.focus?.36:1);const enemy=nearestEnemyAlongRay(angle,w.range,w.spread);const hit=enemy?{x:enemy.x,z:enemy.z}:{x:player.x+Math.sin(angle)*w.range,z:player.z-Math.cos(angle)*w.range};tracers.push({x1:player.x+Math.sin(player.yaw+.17)*.17,y1:1.47,z1:player.z-Math.cos(player.yaw+.17)*.17,x2:hit.x,y2:enemy?1.15:1.4,z2:hit.z,life:.10,col:w.col});if(enemy){damageEnemy(enemy,w.dmg*player.damageMult*(player.rageActive>0?1.8:1));if(gun===3){for(const b of [...enemies])if(Math.hypot(b.x-hit.x,b.z-hit.z)<1.65&&b!==enemy)damageEnemy(b,w.dmg*.55*player.damageMult)}}else if(i===0)spark(hit.x,hit.z,w.col,5)}
 updateHUD()}
function hitPlayer(damage){if(phase!=='play')return;let left=damage;if(player.shield>0){let used=Math.min(player.shield,left);player.shield-=used;left-=used}player.hp=Math.max(0,player.hp-left);player.lastHit=time;shake=.08;damageUntil=time+.21;updateHUD();if(player.hp<=0)gameOver()}
function gameOver(){phase='dead';overlayPlay(false);clearCheckpoint();savePrefs();$('endKicker').textContent='SIGNAL LOST // UNIT DOWN';$('endHeading').textContent='SECTOR FALLEN.';$('endStats').textContent=`SURVIVED ${wave} WAVES · ${kills} ENEMIES ELIMINATED · ${totalScore} SCORE`;showScreen('endScreen')}
function waveComplete(){if(phase!=='play')return;if(wave>=21){phase='won';overlayPlay(false);clearCheckpoint();savePrefs();$('endKicker').textContent='UPLINK RESTORED // CORE RECLAIMED';$('endHeading').textContent='UPRISING COMPLETE.';$('endStats').textContent=`ALL 7 SECTORS · ${kills} ENEMIES ELIMINATED · ${totalScore} SCORE`;showScreen('endScreen');return}phase='upgrade';saveCheckpoint();$('upgradeTitle').textContent=wave%3===0?'SECTOR SECURED. REBUILD.':'CHOOSE YOUR AUGMENT';const choose=[...UPGRADES];for(let i=choose.length-1;i>0;i--){let j=Math.floor(rnd()*(i+1));[choose[i],choose[j]]=[choose[j],choose[i]]}upgradeChoices=choose.slice(0,3);$('upgradeCards').replaceChildren(...upgradeChoices.map((u,i)=>{const b=document.createElement('button');b.className='card';b.innerHTML=`<span class="tag">${u.tag}</span><span class="icon">${u.icon}</span><strong>${u.name}</strong><p>${u.text}</p>`;b.addEventListener('click',()=>{u.apply();if(wave>=2){activeGun[Math.min(3,Math.floor((wave-1)/2))]=true}if(wave>=2)gun=Math.min(3,Math.floor((wave-1)/2));hudWeapon();showScreen(null);beginWave(wave+1);overlayPlay(true);saveCheckpoint();sound('upgrade')});return b}));overlayPlay(false);showScreen('upgradeScreen')}
function useOverdrive(){if(phase!=='play')return;if(player.rage<100){notice('OVERDRIVE REQUIRES FULL CHARGE',1);return}player.rage=0;player.rageActive=9;announce('OVERDRIVE ENGAGED',1.1);sound('upgrade')}
function dash(){if(phase!=='play'||player.dashCool>0||player.energy<26)return false;player.energy-=26;player.dashCool=3.1*player.dashMult;player.dashT=.26;notice('PHASE DASH',.4);return true}
function enemyTick(e,dt){e.hit=Math.max(0,e.hit-dt);e.attackT-=dt;e.pathT-=dt;const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz);if(dist<.01)return;let mx=dx/dist,mz=dz/dist;
 if(e.type==='drone'){e.bob+=dt*4.3;}else e.bob+=dt*(4+e.speed*1.5);
 const preferred=e.type==='drone'?3:e.type==='warden'?2.6:1.05;
 if(e.pathT<=0){e.pathT=.55+rnd()*.25;e.route=!lineClear(e.x,e.z,player.x,player.z)?findRoute(e.x,e.z,player.x,player.z):null;}
 if(e.route){const rx=e.route.x-e.x,rz=e.route.z-e.z,rd=Math.hypot(rx,rz);if(rd>.12){mx=rx/rd;mz=rz/rd}else e.pathT=0;}
 if(dist>preferred&&dist<18){const move=e.speed*dt*(wave>5?1.2:1);const ox=e.x,oz=e.z;collisionMove(e,mx*move,mz*move,e.type==='warden'?.42:.25);if(Math.hypot(e.x-ox,e.z-oz)<.004){e.pathT=0;e.wander+=e.sidestep*dt*1.7;collisionMove(e,Math.cos(e.wander)*move*.9,Math.sin(e.wander)*move*.9)}}
 if(e.attackT<=0&&dist<(e.type==='drone'?9:e.type==='warden'?9:e.type==='crusher'?1.65:1.3)&&lineClear(e.x,e.z,player.x,player.z)){
  e.attackT={sentinel:1.35,crusher:1.8,drone:1.65,warden:.9}[e.type]*(.85+rnd()*.2);if(e.type==='drone'||e.type==='warden'){const speed=4.7;projectiles.push({x:e.x,y:e.type==='drone'?1.8:1.4,z:e.z,vx:dx/dist*speed,vz:dz/dist*speed,life:3.5,col:e.type==='warden'?'pink':'orange',damage:e.type==='warden'?15:9})}else hitPlayer(e.type==='crusher'?20:11)
 }
}
function tick(dt){if(phase!=='play')return;time+=dt;player.dashCool=Math.max(0,player.dashCool-dt);player.dashT=Math.max(0,player.dashT-dt);player.rageActive=Math.max(0,player.rageActive-dt);if(time-player.lastHit>4.2)player.shield=clamp(player.shield+dt*(coreOnline?10:7)*player.regenMult,0,player.maxShield);
 const k=inputs.keys;let forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))-inputs.moveZ,strafe=Number(k.has('d'))-Number(k.has('a'));strafe+=inputs.moveX;const length=Math.hypot(forward,strafe);
 const sprint=length>.15&&(k.has('shift')||(!k.has('w')&&-inputs.moveZ>.87))&&player.energy>0&&player.dashT===0;
 if(length>0){forward/=Math.max(1,length);strafe/=Math.max(1,length);const spd=2.35*player.moveMult*(player.dashT>0?3.7:1)*(sprint?1.52:1)*(inputs.focus?.68:1),fx=Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=-fz,rz=fx;collisionMove(player,(fx*forward+rx*strafe)*spd*dt,(fz*forward+rz*strafe)*spd*dt);if(player.height<=.015)player.bob+=dt*12*(player.dashT>0?2:1)}
 player.energy=clamp(player.energy+(sprint?-22:player.dashT>0?3:17)*dt,0,100);
 if(player.height>0||player.verticalVel>0){player.height+=player.verticalVel*dt;player.verticalVel-=17.5*dt;if(player.height<0){player.height=0;player.verticalVel=0}}
 if(k.has('arrowleft'))player.yaw-=dt*1.7;if(k.has('arrowright'))player.yaw+=dt*1.7;
 if(inputs.shoot||k.has('f'))shoot();tryInteract(dt);
 saveTimer+=dt;if(saveTimer>=18){saveTimer=0;saveCheckpoint()};
 if(spawnPending>0){spawnClock-=dt;if(spawnClock<=0){spawnEnemy();spawnPending--;spawnClock=Math.max(.43,1.25-wave*.04)}}
 for(const e of [...enemies])enemyTick(e,dt);
 for(const p of [...projectiles]){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;if(p.life<=0||tile(p.x,p.z)){spark(p.x,p.z,p.col,4);projectiles=projectiles.filter(o=>o!==p);continue}if(Math.hypot(p.x-player.x,p.z-player.z)<.36){hitPlayer(p.damage);spark(p.x,p.z,p.col,8);projectiles=projectiles.filter(o=>o!==p)}}
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*7;p.life-=dt}particles=particles.filter(p=>p.life>0);
 for(const b of tracers)b.life-=dt;tracers=tracers.filter(b=>b.life>0);
 for(const p of [...pickups]){p.life-=dt;if(Math.hypot(p.x-player.x,p.z-player.z)<.68){if(p.type==='health'){player.hp=Math.min(player.maxHp,player.hp+32);notice('FIELD MEDKIT +32',1.4)}else{player.shield=Math.min(player.maxShield,player.shield+28);notice('SHIELD CELL +28',1.4)}pickups=pickups.filter(o=>o!==p);sound('pickup')}else if(p.life<=0)pickups=pickups.filter(o=>o!==p)}
 if(spawnPending===0&&enemies.length===0&&wave>0){waveComplete();return}
 if(time>toastUntil)$('toast').classList.add('hidden');if(time>announcedUntil)$('waveAnnounce').classList.add('hidden');$('damage').style.opacity=String(clamp((damageUntil-time)*1.9,0,.42));shake*=.87;updateHUD(false)
}
function addRobot(m,e){const boss=e.type==='warden',crusher=e.type==='crusher',drone=e.type==='drone',s=boss?2.0:crusher?1.25:1,dy=(drone?1.65+Math.sin(e.bob)*.18:Math.sin(e.bob)*.025),h=e.hit>0;const col=h?'white':boss?'rim':crusher?'metal':'metal2',en=h?'pink':boss?'pink':drone?'orange':'cyan',a=Math.atan2(player.x-e.x,-(player.z-e.z));
 if(drone){m.box(e.x,dy,e.z,.7,.28,.7,col,.1,a);m.box(e.x,dy+.12,e.z,.44,.22,.4,'rim',0,a);m.box(e.x,dy,e.z-.25,.55,.13,.11,en,1.9,a);for(const side of [-1,1]){m.box(e.x+side*.52,dy,e.z,.35,.22,.35,'rim',0,a);m.box(e.x+side*.52,dy+.14,e.z,.2,.055,.2,en,1.1,a)}}
 else{const y=dy;if(!boss){m.box(e.x,y+1.25*s,e.z,.61*s,.87*s,.37*s,col,.1,a);m.box(e.x,y+1.81*s,e.z,.39*s,.33*s,.38*s,'rim',0,a);m.box(e.x,y+1.81*s,e.z-.205*s,.31*s,.09*s,.065*s,en,2.3,a);for(const side of [-1,1]){m.box(e.x+side*.43*s,y+1.36*s,e.z,.25*s,.62*s,.27*s,'rim',0,a);m.box(e.x+side*.18*s,y+.50*s+Math.sin(e.bob+side)*.12,e.z,.21*s,.76*s,.26*s,'metal',0,a);m.box(e.x+side*.19*s,y+.08*s+Math.sin(e.bob+side)*.09,e.z-.15*s,.33*s,.16*s,.47*s,'rim',0,a)}m.box(e.x,y+1.2*s,e.z-.25*s,.48*s,.18*s,.12*s,en,1.45,a);m.box(e.x,y+1.66*s,e.z+.15*s,.45*s,.20*s,.13*s,'dark',0,a)}
 else{m.box(e.x,y+1.35*s,e.z,.97*s,.91*s,.54*s,col,0,a);m.box(e.x,y+1.89*s,e.z,.48*s,.39*s,.4*s,'rim',0,a);m.box(e.x,y+1.96*s,e.z-.23*s,.40*s,.10*s,.09*s,en,2.3,a);for(const side of [-1,1]){m.box(e.x+side*.60*s,y+1.42*s,e.z,.37*s,.77*s,.38*s,'metal',0,a);m.box(e.x+side*.64*s,y+1.5*s,e.z-.26*s,.23*s,.25*s,.18*s,'pink',1.2,a);m.box(e.x+side*.24*s,y+.57*s,e.z,.33*s,.97*s,.36*s,'rim',0,a)}m.box(e.x,y+1.45*s,e.z-.35*s,.55*s,.27*s,.17*s,'purple',1.6,a);m.box(e.x,y+2.43*s,e.z,.76*s,.11*s,.7*s,'metal',0,a);}
 }
 // Enemy healthbar as thin in-world luminous piece.
 const w=boss?1.5:.65;m.box(e.x,(boss?4.9:drone?2.27:2.22*s)+dy*.1,e.z,w,.035,.045,'red',.22);m.box(e.x-w*(1-e.hp/e.maxHp)/2,(boss?4.92:drone?2.29:2.24*s)+dy*.1,e.z,w*clamp(e.hp/e.maxHp,0,1),.04,.055,en,1.65)
}
function render(){const p=player||defaultPlayer();const ratio=Number(devicePixelRatio)||1;const q=$('quality').value;const res=q==='high'?Math.min(ratio,1.6):q==='balanced'?Math.min(ratio,1.12):.7;const w=Math.max(1,Math.round(world.clientWidth*res)),h=Math.max(1,Math.round(world.clientHeight*res));if(world.width!==w||world.height!==h){world.width=w;world.height=h;gl.viewport(0,0,w,h)}gl.clearColor(.017,.016,.047,1);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);
 const wobble=shake*(rnd()-.5)*.12;const oldYaw=p.yaw;p.yaw+=wobble;
 gl.uniformMatrix4fv(U.proj,false,perspective(Math.PI/(inputs.focus?3.95:2.9),w/h,.05,85));gl.uniformMatrix4fv(U.view,false,cameraView());p.yaw=oldYaw;
 gl.uniform3f(U.eye,p.x,1.64+p.height,p.z);gl.uniform3f(U.lightPos,10.5,2.5,10.5);gl.uniform3f(U.sectorTint,...([[.34,.1,.8],[.03,.66,.6],[.7,.12,.52],[.95,.29,.12],[.44,.62,.14],[.27,.36,.91],[.91,.15,.32]][sector]||[.3,.3,.5]));gl.uniform1f(U.clock,time);gl.uniform1f(U.visualQuality,q==='high'?1:q==='balanced'?.65:.25);gl.uniform1f(U.flash,damageUntil>time?.2:0);gl.uniform1f(U.overdrive,p.rageActive>0?1:0);drawMesh(staticGPU);
 const m=new Mesh();
 for(const r of RELAYS){const on=!!relayState[r.id],col=on?'cyan':'orange',pulse=.82+Math.sin(time*2.4+r.x)*.13;
 m.box(r.x,.12,r.z,1.45,.23,1.45,'metal2');m.box(r.x,.25,r.z,1.12,.08,1.12,'rim');m.box(r.x,.84,r.z,.34,1.1,.35,on?'metal':'dark');
 for(const side of [-1,1]){m.box(r.x+side*.48,.62,r.z,.09,.78,.09,'rim');m.box(r.x+side*.48,1.02,r.z,.24,.075,.18,col,pulse*1.8)}
 m.box(r.x,1.38+Math.sin(time*2+r.x)*.08,r.z,.52,.22,.52,col,pulse*2);m.box(r.x,.23,r.z,.75,.02,.75,col,on?1.5:.35);
 }
 if(coreOnline){m.box(10.5,2.35,10.5,1.2,.12,1.2,'cyan',2.5);m.box(10.5,1.4,10.5,.6,.8,.6,'green',1.3)}
 for(const e of enemies)addRobot(m,e);
 for(const b of projectiles){m.box(b.x,b.y,b.z,.12,.12,.12,b.col,2);m.box(b.x,b.y,b.z,.21,.035,.21,b.col,1.2)}
 for(const p of particles)m.box(p.x,p.y,p.z,p.size,p.size,p.size,p.col,2.3);
 for(const p of pickups){m.box(p.x,.49+Math.sin(time*3)*.1,p.z,.37,.42,.37,p.type==='health'?'green':'cyan',1.7);m.box(p.x,.49+Math.sin(time*3)*.1,p.z,.53,.06,.53,'white',.8)}
 for(const t of tracers)m.beam(t.x1,t.y1,t.z1,t.x2,t.y2,t.z2,.065,t.col,2.1);
 // Environmental ash and drifting rain glints: decorative only, deterministic, low-cost.
 // 18 particles in battery mode, 48 balanced, 90 high; no new shader programs/textures.
 const ambientCount=q==='high'?90:q==='balanced'?48:18;
 for(let i=0;i<ambientCount;i++){
   let n=i*91.37, age=time*(i%4===0?.34:.67);
   let px=1.12+((Math.sin(n*1.19)*7777.13+age*.24)%18.5+18.5)%18.5;
   let pz=1.12+((Math.cos(n*.71)*3173.43+age*.09)%18.5+18.5)%18.5;
   let py=.25+((i*.197+time*(i%3===0?.07:.15))%3.95);
   let flick=.48+.52*Math.sin(time*1.31+i*1.9);
   m.box(px,py,pz,i%5===0?.024:.012,.035+(i%4)*.03,.014,i%7===0?'warm':'mist',i%7===0?flick*.5:.08);
 }
 // Beacon rings float at the relays, accelerating as power is restored.
 for(const r of RELAYS){const active=!!relayState[r.id],c=active?'cyan':'orange';
   for(let j=0;j<14;j++){const a=j*TAU/14+time*(active?.7:.29),b=a+TAU/14;
     m.beam(r.x+Math.cos(a)*.64,1.62+Math.sin(time*1.8+r.x)*.09,r.z+Math.sin(a)*.64,r.x+Math.cos(b)*.64,1.62+Math.sin(time*1.8+r.x)*.09,r.z+Math.sin(b)*.64,.018,c,active?1.8:.7);
   }
 }
 // Animated suspended reactor, no extra physics objects.
 const x=10.5,z=10.5;for(let i=0;i<9;i++){const a=time*.45+i*TAU/9;m.box(x+Math.cos(a)*1.16,1.25+Math.sin(time*1.4+i)*.21,z+Math.sin(a)*1.16,.14,.22,.14,i%2?'cyan':'pink',2)}
 // First-person weapon: rig locked to camera by placing meshes in world-space in front of eye.
 if(phase==='play'||phase==='upgrade'||phase==='pause'){
 const fx=Math.sin(p.yaw),fz=-Math.cos(p.yaw),rx=-fz,rz=fx;const bx=p.x+fx*.57+rx*.33,by=1.08+p.height+Math.sin(p.bob)*.019,bz=p.z+fz*.57+rz*.33;let glow=gun===1?'orange':gun===2?'pink':gun===3?'purple':'cyan';
 m.box(bx,by,bz,.32,.27,.7,'metal',.08,p.yaw);m.box(bx,by+.12,bz,.24,.1,.74,'rim',0,p.yaw);m.box(bx,by-.09,bz,.17,.29,.15,'black',0,p.yaw);m.box(bx,by+.18,bz-.23,.12,.06,.34,glow,1.2,p.yaw);m.box(bx,by+.01,bz-.52,.12,.1,.43,'dark',0,p.yaw);m.box(bx,by+.02,bz-.75,.16,.13,.1,glow,1.6,p.yaw);
 }
 upload(dynamicGPU,m.data);drawMesh(dynamicGPU);if(phase==='play')drawRadar();}
function drawRadar(){const w=radar.width,h=radar.height,cx=w/2,cy=h/2,r=57;rg.clearRect(0,0,w,h);rg.save();rg.beginPath();rg.arc(cx,cy,r,0,TAU);rg.clip();rg.fillStyle='#051120cf';rg.fillRect(0,0,w,h);rg.strokeStyle='#5acfc338';for(const a of [20,39,56]){rg.beginPath();rg.arc(cx,cy,a,0,TAU);rg.stroke()}
 const scale=5.0,ca=Math.cos(player.yaw),sa=Math.sin(player.yaw);function plot(x,z){let dx=x-player.x,dz=z-player.z;return [cx+(dx*ca+dz*sa)*scale,cy+(dz*ca-dx*sa)*scale]}
 for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)if(map[z][x]&&(x+z)%2===0){const [px,py]=plot(x+.5,z+.5);rg.fillStyle='#6f8b9c30';rg.fillRect(px,py,3,3)}
 for(const r of RELAYS){const [x,y]=plot(r.x,r.z);rg.fillStyle=relayState[r.id]?'#46fcd4':'#ffb96a';rg.fillRect(x-2,y-2,5,5)}
 const objectivePoint=objective();if(objectivePoint){const [x,y]=plot(objectivePoint.x,objectivePoint.z);rg.strokeStyle='#ffffff';rg.strokeRect(x-4,y-4,8,8)}
 for(const e of enemies){const [x,y]=plot(e.x,e.z);rg.fillStyle=e.type==='warden'?'#f2a5ff':'#ff6b7a';rg.beginPath();rg.arc(x,y,e.type==='warden'?4:2.1,0,TAU);rg.fill()}
 rg.fillStyle='#5bffdf';rg.beginPath();rg.moveTo(cx,cy-7);rg.lineTo(cx-5,cy+5);rg.lineTo(cx+5,cy+5);rg.fill();rg.restore()}
let hudNext=0;function updateHUD(force=true){if(!player||(!force&&time<hudNext))return;hudNext=time+.17;const pct=(x,max)=>`${Math.round(clamp(x/max*100,0,100))}%`;$('healthBar').style.width=pct(player.hp,player.maxHp);$('shieldBar').style.width=pct(player.shield,player.maxShield);$('rageBar').style.width=pct(player.rage,100);$('energyBar').style.width=pct(player.energy,100);$('healthText').textContent=Math.ceil(player.hp);$('shieldText').textContent=Math.ceil(player.shield);$('rageText').textContent=Math.floor(player.rage)+'%';$('waveText').textContent=String(wave).padStart(2,'0');$('enemyText').textContent=String(enemies.length+spawnPending).padStart(2,'0');$('cashText').textContent=String(player.cash).padStart(4,'0');$('missionLabel').textContent=player.rageActive>0?'OVERDRIVE ENGAGED':coreOnline?'GRID RESTORED // HOLD THE CITY':`REACTIVATE GRID // ${SECTORS[sector]}`;updateObjectiveUI()}
function hudWeapon(){$('weaponTitle').textContent=WEAPONS[gun].name;$('weaponSub').textContent=WEAPONS[gun].sub;$('ammoText').textContent='∞';document.querySelectorAll('#weaponSelect button').forEach((b,i)=>{b.disabled=!activeGun[i];b.classList.toggle('selected',gun===i);b.style.opacity=activeGun[i]?'1':'.30'})}
function chooseWeapon(i){if(activeGun[i]){gun=i;hudWeapon();sound('upgrade')}}
function pause(){if(phase==='play'){phase='pause';inputs.shoot=false;inputs.interact=false;inputs.keys.clear();saveCheckpoint();showScreen('pauseScreen');overlayPlay(false);document.exitPointerLock?.()}else if(phase==='pause'){phase='play';showScreen(null);overlayPlay(true)}}
function toMenu(){if(phase==='play')saveCheckpoint();phase='menu';showScreen('mainMenu');overlayPlay(false);savePrefs();$('bestScore').textContent='BEST RUN '+String(JSON.parse(localStorage.getItem('su2-prefs')||'{}').best||0).padStart(5,'0');checkCheckpoint()}
function resize(){const ww=innerWidth,hh=innerHeight;world.style.width=ww+'px';world.style.height=hh+'px';radar.width=124;radar.height=124}
function frame(ms){const dt=last?Math.min(.08,(ms-last)/1000):.016;last=ms;stepDebt=Math.min(.07,stepDebt+dt);let steps=0;while(stepDebt>=1/60&&steps<5){if(phase==='play')tick(1/60);else time+=1/60;stepDebt-=1/60;steps++}render();requestAnimationFrame(frame)}
function pointer(e){return {x:e.clientX,y:e.clientY}};
let lastJoy=0;
function moveStick(e){if(!inputs.joystick||e.pointerId!==inputs.joystick.id)return;const box=$('joystick').getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),s=Math.min(d,43)/Math.max(d,1);$('stick').style.transform=`translate(${dx*s}px,${dy*s}px)`;inputs.moveX=dx*s/43;inputs.moveZ=dy*s/43}
$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();inputs.joystick={id:e.pointerId};$('joystick').setPointerCapture(e.pointerId);moveStick(e)});$('joystick').addEventListener('pointermove',moveStick);for(const t of ['pointercancel','pointerup','lostpointercapture'])$('joystick').addEventListener(t,e=>{if(inputs.joystick?.id===e.pointerId){inputs.joystick=null;inputs.moveX=0;inputs.moveZ=0;$('stick').style.transform='none'}});
$('aimZone').addEventListener('pointerdown',e=>{e.preventDefault();inputs.look={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)});$('aimZone').addEventListener('pointermove',e=>{if(inputs.look?.id!==e.pointerId)return;player.yaw+=(e.clientX-inputs.look.x)*.0046;player.pitch=clamp(player.pitch+(inputs.look.y-e.clientY)*.0035,-.58,.58);inputs.look.x=e.clientX;inputs.look.y=e.clientY});for(const t of ['pointerup','pointercancel','lostpointercapture'])$('aimZone').addEventListener(t,e=>{if(inputs.look?.id===e.pointerId)inputs.look=null});
$('shootButton').addEventListener('pointerdown',e=>{e.preventDefault();inputs.shoot=true;shoot();e.currentTarget.setPointerCapture(e.pointerId)});for(const t of ['pointerup','pointercancel','lostpointercapture'])$('shootButton').addEventListener(t,()=>inputs.shoot=false);
$('dashButton').addEventListener('click',dash);$('specialButton').addEventListener('click',useOverdrive);
$('jumpButton').addEventListener('click',jump);
$('focusButton').addEventListener('click',()=>{inputs.focus=!inputs.focus;$('focusButton').classList.toggle('active',inputs.focus)});
$('interactButton').addEventListener('pointerdown',e=>{e.preventDefault();inputs.interact=true;e.currentTarget.setPointerCapture(e.pointerId)});
for(const t of ['pointerup','pointercancel','lostpointercapture'])$('interactButton').addEventListener(t,()=>inputs.interact=false);
addEventListener('contextmenu',e=>{if(phase==='play')e.preventDefault()});
world.addEventListener('pointerdown',e=>{if(e.button===2)inputs.focus=true});addEventListener('pointerup',e=>{if(e.button===2)inputs.focus=false});
$('world').addEventListener('pointerdown',e=>{if(phase==='play'&&!touch&&e.button===0){inputs.shoot=true;world.requestPointerLock?.();shoot()}});addEventListener('pointerup',()=>{if(!touch)inputs.shoot=false});addEventListener('mousemove',e=>{if(document.pointerLockElement===world&&phase==='play'){player.yaw+=e.movementX*.0025;player.pitch=clamp(player.pitch-e.movementY*.0023,-.58,.58)}});
addEventListener('keydown',e=>{const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();inputs.keys.add(key);if(e.repeat)return;if(['1','2','3','4'].includes(key))chooseWeapon(Number(key)-1);if(key==='escape'||key==='p')pause();if(key==='q')dash();if(key==='r')useOverdrive();if(key===' ')jump();if(key==='enter'&&phase==='menu')startGame(false)});addEventListener('keyup',e=>inputs.keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{inputs.keys.clear();inputs.shoot=false;inputs.moveX=0;inputs.moveZ=0;inputs.interact=false;inputs.focus=false;if(phase==='play')pause()});
$('startButton').addEventListener('click',()=>startGame(false));$('continueButton').addEventListener('click',()=>startGame(true));$('pauseButton').addEventListener('click',pause);$('resumeButton').addEventListener('click',pause);$('exitButton').addEventListener('click',toMenu);$('retryButton').addEventListener('click',()=>startGame(false));$('endMenuButton').addEventListener('click',toMenu);$('soundButton').addEventListener('click',()=>{muted=!muted;$('soundButton').textContent='SOUND: '+(muted?'OFF':'ON');savePrefs()});$('quality').addEventListener('change',savePrefs);document.querySelectorAll('#weaponSelect button').forEach(b=>b.addEventListener('click',()=>chooseWeapon(Number(b.dataset.gun))));
// Public instrumentation is read-only except bounded test-only stepping and run start; no network interface.
window.__sector2={state:()=>({phase,wave,sector,kills,totalScore,player:player&&{x:player.x,z:player.z,hp:player.hp,shield:player.shield,rage:player.rage},enemies:enemies.length,spawnPending,weapon:WEAPONS[gun].name,relays:activeRelays(),coreOnline,energy:player.energy,height:player.height,objective:objective()?.id||null,interactProgress,staticVertices:staticGPU.count,dynamicVertices:dynamicGPU.count,visualKit:'afterlight-v03',visualQuality:$('quality').value}),start:()=>startGame(false),step:seconds=>{for(let n=0;n<Math.min(300,Math.ceil(seconds*60));n++)tick(1/60)},shoot:()=>shoot(),jump:()=>jump(),dash:()=>dash(),setPositionForTest:(x,z)=>{if(phase==='play'&&Number.isFinite(x)&&Number.isFinite(z)&&free(x,z,.26)){player.x=x;player.z=z;return true}return false},holdInteractForTest:(seconds)=>{inputs.interact=true;for(let n=0;n<Math.min(300,Math.ceil(seconds*60));n++)tick(1/60);inputs.interact=false},save:()=>saveCheckpoint(),waveComplete:()=>{spawnPending=0;enemies=[];waveComplete()}};
createMap();player=defaultPlayer();buildStatic();resize();loadPrefs();checkCheckpoint();showScreen('mainMenu');overlayPlay(false);addEventListener('resize',resize);requestAnimationFrame(frame);
})();

