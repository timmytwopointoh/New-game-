/* Peks Challenges v1 — purpose-built touch minigames; no external libraries. */
(function(global){"use strict";
const POOLS={
tiki:[["lime","pineapple","ice"],["berry","ice","lime"],["pineapple","mint","ice"]],
cook:[["fish","shrimp","bread"],["shrimp","fish","bread"],["bread","fish","shrimp"]],
prep:[["lettuce","tomato","cucumber"],["tomato","cucumber","lettuce"],["cucumber","lettuce","tomato"]],
server:[["fish","salad","chowder"],["salad","chowder","fish"],["chowder","fish","salad"]],
manager:[["Kitchen rush","Send cooks"],["Dirty tables","Send bussers"],["Long queue","Send servers"]],
decor:[["Lanterns","Pier"],["Flowers","Patio"],["Bunting","Chowder"]],
trash:[["Glass bottle","Recycle"],["Food scraps","Compost"],["Paper box","Recycle"],["Greasy wrapper","Trash"]],
raccoon:[["Shiny coin","KEEP"],["Crab trap","LEAVE"],["Juicy berry","KEEP"],["Broken glass","LEAVE"]]
};
const EMOJI={lime:"🍋",pineapple:"🍍",ice:"🧊",berry:"🍓",mint:"🌿",fish:"🐟",shrimp:"🍤",bread:"🍞",lettuce:"🥬",tomato:"🍅",cucumber:"🥒",salad:"🥗",chowder:"🥣"};
const clean=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const ordered=(arr,seed)=>arr.map((v,i)=>({v,sort:(i*17+seed*11)%13})).sort((a,b)=>a.sort-b.sort).map(x=>x.v);
function create(opts){
 const stage=opts.stage,button=opts.button,kind=opts.kind,steps=(kind==="dishes"||kind==="tiki"||kind==="prep")?3:(kind==="truck"||kind==="crab")?5:6;
 let round=0,errors=0,active=true,position=0,grid=Array(20).fill(false),rot=0;
 let allowed=POOLS[kind]||POOLS.server;
 const completed=()=>{if(!active)return;active=false;stage.innerHTML='<div class="challengeWin">✨ GREAT WORK! ✨</div>';button.hidden=true;opts.onComplete({rounds:round,errors:errors});};
 const progress=(msg)=>{round++;if(opts.onProgress)opts.onProgress(round,steps,msg||"Good job!");if(round>=steps)completed();else render();};
 const mistake=(msg)=>{errors++;if(opts.onProgress)opts.onProgress(round,steps,msg||"Try again");};
 const rows=(choices,answer,title)=>'<div class="challengeHeader">'+title+'</div><div class="challengeChoices">'+choices.map(c=>'<button class="challengeTile" data-choice="'+clean(c)+'">'+(EMOJI[c]||"✦")+'<span>'+clean(c)+'</span></button>').join("")+'</div>';
 const banner=(a,b)=>'<div class="challengeHeader">'+clean(a)+'</div><div class="challengeSub">'+clean(b)+'</div>';
 function animateGauge(){if(!active||kind!=="cook")return;const needle=stage.querySelector(".heatNeedle");if(needle)needle.style.left=((performance.now()/19+round*17)%100)+"%";requestAnimationFrame(animateGauge);}
 function render(){
 if(!active)return;
 button.hidden=!(kind==="cook"||kind==="truck");button.textContent=kind==="cook"?"PLATE NOW":"ROTATE CRATE";
 const seq=allowed[round%allowed.length];stage.dataset.kind=kind;
 if(kind==="dishes"){
 let stains=Array.from({length:8},(_,i)=>'<button data-stain="'+i+'" class="dishStain" style="left:'+(16+(i%4)*20)+'%;top:'+(23+Math.floor(i/4)*38)+'%">✦</button>').join("");
 stage.innerHTML=banner("SCRUB EVERY SPOT","Tap or swipe across the dirt, then rinse.")+'<div class="plateArea"><div class="plateRing">'+stains+'</div></div><button data-action="rinse" class="challengeRinse">RINSE PLATE</button>';
 }else if(kind==="crab"){
 stage.innerHTML=banner("CATCH THE CRAB","Tap the crab before it scurries away.")+'<div class="crabCourse"><button data-action="catch" class="scurryCrab" style="animation-delay:-'+(round%5)*.3+'s">🦀</button></div>';
 }else if(kind==="tiki"){
 let next=seq[position];stage.innerHTML=banner("SHAKE A TIKI COOLER","Recipe: "+seq.join(" → "))+'<div class="recipeStatus">'+seq.map((s,i)=>i<position?"✅":i===position?"⬇️ "+s:s).join(" · ")+'</div>'+rows(ordered(["lime","pineapple","ice","berry","mint"],round),"", "ADD "+next.toUpperCase());
 }else if(kind==="cook"){
 stage.innerHTML=banner("HOT LINE GRILL","Plate when the gauge reaches the golden zone.")+'<div class="heatGauge"><div class="heatSweet"></div><div class="heatNeedle" style="left:'+(round*12%88)+'%"></div></div><div class="challengeSub">Timing matters — press PLATE NOW!</div>';
 }else if(kind==="truck"){
 const shapes=rot%2?[[0,0],[0,1],[0,2]]:[[0,0],[1,0],[2,0]];
 stage.innerHTML=banner("PREP TRUCK TETRIS","Tap a clear space to place the three-crate shipment.")+'<div class="truckBoard">'+grid.map((v,i)=>'<button data-cell="'+i+'" class="truckCell '+(v?"filled":"")+'">'+(v?"📦":"")+'</button>').join("")+'</div><div class="challengeSub">Crate: '+(rot%2?"vertical":"horizontal")+' • ROTATE to turn</div>';
 }else if(kind==="prep"){
 let next=seq[position];stage.innerHTML=banner("FRESH SALAD STATION","Chop in order: "+seq.join(" → "))+'<div class="recipeStatus">'+seq.map((s,i)=>i<position?"✅":i===position?"🔪 "+s:s).join(" · ")+'</div>'+rows(ordered(["lettuce","tomato","cucumber"],round),"", "CHOP "+next.toUpperCase());
 }else if(kind==="server"){
 let order=seq[round%seq.length];stage.innerHTML=banner("SERVE THE RIGHT ORDER","Guest ordered: "+order.toUpperCase())+rows(ordered(["fish","salad","chowder"],round),"","PICK UP THE PLATE");
 }else if(kind==="manager"){
 stage.innerHTML=banner("KEEP THE SHIFT RUNNING",seq[0])+rows(ordered(["Send cooks","Send bussers","Send servers"],round),"","WHO SHOULD HELP?");
 }else if(kind==="decor"){
 stage.innerHTML=banner("DECORATE THE COVE","Place "+seq[0]+" in the "+seq[1])+rows(ordered(["Pier","Patio","Chowder"],round),"","CHOOSE THE LOCATION");
 }else if(kind==="trash"){
 stage.innerHTML=banner("SORT THE TRASH",seq[0])+rows(ordered(["Recycle","Compost","Trash"],round),"","PICK THE CORRECT BIN");
 }else if(kind==="raccoon"){
 stage.innerHTML=banner("JIMOTHY'S SCAVENGER HUNT",seq[0])+rows(["KEEP","LEAVE"],"","IS IT SAFE FOR JIMOTHY?");
 }else{
 stage.innerHTML=banner("COVE WORK","Complete the task")+rows(["Done"],"","LET'S GO");
 }
 }
 function answer(value){
 if(!active)return;
 const seq=allowed[round%allowed.length];let good=false;
 if(kind==="tiki"||kind==="prep"){
 good=value===seq[position];if(good){position++;if(position>=seq.length){position=0;progress("Recipe completed!");}else render();}
 else{position=0;mistake("Wrong ingredient — try the recipe again");render();}
 }else if(kind==="server"){good=value===seq[round%seq.length];}
 else if(kind==="manager"||kind==="decor"||kind==="trash"||kind==="raccoon"){good=value===seq[1];}
 else if(kind==="dishes"){if(value==="rinse"){good=stage.querySelectorAll(".dishStain").length===0;if(!good)mistake("Scrub every spot first");}}
 else if(kind==="crab"){good=value==="catch";}
 else if(kind==="truck"){const idx=Number(value),x=idx%5,y=Math.floor(idx/5),points=rot%2?[[0,0],[0,1],[0,2]]:[[0,0],[1,0],[2,0]];
 good=Number.isInteger(idx)&&idx>=0&&idx<20&&points.every(p=>x+p[0]<5&&y+p[1]<4&&!grid[(y+p[1])*5+x+p[0]]);
 if(good){for(let p of points)grid[(y+p[1])*5+x+p[0]]=true;if(grid.filter(Boolean).length>=15)grid.fill(false);}else mistake("Crates overlap or leave the truck — pick another space");
 }else if(kind==="cook"){let phase=((performance.now()/19+round*17)%100);good=phase>=42&&phase<=62;if(!good)mistake("Not ready yet — wait for the gold zone");}
 else good=true;
 if(good){if(kind==="dishes"||kind==="crab"||kind==="truck"||kind==="cook"||!["tiki","prep"].includes(kind))progress();}else if(!["dishes","truck","cook","tiki","prep"].includes(kind))mistake("Not quite — follow the instruction above");
 }
 function onClick(ev){
 const n=ev.target&&ev.target.closest?ev.target.closest("[data-choice],[data-action],[data-stain],[data-cell]"):null;
 if(!n||!stage.contains(n)||!active)return;
 if(n.hasAttribute("data-stain")){n.remove();return;}
 if(n.hasAttribute("data-choice"))answer(n.dataset.choice);
 else if(n.hasAttribute("data-cell"))answer(n.dataset.cell);
 else answer(n.dataset.action);
 }
 function onMove(ev){
 if(kind!=="dishes"||!active||(ev.buttons&1)===0)return;
 const node=document.elementFromPoint(ev.clientX,ev.clientY);
 if(node&&node.classList&&node.classList.contains("dishStain")&&stage.contains(node))node.remove();
 }
 function onButton(){if(kind==="truck"){rot++;render();}else if(kind==="cook")answer("plate");}
 stage.addEventListener("click",onClick);stage.addEventListener("pointermove",onMove);button.addEventListener("click",onButton);
 render();if(kind==="cook")requestAnimationFrame(animateGauge);if(opts.onProgress)opts.onProgress(0,steps,"Start the challenge");
 return {stop(){active=false;stage.removeEventListener("click",onClick);stage.removeEventListener("pointermove",onMove);button.removeEventListener("click",onButton);button.hidden=false;},progress(){return round;},errors(){return errors;},kind};
}
global.PeksChallenges={create};
})(window);
