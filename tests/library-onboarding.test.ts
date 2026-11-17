import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySystemSpecs,systemSpecsError,type CatalogInput,type SystemComponent} from '../lib/system-specs.ts';
import {libraryOnboarding,libraryModelTemplate,onboardingMetadata} from '../lib/library-onboarding.ts';
import {completeLibraryModel} from '../lib/library-completion.ts';
import {manufacturerSpecifications} from '../lib/manufacturer-specifications.ts';
import {networkPorts} from '../lib/network-ports.ts';
import {isNetworkEnrichment} from '../lib/network-library-update.ts';
import {feedRack} from '../lib/feed-rack.ts';
import {libraryPowerLimits} from '../lib/library-power-limits.ts';
const input=(sku='CUSTOM'):CatalogInput=>({sku,vendor:'Vendor',model:sku,category:'chassis',heightRU:1,specs:emptySystemSpecs()});
const nic=(values:Partial<SystemComponent>={}):SystemComponent=>({id:'net',kind:'network',manufacturer:'Vendor',model:'Card',quantity:1,notes:'',attributes:{ports:'1',protocol:'Ethernet',connector:'RJ45',speedGbps:'1'},...values});

test('unknown models can remain drafts without invented power or network defaults',()=>{
 const i=input(),before=structuredClone(i),result=libraryOnboarding(i);
 assert.equal(result.ready,false);assert.equal(result.checks.length,5);assert.equal(result.completed,1);
 assert.equal(libraryModelTemplate(i),null);assert.deepEqual(i,before);
 const load=feedRack([{id:'x',name:'x',sku:i.sku,category:i.category,rawData:{systemSpecs:i.specs},details:{}}],{headroomPercent:0,budgets:{}}).loads[0];
 assert.equal(load.cords,0);assert.equal(load.watts,undefined);assert.equal(load.pf,undefined);
 assert.equal(onboardingMetadata(i,{}).measurementPolicy,'measured-only');
});

test('known model templates stay draft and supply capabilities rather than a configured link',()=>{
 const i=input('SYS-510P-WTR'),next=libraryModelTemplate(i)!;
 assert.equal(systemSpecsError(next.specs),null);assert.equal(next.specs.status,'draft');assert.ok(next.specs.components.length);
 assert.ok(next.specs.components.filter(c=>c.kind==='network').every(c=>!c.attributes.speedGbps&&c.attributes.supportedSpeedsGbps));
 assert.equal(libraryModelTemplate({...i,specs:{...i.specs,components:[nic()]}}),null);
 assert.equal(libraryModelTemplate({...i,heightRU:4}),null);
 assert.equal(libraryModelTemplate({...input('APDU11350ME'),category:'pdu',heightRU:0}),null);
});

test('GrandTwin base templates keep optional slots distinct from installed adapters',()=>{
 const i={...input('SYS-211GT-HNTR-CK2-TT019'),heightRU:2},next=libraryModelTemplate(i)!;
 assert.equal(next.specs.components.filter(c=>c.kind==='other').length,8);
 assert.equal(networkPorts({systemSpecs:next.specs}).length,4);
 const load=feedRack([{id:'x',name:'x',sku:i.sku,category:i.category,rawData:{systemSpecs:next.specs},details:{}}],{headroomPercent:0,budgets:{}}).loads[0];
 assert.equal(load.cords,2);assert.equal(load.minVoltage,200);assert.equal(load.watts,undefined);
});

test('manufacturer capabilities expand conservatively and never change selected links',()=>{
 const c=nic({id:'ref-data',model:'QSFP100 data ports',attributes:{ports:'32',protocol:'Ethernet',connector:'QSFP28',speedGbps:'100',supportedSpeedsGbps:'100',slot:'Front'}});
 const before={...emptySystemSpecs(),components:[c]},r=manufacturerSpecifications('DCS-7050CX3-32S',before);
 assert.deepEqual(r.conflicts,[]);assert.equal(r.specs.components[0].attributes.supportedSpeedsGbps,'40,100');assert.equal(r.specs.components[0].attributes.speedGbps,'100');
 assert.equal(manufacturerSpecifications('DCS-7050CX3-32S',r.specs).changes.length,0);
 const conflicting={...before,components:[{...c,attributes:{...c.attributes,supportedSpeedsGbps:'200'}}]};
 assert.ok(manufacturerSpecifications('DCS-7050CX3-32S',conflicting).conflicts.length);
 assert.equal(conflicting.components[0].attributes.supportedSpeedsGbps,'200');
});

test('adding a documented management endpoint preserves all existing port identities and constraints',()=>{
 const c=nic({id:'data',model:'Quantum HDR InfiniBand',attributes:{ports:'40',slot:'front',protocol:'InfiniBand',connector:'QSFP56',speedGbps:'200'}}),i={...input('UNC-MQM8700-HS2F'),category:'switch'},before={systemSpecs:{...emptySystemSpecs(),components:[c]}};
 const result=completeLibraryModel(i,before),old=networkPorts(before),next=networkPorts(result.rawData);
 assert.equal(next.length,41);assert.deepEqual(next.slice(0,40).map(p=>p.id),old.map(p=>p.id));assert.equal(isNetworkEnrichment(before,result.rawData),true);
 assert.deepEqual(completeLibraryModel(i,result.rawData).rawData,result.rawData);
 assert.equal(isNetworkEnrichment(before,{systemSpecs:emptySystemSpecs()}),false);
 assert.equal(isNetworkEnrichment(before,{systemSpecs:{...before.systemSpecs,components:[{...c,id:'renamed'}]}}),false);
 assert.equal(isNetworkEnrichment(before,{systemSpecs:{...before.systemSpecs,components:[{...c,attributes:{...c.attributes,protocol:'Ethernet'}}]}}),false);
});

test('APC mixed management speeds do not give both old endpoints gigabit capability',()=>{
 const i={...input('UNC-APDU10151ME'),category:'pdu',heightRU:0},before={systemSpecs:{...emptySystemSpecs(),components:[nic({id:'pdu-mgmt',model:'Dual Ethernet management',attributes:{slot:'MGMT',ports:'2',connector:'RJ45',protocol:'Ethernet'}})]}};
 const result=completeLibraryModel(i,before),ports=networkPorts(result.rawData);
 assert.ok(ports.every(p=>p.speedGbps===null&&!p.supportedSpeedsGbps?.includes(1)));
 assert.match(result.rawData.systemSpecs.components[0].notes,/gigabit socket/);
});

test('placeholder identities and shared-power nodes cannot receive a completed onboarding status',()=>{
 for(const i of [{...input('NVIDIA-B300-4U'),heightRU:4},{...input('SYS-211GT-CU1-NODE'),heightRU:0,category:'node'}]){
  const result=libraryOnboarding(i);assert.equal(result.ready,false);assert.equal(libraryModelTemplate(i),null);
  assert.ok(result.checks.some(c=>c.id==='identity'&&!c.ready));
 }
});

test('QM8700 AC reference uses the documented high-line band without bridging its voltage gap',()=>{
 const limits=libraryPowerLimits('QM8700',{},undefined,true);
 assert.equal(limits.minVoltage,200);assert.equal(limits.maxVoltage,240);
 assert.equal(limits.watts,undefined);assert.equal(limits.pf,undefined);
 assert.equal(libraryPowerLimits('QM8700',{},undefined,false).minVoltage,undefined);
 assert.equal(libraryPowerLimits('QM8700',{}, {connector:'DC'},true).minVoltage,undefined);
 assert.equal(libraryPowerLimits('QM8700',{}, {minVoltage:100,maxVoltage:127},true).maxVoltage,127);
});
