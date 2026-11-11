import test from 'node:test';
import assert from 'node:assert/strict';
import {individualPowerFixture,individualEquipment} from './fixtures/individual-power';
import {individualPowerReview} from '../lib/individual-power-review';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {psuConnectionStatuses} from '../lib/psu-connection-status';
import {readDetails} from '../lib/equipment-details';
import type {Supply} from '../lib/feed-power';
import {actionHarness} from './helpers/action-harness';

test('manual outlet planning survives unrelated missing demand and unknown APC-style bank ratings; automatic balance still waits',async()=>{
 const f=individualPowerFixture(),{cord:c}=f;
 assert.ok(simplePowerPlan(f.equipment,f.rack.configuration).error);
 const review=individualPowerReview(f.equipment,f.rack.configuration,c);
 assert.deepEqual(review.errors,[]);assert.equal(review.planning,true);
 assert.ok(review.pendingChecks.some(s=>s.includes('branch mapping')));
 assert.ok(!review.pendingChecks.some(s=>s.includes('watts')),'unconnected devices are outside this individual check');
 const h=await actionHarness({rack:f.rack});
 assert.ok((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,false)).error);assert.equal(h.updates.length,0);
 assert.equal((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true)).ok,true);
 const after=h.snapshot() as typeof f.rack,updated=individualEquipment(after);
 assert.deepEqual(after.configuration,f.rack.configuration);
 assert.deepEqual((after.devices[0].details as {future:unknown}).future,{keep:true});
 assert.equal(readDetails(after.devices[0].details).outlets[1].locked,true);
 const states=psuConnectionStatuses(updated,after.configuration).server;
 assert.equal(states[1].state,'pending');assert.equal(states[2].state,'off');
 assert.ok((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true)).error);
 assert.equal(h.updates.length,1);
 assert.equal((await h.visual.disconnectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet)).ok,true);
 const cleared=h.snapshot() as typeof f.rack;
 assert.equal(psuConnectionStatuses(individualEquipment(cleared),cleared.configuration).server[1].state,'off');
 assert.ok(simplePowerPlan(updated,after.configuration).error,'saving a draft must not approve automatic balancing');
});

test('same display names do not pull unrelated missing settings into a checked connection',async()=>{
 const f=individualPowerFixture(false),c=f.cord;
 assert.deepEqual(individualPowerReview(f.equipment,f.rack.configuration,c),{errors:[],pendingChecks:[],planning:false});
 const h=await actionHarness({rack:f.rack});
 assert.equal((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet)).ok,true);
 const after=h.snapshot() as typeof f.rack;
 assert.equal(psuConnectionStatuses(individualEquipment(after),after.configuration).server[1].state,'connected');
});

test('other saved demand on the selected PDU is included; unknown co-loads prevent green status',()=>{
 const f=individualPowerFixture(false),c=f.cord;
 f.rack.devices[0].details={outlets:{2:{deviceId:'missing-0',inlet:1,notes:''}}};
 let review=individualPowerReview(individualEquipment(f.rack),f.rack.configuration,c);
 assert.equal(review.planning,true);assert.ok(review.pendingChecks.some(s=>s.includes('watts')));
 f.inputs.budgets['missing-0']={...f.inputs.budgets.server,watts:5000};
 review=individualPowerReview(individualEquipment(f.rack),f.rack.configuration,c);
 assert.ok(review.errors.some(s=>s.includes('exceeds')||s.includes('overloaded')));
});

test('planning never bypasses known endpoint, voltage, PSU, outlet, branch or supply failures',async()=>{
 const mutations:((f:ReturnType<typeof individualPowerFixture>,p:Supply)=>void)[]=[
  f=>{f.inputs.budgets.server.connector='C19';},
  f=>{f.inputs.budgets.server.minVoltage=230;},
  f=>{f.inputs.budgets.server.psuAcCapacity=100;},
  f=>{f.inputs.budgets.server.cordLimitAmps=.1;},
  (_,p)=>{p.outlets[0].limitAmps=.1;},
  (_,p)=>{p.branches!.B1=.1;},
  (_,p)=>{p.limitAmps=.1;},
  (_,p)=>{p.outlets[0].reserved=true;},
  f=>{f.inputs.headroomPercent=-1;},
  f=>{f.rack.devices[1].details={outlets:{2:{deviceId:'server',inlet:1,notes:''}}};},
  f=>{f.rack.devices[0].details={outlets:{1:{deviceId:'missing-0',inlet:1,notes:''}}};},
 ];
 for(const mutate of mutations){
  const f=individualPowerFixture(false),c=f.cord,p=(f.rack.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile;mutate(f,p);
  const h=await actionHarness({rack:f.rack});
  assert.ok((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true)).error,String(mutate));assert.equal(h.updates.length,0);
 }
});

test('a changed supply limit marks an already-saved planning connection red',async()=>{
 const f=individualPowerFixture(),c=f.cord,h=await actionHarness({rack:f.rack});
 await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true);
 const after=h.snapshot() as typeof f.rack;
 (after.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile.limitAmps=.1;
 assert.equal(psuConnectionStatuses(individualEquipment(after),after.configuration).server[1].state,'issue');
});
