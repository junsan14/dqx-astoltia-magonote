import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const source = await readFile(new URL('./craftOptimizer.js', import.meta.url), 'utf8');
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const board = targets => targets.map(row=>row.map(target=>target == null ? null : {target}));
const state = (targets, extra={}) => ({grid:board(targets),values:{},currentPower:'normal',nextPower:'weak',mentalPower:252,clothType:'regen',...extra});
const cases=[];
function test(name, run){run(); cases.push(name);}
test('rounded numbers: wrap outer super 18..28, weak half adjustment 5..7',()=>{
 assert.deepEqual(m.getSewNumbers('wrap','super',.75),[18,20,22,24,24,26,28]);
 assert.deepEqual(m.getSewNumbers('halfAdjust','weak'),[5,5,6,6,6,7,7]);
 assert.deepEqual(m.getSewNumbers('loosen','weak',1,true),[-6,-6,-7,-7,-8,-8,-9]);
 assert.equal(m.POWER_TABLES.halfAdjust.cost,12);
});
test('cloth timing 5/9/13; rainbow half/critical and rounded costs',()=>{
 assert.equal(m.isClothEffectTurn(4),false); assert.equal(m.isClothEffectTurn(5),true);
 assert.equal(m.getNextClothTurn(5),5); assert.equal(m.getNextClothTurn(6),9);
 assert.equal(m.getEffectiveCost(13,'rainbow',5),7);
 assert.equal(m.getEffectiveCost(13,'rainbow',9),20);
 assert.equal(m.getEffectiveCost(13,'rainbow',13),7);
 assert.equal(m.getEffectiveCost(13,'rainbow',9,{'9':{rainbowMode:'halfCost'}}),7);
});
test('regen compares ratio, excludes ±4, retains ties',()=>{
 let g=board([[200,100,80]]);
 assert.deepEqual(m.getRegenTargets(g,{'0-0':80,'0-1':50,'0-2':40}).map(c=>c.cellKey),['0-1','0-2']);
 assert.deepEqual(m.getRegenTargets(g,{'0-0':199,'0-1':105,'0-2':70}).map(c=>c.cellKey),['0-1']);
});
test('global absolute error cannot cancel across cells',()=>{
 assert.equal(m.getBoardSummary(board([[100,100]]),{'0-0':102,'0-1':98},3).withinTolerance,false);
 assert.equal(m.getBoardSummary(board([[100,100]]),{'0-0':102,'0-1':98},4).withinTolerance,true);
 assert.equal(m.getBoardSummary(board([[100,100]]),{'0-0':105,'0-1':100},8).withinTolerance,true);
});
test('safe opening preserves ordinary sew before strongest power',()=>{
 assert.equal(m.getGlobalOptimizedCandidates(state([[100,100]],{currentPower:'weak',nextPower:'super'}))[0].skillKey,'noSkill');
});
test('focus: strongest, postpone if next also strongest, renew only near expiry',()=>{
 const base=state([[100,100]],{currentPower:'super',nextPower:'weak'});
 assert.equal(m.getGlobalOptimizedCandidates(base)[0].skillKey,'focus');
 assert(!m.getGlobalOptimizedCandidates({...base,nextPower:'super',limit:100}).some(c=>c.skillKey==='focus'));
 assert(!m.getGlobalOptimizedCandidates({...base,focusTurns:2,limit:100}).some(c=>c.skillKey==='focus'));
 assert(m.getGlobalOptimizedCandidates({...base,focusTurns:1,limit:100}).some(c=>c.skillKey==='focus'));
 assert(!m.getGlobalOptimizedCandidates({...base,mentalPower:10,limit:100}).some(c=>c.skillKey==='focus'));
 assert(!m.getGlobalOptimizedCandidates(state([[12,14]],{currentPower:'super',limit:100})).some(c=>c.skillKey==='focus'));
});
test('four-cell board can use edge wrap without imaginary cells',()=>{
 const cs=m.getGlobalOptimizedCandidates(state([[100,100],[100,100]],{limit:100}));
 const wraps=cs.filter(c=>c.skillKey==='wrap');
 assert.equal(wraps.length,4);assert(wraps.every(c=>c.affectedPreview.length===3));
 assert.equal(new Set(cs.map(c=>c.key)).size,cs.length);
});
test('pink event requires observation; glow doubles the correct cell only',()=>{
 const base=state([[100,100]],{clothType:'pink',turnCount:5,limit:100});
 assert.equal(m.getGlobalOptimizedCandidates(base).length,0);
 const cs=m.getGlobalOptimizedCandidates({...base,clothEvents:{'5':{cellKeys:['0-0']}}});
 const sew=cs.find(c=>c.skillKey==='horizontal'); assert(sew);
 assert.equal(sew.affectedPreview.find(c=>c.cellKey==='0-0').max,36);
 assert.equal(sew.affectedPreview.find(c=>c.cellKey==='0-1').max,18);
});
test('basting is persistent, consumed once, and ignores support input values',()=>{
 const base=state([[300]],{nextPower:'super',limit:100});
 const c=m.getGlobalOptimizedCandidates(base).find(c=>c.skillKey==='basting');assert(c);
 let applied=m.applySewingResult({values:{'0-0':'0'},candidate:c,results:{'0-0':99}});
 assert.equal(applied.values['0-0'],'0');assert(applied.bastingCells['0-0']);
 const cs=m.getGlobalOptimizedCandidates({...base,currentPower:'super',bastingCells:applied.bastingCells});
 const all=m.getGlobalOptimizedCandidates({...base,currentPower:'super',bastingCells:applied.bastingCells,limit:100});
 const sew=all.find(c=>c.skillKey==='triple');assert.equal(sew.affectedPreview[0].max,216);
 assert(!all.some(c=>c.skillKey==='basting'));
 applied=m.applySewingResult({...applied,candidate:sew,results:{'0-0':'160'}});
 assert.equal(applied.values['0-0'],'160');assert.equal(applied.bastingCells['0-0'],undefined);
});
test('negative, decimal, empty and missing results are rejected atomically',()=>{
 const c=m.getGlobalOptimizedCandidates(state([[100]],{limit:100})).find(c=>c.skillKey==='noSkill');
 for(const value of ['',-1,1.5,Infinity,undefined])assert.throws(()=>m.applySewingResult({values:{'0-0':'0'},candidate:c,results:{'0-0':value}}));
});
test('stop within tolerance; no shift or random-sew guesses',()=>{
 const cs=m.getGlobalOptimizedCandidates(state([[100,100]],{limit:100}));
 assert(!cs.some(c=>['powerShift','randomSew'].includes(c.skillKey)));
 assert.equal(m.getGlobalOptimizedCandidates(state([[100,100]],{values:{'0-0':99,'0-1':101},tolerance:2})).length,0);
});
test('4/6/9-cell shapes, three cloth types: finite scores, budget, protected cells',()=>{
 const started=performance.now();
 for(const targets of [[[100,100],[100,100]],[[150,180,150],[90,150,90]],[[60,120,60],[150,120,150],[60,150,60]]]) {
  for(const clothType of ['regen','rainbow','pink']) for(const currentPower of m.POWER_ORDER) for(const mentalPower of [0,7,25,80,252]) {
   const cs=m.getGlobalOptimizedCandidates(state(targets,{clothType,currentPower,mentalPower,values:{'0-0':targets[0][0]},limit:100}));
   for(const c of cs){assert(Number.isFinite(c.score));assert(c.effectiveCost<=mentalPower);assert(c.reason);assert(c.affectedPreview.every(p=>p.cellKey!=='0-0'));}
  }
 }
 console.log('scenario sweep ms:',Math.round(performance.now()-started));
});
test('power queue shifts automatically and preserves random placeholders',()=>{
 const before={currentPower:'weak',nextPower:'super',focusTurns:0,powerQueue:['unknown','normal']};
 const next=m.advancePowerState(before);
 assert.deepEqual(next,{currentPower:'super',nextPower:'unknown',focusTurns:0,powerQueue:['normal']});
 assert.deepEqual(m.advancePowerState(next),{currentPower:'unknown',nextPower:'normal',focusTurns:0,powerQueue:[]});
 assert.deepEqual(before.powerQueue,['unknown','normal']);
});
test('three focus actions preserve sequence until the last action',()=>{
 let s={currentPower:'super',nextPower:'weak',focusTurns:3,powerQueue:['normal','strong']};
 s=m.advancePowerState(s); assert.equal(s.currentPower,'super'); assert.equal(s.focusTurns,2); assert.equal(s.powerQueue.length,2);
 s=m.advancePowerState(s); assert.equal(s.currentPower,'super'); assert.equal(s.focusTurns,1); assert.equal(s.nextPower,'weak');
 // Renewing focus inserts another three actions without changing the underlying queue.
 const renewed=m.advancePowerState({...s,focusTurns:3}); assert.equal(renewed.nextPower,'weak'); assert.equal(renewed.powerQueue.length,2);
 s=m.advancePowerState(s); assert.deepEqual(s,{currentPower:'weak',nextPower:'normal',focusTurns:0,powerQueue:['strong']});
 s=m.advancePowerState(s); assert.equal(s.currentPower,'normal'); assert.equal(s.nextPower,'strong');
});
test('equipment thresholds include body parts and exact boundaries',()=>{
 for(const [name,limit] of [['頭',2],['体上',8],['体下',4],['腕',4],['靴',2]]) {
  assert.equal(m.getEquipmentTolerance({equipmentType:{name}}),limit);
  assert(m.getBoardSummary(board([[100]]),{'0-0':100-limit},limit).withinTolerance);
  assert(!m.getBoardSummary(board([[100]]),{'0-0':99-limit},limit).withinTolerance);
 }
 assert.equal(m.getEquipmentTolerance({groupName:'不明'}),0);
});
test('shift is an affordable escape from excessive strong sewing, not an opener',()=>{
 const small=state([[100,100]],{currentPower:'super',values:{'0-0':97,'0-1':97},mentalPower:30});
 assert.equal(m.getGlobalOptimizedCandidates(small)[0].skillKey,'powerShift');
 assert(!m.getGlobalOptimizedCandidates({...small,mentalPower:6}).some(c=>c.skillKey==='powerShift'));
 assert(!m.getGlobalOptimizedCandidates({...small,currentPower:'weak'}).some(c=>c.skillKey==='powerShift'));
 assert(!m.getGlobalOptimizedCandidates({...small,values:{}}).some(c=>c.skillKey==='powerShift'));
});
test('weak costly opening preserves ordinary sewing',()=>{
 for(const mentalPower of [80,180,252]) assert.equal(m.getGlobalOptimizedCandidates(state([[200,200,200],[200,200,200],[200,200,200]],{currentPower:'weak',mentalPower}))[0].skillKey,'noSkill');
});
test('shift inside focus preserves held power and underlying sequence',()=>{
 let s=m.advancePowerState({currentPower:'super',nextPower:'weak',focusTurns:3,powerQueue:['normal']},true);
 assert.equal(s.currentPower,'unknown');assert.equal(s.focusTurns,2);assert.equal(s.heldPower,'super');
 s=m.advancePowerState({...s,currentPower:'normal'});assert.equal(s.currentPower,'super');assert.equal(s.focusTurns,1);
 s=m.advancePowerState(s);assert.equal(s.currentPower,'weak');assert.equal(s.nextPower,'normal');
});
test('finishing search changes a greedy choice and tracks fallback per body part',()=>{
 const s=state([[100,100]],{values:{'0-0':88,'0-1':92},currentPower:'normal',nextPower:'weak',powerQueue:['weak','normal'],mentalPower:25,clothType:'rainbow',tolerance:2});
 const greedy=m.getGlobalOptimizedCandidates({...s,searchDepth:0});
 const searched=m.getGlobalOptimizedCandidates(s);
 assert.equal(greedy[0].skillKey,'halfAdjust');assert.equal(searched[0].skillKey,'adjust');
 for(const c of searched) {
  assert.equal(c.finishingPlan.fallback,8);
  assert(c.finishingPlan.sampledWorstError>=c.finishingPlan.sampledMeanError);
  assert(c.effectiveCost<=25);
 }
 assert.equal(m.getGlobalOptimizedCandidates({...s,tolerance:4})[0].finishingPlan.fallback,10);
});
test('unknown powers are not treated as a guaranteed weak finishing turn',()=>{
 const s=state([[100,100]],{values:{'0-0':88,'0-1':92},currentPower:'normal',nextPower:'unknown',mentalPower:25,tolerance:2});
 const cs=m.getGlobalOptimizedCandidates(s);assert(cs.length);
 assert(cs.every(c=>c.finishingPlan.uncertain));
});
for(const name of cases)console.log('PASS',name);
console.log(`${cases.length} test groups passed`);
