import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {emptySystemSpecs,mergeSystemSpecs,systemSpecsError,type SystemComponent} from '../lib/system-specs.ts';
import {readFeedInputs,feedRack} from '../lib/feed-rack.ts';
import {feedInputsError} from '../lib/feed-power.ts';
import {cableLimitSource} from '../lib/cable-limit-source.ts';
import {libraryPowerLimits} from '../lib/library-power-limits.ts';
import {libraryReadiness} from '../lib/library-readiness.ts';
import {maintainLibraryReference} from '../lib/library-reference-maintenance.ts';
import {libraryIntegrity} from '../lib/library-integrity.ts';
import {networkPorts} from '../lib/network-ports.ts';
import profiles from '../data/catalog/researched-profiles.json' with {type:'json'};
const raw=(components:SystemComponent[]=[])=>({systemSpecs:{...emptySystemSpecs(),components}});
const psu=(quantity=4):SystemComponent=>({id:'psu',kind:'psu',quantity,manufacturer:'Supermicro',model:'Power supply — exact installed part number pending',attributes:{outputWatts:quantity===4?'2000':'3000',redundancy:quantity===4?'2+2':'3+3'},notes:''});

test('legacy import retains saved watts/amps and their provenance without inventing cord ratings',()=>{
 const input={px3Power:{pf:.95,budgets:{one:{watts:400,connector:'C13',confirmed:true,source:'Vendor budget'},two:{watts:900,connector:'C19',confirmed:false,cordAmps:13,pf:.91,testOnly:true}}}};
 const before=JSON.stringify(input),result=readFeedInputs(input,[]);
 assert.equal(result.budgets.one.cordLimitAmps,undefined);assert.equal(result.budgets.two.cordLimitAmps,13);
 assert.equal(result.budgets.one.watts,400);assert.equal(result.budgets.one.pf,.95);assert.equal(result.budgets.two.pf,.91);
 assert.match(result.budgets.one.estimateSource!,/Vendor budget/);assert.match(result.budgets.one.pfEstimateSource!,/shared rack/);
 assert.match(result.budgets.two.estimateSource!,/synthetic test/);assert.equal(result.budgets.one.measurement,undefined);
 assert.equal(JSON.stringify(input),before);assert.equal(feedInputsError(result),null);
});
test('existing limits stay effective and are labeled without pretending their origin is proven',()=>{
 const input={feedPower:{headroomPercent:0,budgets:{one:{watts:400,pf:.95,cordLimitAmps:12,connector:'C13'}}}};
 assert.deepEqual(readFeedInputs(input),input.feedPower);
 assert.match(cableLimitSource(input.feedPower.budgets.one)!,/matches a legacy default/);
 assert.equal(cableLimitSource({cordLimitAmps:12,cordLimitSource:'Chosen planning constraint'}),'Chosen planning constraint');
 assert.equal(feedInputsError({...input.feedPower,budgets:{one:{...input.feedPower.budgets.one,cordLimitSource:'x'.repeat(1001)}}}),'Check cable planning limit source.');
});
test('Library saves synchronize only legacy PSU counts and remove stale field reviews',()=>{
 const p=psu();p.fieldReviews={inputVoltage:{value:'100-240 VAC',model:p.model,manufacturer:p.manufacturer,source:'https://example.org/spec',reviewedAt:'2026-11-15'}};
 p.attributes.inputVoltage='200-240 VAC';const original={...raw([p]),psu:{count:2,watts:1600},custom:'keep'},before=JSON.stringify(original);
 const saved=mergeSystemSpecs(original,original.systemSpecs);
 assert.deepEqual(saved.psu,{count:4,watts:1600});assert.equal(saved.systemSpecs.components[0].fieldReviews,undefined);assert.equal(saved.custom,'keep');
 assert.equal(JSON.stringify(original),before);
});
test('reviewed N+N requirements inherit; saved limits and unrelated PSU arrangements stay independent',()=>{
 for(const [sku,count,minimum] of [['SYS-420GP-TNR',4,2],['SYS-821GV-TNR',6,3]] as const){
  const original={...raw([psu(count)]),psu:{count:2,watts:1600}},next=maintainLibraryReference(sku,original).rawData;
  const limits=libraryPowerLimits(sku,next);assert.equal(limits.minimumCords,minimum);assert.equal(limits.minVoltage,200);assert.equal(limits.maxVoltage,240);
  assert.equal(limits.psuAcCapacity,undefined);assert.equal(limits.cordLimitAmps,undefined);assert.equal(limits.watts,undefined);
  assert.equal(libraryPowerLimits(sku,next,{minimumCords:1}).minimumCords,1);
  assert.deepEqual(maintainLibraryReference(sku,next).rawData,next);
 }
 assert.equal(libraryPowerLimits('CUSTOM',raw([psu()])).minimumCords,undefined);
});
test('AC-only Arista voltage reference preserves DC/unknown variants and explicit installation settings',()=>{
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S',raw()).minVoltage,undefined);
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S',raw(),{connector:'Hardwired'}).minVoltage,undefined);
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S',raw(),{connector:'C13'}).minVoltage,100);
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S-OTHER',raw(),{connector:'C13'}).minVoltage,undefined);
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S',raw(),{connector:'C13',minVoltage:200}).minVoltage,200);
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S',raw(),{},true).minVoltage,100);
 assert.equal(libraryPowerLimits('DCS-7050CX3-32S',raw(),{connector:'DC'},true).minVoltage,undefined);
 assert.equal(feedRack([{id:'arista',name:'Arista',sku:'DCS-7050CX3-32S',category:'switch',rawData:raw([psu(2)]),details:{}}],{headroomPercent:0,budgets:{}}).loads[0].connector,'');
});
test('placeholder and shared-power node records never silently create two PSUs',()=>{
 const r={...raw(),catalogReference:{basis:'model-pending'}};
 for(const category of ['node','chassis']){
  const equipment={id:'node',name:'Reference',sku:'PENDING',category,rawData:r,details:{}};
  const load=feedRack([equipment],{headroomPercent:0,budgets:{}}).loads[0];assert.equal(load.cords,0);
  assert.equal(libraryReadiness('PENDING',category,r).label,'Reference only');
 }
});
test('B300 capability enrichment keeps physical endpoints and configured fabric unknown',()=>{
 const p=profiles.find(p=>p.key==='smc-b3008u')!;
 const original=raw(p.components as SystemComponent[]),next=maintainLibraryReference('AS-8126GS-NB3RT',original).rawData;
 assert.deepEqual(networkPorts(original).map(p=>p.id),networkPorts(next).map(p=>p.id));
 const cx=networkPorts(next).filter(p=>p.connector==='OSFP');assert.equal(cx.length,8);
 assert.ok(cx.every(p=>p.speedGbps===null&&p.protocol==='Other'&&p.supportedSpeedsGbps?.includes(800)));
 assert.equal(libraryReadiness('AS-8126GS-NB3RT','chassis',next).label,'Configuration incomplete');
});
test('shared templates have valid schemas, stable identities and existing front/rear assets',()=>{
 const records=profiles.map(p=>({sku:p.skus[0],model:p.label,rawData:raw(p.components as SystemComponent[])}));
 assert.deepEqual(libraryIntegrity(records,path=>existsSync('public'+path)),[]);
 for(const record of records){const next=maintainLibraryReference(record.sku,record.rawData).rawData;assert.equal(systemSpecsError(next.systemSpecs),null);assert.deepEqual(networkPorts(next).map(p=>p.id),networkPorts(record.rawData).map(p=>p.id));}
 const b300=profiles.find(p=>p.key==='smc-b3008u')!;
 assert.doesNotMatch(JSON.stringify(b300),/not implemented|targets are intentionally absent|mapping remains unvalidated/);
 assert.match(b300.drawing.audit,/Internal PSU redundancy/);
 const template=JSON.parse(readFileSync('data/catalog/supermicro-as-8126gs-nb3rt.json','utf8'));
 assert.doesNotMatch(template.specs.notes,/does not validate that topology/);
});
test('integrity audit catches conflicting metadata, stale reviews, duplicate identities and missing art',()=>{
 const p=psu();p.fieldReviews={redundancy:{value:'3+3',model:p.model,manufacturer:p.manufacturer,source:'https://example.org/spec',reviewedAt:'2026-11-15'}};
 const r={sku:'SYS-420GP-TNR',model:'Reference',rawData:{...raw([p]),psu:{count:2}}};
 const errors=libraryIntegrity([r,r],()=>false);
 for(const text of ['stale','counts disagree','duplicate Library','missing front','missing rear'])assert.ok(errors.some(e=>e.includes(text)),text);
 const n:SystemComponent={id:'net',kind:'network',quantity:1,manufacturer:'Vendor',model:'Card',notes:'',attributes:{ports:'1',speedGbps:'100',supportedSpeedsGbps:'25,50'}};
 assert.match(systemSpecsError(raw([n]).systemSpecs)!,/Selected network speed/);
});
test('maintenance and future saves use the existing SKU-specific Raritan reference paths',()=>{
 const original={...raw(),catalogReference:{frontSvg:'/old.svg',rearSvg:'/old.svg',source:'keep'}};
 const next=maintainLibraryReference('PX3-4068YV-V2-K2',original).rawData;
 assert.deepEqual(next.catalogReference,{profile:'raritan-px3',frontSvg:'/equipment-artwork/raritan-px3-k2-horizontal-front.svg',rearSvg:'/equipment-artwork/raritan-px3-k2-horizontal-rear.svg',source:'keep'});
 assert.equal(original.catalogReference.frontSvg,'/old.svg');
});
