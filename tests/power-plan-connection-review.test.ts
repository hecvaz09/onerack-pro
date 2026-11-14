import test from 'node:test';
import assert from 'node:assert/strict';
import {fourPsuPlanFixture} from './fixtures/four-psu-plan';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {powerPlanConnectionReview} from '../lib/power-plan-connection-review';
import {powerCapacityReview} from '../lib/power-capacity-review';
import {feedRack,readFeedInputs} from '../lib/feed-rack';
import {psuConnectionStatuses} from '../lib/psu-connection-status';
import {actionHarness} from './helpers/action-harness';
import {individualEquipment} from './fixtures/individual-power';

test('selected four-PSU proposal uses the full layout, while an isolated input still exceeds its real limit',()=>{
 const f=fourPsuPlanFixture(),before=structuredClone(f.equipment),plan=simplePowerPlan(f.equipment,f.rack.configuration);
 assert.equal(plan.error,undefined);assert.equal(plan.remaining.length,5);
 const candidate=plan.remaining.find(c=>c.deviceId==='server')!;
 const single=powerCapacityReview(f.equipment,f.rack.configuration,candidate)!;
 assert.equal(single.primary.amps.toFixed(2),'20.17');assert.equal(single.primary.limit,16);
 assert.equal(single.devices.find(d=>d.id==='server')?.assignedInputs,1);
 const complete=powerPlanConnectionReview(f.equipment,f.rack.configuration,plan,plan.revision,candidate)!;
 assert.equal(complete.inputs,4);assert.equal(complete.A,2);assert.equal(complete.B,2);
 assert.equal(complete.scenarios[0].amps.toFixed(2),'5.04');
 assert.equal(complete.scenarios.find(s=>s.lost&&s.online)!.amps.toFixed(2),'10.09');
 assert.deepEqual(f.equipment,before);assert.ok(Object.values(psuConnectionStatuses(f.equipment,f.rack.configuration).server).every(s=>s.state==='off'));
 assert.ok(plan.analysis.scenarios.every(s=>s.errors.length===0));
});
test('unreviewed, stale, alternate and invalid layouts cannot borrow complete-plan validation',()=>{
 const f=fourPsuPlanFixture(),plan=simplePowerPlan(f.equipment,f.rack.configuration),candidate=plan.remaining.find(c=>c.deviceId==='server')!;
 const review=(revision:string|null,c=candidate,p=plan)=>powerPlanConnectionReview(f.equipment,f.rack.configuration,p,revision,c);
 assert.equal(review(null),undefined);assert.equal(review('stale'),undefined);
 assert.equal(review(plan.revision,{...candidate,outlet:999}),undefined);
 assert.equal(review(plan.revision,{...candidate,inputIdentity:'b300-module-input-v1'}),undefined);
 assert.equal(review(plan.revision,candidate,{...plan,error:'Overload'}),undefined);
 const changed=structuredClone(plan);changed.analysis.scenarios[0].errors.push('Known capacity violation');assert.equal(review(plan.revision,candidate,changed),undefined);
});
test('the existing bulk action saves every reviewed input and rejects isolated or stale saves',async()=>{
 const f=fourPsuPlanFixture(),equipment=individualEquipment(f.rack).map(e=>({...e,name:`${e.name} · U${e.startRU}`})),plan=simplePowerPlan(equipment,f.rack.configuration),h=await actionHarness({rack:f.rack});
 const c=plan.remaining.find(c=>c.deviceId==='server')!;
 assert.ok((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true)).error);assert.equal(h.updates.length,0);
 assert.equal((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).ok,true);
 const saved=h.snapshot() as typeof f.rack,e=individualEquipment(saved);
 assert.equal(feedRack(e,readFeedInputs(saved.configuration,e)).cords.length,6);
 assert.ok(Object.values(psuConnectionStatuses(e,saved.configuration).server).every(s=>s.state==='connected'));
 assert.deepEqual(saved.configuration,f.rack.configuration);assert.equal(h.rackUpdates.length,0);
 const writeCount=h.updates.length;assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).error);assert.equal(h.updates.length,writeCount);
});
test('known full-layout overloads stay blocked before any write',async()=>{
 const f=fourPsuPlanFixture();f.inputs.budgets.server.watts=50000;
 const e=individualEquipment(f.rack).map(d=>({...d,name:`${d.name} · U${d.startRU}`})),plan=simplePowerPlan(e,f.rack.configuration),h=await actionHarness({rack:f.rack});
 assert.ok(plan.error);assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).error);assert.equal(h.updates.length,0);
});
