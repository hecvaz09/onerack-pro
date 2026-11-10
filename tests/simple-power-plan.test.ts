import test from 'node:test';
import assert from 'node:assert/strict';
import {simplePowerPlan,missingPowerEstimates,nextPowerQuestion} from '../lib/simple-power-plan';
import {balanceFeeds} from '../lib/feed-balance';
import {readDetails} from '../lib/equipment-details';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {actionHarness} from './helpers/action-harness';
import {b300PowerFixture,withCables} from './fixtures/b300-power';

const equipment=(rack:ReturnType<typeof b300PowerFixture>['rack']):FeedEquipment[]=>rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));

test('bulk save applies all twelve reviewed inputs, acknowledges committed PDU details, and preserves metadata',async()=>{
 const f=b300PowerFixture(),e=equipment(f.rack),plan=simplePowerPlan(e,f.rack.configuration),h=await actionHarness({rack:f.rack});
 assert.equal(plan.error,undefined);assert.equal(plan.remaining.length,12);
 const result=await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false);
 assert.equal(result.ok,true);assert.equal(result.count,12);assert.equal(result.updates?.length,2);
 const after=h.snapshot() as typeof f.rack;
 assert.equal(feedRack(equipment(after),f.inputs).cords.length,12);
 for(const pdu of after.devices.filter(d=>d.catalogDevice.category==='pdu')){
  assert.deepEqual((pdu.details as Record<string,unknown>).future,{keep:true});
  assert.equal((pdu.details as Record<string,unknown>).whip,'down');
 }
 assert.deepEqual(after.configuration,f.rack.configuration);assert.equal(h.rackUpdates.length,0);
 assert.equal(simplePowerPlan(equipment(after),after.configuration).remaining.length,0);
 const duplicate=await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false);
 assert.ok(duplicate.error?.includes('changed'));assert.equal(h.updates.length,2);
});

test('planning estimates require explicit planning save; strict electrical approval is unchanged',async()=>{
 const f=b300PowerFixture();f.inputs.budgets.b300.estimateSource='Synthetic estimated demand; not measured.';
 f.rack.configuration={...f.rack.configuration,feedPower:f.inputs};
 const e=equipment(f.rack),plan=simplePowerPlan(e,f.rack.configuration),h=await actionHarness({rack:f.rack});
 assert.equal(plan.error,undefined);assert.equal(plan.planning,true);
 assert.ok(balanceFeeds(e,f.inputs).error);
 assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false)).error);assert.equal(h.updates.length,0);
 assert.equal((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).ok,true);
 const after=h.snapshot() as typeof f.rack;
 for(const pdu of after.devices.filter(d=>d.catalogDevice.category==='pdu'))for(const a of Object.values(readDetails(pdu.details).outlets))assert.match(a.notes,/Planning draft:/);
});

test('saved auto or manual cords are fixed, including unknown assignment metadata',()=>{
 const f=b300PowerFixture(),first=simplePowerPlan(f.equipment,{feedPower:f.inputs}).assignments[0];
 const e=withCables(f.equipment,[first]);
 const pdu=e.find(d=>d.id===first.pduId)!;
 const details=pdu.details as {outlets:Record<number,Record<string,unknown>>};details.outlets[first.outlet].locked=false;details.outlets[first.outlet].futureAssignment={keep:true};
 const before=structuredClone(e),plan=simplePowerPlan(e,{feedPower:f.inputs});
 assert.equal(plan.error,undefined);assert.equal(plan.remaining.length,11);assert.ok(plan.assignments.some(c=>JSON.stringify(c)===JSON.stringify(first)));assert.deepEqual(e,before);
});

test('missing Library estimates never replace selected demand or infer electrical limits',()=>{
 const f=b300PowerFixture(),record={version:1,status:'verified',description:'',sourceUrl:'',notes:'',custom:[],components:[{id:'psu',kind:'psu',manufacturer:'Supermicro',model:'PWS-504P-1R',quantity:2,attributes:{outputWatts:'500'},notes:''}]};
 const e:FeedEquipment[]=[{id:'server',name:'SYS-510P-WTR',model:'SYS-510P-WTR',category:'chassis',rawData:{systemSpecs:record},details:{}}];
 const original={headroomPercent:0,budgets:{}};const next=missingPowerEstimates(e,original);
 assert.equal(next.changes.length,1);assert.equal(next.inputs.budgets.server.watts,556);assert.ok(next.inputs.budgets.server.estimateSource);
 assert.equal(next.inputs.budgets.server.cordLimitAmps,undefined);assert.equal(next.inputs.budgets.server.psuAcCapacity,undefined);assert.equal(next.inputs.supplies,undefined);
 const measured={headroomPercent:0,budgets:{server:{watts:120,pf:.98,measurement:{watts:120,source:'Synthetic meter'}}}};
 assert.equal(missingPowerEstimates(e,measured).inputs,measured);
 assert.equal(missingPowerEstimates(f.equipment,{headroomPercent:0,budgets:{}}).changes.length,0,'B300 internal redundancy is not assumed for a capacity fallback');
 assert.equal(nextPowerQuestion(e,original)?.target,'power-equipment');
});

test('stale settings or known overloaded feeds reject bulk saves before any write',async()=>{
 const f=b300PowerFixture(),plan=simplePowerPlan(equipment(f.rack),f.rack.configuration);
 f.rack.configuration.feedPower.headroomPercent=100;
 const h=await actionHarness({rack:f.rack});assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false)).error);assert.equal(h.updates.length,0);
});
