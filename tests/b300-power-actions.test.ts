import test from 'node:test';
import assert from 'node:assert/strict';
import {actionHarness} from './helpers/action-harness';
import {b300PowerFixture,withCables} from './fixtures/b300-power';
import {B300_INPUT_IDENTITY} from '../lib/b300-power-inputs';
import {balanceFeeds,feedRevision} from '../lib/feed-balance';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {analyzeFeeds} from '../lib/feed-power';
import {readDetails} from '../lib/equipment-details';
import {powerInputsRevision} from '../lib/power-input-revision';
const equipment=(rack:ReturnType<typeof b300PowerFixture>['rack']):FeedEquipment[]=>rack.devices.map(d=>({id:d.id,name:`${d.label} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));

test('actual visual save callbacks record all twelve distinct inputs, reload correctly and preserve PDU metadata/configuration',async()=>{
 const f=b300PowerFixture(),h=await actionHarness({rack:f.rack}),plan=balanceFeeds(f.equipment,f.inputs);assert.equal(plan.error,undefined);
 for(const c of [...plan.assignments].sort((a,b)=>b.inlet-a.inlet)){const result=await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet);assert.ok('ok' in result&&result.ok,JSON.stringify(result));}
 const rack=h.snapshot() as typeof f.rack;const e=equipment(rack),model=feedRack(e,f.inputs);assert.equal(model.cords.length,12);assert.ok(model.cords.every(c=>c.inputIdentity===B300_INPUT_IDENTITY));assert.equal(analyzeFeeds(model.supplies,model.loads,model.cords).ready,true);
 for(const d of rack.devices.filter(d=>d.catalogDevice.category==='pdu')){const details=d.details as Record<string,unknown>;assert.equal(details.whip,'down');assert.deepEqual(details.future,{keep:true});assert.deepEqual(details.nodes,{});}
 assert.deepEqual(rack.configuration,f.rack.configuration);assert.equal(h.rackUpdates.length,0);assert.equal(h.updates.length,12);
});
test('duplicate visual save and stale clear are rejected without overwriting a saved endpoint',async()=>{
 const f=b300PowerFixture(),h=await actionHarness({rack:f.rack}),plan=balanceFeeds(f.equipment,f.inputs),c=plan.assignments[11];
 assert.equal((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,12)).ok,true);
 const before=h.snapshot(),writes=h.updates.length;
 assert.ok((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,12)).error);
 assert.ok((await h.visual.disconnectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,11)).error);
 assert.equal(h.updates.length,writes);assert.deepEqual(h.snapshot(),before);
 assert.equal((await h.visual.disconnectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,12)).ok,true);
 assert.equal(Object.keys(readDetails((h.snapshot() as typeof f.rack).devices.find(d=>d.id===c.pduId)!.details).outlets).length,0);
});
test('actual manual outlet save accepts physical input 12 and rejects invalid or duplicate input identities',async()=>{
 const f=b300PowerFixture(),h=await actionHarness({rack:f.rack}),c=balanceFeeds(f.equipment,f.inputs).assignments[11];
 assert.equal((await h.actions.saveOutlet(f.rack.id,c.pduId,c.outlet,'b300','keep note',12)).ok,true);
 const saved=readDetails((h.snapshot() as typeof f.rack).devices.find(d=>d.id===c.pduId)!.details).outlets[c.outlet];assert.equal(saved.inputIdentity,B300_INPUT_IDENTITY);assert.equal(saved.notes,'keep note');
 const writes=h.updates.length;
 for(const n of [0,13])assert.equal((await h.actions.saveOutlet(f.rack.id,'pdu-a',12,'b300','',n)).ok,false);
 assert.equal((await h.actions.saveOutlet(f.rack.id,c.pduId,1,'b300','',12)).ok,false);assert.equal(h.updates.length,writes);
});
test('actual bulk apply saves exact input identities and preserves future metadata and unrelated wiring',async()=>{
 const f=b300PowerFixture(),h=await actionHarness({rack:f.rack});
 const result=await h.feed.applyFeedBalance(f.rack.id,feedRevision(equipment(f.rack),f.inputs));assert.ok('ok' in result&&result.ok,JSON.stringify(result));
 const rack=h.snapshot() as typeof f.rack,model=feedRack(equipment(rack),f.inputs);assert.equal(model.cords.length,12);assert.ok(model.cords.every(c=>c.inputIdentity===B300_INPUT_IDENTITY));
 for(const d of rack.devices.filter(d=>d.catalogDevice.category==='pdu'))assert.deepEqual((d.details as Record<string,unknown>).future,{keep:true});
 assert.equal(h.rackUpdates.length,0);assert.deepEqual(rack.configuration,f.rack.configuration);
});
test('input save revision protection includes connection changes; stale input budgets cannot overwrite current saved state',async()=>{
 const f=b300PowerFixture(),h=await actionHarness({rack:f.rack});const revision=powerInputsRevision(f.rack.id,f.rack),c=balanceFeeds(f.equipment,f.inputs).assignments[0];
 assert.equal((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet)).ok,true);
 const result=await h.feed.saveFeedInputs(f.rack.id,{...f.inputs,headroomPercent:20},revision);assert.ok('error' in result);assert.equal(result.conflict,true);assert.equal(h.rackUpdates.length,0);
});
test('removed devices, known overloads and legacy ambiguous wiring cannot produce a successful visual save',async()=>{
 const f=b300PowerFixture(),c=balanceFeeds(f.equipment,f.inputs).assignments[11];
 const missing=await actionHarness({rack:{...f.rack,devices:f.rack.devices.filter(d=>d.id!=='b300')}});assert.ok((await missing.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,'b300',12)).error);assert.equal(missing.updates.length,0);
 f.inputs.budgets.b300.watts=100000;const overloaded=await actionHarness({rack:f.rack});assert.ok((await overloaded.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,'b300',12)).error);assert.equal(overloaded.updates.length,0);
 const clean=b300PowerFixture(),old=withCables(clean.equipment,[{...balanceFeeds(clean.equipment,clean.inputs).assignments[0],inputIdentity:undefined}]);for(const device of clean.rack.devices)device.details=old.find(d=>d.id===device.id)!.details;
 const legacy=await actionHarness({rack:clean.rack});assert.ok((await legacy.visual.connectVisualPower(clean.rack.id,'pdu-b',1,'b300',12)).error);assert.equal(legacy.updates.length,0);
});
