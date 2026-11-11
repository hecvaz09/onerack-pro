import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySystemSpecs,type SystemComponent} from '../lib/system-specs.ts';
import {catalogPowerLimits} from '../lib/catalog-power-limits.ts';
import {libraryPowerLimits} from '../lib/library-power-limits.ts';
import {feedRack} from '../lib/feed-rack.ts';
import {equipmentRecord} from '../lib/equipment-record.ts';
const psu=():SystemComponent=>({id:'original-psu',kind:'psu',manufacturer:'Supermicro',model:'PWS-504P-1R',quantity:2,attributes:{inputVoltage:'100–240 VAC',outputWatts:'500'},notes:''});
const raw=(p=psu())=>({systemSpecs:{...emptySystemSpecs(),components:[p]}});
test('draft exact PSU inherits reviewed voltage without promoting unrelated fields or modifying the record',()=>{
 const r=raw(),before=JSON.stringify(r);
 assert.deepEqual(catalogPowerLimits(r),{minVoltage:100,maxVoltage:240});
 assert.equal(JSON.stringify(r),before);
 for(const field of ['watts','pf','cordLimitAmps','psuAcCapacity','connector'])assert.equal(libraryPowerLimits('SYS-510P-WTR',r)[field],undefined);
 const changed=psu();changed.model+='2';assert.deepEqual(catalogPowerLimits(raw(changed)),{});
 changed.model='PWS-504P-1R';changed.attributes.inputVoltage='200-240 VAC';assert.deepEqual(catalogPowerLimits(raw(changed)),{});
});
test('field approval expires when its value or component identity changes',()=>{
 const p=psu();p.model='Exact AC PSU';p.attributes.inlet='C14';
 p.fieldReviews={inlet:{value:'C14',model:p.model,manufacturer:p.manufacturer,source:'https://manufacturer.example/spec',reviewedAt:'2026-11-10'}};
 assert.equal(catalogPowerLimits(raw(p)).connector,'C13');
 p.attributes.inlet='C20';assert.equal(catalogPowerLimits(raw(p)).connector,undefined);
 p.attributes.inlet='C14';p.model='Different PSU';assert.equal(catalogPowerLimits(raw(p)).connector,undefined);
});
test('Library summary and rack inherit the same limits while saved overrides survive',()=>{
 const r=raw(),saved={watts:450,pf:.95,minVoltage:110,maxVoltage:230};
 const e={id:'server',name:'SMC 1U',sku:'SYS-510P-WTR',category:'chassis',rawData:r,details:{}};
 const load=feedRack([e],{headroomPercent:0,budgets:{server:saved}}).loads[0];
 const summary=equipmentRecord(e.name,r,saved,e.sku);
 assert.equal(load.minVoltage,110);assert.equal(load.watts,450);assert.equal(load.pf,.95);
 assert.equal(summary.facts.find(f=>f.key==='minVoltage')?.value,'110 V');
 assert.equal(libraryPowerLimits(e.sku,r,{minVoltage:0}).minVoltage,0);
 assert.equal(libraryPowerLimits(e.sku,r,{minVoltage:undefined}).minVoltage,100);
});
