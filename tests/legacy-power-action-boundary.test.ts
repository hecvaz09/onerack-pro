import test from 'node:test';
import assert from 'node:assert/strict';
import {actionHarness} from './helpers/action-harness';
import {individualPowerFixture} from './fixtures/individual-power';
import {balancePx3,powerRevision,readPx3Settings} from '../lib/px3-power';
import {savedRackPowerAssessment} from '../lib/rack-power-assessment';
import {readDetails} from '../lib/equipment-details';

function fixture(shared:unknown){
  const f=individualPowerFixture(false);
  f.rack.devices=f.rack.devices.filter(d=>!d.id.startsWith('missing-'));
  for(const d of f.rack.devices.filter(d=>d.catalogDevice.category==='pdu')){
    d.catalogDevice.model=d.id==='pdu-a'?'PX3-4068YV-V2-K1':'PX3-4068YV-V2-K2';
    d.catalogDevice.rawData={model:d.catalogDevice.model};
  }
  const configuration={feedPower:shared,px3Power:{voltage:400,pf:.95,inputLimit:80,reserveDedicated:false,supplyConfirmed:true,budgets:{server:{watts:556,connector:'C13',passive:false,confirmed:true,source:'Synthetic old workbook',psusPerFeed:1,psuAcCapacity:1000,cordAmps:12}}}};
  const rack={...f.rack,configuration},equipment=rack.devices.map(d=>({id:d.id,name:`${d.label} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
  const settings=readPx3Settings(configuration),revision=powerRevision(equipment,settings),plan=balancePx3(equipment,settings);
  assert.equal(plan.analysis.ready,true,'the stale legacy plan alone passes');
  return {rack,equipment,settings,revision,plan};
}

test('legacy bulk action cannot write cabling using stale demand after shared inputs become authoritative',async()=>{
  const shared=individualPowerFixture(false).inputs;shared.budgets.server.watts=50000;
  const f=fixture(shared),proposed=f.equipment.map(e=>({...e,details:{outlets:Object.fromEntries(f.plan.assignments.filter(c=>c.pduId===e.id).map(c=>[c.outlet,{deviceId:c.deviceId,inlet:c.inlet,notes:''}]))}}));
  const canonical=savedRackPowerAssessment(proposed,f.rack.configuration);
  assert.equal(canonical.inputs.budgets.server.watts,50000);assert.equal(canonical.design.ready,false);
  assert.ok(canonical.design.scenarios.some(s=>s.errors.some(e=>e.includes('exceeded')||e.includes('exceeds'))));
  for(const includeLegacyInputs of [false,true]){
    const h=await actionHarness({rack:f.rack});
    const result=await h.power.applyPowerBalance(f.rack.id,f.revision,includeLegacyInputs?f.settings:undefined);
    assert.equal(result.ok,false);assert.match(result.error||'',/Reload the shared Power workspace/);
    assert.equal(h.updates.length,0);assert.equal(h.rackUpdates.length,0);assert.equal(h.paths.length,0);assert.deepEqual(h.snapshot(),f.rack);
  }
});

test('an empty saved shared-input object remains authoritative, matching legacy import selection',async()=>{
  const f=fixture({}),h=await actionHarness({rack:f.rack});
  assert.deepEqual(savedRackPowerAssessment(f.equipment,f.rack.configuration).inputs.budgets,{});
  const result=await h.power.applyPowerBalance(f.rack.id,f.revision);
  assert.equal(result.ok,false);assert.match(result.error||'',/Reload the shared Power workspace/);
  assert.equal(h.updates.length,0);assert.equal(h.rackUpdates.length,0);
});

test('legacy-only saved settings still import and can apply their valid physical cable plan',async()=>{
  const f=fixture(null),h=await actionHarness({rack:f.rack});
  assert.equal(savedRackPowerAssessment(f.equipment,f.rack.configuration).inputs.budgets.server.watts,556);
  const result=await h.power.applyPowerBalance(f.rack.id,f.revision);
  assert.equal(result.ok,true,result.error);assert.equal(h.updates.length,2);assert.equal(h.rackUpdates.length,0);
  const saved=h.snapshot() as typeof f.rack;
  assert.deepEqual(saved.configuration,f.rack.configuration);
  const assigned=saved.devices.filter(d=>d.catalogDevice.category==='pdu').flatMap(d=>Object.values(readDetails(d.details).outlets).filter(o=>o.deviceId));
  assert.equal(assigned.length,2);assert.deepEqual(assigned.map(a=>a.inlet).sort(),[1,2]);
  const equipment=f.equipment.map(e=>({...e,details:saved.devices.find(d=>d.id===e.id)!.details}));
  assert.equal(savedRackPowerAssessment(equipment,saved.configuration).inputs.budgets.server.watts,556);
});
