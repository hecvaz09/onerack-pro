import test from 'node:test';
import assert from 'node:assert/strict';
import {b300PowerFixture} from './fixtures/b300-power';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {balanceFeeds} from '../lib/feed-balance';
import {psuConnectionStatuses} from '../lib/psu-connection-status';
import {actionHarness} from './helpers/action-harness';
import type {FeedEquipment} from '../lib/feed-rack';
function fixture(){
 const f=b300PowerFixture();const d=f.rack.devices.find(d=>d.id==='b300')!;d.catalogDevice.model='Synthetic server';d.catalogDevice.sku='SYNTHETIC';d.catalogDevice.rawData={};
 f.inputs.budgets.b300={watts:556,pf:.87};
 const equipment=f.rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details})) as FeedEquipment[];
 return {...f,equipment};
}
test('outlet-only plan saves through bulk action and reloads as pending, never approved',async()=>{
 const f=fixture(),plan=simplePowerPlan(f.equipment,f.rack.configuration);assert.equal(plan.error,undefined);assert.equal(plan.planning,true);assert.equal(plan.assignments.length,2);assert.ok(balanceFeeds(f.equipment,f.inputs).error);
 const h=await actionHarness({rack:f.rack});assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false)).error);assert.equal(h.updates.length,0);
 assert.equal((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).ok,true);
 const after=h.snapshot() as typeof f.rack;const updated=f.equipment.map(e=>({...e,details:after.devices.find(d=>d.id===e.id)!.details}));assert.equal(simplePowerPlan(updated,after.configuration).remaining.length,0);
 assert.ok(Object.values(psuConnectionStatuses(updated,after.configuration).b300).every(s=>s.state==='pending'));
});
test('individual planning save works without cable details; known mismatches and current limits still block',async()=>{
 const f=fixture(),plan=simplePowerPlan(f.equipment,f.rack.configuration),c=plan.assignments[0],h=await actionHarness({rack:f.rack});assert.equal((await h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true)).ok,true);
 f.inputs.budgets.b300.connector='C13';assert.ok(simplePowerPlan(f.equipment,f.rack.configuration).error);
 f.inputs.budgets.b300.connector='';f.inputs.budgets.b300.cordLimitAmps=.1;assert.ok(simplePowerPlan(f.equipment,f.rack.configuration).error);
 delete f.inputs.budgets.b300.cordLimitAmps;
 for(const p of f.equipment.filter(e=>e.category==='pdu')){const profile=(p.rawData as {electricalProfile:{outlets:{limitAmps:number}[]}}).electricalProfile;for(const o of profile.outlets)o.limitAmps=.1;}
 assert.ok(simplePowerPlan(f.equipment,f.rack.configuration).error);
});
