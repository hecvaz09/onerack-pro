import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {catalogActionHarness,type CatalogRecord} from './helpers/catalog-action-harness.ts';
import {catalogRevision} from '../lib/catalog-revision.ts';
import {catalogBaseSku} from '../lib/catalog-identity.ts';
import {catalogProfile,artworkUrl} from '../lib/catalog-artwork.ts';
import {readSystemSpecs,emptySystemSpecs,type CatalogInput,type SystemComponent} from '../lib/system-specs.ts';
import {feedRack} from '../lib/feed-rack.ts';
import {readOutlets,readNodeNames} from '../lib/equipment-details.ts';
import {libraryIntegrity} from '../lib/library-integrity.ts';
import {CatalogVisuals} from '../app/equipment/catalog-visuals';
import {RackGrid} from '../app/projects/[id]/racks/[rackId]/physical-rack-grid';
import {readRackConfig} from '../lib/rack-config.ts';
import {networkPorts} from '../lib/network-ports.ts';
import {powerInputPositions} from '../lib/power-cable-routing.ts';
import {libraryPowerLimits} from '../lib/library-power-limits.ts';
import {equipmentRecord} from '../lib/equipment-record.ts';

const apc=():CatalogRecord=>({id:'apc-source',...JSON.parse(readFileSync('data/catalog/apc-apdu11350me.json','utf8'))});
function legacy(sku:string):CatalogRecord{
 const raw=JSON.parse(readFileSync('prisma/rr-catalog-v1.json','utf8'))[sku],p=catalogProfile(sku)!;
 return {id:sku,sku,vendor:raw.manufacturer,model:raw.name||raw.model,heightRU:raw.ru,category:raw.category,rawData:{...raw,systemSpecs:{...emptySystemSpecs(),components:p.components as SystemComponent[]}}};
}
const input=(record:CatalogRecord,sku=record.sku+'-COPY'):CatalogInput=>({sku,vendor:record.vendor,model:record.model,heightRU:record.heightRU,category:record.category,specs:{...readSystemSpecs(record.rawData),status:'draft'}});
const equipment=(record:CatalogRecord)=>({id:record.id,name:record.model,sku:record.sku,model:record.model,category:record.category,rawData:record.rawData,details:{feed:'A'}});
const supply=(record:CatalogRecord)=>feedRack([equipment(record)],{headroomPercent:0,budgets:{}}).supplies[0];

test('Duplicate action saves and reloads complete APC and Raritan outlet/bank definitions with independent model references',async()=>{
 for(const source of [apc(),legacy('PX3-4068YV-V2-K1'),legacy('PX3-4068YV-V2-K2')]){
  const before=structuredClone(source),h=await catalogActionHarness([source]);
  const draft=input(source),result=await h.actions.saveCatalogEquipment(null,'',draft,{id:source.id,revision:catalogRevision(source)});
  assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)continue;
  const saved=h.reload(result.id),originalSupply=supply(source),copySupply=supply(saved);
  assert.notEqual(saved.id,source.id);assert.notEqual(saved.sku,source.sku);
  for(const key of ['voltage','limitAmps','topology','branches','outlets'] as const)assert.deepEqual(copySupply[key],originalSupply[key],`${source.sku}: ${key}`);
  assert.deepEqual(readOutlets(saved.rawData),readOutlets(source.rawData));
  assert.equal(catalogBaseSku(saved.sku,saved.rawData),source.sku);
  assert.equal(catalogProfile(saved.sku,saved.model,saved.rawData)?.key,catalogProfile(source.sku,source.model,source.rawData)?.key);
  assert.equal(catalogProfile('SYS-821GV-TNR',saved.model,saved.rawData)?.key,catalogProfile(source.sku,source.model,source.rawData)?.key,'A configuration label cannot override its stored hardware identity');
  const html=renderToStaticMarkup(createElement(CatalogVisuals,{sku:saved.sku,model:saved.model,raw:saved.rawData,specs:readSystemSpecs(saved.rawData)}));
  for(const face of ['front','rear'] as const)assert.ok(html.includes(artworkUrl(catalogProfile(source.sku)!,face,source.sku)),`${source.sku}: ${face}`);
  assert.deepEqual(libraryIntegrity([saved]),[]);
  assert.deepEqual(source,before);assert.deepEqual(h.reload(source.id),before);assert.equal(h.writes.length,1);
  assert.equal(h.connectionReads(),0);
 }
});

test('copy of a copy retains the original K2 reference through another save and SKU rename',async()=>{
 const source=legacy('PX3-4068YV-V2-K2'),h=await catalogActionHarness([source]);
 const one=await h.actions.saveCatalogEquipment(null,'',input(source,'PDU-CONFIG-ONE'),{id:source.id,revision:catalogRevision(source)});
 assert.ok(one.ok);if(!one.ok)return;const first=h.reload(one.id);
 const two=await h.actions.saveCatalogEquipment(null,'',input(first,'PDU-CONFIG-TWO'),{id:first.id,revision:catalogRevision(first)});
 assert.ok(two.ok);if(!two.ok)return;const second=h.reload(two.id),before=structuredClone(second);
 const renamed={...input(second,'PDU-CONFIG-RENAMED'),specs:readSystemSpecs(second.rawData)};
 assert.ok((await h.actions.saveCatalogEquipment(second.id,catalogRevision(second),renamed)).ok);
 const final=h.reload(second.id),profile=catalogProfile(final.sku,final.model,final.rawData)!;
 assert.equal(catalogBaseSku(final.sku,final.rawData),source.sku);
 assert.equal(artworkUrl(profile,'rear',final.sku,final.rawData),'/equipment-artwork/raritan-px3-k2-horizontal-rear.svg');
 assert.deepEqual(supply(final).outlets,supply(source).outlets);
 assert.deepEqual(h.reload(first.id),first);assert.equal(before.sku,'PDU-CONFIG-TWO');
});

test('duplicating a site-confirmed PDU preserves its model limits but leaves new installations unverified',async()=>{
 const source=apc();source.rawData.electricalProfile={...(source.rawData.electricalProfile as Record<string,unknown>),confirmed:true};
 const before=structuredClone(source),h=await catalogActionHarness([source]);
 const result=await h.actions.saveCatalogEquipment(null,'',input(source),{id:source.id,revision:catalogRevision(source)});
 assert.ok(result.ok);if(!result.ok)return;const saved=h.reload(result.id),newInstallation=supply(saved);
 assert.equal(supply(source).confirmed,true);assert.equal((saved.rawData.electricalProfile as Record<string,unknown>).confirmed,false);assert.equal(newInstallation.confirmed,false);
 for(const key of ['voltage','limitAmps','topology','branches','outlets'] as const)assert.deepEqual(newInstallation[key],supply(source)[key]);
 assert.deepEqual(h.reload(source.id),before);
});

test('chassis duplication keeps node definitions and component IDs without installation measurements or cables',async()=>{
 const source=legacy('SYS-211GT-HNTR-CU1-TT019');
 Object.assign(source.rawData,{details:{nodes:{'Node A':{hostname:'installed-host',serial:'private-serial'}},outlets:{1:{deviceId:'live-server'}}},measurement:{watts:1648.5,source:'installed measurement'},powerLoad:{cords:2,connector:'C13',watts:1648.5,pf:.94,measurement:{watts:1648.5,source:'meter'}},connections:[{id:'saved-cable'}]});
 const before=structuredClone(source),h=await catalogActionHarness([source]);
 const result=await h.actions.saveCatalogEquipment(null,'',input(source),{id:source.id,revision:catalogRevision(source)});
 assert.ok(result.ok);if(!result.ok)return;const saved=h.reload(result.id);
 assert.deepEqual(readNodeNames(saved.rawData),readNodeNames(source.rawData));
 assert.deepEqual(networkPorts(saved.rawData).map(p=>p.id),networkPorts(source.rawData).map(p=>p.id));
 assert.equal(saved.rawData.details,undefined);assert.equal(saved.rawData.measurement,undefined);assert.equal(saved.rawData.connections,undefined);
 assert.deepEqual(saved.rawData.powerLoad,{cords:2,connector:'C13'});assert.equal((saved.rawData.psu as Record<string,unknown>).watts,undefined);
 const copied=feedRack([equipment(saved)],{headroomPercent:0,budgets:{}}).loads[0];assert.equal(copied.watts,undefined);assert.equal(copied.pf,undefined);
 assert.deepEqual(h.reload(source.id),before);
});

test('a duplicate retains server artwork and PSU endpoint geometry after a custom SKU is saved',async()=>{
 const p=catalogProfile('SYS-821GV-TNR')!,source:CatalogRecord={id:'server-source',sku:p.skus[0],vendor:'Supermicro',model:p.label,heightRU:p.heightRU,category:p.category,rawData:{systemSpecs:{...emptySystemSpecs(),components:p.components as SystemComponent[]}}};
 const h=await catalogActionHarness([source]),result=await h.actions.saveCatalogEquipment(null,'',input(source,'SERVER-CONFIG-ALPHA'),{id:source.id,revision:catalogRevision(source)});
 assert.ok(result.ok);if(!result.ok)return;const saved=h.reload(result.id);
 const html=renderToStaticMarkup(createElement(RackGrid,{heightRU:42,config:readRackConfig({profile:'generic-42'}),rear:true,devices:[{id:'installed-copy',label:null,startRU:1,mounting:'front',catalogDevice:saved}],onPsu:()=>{}}));
 assert.ok(html.includes('smc-821gv-rear.svg'));assert.equal((html.match(/data-psu-device=/g)||[]).length,6);
 assert.deepEqual([...powerInputPositions(equipment(saved))],[...powerInputPositions(equipment(source))]);
});

test('missing, stale, malformed or edited-hardware duplicate sources cannot create records',async()=>{
 const source=apc();
 for(const candidate of [
  {copy:{id:'deleted-source',revision:catalogRevision(source)},draft:input(source)},
  {copy:{id:source.id,revision:'0'.repeat(64)},draft:input(source)},
  {copy:{id:source.id,revision:''},draft:input(source)},
  ...[{vendor:'Different vendor'},{model:'Different PDU'},{category:'chassis'},{heightRU:1}].map(change=>({copy:{id:source.id,revision:catalogRevision(source)},draft:{...input(source),...change}})),
 ]){
  const h=await catalogActionHarness([source]),result=await h.actions.saveCatalogEquipment(null,'',candidate.draft,candidate.copy);
  assert.equal(result.ok,false);assert.equal(h.writes.length,0);assert.equal(h.paths.length,0);assert.deepEqual(h.reload(source.id),source);
 }
});

test('a saved inherited variant cannot be relabeled as a different hardware model',async()=>{
 const source=apc(),h=await catalogActionHarness([source]),result=await h.actions.saveCatalogEquipment(null,'',input(source),{id:source.id,revision:catalogRevision(source)});
 assert.ok(result.ok);if(!result.ok)return;const saved=h.reload(result.id),writes=h.writes.length;
 const changed=await h.actions.saveCatalogEquipment(saved.id,catalogRevision(saved),{...input(saved,saved.sku),model:'Another hardware model'});
 assert.equal(changed.ok,false);assert.equal(h.writes.length,writes);assert.deepEqual(h.reload(saved.id),saved);
});

test('custom-SKU duplicates retain exact-model fallback specifications without creating installation W or PF',async()=>{
 for(const sku of ['DCS-7050CX3-32S','N9K-C9336C-FX2','SYS-510P-WTR']){
  const profile=catalogProfile(sku)!;
  const source:CatalogRecord={id:sku,sku,vendor:'Source vendor',model:profile.label,heightRU:profile.heightRU,category:profile.category,rawData:{systemSpecs:emptySystemSpecs()}};
  const h=await catalogActionHarness([source]),result=await h.actions.saveCatalogEquipment(null,'',input(source,'CONFIG-'+sku+'-CUSTOM'),{id:source.id,revision:catalogRevision(source)});
  assert.ok(result.ok);if(!result.ok)continue;const saved=h.reload(result.id);
  const originalLimits=libraryPowerLimits(source.sku,source.rawData,{},true),copyLimits=libraryPowerLimits(saved.sku,saved.rawData,{},true);
  assert.deepEqual(copyLimits,originalLimits,sku);
  if(sku==='DCS-7050CX3-32S'){assert.equal(copyLimits.minVoltage,100);assert.equal(copyLimits.maxVoltage,240);}
  const originalRecord=equipmentRecord(source.model,source.rawData,undefined,source.sku,true),copyRecord=equipmentRecord(saved.model,saved.rawData,undefined,saved.sku,true);
  assert.deepEqual(copyRecord,originalRecord,sku);
  if(sku==='N9K-C9336C-FX2')assert.ok(copyRecord.facts.some(f=>f.key==='watts'&&f.origin==='model'&&f.value==='719 W'));
  if(sku==='SYS-510P-WTR')assert.equal(copyRecord.psuTest?.model,'PWS-504P-1R');
  const load=feedRack([equipment(saved)],{headroomPercent:0,budgets:{}}).loads[0];
  assert.equal(load.watts,undefined);assert.equal(load.pf,undefined);assert.equal(copyLimits.watts,undefined);assert.equal(copyLimits.pf,undefined);
  const installed={watts:1648.5,pf:.94,minVoltage:200,maxVoltage:240,measurement:{watts:1648.5,source:'Saved measurement'}},before=structuredClone(installed);
  assert.deepEqual(libraryPowerLimits(saved.sku,saved.rawData,installed,true),libraryPowerLimits(source.sku,source.rawData,installed,true));assert.deepEqual(installed,before);
 }
});
