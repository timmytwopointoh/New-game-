/* Peks Engine: self-contained offline WebGL2 renderer */
(function(global){"use strict";
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const color=(s)=>typeof s==="string"?[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255]:s;
const PAL={sea:"#1a637a",surf:"#59b6bd",sand:"#d9be8a",deck:"#936341",plank:"#bc8d61",trim:"#ebc790",wood:"#764c39",floor:"#ba966a",tile:"#8ea9ac",granite:"#667984",steel:"#4b6471",glass:"#5eb9ca",sky:"#d9ddca",red:"#b14c45",blue:"#246a8a",green:"#426c52",pink:"#da817b",dark:"#233541",shadow:"#345668",white:"#eee4c9",gold:"#f6ce7e"};
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];o[c*4+r]=v;}return o;}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
function look(eye,center){const norm=v=>{let d=Math.hypot(...v)||1;return v.map(x=>x/d)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((p,v,i)=>p+v*b[i],0),z=norm(eye.map((x,i)=>x-center[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
class Mesh{
 constructor(){this.data=[];}
 tri(p,q,r,c){let u=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],v=[r[0]-p[0],r[1]-p[1],r[2]-p[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=Math.hypot(...n)||1;const rgb=color(c);for(let a of [p,q,r])this.data.push(...a,...n.map(x=>x/d),...rgb);}
 quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);}
 box(x,y,z,sx,sy,sz,col){let a=sx/2,b=sy/2,c=sz/2,p=[[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]].map(v=>[x+v[0],y+v[1],z+v[2]]);for(let ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])this.quad(...ids.map(i=>p[i]),col);}
 sphere(x,y,z,r,col,sx=1,sy=1,sz=1){const a=5,b=8,p=(i,j)=>[x+Math.sin(i)*Math.cos(j)*r*sx,y+Math.cos(i)*r*sy,z+Math.sin(i)*Math.sin(j)*r*sz];for(let i=0;i<a;i++)for(let j=0;j<b;j++){let t=i*Math.PI/a,u=(i+1)*Math.PI/a,v=j*TAU/b,w=(j+1)*TAU/b;this.tri(p(t,v),p(u,v),p(u,w),col);this.tri(p(t,v),p(u,w),p(t,w),col);}}
 cylinder(x,y,z,r,h,col){for(let i=0;i<10;i++){let a=i*TAU/10,b=(i+1)*TAU/10;const p=[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r],s=[x+Math.cos(a)*r,y+h/2,z+Math.sin(a)*r],t=[x+Math.cos(b)*r,y+h/2,z+Math.sin(b)*r];this.quad(p,q,t,s,col);this.tri([x,y+h/2,z],s,t,col);}}
}
const VS="#version 300 es\nprecision highp float;layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec3 c;uniform mat4 mvp;out vec3 vP,vN,vC;void main(){vP=p;vN=n;vC=c;gl_Position=mvp*vec4(p,1.);}";
const FS="#version 300 es\nprecision highp float;in vec3 vP,vN,vC;uniform vec3 eye;uniform float daylight;out vec4 outColor;void main(){vec3 n=normalize(vN);vec3 sun=normalize(vec3(-.4,.9,.35));float d=max(dot(n,sun),0.);float hemi=.38+.36*max(n.y,0.);vec3 am=vec3(.3,.40,.49)*daylight+vec3(.17,.22,.35)*(1.-daylight);vec3 view=normalize(eye-vP);float spec=pow(max(dot(n,normalize(sun+view)),0.),26.)*.13;vec3 lit=vC*(am*(.7+hemi)+d*vec3(1.05,.91,.73)*daylight*.61)+vec3(spec);float haze=smoothstep(38.,100.,length(eye-vP))*.19;lit=mix(lit,vec3(.12,.32,.38),haze);outColor=vec4(pow(max(lit,vec3(0.)),vec3(.94)),1.);}";
function shader(gl,t,s){const v=gl.createShader(t);gl.shaderSource(v,s);gl.compileShader(v);if(!gl.getShaderParameter(v,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(v));return v;}
function buffer(gl){let vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,4,gl.DYNAMIC_DRAW);for(let a=0;a<3;a++){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,9*4,a*3*4);}gl.bindVertexArray(null);return {vao,vbo,count:0};}
function upload(gl,b,m){gl.bindBuffer(gl.ARRAY_BUFFER,b.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(m.data),gl.DYNAMIC_DRAW);b.count=m.data.length/9;}
function world(m){
 m.box(24,-.92,18,63,1.0,52,PAL.sea);m.box(22,-.41,17,44,.7,34,PAL.sand);
 const zones=global.PEKS_DATA.zones;
 for(let a of zones){let col=a.kind==="deck"?PAL.deck:a.kind==="tile"?PAL.tile:PAL.floor;m.box(a.x+a.w/2,-.03,a.z+a.h/2,a.w,.33,a.h,col);
 if(a.kind!=="tile")for(let x=a.x+.1;x<a.x+a.w;x+=1.3)m.box(x,.145,a.z+a.h/2,.042,.013,a.h,PAL.wood);
 else for(let x=a.x+1;x<a.x+a.w;x+=2)m.box(x,.14,a.z+a.h/2,.015,.015,a.h,PAL.granite);
 }
 for(let x=10;x<27;x+=4){m.box(x,1.65,12,.35,3.3,.35,PAL.wood);m.box(x,1.65,32,.35,3.3,.35,PAL.wood);}
 for(let z=12;z<33;z+=4){m.box(10,1.65,z,.35,3.3,.35,PAL.wood);m.box(26,1.65,z,.35,3.3,.35,PAL.wood);}
 for(let z=15;z<34;z+=1.1)m.box(4,.16,z,8,.045,.06,PAL.plank);
 for(let z=15;z<34;z+=3)for(let x of [.5,8.5]){m.cylinder(x,1,z,.17,2,PAL.wood);m.box(x,1.92,z,.28,.23,.3,PAL.gold);}
 // tiki bar, stools and coconut cups
 m.box(10,1.0,8,6,1.2,1.3,PAL.wood);m.box(10,1.73,8,6.7,.25,1.8,PAL.plank);
 for(let x=8;x<=13;x+=1.45){m.cylinder(x,.62,10,.38,1,PAL.wood);m.cylinder(x,1.17,10,.42,.16,PAL.trim);m.cylinder(x,2.03,8,.13,.21,PAL.glass);}
 // Dining tables with chairs and small tableware
 for(let x of [13.5,18,23])for(let z of [18,24,29]){m.cylinder(x,.72,z,.16,1.3,PAL.wood);m.box(x,1.43,z,2.5,.2,1.7,PAL.plank);
 for(let dx of [-1.8,1.8]){m.box(x+dx,.58,z,.7,.22,1.2,PAL.wood);m.box(x+dx+dx*.12,1.09,z,.19,1.1,1.2,PAL.trim);}m.cylinder(x,1.63,z,.25,.08,PAL.white);}
 // Chowder booth and kitchen granite surfaces
 for(let x of [19,24]){m.box(x,.6,7.4,3.3,.5,1.1,PAL.wood);m.box(x,1.38,7.0,3.3,1.4,.3,PAL.plank);}
 for(let x of [29.2,32.5,35.8]){m.box(x,.85,13,2.6,1.4,2.1,PAL.steel);m.box(x,1.6,13,2.7,.2,2.25,PAL.granite);m.box(x,1.76,12.3,1.1,.12,.52,PAL.dark);}
 m.box(31.6,.8,22.6,7,1.4,2,PAL.wood);m.box(31.6,1.62,22.6,7.1,.22,2.1,PAL.granite);m.box(27.1,1.58,19,1.2,.23,4,PAL.plank);
 for(let x of [35.5,38.5,41.5]){m.box(x,.86,27.7,2.2,1.35,1.8,PAL.wood);m.box(x,1.64,27.7,2.3,.21,1.9,PAL.granite);}
 m.box(42,1.3,14.5,2.3,2.4,3.0,PAL.glass);m.box(42,2.6,14.5,2.5,.2,3.2,PAL.white);
 // Blue wooden crab tanks, not featureless blocks.
 for(let z of [20,23,26]){m.box(5,.81,z,2,1.3,1.6,PAL.blue);m.box(5,1.55,z,2.1,.19,1.7,PAL.wood);m.box(5,1.67,z,1.7,.02,1.3,PAL.glass);}
 for(let x of [9,13]){m.box(x,.52,12,1.5,.6,.7,PAL.wood);for(let dx of [-.45,0,.45])m.sphere(x+dx,.95,12,.3,dx===0?PAL.pink:PAL.green);}
 for(let [x,z] of [[3,7],[3,32],[44,8],[46,32]]){m.cylinder(x,2,z,.27,4,PAL.wood);for(let i=0;i<5;i++){let a=i*TAU/5;m.sphere(x+Math.cos(a)*1.4,4.1,z+Math.sin(a)*1.4,1.1,PAL.green,1.4,.35,.7);}}
}
function drawActor(m,x,z,c,t,isPlayer){
 let bounce=Math.sin(t*6+x)*.07,id=c.id,kind=c.kind;
 m.sphere(x,.13,z,.59,PAL.shadow,1,.09,1);
 if(kind==="raccoon"){let fur="#929994",mask="#323a3e";
 m.sphere(x,.76,z,.76,fur,1.10,.74,1.03);m.sphere(x,1.09,z-.56,.45,fur,1,.94,.9);
 for(let dx of [-.28,.28]){m.sphere(x+dx,1.42,z-.61,.16,fur);m.sphere(x+dx,1.16,z-.90,.19,mask,1.2,.70,.43);m.sphere(x+dx,1.16,z-.97,.08,PAL.white);}
 m.sphere(x,1.01,z-1.04,.09,PAL.dark);for(let dx of [-.43,.43])for(let zz of [-.38,.34])m.sphere(x+dx,.24+bounce,z+zz,.16,fur);
 for(let j=0;j<4;j++)m.sphere(x+.60+j*.17,.56+j*.06,z+.54+j*.18,.23,j%2?fur:mask,1,.8,1);return;}
 let skin="#d2a27e";m.box(x,.93,z,.70,.95,.45,c.color);m.sphere(x,1.70,z,.40,skin,1,1.14,.92);
 m.sphere(x,2.0,z+.04,.41,PAL.dark,1,.34,1);
 for(let dx of [-1,1]){m.box(x+dx*.24,.35+bounce*dx,z,.23,.66,.26,PAL.dark);m.box(x+dx*.5,1.05+bounce*dx,z,.20,.67,.25,skin);}
 if(kind==="cook"||kind==="prep"||kind==="dishes")m.sphere(x,2.12,z,.37,PAL.white,1.1,.40,1.05);
 if(id==="eddie"){m.sphere(x,1.74,z-.17,.4,PAL.white,1,1.15,.94);for(let k of [-1,0,1])m.box(x+k*.13,1.78,z-.54,.044,.12,.04,PAL.dark);}
 if(id==="plan"){m.box(x,.93,z-.25,.48,.68,.05,PAL.white);for(let k of [-1,0,1])m.sphere(x+k*.17,1.02,z-.32,.10,PAL.red);}
 if(id==="spooderman"){m.sphere(x,1.72,z,.43,PAL.red);for(let k of [-1,1])m.sphere(x+k*.17,1.78,z-.39,.15,PAL.white,1.1,.5,.35);}
 if(isPlayer)m.sphere(x,2.33,z,.14,PAL.gold,1,.5,1);
}
class Engine{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext("webgl2",{alpha:false,antialias:false,depth:true,powerPreference:"high-performance"});if(!gl)throw Error("Peks Engine requires WebGL2");this.gl=gl;
 let p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.program=p;this.mvp=gl.getUniformLocation(p,"mvp");this.eye=gl.getUniformLocation(p,"eye");this.daylight=gl.getUniformLocation(p,"daylight");this.static=buffer(gl);this.dynamic=buffer(gl);const m=new Mesh();world(m);upload(gl,this.static,m);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);}
 render(time,state){const gl=this.gl,c=this.canvas;let dpr=Math.min(global.devicePixelRatio||1,1.35),w=Math.max(1,Math.floor(c.clientWidth*dpr)),h=Math.max(1,Math.floor(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);
 let playing=state.playing,x=playing?state.player.x:22,z=playing?state.player.z:18,eye=[x+25,27,z+25],aspect=w/h,span=aspect<1.5?27:33;let mvp=mul(ortho(-span*aspect*.52,span*aspect*.52,-span*.52,span*.52,.05,150),look(eye,[x,0,z]));let light=clamp(.68+.3*Math.sin((state.clock||.2)*TAU),.3,1);
 gl.clearColor(.035*light,.14*light,.21*light+.06*(1-light),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.mvp,false,mvp);gl.uniform3fv(this.eye,eye);gl.uniform1f(this.daylight,light);gl.bindVertexArray(this.static.vao);gl.drawArrays(gl.TRIANGLES,0,this.static.count);
 const m=new Mesh();for(let i=0;i<35;i++){let wx=(i*7.1)%60-5,wz=(i*13.7)%50-5;if(wx>0&&wx<48&&wz>0&&wz<35)continue;m.box(wx,-.4+Math.sin(time*.002+i)*.07,wz,2,.03,.08,i%2?PAL.surf:PAL.sea);}
 for(let z of [20,23,26]){let bob=Math.sin(time*.002+z)*.05;m.sphere(5,1.49+bob,z,.32,PAL.red,1.25,.38,.9);for(let dx of [-.55,.55])m.sphere(5+dx,1.48+bob,z-.14,.13,PAL.red);}
 if(Math.sin(time*.00019)>.95)m.sphere(-1,.6+Math.abs(Math.sin(time*.002))*2.5,15,.58,PAL.surf,2,.55,.8);
 for(let a of (state.npcs||[])){const role=global.PEKS_DATA.crew.find(v=>v.id===a.id)||global.PEKS_DATA.crew[0];drawActor(m,a.x,a.z,role,time*.001,false);}
 if(playing&&state.marker){const p=state.marker;const rise=2.45+Math.sin(time*.003)*.18;m.sphere(p.x,rise,p.z,.25,PAL.gold,1,.55,1);m.cylinder(p.x,rise-.4,p.z,.08,.4,PAL.white);}
 if(playing){const role=global.PEKS_DATA.crew.find(v=>v.id===state.roleId)||global.PEKS_DATA.crew[0];drawActor(m,state.player.x,state.player.z,role,time*.001,true);}
 upload(gl,this.dynamic,m);gl.bindVertexArray(this.dynamic.vao);gl.drawArrays(gl.TRIANGLES,0,this.dynamic.count);gl.bindVertexArray(null);}
}
global.PeksEngine={Engine,Mesh};
})(window);
