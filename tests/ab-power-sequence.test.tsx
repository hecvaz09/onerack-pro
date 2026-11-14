import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {balanceFeeds} from '../lib/feed-balance';
import {analyzeFeeds,type FeedInputs,type Supply} from '../lib/feed-power';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {simplePowerPlan,nextPowerQuestion} from '../lib/simple-power-plan';
import {powerSetupAudit} from '../lib/power-setup-audit';
import {psuConnectionStatuses} from '../lib/psu-connection-status';
import {designPowerAnalysis} from '../lib/outlet-planning-checks';
import {PowerAssignmentNotes} from '../app/projects/[id]/racks/[rackId]/power-assignment-notes';
import {withCables} from './fixtures/b300-power';
import {individualPowerFixture,individualEquipment} from './fixtures/individual-power';
import {actionHarness} from './helpers/action-harness';

function fixture(rows=[{id:'lower',ru:1,watts:200,cords:2,minimum:1},{id:'upper',ru:10,watts:800,cords:2,minimum:1}],three=false){
 const supplies:Supply[]=(['A','B'] as const).map(feed=>({id:'pdu-'+feed,name:feed+'1',feed,confirmed:true,topology:three?'three-phase-wye':'single-phase',voltage:three?415:208,limitAmps:24,branches:{B1:20,B2:20,B3:20},outlets:Array.from({length:12},(_,i)=>({n:i+1,connectors:['C13'],limitAmps:10,branch:three?'B'+(Math.floor(i/2)%3+1):'B1',phase:three?(['L1','L2','L3'] as const)[Math.floor(i/2)%3]:'L1'}))}));
 const equipment:FeedEquipment[]=supplies.map(p=>({id:p.id,name:p.name,startRU:1,category:'pdu',rawData:{electricalProfile:p,pdu:{outlets:p.outlets.map(o=>({n:o.n,type:'C13',cb:Number(o.branch!.slice(1)),phase:o.phase}))}},details:{feed:p.feed}}));
 const inputs:FeedInputs={headroomPercent:0,budgets:{}};
 for(const row of rows){equipment.push({id:row.id,name:row.id+' · U'+row.ru,startRU:row.ru,category:'server',rawData:{},details:{}});inputs.budgets[row.id]={watts:row.watts,pf:1,cords:row.cords,minimumCords:row.minimum,connector:'C13',minVoltage:100,maxVoltage:240,psuAcCapacity:2000,cordLimitAmps:10};}
 return {equipment,inputs,supplies,plan:()=>simplePowerPlan(equipment,{feedPower:inputs})};
}

test('lowest RU wins over wattage and independent A/B sequences start at P1',()=>{
 const f=fixture();f.equipment.reverse();const plan=f.plan();assert.equal(plan.error,undefined);
 assert.deepEqual(plan.assignments.map(c=>[c.deviceId,c.inlet,c.pduId,c.outlet]),[['lower',1,'pdu-A',1],['lower',2,'pdu-B',1],['upper',1,'pdu-A',2],['upper',2,'pdu-B',2]]);
 assert.equal(plan.deviations.length,0);assert.equal(plan.analysis.ready,true);
 assert.deepEqual(simplePowerPlan([...f.equipment].reverse(),{feedPower:f.inputs}).assignments,plan.assignments);
});

test('phase balance takes priority over the next number and the deviation is visible',()=>{
 const f=fixture(undefined,true),plan=f.plan();assert.equal(plan.error,undefined);
 assert.ok(plan.assignments.filter(c=>c.deviceId==='upper').every(c=>c.outlet===3));
 assert.equal(plan.deviations.length,2);assert.ok(plan.deviations.every(d=>d.skippedOutlet===2&&d.reason.includes('balance')));
 const html=renderToStaticMarkup(<PowerAssignmentNotes equipment={f.equipment} deviations={plan.deviations} limitations={[]}/>);
 assert.match(html,/Why outlet numbers differ from sequence/);assert.match(html,/P2 skipped/);assert.match(html,/upper/);
});

test('saved C13 and switch-outlet policy remains a constraint on bottom-up assignments',()=>{
 const f=fixture();f.inputs.cablePolicy='low-ru-c13-switch-top';f.equipment.find(e=>e.id==='upper')!.category='switch';
 const plan=f.plan();assert.equal(plan.error,undefined);
 assert.ok(plan.assignments.filter(c=>c.deviceId==='lower').every(c=>c.outlet===1));
 assert.ok(plan.assignments.filter(c=>c.deviceId==='upper').every(c=>c.outlet===7));
 assert.ok(plan.deviations.every(d=>d.reason.includes('saved cable policy')));
});

test('outlet array order does not change numbering and a reserved equivalent outlet is never selected',()=>{
 const f=fixture();f.supplies.forEach(p=>{p.outlets[0].reserved=true;p.outlets.reverse();});
 const plan=f.plan();assert.equal(plan.error,undefined);
 assert.deepEqual(plan.assignments.map(c=>c.outlet),[2,2,3,3]);
});

for(const kind of ['reserved','connector','voltage','outlet','branch'] as const)test(`unsuitable P1 (${kind}) is skipped without weakening validation`,()=>{
 const f=fixture([{id:'server',ru:1,watts:600,cords:2,minimum:1}],kind==='voltage');
 for(const p of f.supplies){const o=p.outlets[0];if(kind==='reserved')o.reserved=true;if(kind==='connector')o.connectors=['C19'];if(kind==='voltage'){p.topology='three-phase-delta';p.outlets.forEach(x=>{x.phase='L1-L2';});p.voltage=415;f.inputs.budgets.server.maxVoltage=240;}if(kind==='outlet')o.limitAmps=.1;if(kind==='branch'){o.branch='small';p.branches!.small=.1;}}
 if(kind==='voltage'){assert.ok(f.plan().error,'all delta outlets exceed the input range');return;}
 const plan=f.plan();assert.equal(plan.error,undefined);assert.ok(plan.assignments.every(c=>c.outlet===2));assert.equal(plan.deviations.length,2);assert.ok(plan.deviations.every(d=>d.reason.includes('P1 skipped')));
});

test('a documented line-pair voltage mismatch skips P1 for a suitable line-neutral outlet',()=>{
 const f=fixture([{id:'server',ru:1,watts:600,cords:2,minimum:1}],true);
 for(const p of f.supplies){p.outlets[0].phase='L1-L2';p.outlets[0].branch='pair';p.branches!.pair=20;}
 const plan=f.plan();assert.equal(plan.error,undefined);assert.ok(plan.assignments.every(c=>c.outlet!==1));assert.ok(plan.deviations.every(d=>d.reason.includes('voltage')));
});

test('saved PSU1 on feed B stays fixed; PSU numbering does not impose a feed',()=>{
 const f=fixture([{id:'server',ru:1,watts:600,cords:2,minimum:1}]);
 const e=withCables(f.equipment,[{deviceId:'server',inlet:1,pduId:'pdu-B',outlet:6}]);const before=structuredClone(e),plan=simplePowerPlan(e,{feedPower:f.inputs});
 assert.equal(plan.error,undefined);assert.deepEqual(plan.assignments,[{deviceId:'server',inlet:1,pduId:'pdu-B',outlet:6},{deviceId:'server',inlet:2,pduId:'pdu-A',outlet:1}]);assert.deepEqual(e,before);
});

test('PSU1 may be assigned to B first when that improves calculated balance',()=>{
 const f=fixture([{id:'fixed',ru:1,watts:500,cords:1,minimum:1},{id:'dual',ru:2,watts:300,cords:2,minimum:1}]);
 const e=withCables(f.equipment,[{deviceId:'fixed',inlet:1,pduId:'pdu-A',outlet:1}]),plan=simplePowerPlan(e,{feedPower:f.inputs});
 assert.equal(plan.error,undefined);
 assert.equal(plan.assignments.find(c=>c.deviceId==='dual'&&c.inlet===1)!.pduId,'pdu-B');
 assert.equal(plan.assignments.find(c=>c.deviceId==='dual'&&c.inlet===2)!.pduId,'pdu-A');
});

test('three PSUs share actual feed-loss demand rather than tripling whole-system watts',()=>{
 const f=fixture([{id:'server',ru:1,watts:900,cords:3,minimum:1}]);f.supplies.forEach(p=>{p.limitAmps=6;p.branches!.B1=6;});
 const plan=f.plan();assert.equal(plan.error,undefined);assert.equal(plan.assignments.length,3);assert.equal(plan.analysis.ready,true);
 for(const scenario of plan.analysis.scenarios)for(const p of scenario.totals)assert.ok(p.amps<=6);
 const counts=f.supplies.map(p=>plan.assignments.filter(c=>c.pduId===p.id).length).sort();assert.deepEqual(counts,[1,2]);
});

test('four PDUs share four-PSU loads across A/B without duplicate endpoints',()=>{
 const f=fixture([{id:'server',ru:1,watts:2000,cords:4,minimum:2}]);
 for(const original of [...f.equipment.filter(e=>e.category==='pdu')]){const p=structuredClone(original);p.id+='2';p.name+=' second';f.equipment.push(p);}
 const plan=f.plan();assert.equal(plan.error,undefined);const model=feedRack(f.equipment,f.inputs);
 for(const feed of ['A','B'])assert.equal(plan.assignments.filter(c=>model.supplies.find(p=>p.id===c.pduId)!.feed===feed).length,2);
 assert.equal(new Set(plan.assignments.map(c=>c.pduId)).size,4);assert.equal(plan.analysis.ready,true);
});

test('split A/B does not excuse insufficient surviving PSU count or failover capacity',()=>{
 const count=fixture([{id:'server',ru:1,watts:900,cords:3,minimum:2}]);assert.ok(count.plan().error?.includes('cannot survive'));
 const capacity=fixture([{id:'server',ru:1,watts:3000,cords:2,minimum:1}]);capacity.supplies.forEach(p=>{p.limitAmps=10;});capacity.inputs.budgets.server.psuAcCapacity=5000;
 assert.ok(capacity.plan().error);assert.equal(capacity.plan().remaining.length,0);
});

test('one PSU can be assigned to the less loaded feed but cannot pass A/B validation',()=>{
 const f=fixture([{id:'fixed',ru:1,watts:500,cords:1,minimum:1},{id:'single',ru:2,watts:300,cords:1,minimum:1}]);
 const e=withCables(f.equipment,[{deviceId:'fixed',inlet:1,pduId:'pdu-A',outlet:1}]),plan=simplePowerPlan(e,{feedPower:f.inputs});
 assert.equal(plan.error,undefined);assert.equal(plan.remaining[0].pduId,'pdu-B');assert.equal(plan.planning,true);assert.equal(plan.analysis.ready,false);assert.equal(designPowerAnalysis(plan.analysis).ready,false);
 assert.ok(plan.analysis.scenarios.find(s=>s.lost==='B')!.unavailable.includes('single · U2'));
 const saved=withCables(e,plan.assignments);assert.equal(psuConnectionStatuses(saved,{feedPower:f.inputs}).single[1].state,'pending');
 const html=renderToStaticMarkup(<PowerAssignmentNotes equipment={e} deviations={[]} limitations={plan.pendingChecks}/>);assert.match(html,/A\/B redundancy incomplete/);
});

test('single-PSU planning works with one available feed and records no fictional redundancy',async()=>{
 const f=individualPowerFixture(false);f.rack.devices=f.rack.devices.filter(d=>d.id==='server'||d.id==='pdu-a');f.inputs.budgets.server.cords=1;
 const e=individualEquipment(f.rack).map(d=>({...d,name:`${d.name} · U${d.startRU}`})),plan=simplePowerPlan(e,f.rack.configuration);
 assert.equal(plan.error,undefined);assert.equal(nextPowerQuestion(e,f.inputs),null);assert.ok(powerSetupAudit(e,f.inputs).every(c=>!c.blocking));assert.ok(balanceFeeds(e,f.inputs).error);
 const h=await actionHarness({rack:f.rack});assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false)).error);assert.equal(h.updates.length,0);
 const result=await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true);assert.equal(result.ok,true,JSON.stringify(result));const saved=h.snapshot() as typeof f.rack;
 const model=feedRack(individualEquipment(saved),f.inputs),analysis=analyzeFeeds(model.supplies,model.loads,model.cords);assert.equal(analysis.ready,false);assert.equal(analysis.scenarios.find(s=>s.lost==='A')!.unavailable.length,1);assert.equal(model.cords.length,1);
});
