import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pduFeed,pduNumber,pduPositionItems,pduPlacementRevision,preparePduPlacement,swapPduSides,movePduInDraft} from '../lib/pdu-placement';
import {fourPsuPlanFixture} from './fixtures/four-psu-plan';
import {individualEquipment} from './fixtures/individual-power';
import {actionHarness} from './helpers/action-harness';
import {feedRack,readFeedInputs} from '../lib/feed-rack';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {readRackConfig} from '../lib/rack-config';
import {RackGrid} from '../app/projects/[id]/racks/[rackId]/physical-rack-grid';
import {RackOverview3D} from '../app/projects/[id]/racks/[rackId]/rack-overview-3d';
import {analyzePx3,readPx3Settings} from '../lib/px3-power';
import {PX3_4068_ID} from '../lib/pdu-models';
import {detailsObject} from '../lib/equipment-details';

function fixture(){
  const f=fourPsuPlanFixture();
  const rack={...f.rack,configuration:{...f.rack.configuration,pduPairs:2}};
  for(const d of rack.devices){if(d.id==='a2'||d.id==='b2')d.mounting+='-2';}
  return rack;
}
test('four-PDU side swap is atomic, retains identities, wires, settings and unknown metadata',async()=>{
  const rack=fixture(),before=structuredClone(rack),h=await actionHarness({rack});
  const revision=pduPlacementRevision(rack.devices,rack.configuration),positions=swapPduSides(pduPositionItems(rack.devices,rack.configuration));
  assert.deepEqual(await h.actions.savePduPlacement(rack.id,positions,revision),{ok:true});
  assert.equal(h.updates.length,4);assert.equal(h.rackUpdates.length,0);assert.equal(h.deletions.length,0);
  assert.equal(h.events[0],`rackMutation:${rack.id}`);
  for(const update of h.updates){
    const old=before.devices.find(d=>d.id===update.where.id)!;
    assert.deepEqual(update.data,{mounting:positions.find(p=>p.id===old.id)!.mounting,details:{...detailsObject(old.details),feed:pduFeed(old,before.configuration),pduNumber:pduNumber(old)}});
  }
  const after=h.snapshot() as unknown as typeof rack;
  assert.deepEqual(after.configuration,before.configuration);
  assert.deepEqual(feedRack(individualEquipment(after),readFeedInputs(after.configuration)),feedRack(individualEquipment(before),readFeedInputs(before.configuration)));
  const planBefore=simplePowerPlan(individualEquipment(before),before.configuration),planAfter=simplePowerPlan(individualEquipment(after),after.configuration);
  assert.equal(planBefore.error,undefined);assert.equal(planAfter.error,undefined);
  assert.deepEqual(planAfter.assignments,planBefore.assignments);assert.deepEqual(planAfter.analysis,planBefore.analysis);
  assert.notEqual(planAfter.revision,planBefore.revision,'old proposed layouts must require recalculation');
});
test('individual moves exchange occupied slots and preserve A1/A2 identity after mixed-side moves',()=>{
  const rack=fixture(),items=pduPositionItems(rack.devices,rack.configuration),revision=pduPlacementRevision(rack.devices,rack.configuration);
  const positions=movePduInDraft(items,'a1','rear-left-2');
  assert.equal(positions.find(p=>p.id==='b2')!.mounting,'rear-right');
  const plan=preparePduPlacement(rack.devices,rack.configuration,positions,revision);assert.ok('updates' in plan);
  for(const update of plan.updates){const d=rack.devices.find(d=>d.id===update.id)!;Object.assign(d,update);}
  assert.equal(pduFeed(rack.devices.find(d=>d.id==='a1')!),'A');assert.equal(pduNumber(rack.devices.find(d=>d.id==='a1')!),1);
  assert.equal(pduFeed(rack.devices.find(d=>d.id==='b2')!),'B');assert.equal(pduNumber(rack.devices.find(d=>d.id==='b2')!),2);
  const html=renderToStaticMarkup(createElement(RackGrid,{heightRU:42,config:readRackConfig(rack.configuration),devices:rack.devices,rear:true,disabled:true}));
  assert.match(html,/data-mounting="rear-left-2" class="physical-pdu pdu-A[^]*?physical-pdu-title">PDU-A1</);
  assert.match(html,/data-mounting="rear-right" class="physical-pdu pdu-B[^]*?physical-pdu-title">PDU-B2</);
});
test('invalid, incomplete, disabled and stale placements never write, and a no-op creates no device writes',async()=>{
  const rack=fixture(),revision=pduPlacementRevision(rack.devices,rack.configuration),items=pduPositionItems(rack.devices,rack.configuration);
  const proposals=[items.slice(1),items.map(p=>({...p,mounting:'rear-left'})),items.map((p,i)=>i===0?{...p,id:'foreign-device'}:p),items.map((p,i)=>i===0?{...p,mounting:'front'}:p)];
  for(const positions of proposals){const h=await actionHarness({rack});assert.equal((await h.actions.savePduPlacement(rack.id,positions,revision)).ok,false);assert.equal(h.updates.length,0);}
  const h=await actionHarness({rack});assert.equal((await h.actions.savePduPlacement(rack.id,swapPduSides(items),'stale')).ok,false);assert.equal(h.updates.length,0);
  assert.equal((await h.actions.savePduPlacement(rack.id,items,revision)).ok,true);assert.equal(h.updates.length,0);
  const disabled={...rack.configuration,pduB:false},blocked=preparePduPlacement(rack.devices,disabled,swapPduSides(items),pduPlacementRevision(rack.devices,disabled));assert.ok('error' in blocked);
});
test('two-PDU legacy feeds and explicit configured feeds survive existing drag moves',async()=>{
  const rack=fixture();rack.devices=rack.devices.filter(d=>!['a2','b2'].includes(d.id));
  const a=rack.devices.find(d=>d.id==='a1')!;a.details={outlets:{},whip:'down',future:{keep:true}} as typeof a.details;
  const h=await actionHarness({rack});assert.equal((await h.actions.moveDevice(rack.id,a.id,1,'rear-left-2')).ok,true);
  const moved=(h.snapshot() as unknown as typeof rack).devices.find(d=>d.id===a.id)!;
  assert.equal(pduFeed(moved),'A');assert.equal(pduNumber(moved),1);assert.deepEqual(moved.details,{...detailsObject(a.details),feed:'A',pduNumber:1});
  const configuration={...rack.configuration,feedPower:{...rack.configuration.feedPower,supplies:{a1:{feed:'B'}}}};
  assert.equal(pduFeed(a,configuration),'B');
  const result=preparePduPlacement(rack.devices,configuration,swapPduSides(pduPositionItems(rack.devices,configuration)),pduPlacementRevision(rack.devices,configuration));assert.ok('updates' in result);assert.equal(result.updates.find(p=>p.id==='a1')!.details.feed,'B');
});
test('Raritan planner, labels and 3D feed colors follow electrical identity after a side swap',()=>{
  const rack=fixture(),devices=rack.devices.filter(d=>['a1','b1'].includes(d.id)).map(d=>({...d,catalogDevice:{...d.catalogDevice,pduModel:PX3_4068_ID}}));
  const equipment=devices.map(d=>({id:d.id,name:d.label||d.catalogDevice.model,model:'PX3-4068YV-V2',mounting:d.mounting,category:'pdu',rawData:{model:'PX3-4068YV-V2'},details:{feed:pduFeed(d)}}));
  const before=analyzePx3(equipment,readPx3Settings({}));
  const moved=equipment.map(d=>({...d,mounting:d.mounting.includes('left')?'rear-right':'rear-left'}));
  const after=analyzePx3(moved,readPx3Settings({}));assert.deepEqual(after,before);
  const sameFeed=analyzePx3(moved.map(d=>({...d,details:{feed:'B'}})),readPx3Settings({}));
  assert.ok(sameFeed.issues.some(i=>i.message.includes('independent feed B')),'two physical sides must not masquerade as independent feeds');
  devices[0].mounting='rear-left';devices[1].mounting='rear-right';
  const html=renderToStaticMarkup(createElement(RackOverview3D,{heightRU:42,config:readRackConfig({}),devices,onEdit(){}}));
  assert.match(html,/rack3-pdu-facing-right rack3-raritan-A/);assert.match(html,/rack3-pdu-facing-left rack3-raritan-B/);
});

test('every four-rail permutation preserves electrical modeling and cannot relabel an unknown configured feed',()=>{
  const rack=fixture(),items=pduPositionItems(rack.devices,rack.configuration),revision=pduPlacementRevision(rack.devices,rack.configuration);
  const before=feedRack(individualEquipment(rack),readFeedInputs(rack.configuration));
  function permutations(xs:string[]):string[][]{return xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(rest=>[x,...rest])):[[]];}
  for(const positions of permutations(items.map(p=>p.mounting))){
    const plan=preparePduPlacement(rack.devices,rack.configuration,items.map((p,i)=>({id:p.id,mounting:positions[i]})),revision);assert.ok('updates' in plan);
    const moved={...rack,devices:rack.devices.map(d=>({...d,...plan.updates.find(p=>p.id===d.id)}))};
    assert.deepEqual(feedRack(individualEquipment(moved),readFeedInputs(moved.configuration)),before);
  }
  const unknown={...rack.configuration,feedPower:{...rack.configuration.feedPower,supplies:{a1:{feed:null}}}};
  assert.equal(pduFeed(items[0],unknown),undefined);
  const rejected=preparePduPlacement(rack.devices,unknown,swapPduSides(items),pduPlacementRevision(rack.devices,unknown));assert.ok('error' in rejected);
  assert.equal(pduFeed({mounting:'rear-left',pduFeed:null}),undefined);
});
