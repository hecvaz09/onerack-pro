import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {balanceFeeds} from '../lib/feed-balance';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {powerWiringGuide} from '../lib/power-wiring-guide';
import type {FeedEquipment} from '../lib/feed-rack';
import type {Supply,FeedInputs} from '../lib/feed-power';
import {withCables,b300PowerFixture} from './fixtures/b300-power';
import {PowerAssignmentNotes} from '../app/projects/[id]/racks/[rackId]/power-assignment-notes';

function fixture(){
 const supplies:Supply[]=(['A','B'] as const).map(feed=>({id:feed,name:feed,feed,confirmed:true,topology:'single-phase',voltage:230,limitAmps:24,branches:{B1:16,B2:16},outlets:Array.from({length:8},(_,i)=>({n:i+1,connectors:['C13'],limitAmps:10,branch:i<4?'B1':'B2',phase:'L1'}))}));
 const equipment:FeedEquipment[]=supplies.map(p=>({id:p.id,name:p.id,category:'pdu',rawData:{electricalProfile:p},details:{feed:p.feed}}));
 const inputs:FeedInputs={headroomPercent:0,budgets:{}};
 function add(id:string,watts=400,cords=2){equipment.push({id,name:id,category:'server',startRU:equipment.length,details:{},rawData:{}});inputs.budgets[id]={watts,pf:1,cords,minimumCords:Math.floor(cords/2)||1,connector:'C13',minVoltage:100,maxVoltage:240,psuAcCapacity:2000,cordLimitAmps:10};}
 add('server');return {equipment,inputs,supplies,add};
}

test('all shared entry points mirror a saved higher-numbered outlet without moving the saved cord',()=>{
 const f=fixture(),saved={deviceId:'server',inlet:1,pduId:'B',outlet:6};
 const e=withCables(f.equipment,[saved]),before=structuredClone(e);
 for(const p of [balanceFeeds(e,f.inputs),simplePowerPlan(e,{feedPower:f.inputs}),powerWiringGuide(e,{feedPower:f.inputs})]){
  assert.equal(p.error,undefined);assert.deepEqual(p.assignments,[saved,{deviceId:'server',inlet:2,pduId:'A',outlet:6}]);
 }
 assert.deepEqual(e,before);
});

for(const problem of ['occupied','reserved','outlet limit','branch limit'] as const)test(`mirroring exception explains ${problem} and keeps the complete plan valid`,()=>{
 const f=fixture(),saved=[{deviceId:'server',inlet:1,pduId:'B',outlet:6}];
 if(problem==='occupied'){f.add('other',100,1);saved.push({deviceId:'other',inlet:1,pduId:'A',outlet:6});}
 if(problem==='reserved')f.supplies[0].outlets[5].reserved=true;
 if(problem==='outlet limit')f.supplies[0].outlets[5].limitAmps=.1;
 if(problem==='branch limit')f.supplies[0].branches!.B2=.1;
 const e=withCables(f.equipment,saved),p=balanceFeeds(e,f.inputs,{planning:true});
 assert.equal(p.error,undefined);assert.ok(p.analysis.scenarios.every(s=>!s.errors.length));
 assert.notEqual(p.assignments.find(c=>c.deviceId==='server'&&c.inlet===2)!.outlet,6);
 for(const c of saved)assert.deepEqual(p.assignments.find(v=>v.deviceId===c.deviceId&&v.inlet===c.inlet),c);
 const note=p.deviations.find(d=>d.mirrorException);assert.ok(note);assert.match(note.reason,/P6 could not be mirrored/);
 assert.match(renderToStaticMarkup(<PowerAssignmentNotes equipment={e} deviations={p.deviations} limitations={[]}/>),/P6 could not be mirrored/);
});

test('different outlet maps are not treated as equivalent numbered mirrors',()=>{
 const f=fixture();f.supplies[0].outlets[5].connectors=['C19'];
 const p=balanceFeeds(withCables(f.equipment,[{deviceId:'server',inlet:1,pduId:'B',outlet:6}]),f.inputs);
 assert.equal(p.error,undefined);assert.notEqual(p.assignments.find(c=>c.inlet===2)!.outlet,6);
 assert.ok(p.decisions.every(d=>!d.reason.includes('P6 mirrors')));
});

test('a later load that cannot fit causes a full retry without mirroring, not a false capacity failure',()=>{
 const f=fixture();f.inputs.budgets.server.watts=200;f.inputs.budgets.server.connector='C19';
 f.add('upper',1800);f.add('fixed',400,1);f.equipment.find(e=>e.id==='upper')!.startRU=10;
 for(const p of f.supplies){p.branches={B1:p.id==='A'?10:24,B2:16};p.outlets.forEach(o=>{o.branch='B1';o.limitAmps=16;});p.outlets[0].connectors=['C13','C19'];p.outlets[1].connectors=['C19'];p.outlets[1].branch='B2';}
 const saved=[{deviceId:'server',inlet:1,pduId:'B',outlet:1},{deviceId:'upper',inlet:1,pduId:'B',outlet:3},{deviceId:'fixed',inlet:1,pduId:'A',outlet:3}];
 const p=balanceFeeds(withCables(f.equipment,saved),f.inputs,{planning:true});
 assert.equal(p.error,undefined);assert.ok(p.analysis.scenarios.every(s=>!s.errors.length));
 assert.equal(p.assignments.find(c=>c.deviceId==='server'&&c.inlet===2)!.outlet,2);
 assert.ok(p.deviations.some(d=>d.deviceId==='server'&&d.mirrorException));
});

test('twelve-input systems mirror outlet sets while retaining every physical input identity',()=>{
 const f=b300PowerFixture(),p=balanceFeeds(f.equipment,f.inputs);
 assert.equal(p.error,undefined);assert.ok(p.analysis.scenarios.every(s=>!s.errors.length));
 assert.deepEqual(p.assignments.filter(c=>c.pduId==='pdu-a').map(c=>c.outlet).sort(),p.assignments.filter(c=>c.pduId==='pdu-b').map(c=>c.outlet).sort());
 assert.equal(new Set(p.assignments.map(c=>c.inlet)).size,12);assert.ok(p.assignments.every(c=>c.inputIdentity==='b300-module-input-v1'));
});

test('fully saved asymmetric layouts remain unchanged until explicitly recalculated',()=>{
 const f=fixture(),saved=[{deviceId:'server',inlet:1,pduId:'A',outlet:1},{deviceId:'server',inlet:2,pduId:'B',outlet:6}];
 const p=balanceFeeds(withCables(f.equipment,saved),f.inputs);assert.equal(p.error,undefined);assert.deepEqual(p.assignments,saved);
});

test('an approved saved-layout conversion retains each physical input on its original PDU',()=>{
 const f=b300PowerFixture(),saved=balanceFeeds(f.equipment,f.inputs).assignments;
 const e=withCables(f.equipment,saved);
 for(const p of e.filter(d=>d.category==='pdu'))for(const a of Object.values((p.details as {outlets:Record<string,{locked:boolean}>}).outlets))a.locked=false;
 const p=balanceFeeds(e,f.inputs,{retainPduForSavedInputs:true});assert.equal(p.error,undefined);
 for(const c of saved){const next=p.assignments.find(d=>d.deviceId===c.deviceId&&d.inlet===c.inlet)!;assert.equal(next.pduId,c.pduId);assert.equal(next.inputIdentity,c.inputIdentity);}
});
