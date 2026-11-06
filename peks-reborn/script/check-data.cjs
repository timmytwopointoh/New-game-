const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../game/data.js"),"utf8"),sandbox);
const d=sandbox.window.PEKS_DATA;
assert.equal(d.name,"Peks Plunder");
assert.equal(d.crew.length,19);
assert.equal(new Set(d.crew.map(x=>x.id)).size,19);
assert.deepEqual(Array.from(d.crew.slice(-6).map(c=>c.id)),["tim","tera","plan","eddie","jimothy","spooderman"]);
assert.deepEqual(Array.from(d.crew.slice(-2).map(c=>c.coinMult)),[3,3]);
assert.equal(d.crew.find(c=>c.id==="eddie").coinMult,2);
assert.equal(d.crew.find(c=>c.id==="waiter").coinMult,1.5);
assert.equal(d.crew.find(c=>c.id==="jimothy").kind,"raccoon");
assert.equal(d.crew.filter(c=>!c.locked).length,13);
for(const c of d.crew){assert.ok(d.circuits[c.kind]);for(const s of d.circuits[c.kind])assert.ok(d.stations.some(a=>a.id===s));}
for(const z of d.zones)assert.ok(z.w>0&&z.h>0);
console.log("PASS: game identity, 19 crew, 13 free / 6 locked, Jimothy raccoon and 3x unlocks, circuits, zones.");
