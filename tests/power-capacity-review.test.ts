import test from 'node:test';
import assert from 'node:assert/strict';
import {powerCapacityReview} from '../lib/power-capacity-review';
import {individualPowerReview} from '../lib/individual-power-review';
import {powerCapacityFixture} from './fixtures/power-capacity';
import {individualEquipment} from './fixtures/individual-power';
import {actionHarness} from './helpers/action-harness';
import type {Supply} from '../lib/feed-power';

test('ninth 556 W server reproduces 26.73 A failover without counting two PSUs as two systems',async()=>{
 const f=powerCapacityFixture(),before=structuredClone(f.rack);
 const review=powerCapacityReview(f.equipment,f.rack.configuration,f.cord)!;
 assert.equal(review.title,'Failover capacity exceeded');assert.equal(review.primary.lost,'B');
 assert.equal(review.primary.amps.toFixed(2),'26.73');assert.equal(review.primary.limit,24);
 assert.equal(review.scenarios[0].beforeAmps.toFixed(2),'11.88');assert.equal(review.scenarios[0].amps.toFixed(2),'14.85');
 assert.equal(review.scenarios[2].beforeAmps.toFixed(2),'23.76');assert.equal(review.scenarios[2].watts,9*556);
 assert.equal(review.scenarios[1].online,false);assert.equal(review.devices.length,9);
 assert.deepEqual(f.rack,before);
 const h=await actionHarness({rack:f.rack});
 assert.match((await h.visual.connectVisualPower(f.rack.id,'pdu-a',9,'server-9',1,true)).error!,/exceeds 24 A/);
 assert.equal(h.updates.length,0,'capacity review must not permit an overload even as a planning save');
});

test('same-PDU outlet changes do not remove input overload; normal overload is labelled separately',()=>{
 const f=powerCapacityFixture();
 const a=powerCapacityReview(f.equipment,f.rack.configuration,f.cord)!;
 const b=powerCapacityReview(f.equipment,f.rack.configuration,{...f.cord,outlet:13})!;
 assert.equal(a.primary.amps,b.primary.amps);
 Object.values(f.inputs.budgets).forEach(d=>{d.watts=1200;});
 const normal=powerCapacityReview(f.equipment,f.rack.configuration,f.cord)!;
 assert.equal(normal.primary.lost,null);assert.equal(normal.action,'Review PDU capacity');
});

test('bank overload is distinguished from input capacity and another bank can resolve it',()=>{
 const f=powerCapacityFixture();Object.values(f.inputs.budgets).forEach(d=>{d.watts=300;});
 (f.rack.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile.branches!.B1=7;
 f.equipment=individualEquipment(f.rack);
 const review=powerCapacityReview(f.equipment,f.rack.configuration,f.cord)!;
 assert.ok(review.breaches.every(b=>b.scope==='branch'));assert.equal(review.primary.label,'Bank B1');
 assert.equal(powerCapacityReview(f.equipment,f.rack.configuration,{...f.cord,outlet:13}),undefined);
 assert.deepEqual(individualPowerReview(f.equipment,f.rack.configuration,{...f.cord,outlet:13}).errors,[]);
});

test('three-phase review uses highest line current, and same-name PDUs retain distinct identities',()=>{
 const f=powerCapacityFixture();
 const p=(f.rack.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile;
 p.topology='three-phase-wye';p.voltage=400;p.limitAmps=11;
 p.outlets.forEach(o=>{o.phase=o.branch==='B1'?'L1':'L2';});
 f.equipment=individualEquipment(f.rack);
 const review=powerCapacityReview(f.equipment,f.rack.configuration,f.cord)!;
 assert.equal(review.supply.id,'pdu-a');assert.match(review.primary.label,/highest line/);
 assert.equal(review.primary.amps.toFixed(2),(5*556/.9/(400/Math.sqrt(3))).toFixed(2));
 const other=powerCapacityReview(f.equipment,f.rack.configuration,{...f.cord,pduId:'pdu-b',inlet:2})!;
 assert.equal(other.supply.id,'pdu-b');assert.equal(other.primary.limit,24);assert.equal(other.primary.lost,'A');
});
