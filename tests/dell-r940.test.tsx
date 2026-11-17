import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import record from '../data/catalog/dell-r940-planning.json';
import {catalogInputError,type CatalogInput,type SystemSpecs} from '../lib/system-specs';
import {catalogProfile,artworkUrl} from '../lib/catalog-artwork';
import {libraryOnboarding,libraryModelTemplate,onboardingMetadata} from '../lib/library-onboarding';
import {catalogPowerInputs} from '../lib/power-input-geometry';
import {r940NetworkBox,R940_FACE_HEIGHT} from '../lib/dell-r940-layout';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {networkPorts,networkEndpoint,portCompatibility} from '../lib/network-ports';
import {FaceConnections} from '../app/projects/[id]/racks/[rackId]/face-connections';
import {RackGrid,type RackGridDevice} from '../app/projects/[id]/racks/[rackId]/physical-rack-grid';
import {RackOverview3D} from '../app/projects/[id]/racks/[rackId]/rack-overview-3d';
import {readRackConfig} from '../lib/rack-config';
import {addDellR940,type LibraryAddPlan} from '../scripts/add-dell-r940';

const input:CatalogInput={...record,specs:record.rawData.systemSpecs as unknown as SystemSpecs};
const server:FeedEquipment={id:'r940',name:'R940',sku:record.sku,model:record.model,category:'chassis',mounting:'front',startRU:1,details:{},rawData:record.rawData};
function fixture(){
 const pdus:FeedEquipment[]=['A','B'].map(feed=>({id:feed,name:feed,category:'pdu',mounting:`rear-${feed==='A'?'left':'right'}`,startRU:1,details:{feed},rawData:{electricalProfile:{topology:'single-phase',voltage:230,limitAmps:24,confirmed:false,branches:{B1:16},outlets:[1,2,3,4].map(n=>({n,connectors:['C19'],phase:'L1',branch:'B1',limitAmps:16}))}}}));
 return {equipment:[...pdus,structuredClone(server)],inputs:{headroomPercent:0,budgets:{r940:{watts:1200,pf:.95,estimateSource:'Synthetic integration test only'}}}};
}

test('R940 selected planning variant passes onboarding without fabricated demand, PF or optional parts',()=>{
 assert.equal(catalogInputError(input),null);
 const result=libraryOnboarding(input,record.rawData);assert.equal(result.ready,true,JSON.stringify(result));
 assert.deepEqual(onboardingMetadata(input,record.rawData),record.rawData.libraryOnboarding);
 const load=feedRack([server],{headroomPercent:0,budgets:{}}).loads[0];
 assert.equal(load.cords,2);assert.equal(load.minimumCords,1);assert.equal(load.connector,'C19');
 assert.equal(load.minVoltage,200);assert.equal(load.maxVoltage,240);
 for(const k of ['watts','pf','psuAcCapacity','cordLimitAmps'] as const)assert.equal(load[k],undefined,k);
 assert.equal(input.specs.components.filter(c=>c.kind==='network').length,2);
 assert.equal(input.specs.components.some(c=>['cpu','drive','memory','gpu'].includes(c.kind)),false);
 assert.equal(catalogProfile('R940'),undefined,'Bare model must not imply this optional configuration');
 const template=libraryModelTemplate({...input,specs:{...input.specs,components:[]}})!;
 assert.ok(template);assert.equal(libraryOnboarding(template).ready,true);
 assert.ok(networkPorts({systemSpecs:template.specs}).every(p=>p.speedGbps===null));
});

test('R940 uses the existing A/B planner, follows physical sides and retains wiring after reload',()=>{
 const f=fixture(),before=structuredClone(f.equipment),plan=simplePowerPlan(f.equipment,{feedPower:f.inputs});
 assert.equal(plan.error,undefined);assert.equal(plan.assignments.length,2);
 assert.equal(plan.assignments.find(c=>c.inlet===1)?.pduId,'A');assert.equal(plan.assignments.find(c=>c.inlet===2)?.pduId,'B');
 assert.ok(plan.assignments.every(c=>c.outlet===1));assert.ok(plan.routingNotes.every(n=>!n.attention));
 assert.deepEqual(f.equipment,before);
 for(const c of plan.assignments)f.equipment.find(e=>e.id===c.pduId)!.details={feed:c.pduId,outlets:{[c.outlet]:{deviceId:c.deviceId,inlet:c.inlet,notes:''}}};
 const reloaded=JSON.parse(JSON.stringify(f.equipment));
 const next=simplePowerPlan(reloaded,{feedPower:f.inputs});assert.equal(next.error,undefined);assert.equal(next.remaining.length,0);assert.deepEqual(next.assignments,plan.assignments);
 const swapped=fixture();for(const e of swapped.equipment.filter(e=>e.category==='pdu'))e.mounting=e.mounting!.replace(/left|right/,s=>s==='left'?'right':'left');
 const other=simplePowerPlan(swapped.equipment,{feedPower:swapped.inputs});assert.equal(other.error,undefined);
 assert.equal(other.assignments.find(c=>c.inlet===1)?.pduId,'B');assert.equal(other.assignments.find(c=>c.inlet===2)?.pduId,'A');
});

test('R940 cannot bypass absent measurements, incompatible voltage or feed-loss capacity',()=>{
 const f=fixture();assert.ok(simplePowerPlan(f.equipment,{feedPower:{headroomPercent:0,budgets:{}}}).error);
 const low=fixture();for(const p of low.equipment.filter(e=>e.category==='pdu'))(p.rawData as {electricalProfile:{voltage:number}}).electricalProfile.voltage=120;
 assert.ok(simplePowerPlan(low.equipment,{feedPower:low.inputs}).error);
 const overload=fixture();overload.inputs.budgets.r940.watts=4000;
 // Normal 2 x 2 kW fits each 16 A bank, but one surviving feed cannot carry 4 kW.
 assert.ok(simplePowerPlan(overload.equipment,{feedPower:overload.inputs}).error);
});

test('rNDC identities, common adapter speed and iDRAC remain distinct through a JSON save/reload',()=>{
 const ports=networkPorts(JSON.parse(JSON.stringify(record.rawData)));
 assert.equal(ports.length,3);assert.ok(ports.every(p=>p.reviewed));assert.ok(ports.every(p=>p.speedGbps===null));
 const data=ports.filter(p=>p.position==='rndc');assert.equal(data.length,2);
 assert.deepEqual(data.map(p=>p.supportedSpeedsGbps),[[10,25],[10,25]]);
 assert.equal(networkEndpoint(1,'chassis',data[0]),'U01-rNDC-P1');
 assert.equal(networkEndpoint(1,'chassis',ports[2]),'U01-MGMT');
 const changed={systemSpecs:structuredClone(input.specs)};changed.systemSpecs.components[1].attributes.speedGbps='25';
 const selected=networkPorts(changed);assert.deepEqual(selected.slice(0,2).map(p=>p.speedGbps),[25,25]);
 assert.deepEqual(selected.map(p=>p.id),ports.map(p=>p.id));
 assert.equal(portCompatibility(data[0],{...data[0],speedGbps:25},'DAC').error,undefined);
 assert.ok(portCompatibility(data[0],ports[2],'Cat6/Cat6a').error);
});

test('R940 rear artwork and clickable power/network ports use the same 3U coordinate space',()=>{
 const profile=catalogProfile(record.sku)!;const ports=networkPorts(record.rawData);
 for(const face of ['front','rear'] as const){
  const svg=readFileSync('public'+artworkUrl(profile,face),'utf8');assert.ok(svg.includes(`viewBox="0 0 800 ${R940_FACE_HEIGHT}"`));
  const markup=renderToStaticMarkup(<svg><FaceConnections profile={profile} face={face} ports={ports} deviceId="r940"/></svg>);
  assert.equal((markup.match(/class="psu-hit"/g)||[]).length,face==='rear'?2:0);
  assert.equal((markup.match(/Available/g)||[]).length,face==='rear'?3:0);
  if(face==='rear'){
   for(const {n,box} of catalogPowerInputs(profile)){assert.ok(svg.includes(`data-psu-inlet="${n}"`));assert.ok(markup.includes(`data-psu-inlet="${n}"`));assert.ok(box.y+box.h<R940_FACE_HEIGHT);}
   for(const p of ports){const box=r940NetworkBox(p.position,p.number)!;assert.ok(box);assert.ok(markup.includes(`x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"`));}
  }
 }
});

test('R940 rack renderers fit the full 3U reference in the same SVG as its targets',()=>{
 const devices:RackGridDevice[]=[{id:'r940',label:'R940',startRU:1,mounting:'front',details:{},catalogDevice:record,networkPorts:networkPorts(record.rawData)}];
 const config=readRackConfig({profile:'custom',pduA:false,pduB:false});
 const rack=renderToStaticMarkup(<RackGrid devices={devices} heightRU={6} config={config} rear disabled onPsu={()=>{}}/>);
 assert.ok(rack.includes('catalog-hardware-face'));assert.ok(rack.includes('viewBox="0 0 800 224"'));
 assert.ok(rack.includes('<image href="/equipment-artwork/dell-r940-rear.svg" width="800" height="224"'));
 assert.equal((rack.match(/data-psu-inlet=/g)||[]).length,2);
 const overview=renderToStaticMarkup(<RackOverview3D devices={devices} heightRU={6} config={config} onEdit={()=>{}}/>);
 assert.ok(overview.includes('viewBox="0 0 800 224"'));assert.ok(!overview.includes('height="440"'));
});

test('R940 publication is insert-only and idempotent, stops on drift and protects installed records',async()=>{
 let rows:Record<string,unknown>[]=[],installed=false;const writes:string[]=[];
 const db={async query(sql:string){
  if(sql.startsWith('SELECT id,sku'))return {rows};
  if(sql.startsWith('SELECT id FROM'))return {rows:installed?[{id:'installed'}]:[]};
  if(sql.startsWith('INSERT')){writes.push(sql);rows=[structuredClone(record)];return {rows:[],rowCount:1};}
  if(sql.startsWith('DELETE')){writes.push(sql);rows=[];return {rows:[],rowCount:1};}
  return {rows:[]};
 }};
 const plan=await addDellR940(db,'plan') as LibraryAddPlan;assert.equal(plan.changed,true);assert.equal(writes.length,0);
 await addDellR940(db,'apply',plan);await addDellR940(db,'verify',plan);
 assert.equal(libraryOnboarding({...record,specs:(rows[0].rawData as {systemSpecs:SystemSpecs}).systemSpecs},rows[0].rawData).ready,true);
 assert.deepEqual(networkPorts(rows[0].rawData).map(p=>p.id),networkPorts(record.rawData).map(p=>p.id));
 const again=await addDellR940(db,'plan') as LibraryAddPlan;await addDellR940(db,'apply',again);assert.equal(writes.length,1);
 installed=true;await assert.rejects(addDellR940(db,'rollback',plan),/now installed/);assert.equal(rows.length,1);
 installed=false;await addDellR940(db,'rollback',plan);assert.equal(rows.length,0);
 rows=[{...record,model:'Changed configuration'}];await assert.rejects(addDellR940(db,'apply',plan),/preserved without writes/);
 assert.ok(writes.every(s=>/^(INSERT INTO|DELETE FROM) "CatalogDevice"/.test(s)));
});
