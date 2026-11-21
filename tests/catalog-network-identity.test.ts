import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogActionHarness,type CatalogRecord} from './helpers/catalog-action-harness.ts';
import {catalogRevision} from '../lib/catalog-revision.ts';
import {emptySystemSpecs,readSystemSpecs,type SystemComponent,type CatalogInput} from '../lib/system-specs.ts';
import {networkPorts,networkShape} from '../lib/network-ports.ts';
import type {LibraryNetworkLink} from '../lib/network-library-update.ts';

const nic=(attributes:Record<string,string>={},id='nic'):SystemComponent=>({id,kind:'network',manufacturer:'Example',model:'Adapter',quantity:1,notes:'',attributes:{ports:'2',slot:'1',protocol:'Ethernet',connector:'SFP28',speedGbps:'25',...attributes}});
const record=(components=[nic()]):CatalogRecord=>({id:'catalog',sku:'SYNTHETIC-CATALOG',vendor:'Example',model:'Synthetic device',heightRU:1,category:'chassis',rawData:{systemSpecs:{...emptySystemSpecs(),components}}});
const input=(r:CatalogRecord):CatalogInput=>({sku:r.sku,vendor:r.vendor,model:r.model,heightRU:r.heightRU,category:r.category,specs:readSystemSpecs(r.rawData)});
function link(r:CatalogRecord,side:'external'|'from'|'to'='external',portId:string|null=networkPorts(r.rawData)[0].id):LibraryNetworkLink{
 const own={catalogDeviceId:r.id,catalogDevice:{rawData:r.rawData}},otherRaw=record([nic({},'peer')]).rawData,peer={catalogDeviceId:'peer-catalog',catalogDevice:{rawData:otherRaw}},peerPort=networkPorts(otherRaw)[0].id;
 return side==='to'?{fromDevice:peer,toDevice:own,fromPort:peerPort,toPort:portId,cableType:'DAC'}:{fromDevice:own,toDevice:side==='external'?null:peer,fromPort:portId,toPort:side==='external'?null:peerPort,cableType:'DAC'};
}

test('Library action blocks connected socket relocation and renumbering for external, from and to endpoints',async()=>{
 const cases:[string,Record<string,string>,Record<string,string>][]=[
  ['slot',{slot:'1'},{slot:'2'}],['physical switch number',{slot:'front',startPort:'1'},{startPort:'25'}],
  ['numbering base',{slot:'1'},{portNumberBase:'0'}],['onboard position',{slot:'onboard'},{slot:'MGMT'}],
  ['node',{slot:'1',node:'A'},{node:'B'}],['AIOM',{slot:'AIOM1'},{slot:'AIOM2'}],
 ];
 for(const [label,original,change] of cases)for(const side of ['external','from','to'] as const){
  const r=record([nic(original)]),draft=input(r);draft.specs=structuredClone(draft.specs);Object.assign(draft.specs.components[0].attributes,change);
  const h=await catalogActionHarness([r],[link(r,side)]),before=structuredClone(r);
  assert.notEqual(networkShape(r.rawData),networkShape({systemSpecs:draft.specs}),label);
  const result=await h.actions.saveCatalogEquipment(r.id,catalogRevision(r),draft);
  assert.equal(result.ok,false,`${label}: ${side}`);assert.equal(h.connectionReads(),1);assert.equal(h.writes.length,0);assert.equal(h.paths.length,0);assert.deepEqual(h.reload(r.id),before);
 }
});

test('connected card population and known capabilities retain their existing protections',async()=>{
 for(const change of [(c:SystemComponent)=>c.quantity=2,(c:SystemComponent)=>c.attributes.ports='3',(c:SystemComponent)=>c.attributes.speedGbps='10',(c:SystemComponent)=>c.attributes.connector='RJ45',(c:SystemComponent)=>c.id='new-id']){
  const r=record(),draft=input(r);draft.specs=structuredClone(draft.specs);change(draft.specs.components[0]);
  const h=await catalogActionHarness([r],[link(r)]),result=await h.actions.saveCatalogEquipment(r.id,catalogRevision(r),draft);
  assert.equal(result.ok,false);assert.equal(h.writes.length,0);
 }
});

test('unconnected group edits are allowed when actual mapped endpoints remain identifiable and unchanged',async()=>{
 for(const side of ['external','from','to'] as const){
  const r=record([nic({},'connected'),nic({slot:'4'},'spare')]),draft=input(r);draft.specs=structuredClone(draft.specs);draft.specs.components[1].attributes.slot='5';
  const cable=link(r,side),beforeCable=structuredClone(cable),h=await catalogActionHarness([r],[cable]);
  const result=await h.actions.saveCatalogEquipment(r.id,catalogRevision(r),draft);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(h.connectionReads(),1);assert.equal(h.writes.length,1);
  assert.deepEqual(networkPorts(h.reload(r.id).rawData).find(p=>p.id===networkPorts(r.rawData)[0].id),networkPorts(r.rawData)[0]);
  assert.deepEqual(cable,beforeCable);
 }
});

test('legacy links without selected ports still prevent topology changes on either catalog side',async()=>{
 for(const side of ['external','from','to'] as const){
  const r=record([nic({},'connected'),nic({slot:'4'},'spare')]),draft=input(r);draft.specs=structuredClone(draft.specs);draft.specs.components[1].attributes.slot='5';
  const h=await catalogActionHarness([r],[link(r,side,null)]),result=await h.actions.saveCatalogEquipment(r.id,catalogRevision(r),draft);
  assert.equal(result.ok,false,side);assert.equal(h.writes.length,0);
 }
});

test('safe capability enrichment preserves saved endpoints, source fields and instance data',async()=>{
 const c=nic();delete c.attributes.speedGbps;c.attributes.protocol='Other';
 const r=record([c]);r.rawData.customModelField={keep:'model reference'};
 const draft=input(r);draft.specs=structuredClone(draft.specs);Object.assign(draft.specs.components[0].attributes,{protocol:'Ethernet',speedGbps:'25',supportedSpeedsGbps:'10,25'});
 const cable=link(r,'from'),beforeCable=structuredClone(cable),h=await catalogActionHarness([r],[cable]);
 const result=await h.actions.saveCatalogEquipment(r.id,catalogRevision(r),draft);
 assert.ok(result.ok,JSON.stringify(result));assert.deepEqual(networkPorts(h.reload(r.id).rawData).map(p=>p.id),networkPorts(r.rawData).map(p=>p.id));
 assert.deepEqual(h.reload(r.id).rawData.customModelField,r.rawData.customModelField);assert.deepEqual(cable,beforeCable);
});

test('enrichment cannot make an existing cable incompatible and stale catalog edits cannot write',async()=>{
 const c=nic();c.attributes.protocol='Other';const r=record([c]),draft=input(r);draft.specs=structuredClone(draft.specs);draft.specs.components[0].attributes.protocol='InfiniBand';
 const h=await catalogActionHarness([r],[link(r,'to')]),result=await h.actions.saveCatalogEquipment(r.id,catalogRevision(r),draft);
 assert.equal(result.ok,false);assert.equal(h.writes.length,0);
 const stale=await h.actions.saveCatalogEquipment(r.id,'stale',input(r));assert.equal(stale.ok,false);assert.equal(h.writes.length,0);
});
