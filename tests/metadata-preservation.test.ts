import {powerInputsRevision} from '../lib/power-input-revision';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {actionHarness,deepFreeze} from './helpers/action-harness.ts';
import {readDetails,type NodeDetails} from '../lib/equipment-details.ts';
import {balancePx3,powerRevision,readPx3Settings} from '../lib/px3-power.ts';

type ObjectValue=Record<string,unknown>;
const node:NodeDetails={hostname:'sample-new',ip:'',serial:'',notes:'Synthetic node edit',status:'active'};
const originalDetails=()=>({feed:'B',whip:'down',future:{nested:['keep',2,null]},outlets:{'7':{deviceId:'removed',inlet:1,locked:true,notes:'Keep note',futureAssignment:{tag:'keep'}},'11':{deviceId:'other',inlet:2,locked:false,notes:'Other assignment',futureAssignment:['keep']},legacy:'Keep malformed untouched value'},nodes:{A:{hostname:'old',ip:'',serial:'',notes:'',status:'active',futureNode:'keep'},B:{hostname:'other',ip:'',serial:'',notes:'',status:'offline',futureNode:{tag:'keep'}}}});
const payload=(h:Awaited<ReturnType<typeof actionHarness>>,id:string)=>h.updates.find(u=>u.where.id===id)!.data.details as ObjectValue;

test('removeDevice clears only matching device references and preserves PDU metadata, nodes and other assignments',async()=>{
 const source=deepFreeze(originalDetails());const untouched=deepFreeze({feed:'A',whip:'up',outlets:{'1':{deviceId:'other',notes:'',inlet:1}},nodes:{}});
 const h=await actionHarness({device:{rack:{projectId:'sample-project'}},pdus:[{id:'pdu',details:source},{id:'untouched',details:untouched}]});
 assert.deepEqual(await h.actions.removeDevice('sample-rack','removed'),{ok:true});
 const expected=structuredClone(source);expected.outlets['7'].deviceId='';assert.deepEqual(payload(h,'pdu'),expected);
 assert.equal(h.updates.length,1);assert.deepEqual(h.deletions,['removed']);assert.deepEqual(h.events,['rackMutation:sample-rack','update:pdu','delete:removed']);
 assert.deepEqual(h.paths,['/projects/sample-project/racks/sample-rack','/projects/sample-project/racks/sample-rack/connections']);assert.equal(source.outlets['7'].deviceId,'removed');
});
test('removeDevice with no matching assignment performs no PDU write',async()=>{
 const h=await actionHarness({device:{rack:{projectId:'sample-project'}},pdus:[{id:'pdu',details:deepFreeze(originalDetails())}]});
 assert.deepEqual(await h.actions.removeDevice('sample-rack','absent-reference'),{ok:true});assert.equal(h.updates.length,0);assert.deepEqual(h.deletions,['absent-reference']);
});
test('removeDevice missing installed target does not write, delete or revalidate',async()=>{
 const h=await actionHarness();assert.equal((await h.actions.removeDevice('sample-rack','missing')).ok,false);assert.equal(h.updates.length,0);assert.equal(h.deletions.length,0);assert.equal(h.paths.length,0);
});
for(const [name,value] of [['missing',undefined],['null',null],['array',[]],['string','legacy'],['number',7]] as const){
 test('removeDevice tolerates '+name+' details without inventing a PDU update',async()=>{
  const h=await actionHarness({device:{rack:{projectId:'sample-project'}},pdus:[{id:'pdu',details:value}]});assert.deepEqual(await h.actions.removeDevice('sample-rack','removed'),{ok:true});assert.equal(h.updates.length,0);
 });
}
test('saveNode replaces known selected node fields while retaining all other details and unknown node metadata',async()=>{
 const source=deepFreeze(originalDetails());const h=await actionHarness({device:{id:'device',details:source,rack:{projectId:'sample-project'},catalogDevice:{rawData:{nodeGrid:{labels:[['A','B']]}}}}});
 assert.deepEqual(await h.actions.saveNode('sample-rack','device','A',node),{ok:true});
 const expected={...structuredClone(source),nodes:{...structuredClone(source.nodes),A:{...source.nodes.A,...node}}};assert.deepEqual(payload(h,'device'),expected);assert.equal(source.nodes.A.hostname,'old');assert.equal(h.events[0],'rackMutation:sample-rack');
});
for(const [name,value] of [['missing',undefined],['null',null],['array',[]],['string','legacy'],['malformed section',{future:'keep',outlets:{legacy:'keep'},nodes:[]}]] as const){
 test('saveNode handles '+name+' details safely without spreading scalar/array entries',async()=>{
  const h=await actionHarness({device:{details:value,rack:{projectId:'sample-project'},catalogDevice:{rawData:{nodeGrid:{labels:[['A']]}}}}});
  assert.deepEqual(await h.actions.saveNode('sample-rack','device','A',node),{ok:true});
  assert.deepEqual(payload(h,'device'),name==='malformed section'?{future:'keep',outlets:{legacy:'keep'},nodes:{A:node}}:{nodes:{A:node}});
 });
}
test('saveNode unknown node name and invalid node input do not write',async()=>{
 const h=await actionHarness({device:{details:originalDetails(),rack:{projectId:'sample-project'},catalogDevice:{rawData:{nodeGrid:{labels:[['A']]}}}}});
 assert.equal((await h.actions.saveNode('sample-rack','device','not-a-node',node)).ok,false);assert.equal((await h.actions.saveNode('sample-rack','device','A',{...node,status:'invalid' as NodeDetails['status']})).ok,false);assert.equal(h.updates.length,0);assert.equal(h.paths.length,0);
});
function powerFixture(){
 const detail=(feed:string)=>({feed,whip:'down',future:{calibration:'synthetic'},nodes:{A:{hostname:'sample',ip:'',serial:'',notes:'',status:'active',futureNode:'keep'}},outlets:feed==='A'?{'7':{deviceId:'load',inlet:1,locked:true,notes:'anchor',futureAssignment:'keep'},'15':{deviceId:'',notes:'unassigned note',futureAssignment:'keep'}}:{'47':{deviceId:'load',inlet:2,locked:false,notes:'old proposal',futureAssignment:'keep'}}});
 const devices=[{id:'pdu-a',label:'Sample PDU A',startRU:1,mounting:'rear-right',details:detail('A'),catalogDevice:{model:'PX3-4068YV-V2-K1',category:'pdu',rawData:{model:'PX3-4068YV-V2-K1'}}},{id:'pdu-b',label:'Sample PDU B',startRU:1,mounting:'rear-left',details:detail('B'),catalogDevice:{model:'PX3-4068YV-V2-K2',category:'pdu',rawData:{model:'PX3-4068YV-V2-K2'}}},{id:'load',label:'Sample load',startRU:3,mounting:'front',details:{future:'keep'},catalogDevice:{model:'Synthetic system',category:'chassis',rawData:{}}}];
 const configuration={futureRack:{tag:'keep'},px3Power:{voltage:400,pf:0.95,inputLimit:80,reserveDedicated:false,supplyConfirmed:true,budgets:{load:{watts:500,connector:'C13',passive:false,confirmed:true,source:'Synthetic fixture',psusPerFeed:1,psuAcCapacity:1000,cordAmps:12}}}};
 const rack={projectId:'sample-project',configuration,devices};
 const equipment=devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
 return {rack,equipment,settings:readPx3Settings(configuration)};
}
test('applyPowerBalance keeps PDU metadata/nodes and unrelated outlets while applying the actual specialist plan',async()=>{
 const f=powerFixture();const before=structuredClone(f.rack);deepFreeze(f.rack);const plan=balancePx3(f.equipment,f.settings);assert.equal(plan.error,undefined);assert.equal(plan.analysis.ready,true);
 const h=await actionHarness({rack:f.rack});assert.deepEqual(await h.power.applyPowerBalance('sample-rack',powerRevision(f.equipment,f.settings)),{ok:true});assert.equal(h.updates.length,2);assert.equal(h.rackUpdates.length,0);
 for(const pdu of f.rack.devices.filter(d=>d.catalogDevice.category==='pdu')){
  const actual=payload(h,pdu.id),original=pdu.details as ObjectValue;assert.deepEqual(actual.feed,original.feed);assert.deepEqual(actual.whip,original.whip);assert.deepEqual(actual.future,original.future);assert.deepEqual(actual.nodes,original.nodes);
  const outlets=actual.outlets as Record<string,ObjectValue>,oldOutlets=original.outlets as Record<string,ObjectValue>;
  for(const [n,a] of Object.entries(oldOutlets)){
   assert.deepEqual(outlets[n].futureAssignment,a.futureAssignment);
   if(!plan.assignments.some(c=>c.pduId===pdu.id&&String(c.outlet)===n)&&a.deviceId&&a.locked===false){assert.equal(outlets[n].deviceId,'');assert.equal(outlets[n].inlet,undefined);assert.equal(outlets[n].locked,undefined);assert.equal(outlets[n].notes,a.notes);}
   else if(!plan.assignments.some(c=>c.pduId===pdu.id&&String(c.outlet)===n))assert.deepEqual(outlets[n],a);
  }
  for(const c of plan.assignments.filter(c=>c.pduId===pdu.id)){const a=readDetails(actual).outlets[c.outlet];assert.equal(a.deviceId,c.deviceId);assert.equal(a.inlet,c.inlet);assert.equal(a.locked,c.locked);}
 }
 assert.deepEqual(f.rack,before);assert.equal(h.events[0],'rackMutation:sample-rack');assert.deepEqual(h.paths,['/projects/sample-project/racks/sample-rack']);
});
test('applyPowerBalance stale revision and blocked plan do not write',async()=>{
 const f=powerFixture();const stale=await actionHarness({rack:f.rack});assert.equal((await stale.power.applyPowerBalance('sample-rack','stale')).ok,false);assert.equal(stale.updates.length,0);assert.equal(stale.paths.length,0);
 f.rack.configuration.px3Power.supplyConfirmed=false;const blocked=await actionHarness({rack:f.rack});assert.equal((await blocked.power.applyPowerBalance('sample-rack',powerRevision(f.equipment,readPx3Settings(f.rack.configuration)))).ok,false);assert.equal(blocked.updates.length,0);assert.equal(blocked.rackUpdates.length,0);
});
test('metadata actions retain controlled error behavior for synthetic transaction failures',async()=>{
 const source=deepFreeze(originalDetails());const h=await actionHarness({device:{details:source,rack:{projectId:'sample-project'},catalogDevice:{rawData:{nodeGrid:{labels:[['A']]}}}},pdus:[{id:'pdu',details:source}],failUpdate:true});
 assert.equal((await h.actions.saveNode('sample-rack','device','A',node)).ok,false);assert.equal((await h.actions.removeDevice('sample-rack','removed')).ok,false);assert.equal(h.deletions.length,0);assert.equal(h.paths.length,0);assert.equal(source.outlets['7'].deviceId,'removed');
 const f=powerFixture(),p=await actionHarness({rack:f.rack,failUpdate:true});assert.equal((await p.power.applyPowerBalance('sample-rack',powerRevision(f.equipment,f.settings))).ok,false);assert.equal(p.paths.length,0);
});

for(const [name,value] of [['missing',undefined],['null',null],['array',[]],['string','legacy'],['malformed section',{feed:'B',whip:'down',future:{keep:true},nodes:['keep'],outlets:[]}]] as const){
 test('applyPowerBalance handles '+name+' PDU details without losing unrelated fields',async()=>{
  const f=powerFixture();const devices=f.rack.devices.map(d=>d.catalogDevice.category==='pdu'?{...d,details:value}:d);
  const rack=deepFreeze({...f.rack,devices});
  const equipment=devices.map(d=>({id:d.id,name:`${d.label} · U${d.startRU}`,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
  const plan=balancePx3(equipment,f.settings);assert.equal(plan.error,undefined);
  const h=await actionHarness({rack});assert.deepEqual(await h.power.applyPowerBalance('sample-rack',powerRevision(equipment,f.settings)),{ok:true});
  for(const id of ['pdu-a','pdu-b']){
   const actual=payload(h,id),outlets=actual.outlets as Record<string,ObjectValue>;
   const original=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
   assert.deepEqual(actual,{...original,outlets});assert.equal(Object.keys(outlets).length,1);
   const assigned=plan.assignments.find(c=>c.pduId===id)!;assert.equal(outlets[assigned.outlet].deviceId,assigned.deviceId);assert.equal(outlets[assigned.outlet].inlet,assigned.inlet);
  }
 });
}
test('applyPowerBalance optional input save preserves unrelated rack configuration',async()=>{
 const f=powerFixture();const inputs={...f.settings,headroomPercent:10};const h=await actionHarness({rack:deepFreeze(f.rack)});
 const saved=await h.power.applyPowerBalance('sample-rack',powerRevision(f.equipment,f.settings),inputs,powerInputsRevision('sample-rack',f.rack));assert.equal(saved.ok,true);assert.equal(h.rackUpdates.length,1);
 assert.deepEqual(h.rackUpdates[0].data.configuration,{...f.rack.configuration,px3Power:inputs});
});

test('legacy specialist plan revision still matches when real catalog SKU identity is projected by the page',async()=>{
 const f=powerFixture();const devices=f.rack.devices.map(d=>({...d,catalogDevice:{...d.catalogDevice,sku:'SYNTHETIC-'+d.id}}));
 const equipment=devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
 const h=await actionHarness({rack:{...f.rack,devices}});const result=await h.power.applyPowerBalance('sample-rack',powerRevision(equipment,f.settings));assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(h.updates.length,2);
});
