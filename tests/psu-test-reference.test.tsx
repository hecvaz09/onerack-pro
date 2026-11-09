import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {psuTestReference,PWS_504P_1R_TEST} from '../lib/psu-test-reference';
import {equipmentRecord} from '../lib/equipment-record';
import {EquipmentRecordSummary} from '../app/equipment/equipment-record-summary';
import {catalogPowerLimits} from '../lib/catalog-power-limits';
const raw=(model='PWS-504P-1R')=>({systemSpecs:{version:1,status:'verified',description:'',sourceUrl:'',notes:'',custom:[],components:[{id:'psu',kind:'psu',manufacturer:'Supermicro',model,quantity:2,attributes:{outputWatts:'500',inputVoltage:'100–240 VAC'},notes:''}]}});
test('bench report requires exact server and compatible recorded PSU identity',()=>{
 assert.equal(psuTestReference('SYS-510P-WTR',raw()),PWS_504P_1R_TEST);
 for(const model of ['SYS-510P-WT','SYS-510P-WTR-EU','OTHER'])assert.equal(psuTestReference(model,raw()),undefined);
 assert.equal(psuTestReference('SYS-510P-WTR',raw('PWS-504P-1R2')),undefined);
});
test('report does not turn bench watts or PF into installation demand or AC budget',()=>{
 const record=equipmentRecord('SYS-510P-WTR',raw());
 for(const key of ['watts','pf','psuAcCapacity','cordLimitAmps'])assert.equal(record.facts.find(f=>f.key===key)?.origin,'unknown');
 assert.equal(catalogPowerLimits(raw()).psuAcCapacity,undefined);
 const saved=equipmentRecord('SYS-510P-WTR',raw(),{watts:180,pf:.93});
 assert.equal(saved.facts.find(f=>f.key==='watts')?.value,'180 W');
 assert.equal(saved.facts.find(f=>f.key==='pf')?.value,'0.93');
});
test('existing equipment record exposes the sourced report with conditions and caveats',()=>{
 const html=renderToStaticMarkup(createElement(EquipmentRecordSummary,{model:'SYS-510P-WTR',raw:raw()}));
 for(const value of ['94.11%','92.61%','547 W','230','60 Hz','SO-179.3','not this server','Fan power'])assert.ok(html.includes(value),value);
});

test('Library SKU identifies the server even with a customized display name',()=>{
 const record=equipmentRecord('SMC 1U Server',raw(),undefined,'SYS-510P-WTR');
 assert.equal(record.psuTest?.model,'PWS-504P-1R');
});
