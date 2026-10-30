import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogInputError,type CatalogInput} from '../lib/system-specs.ts';
import {networkPorts} from '../lib/network-ports.ts';
import {equipmentRecord} from '../lib/equipment-record.ts';
import {catalogProfile} from '../lib/catalog-artwork.ts';

const entry=JSON.parse(readFileSync('data/catalog/supermicro-as-8126gs-nb3rt.json','utf8')) as CatalogInput;
const raw={systemSpecs:entry.specs};

test('exact AMD B300 identity validates as an independent 8U air-cooled model',()=>{
 assert.equal(catalogInputError(entry),null);
 assert.equal(entry.sku,'AS-8126GS-NB3RT');assert.equal(entry.model,entry.sku);
 assert.equal(entry.vendor,'Supermicro');assert.equal(entry.heightRU,8);assert.equal(entry.category,'chassis');
 assert.equal(entry.specs.status,'draft');
 assert.ok(entry.specs.custom.some(c=>c.name==='Platform and cooling'&&c.value.includes('air-cooled')));
});

test('fixed GPU and PSU capabilities do not fabricate measured demand or AC capacity',()=>{
 const gpu=entry.specs.components.find(c=>c.kind==='gpu')!,psu=entry.specs.components.find(c=>c.kind==='psu')!;
 assert.equal(gpu.quantity,8);assert.equal(gpu.attributes.memoryGB,'288');assert.equal(gpu.attributes.tdpWatts,undefined);
 assert.equal(psu.quantity,6);assert.equal(psu.attributes.outputWatts,'6600');
 assert.equal(psu.attributes.acCapacityWatts,undefined);assert.equal(psu.attributes.inlet,undefined);
 const facts=equipmentRecord(entry.model,raw).facts;
 for(const key of ['watts','pf','psuAcCapacity','cordLimitAmps','minimumCords'])assert.equal(facts.find(f=>f.key===key)!.origin,'unknown',key);
 assert.equal(facts.find(f=>f.key==='psuDcWatts')!.value,'6600 W');
 assert.ok(!Object.hasOwn(raw,'powerLoad'));assert.ok(!Object.hasOwn(entry,'configuration'));
});

test('only fixed network connectors are exposed; unselected fabric and optional DPUs stay explicit',()=>{
 const ports=networkPorts(raw),cx=ports.filter(p=>p.connector==='OSFP');
 assert.equal(ports.length,11);assert.equal(new Set(ports.map(p=>p.id)).size,11);
 assert.equal(cx.length,8);assert.ok(cx.every(p=>p.protocol==='Other'&&p.speedGbps===null&&!p.reviewed));
 assert.deepEqual(ports.filter(p=>p.position==='lan').map(p=>[p.endpoint,p.speedGbps,p.connector]),[['LAN1',10,'RJ45'],['LAN2',10,'RJ45']]);
 const mgmt=ports.filter(p=>p.position==='mgmt');assert.equal(mgmt.length,1);assert.equal(mgmt[0].endpoint,'MGMT');assert.equal(mgmt[0].speedGbps,null);
 assert.ok(!entry.specs.components.some(c=>/BlueField/i.test(c.model)));
 assert.deepEqual(networkPorts(structuredClone(raw)).map(p=>p.id),ports.map(p=>p.id));
});

test('memory bays and optional parts are capabilities, not invented installed components',()=>{
 assert.ok(!entry.specs.components.some(c=>c.kind==='memory'||c.kind==='drive'));
 const cpu=entry.specs.components.find(c=>c.kind==='cpu')!;
 assert.equal(cpu.attributes.socket,'SP5');assert.equal(cpu.attributes.tdpWatts,undefined);
 assert.ok(entry.specs.custom.some(c=>c.name==='Host memory capability'&&c.value.includes('Installed DIMM')));
 assert.ok(entry.specs.custom.some(c=>c.name==='Storage capacity, not installed drives'));
});

test('B300 does not inherit different-model B200 or unverified 4U placeholder artwork',()=>{
 assert.equal(catalogProfile(entry.sku,entry.model),undefined);
 assert.equal(catalogProfile('AS-8126GS-TNMR-2CX8-IB-DRAFT')!.key,'smc-as8126');
 assert.equal(catalogProfile('NVIDIA-B300-4U')!.key,'b300-pending');
});
