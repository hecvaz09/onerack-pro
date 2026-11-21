import test from 'node:test';
import assert from 'node:assert/strict';
import {actionHarness} from './helpers/action-harness';
import {individualPowerFixture,individualEquipment} from './fixtures/individual-power';
import {b300PowerFixture} from './fixtures/b300-power';
import {readDetails} from '../lib/equipment-details';
import {feedRack,readFeedInputs} from '../lib/feed-rack';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {feedRevision,balanceFeeds} from '../lib/feed-balance';
import {balancePx3,powerRevision,readPx3Settings} from '../lib/px3-power';
import {psuConnectionStatuses} from '../lib/psu-connection-status';
import type {Supply} from '../lib/feed-power';

type Fixture=ReturnType<typeof individualPowerFixture>;
const profile=(f:Fixture)=>(f.rack.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile;

test('manual and visual saves reject the same known-invalid endpoints and limits before any write',async()=>{
 const cases:[string,(f:Fixture)=>void][]=[
  ['PSU outside configured count',f=>{f.cord.inlet=6;}],
  ['unidentified PSU',f=>{f.cord.inlet=0;}],
  ['nonexistent outlet',f=>{f.cord.outlet=999;}],
  ['missing device',f=>{f.cord.deviceId='removed';}],
  ['duplicate PSU on another PDU',f=>{f.rack.devices[1].details={outlets:{2:{deviceId:'server',inlet:1,notes:''}}};}],
  ['occupied outlet',f=>{f.rack.devices[0].details={outlets:{1:{deviceId:'missing-0',inlet:1,notes:''}}};}],
  ['occupied outlet with different input on same device',f=>{f.rack.devices[0].details={outlets:{1:{deviceId:'server',inlet:2,notes:''}}};}],
  ['reserved outlet',f=>{profile(f).outlets[0].reserved=true;}],
  ['incompatible connector',f=>{f.inputs.budgets.server.connector='C19';}],
  ['incompatible voltage',f=>{f.inputs.budgets.server.minVoltage=230;}],
  ['known PSU capacity',f=>{f.inputs.budgets.server.psuAcCapacity=100;}],
  ['known cord limit',f=>{f.inputs.budgets.server.cordLimitAmps=.1;}],
  ['known outlet limit',f=>{profile(f).outlets[0].limitAmps=.1;}],
  ['known branch limit',f=>{profile(f).branches!.B1=.1;}],
  ['known PDU limit',f=>{profile(f).limitAmps=.1;}],
  ['invalid headroom',f=>{f.inputs.headroomPercent=-1;}],
 ];
 for(const [name,mutate] of cases){
  const f=individualPowerFixture(false);mutate(f);const c=f.cord;
  const manual=await actionHarness({rack:f.rack}),visual=await actionHarness({rack:f.rack});
  const m=await manual.actions.saveOutlet(f.rack.id,c.pduId,c.outlet,c.deviceId,'Keep note',c.inlet,true);
  const v=await visual.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,true);
  assert.equal(m.ok,false,name);assert.ok(v.error,name);
  for(const h of [manual,visual]){
   assert.equal(h.updates.length,0,name);assert.equal(h.rackUpdates.length,0,name);
   assert.equal(h.paths.length,0,name);assert.deepEqual(h.snapshot(),f.rack,name);
  }
 }
});

test('manual planning retains recorded demand and metadata while both entry paths require explicit planning intent',async()=>{
 const f=individualPowerFixture(),c=f.cord;
 Object.assign(f.inputs.budgets.server,{watts:1648.5,pf:.97,psuAcCapacity:undefined,measurement:{watts:1648.5,source:'Synthetic recorded measurement'}});
 f.rack.devices[0].details={future:{keep:true},outlets:{1:{deviceId:'',notes:'Retain outlet note',future:{keep:'outlet'}}}};
 for(const mode of ['manual','visual'] as const){
  const h=await actionHarness({rack:f.rack});
  const save=(planning:boolean)=>mode==='manual'
   ?h.actions.saveOutlet(f.rack.id,c.pduId,c.outlet,c.deviceId,'Retain outlet note',c.inlet,planning)
   :h.visual.connectVisualPower(f.rack.id,c.pduId,c.outlet,c.deviceId,c.inlet,planning);
  const strict=await save(false);
  assert.ok('error' in strict&&strict.error,mode);assert.equal(h.updates.length,0,mode);
  assert.equal((await save(true)).ok,true,mode);
  const saved=h.snapshot() as typeof f.rack,equipment=individualEquipment(saved);
  assert.deepEqual(saved.configuration,f.rack.configuration,mode);
  const demand=feedRack(equipment,readFeedInputs(saved.configuration,equipment)).loads.find(d=>d.id==='server')!;
  assert.equal(demand.watts,1648.5,mode);assert.equal(demand.measurement?.source,'Synthetic recorded measurement',mode);
  assert.equal(psuConnectionStatuses(equipment,saved.configuration).server[1].state,'pending',mode);
  const raw=saved.devices[0].details as {future:unknown;outlets:Record<string,{future:unknown}>};
  assert.deepEqual(raw.future,{keep:true},mode);assert.deepEqual(raw.outlets[1].future,{keep:'outlet'},mode);
  assert.equal(readDetails(raw).outlets[1].notes,'Retain outlet note Planning draft: electrical verification pending.',mode);
 }
});

test('a checked manual connection saves, reloads, and permits a note edit without changing its binding',async()=>{
 const f=individualPowerFixture(false),c=f.cord,h=await actionHarness({rack:f.rack});
 assert.equal((await h.actions.saveOutlet(f.rack.id,c.pduId,c.outlet,c.deviceId,'Original note',c.inlet)).ok,true);
 assert.equal((await h.actions.saveOutlet(f.rack.id,c.pduId,c.outlet,c.deviceId,'Updated note',c.inlet)).ok,true);
 const saved=h.snapshot() as typeof f.rack,assignment=readDetails(saved.devices[0].details).outlets[c.outlet];
 assert.deepEqual(assignment,{deviceId:c.deviceId,inlet:c.inlet,notes:'Updated note',locked:true});
 assert.equal(psuConnectionStatuses(individualEquipment(saved),saved.configuration).server[1].state,'connected');
 assert.equal(h.rackUpdates.length,0);
 assert.equal((await h.actions.saveOutlet(f.rack.id,c.pduId,c.outlet,'','',0)).ok,true);
 assert.equal(readDetails((h.snapshot() as typeof f.rack).devices[0].details).outlets[c.outlet],undefined);
});

test('B300 manual and visual saves retain physical input identity and reject a duplicate input',async()=>{
 const f=b300PowerFixture(),c=balanceFeeds(f.equipment,f.inputs).assignments.find(c=>c.inlet===12)!;
 for(const mode of ['manual','visual'] as const){
  const h=await actionHarness({rack:f.rack});
  const save=(outlet:number)=>mode==='manual'
   ?h.actions.saveOutlet(f.rack.id,c.pduId,outlet,c.deviceId,'',c.inlet,true)
   :h.visual.connectVisualPower(f.rack.id,c.pduId,outlet,c.deviceId,c.inlet,true);
  assert.equal((await save(c.outlet)).ok,true,mode);
  const saved=h.snapshot() as typeof f.rack,pdu=saved.devices.find(d=>d.id===c.pduId)!;
  assert.equal(readDetails(pdu.details).outlets[c.outlet].inputIdentity,'b300-module-input-v1',mode);
  const duplicate=await save(c.outlet===1?2:1);
  assert.ok('error' in duplicate&&duplicate.error,mode);assert.equal(h.updates.length,1,mode);
 }
});

test('both canonical bulk actions reject invalid fixed PSU assignments without writes',async()=>{
 for(const inlet of [1,6]){
  const f=individualPowerFixture(false);
  f.rack.devices=f.rack.devices.filter(d=>!d.id.startsWith('missing-'));
  f.rack.devices[0].details={outlets:{1:{deviceId:'server',inlet:1,notes:'',locked:true}}};
  f.rack.devices[1].details={outlets:{2:{deviceId:'server',inlet,notes:'',locked:true}}};
  const equipment=individualEquipment(f.rack).map(d=>({...d,name:`${d.name} · U${d.startRU}`}));
  const plan=simplePowerPlan(equipment,f.rack.configuration),h=await actionHarness({rack:f.rack});
  assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).error);
  const bulk=await h.feed.applyFeedBalance(f.rack.id,feedRevision(equipment,f.inputs));
  assert.ok('error' in bulk&&bulk.error);
  assert.equal(h.updates.length,0);assert.equal(h.rackUpdates.length,0);assert.deepEqual(h.snapshot(),f.rack);
 }
});

test('legacy bulk save cannot bypass authoritative shared input counts or outlet reservations',async()=>{
 for(const reason of ['input-count','reserved-outlet'] as const){
  const f=individualPowerFixture(false);
  f.rack.devices=f.rack.devices.filter(d=>!d.id.startsWith('missing-'));
  for(const d of f.rack.devices.filter(d=>d.catalogDevice.category==='pdu')){
   d.catalogDevice.model=d.id==='pdu-a'?'PX3-4068YV-V2-K1':'PX3-4068YV-V2-K2';
   d.catalogDevice.rawData={model:d.catalogDevice.model};
  }
  const configuration={...f.rack.configuration,px3Power:{voltage:400,pf:.95,inputLimit:80,reserveDedicated:false,supplyConfirmed:true,budgets:{server:{watts:556,connector:'C13',passive:false,confirmed:true,source:'Synthetic legacy input',psusPerFeed:reason==='input-count'?3:1,psuAcCapacity:1000,cordAmps:12}}}};
  const settings=readPx3Settings(configuration);
  const equipment=f.rack.devices.map(d=>({id:d.id,name:`${d.label} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
  const legacyPlan=balancePx3(equipment,settings);
  assert.equal(legacyPlan.analysis.ready,true,reason);
  if(reason==='reserved-outlet'){
   const c=legacyPlan.assignments[0];
   const supply=feedRack(equipment,f.inputs).supplies.find(p=>p.id===c.pduId)!;
   f.inputs.supplies={[supply.id]:{...supply,outlets:supply.outlets.map(o=>o.n===c.outlet?{...o,reserved:true}:o)}};
  }
  const h=await actionHarness({rack:{...f.rack,configuration}});
  const result=await h.power.applyPowerBalance(f.rack.id,powerRevision(equipment,settings));
  assert.equal(result.ok,false,reason);
   assert.match(result.error||'',/Reload the shared Power workspace/);
  assert.equal(h.updates.length,0,reason);assert.equal(h.rackUpdates.length,0,reason);
 }
});
