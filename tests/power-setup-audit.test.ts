import test from 'node:test';
import assert from 'node:assert/strict';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {powerSetupAudit} from '../lib/power-setup-audit';
const raw={systemSpecs:{version:1,status:'verified',description:'',sourceUrl:'',notes:'',custom:[],components:[{id:'psu',kind:'psu',manufacturer:'Synthetic',model:'PSU',quantity:2,attributes:{inlet:'C14',inputVoltage:'100-240 VAC'},notes:''}]}};
const device:FeedEquipment={id:'s',name:'Synthetic server',category:'node',model:'Test',rawData:raw,details:{}};
test('blank connector overrides inherit verified Library inlet and voltage, explicit overrides win',()=>{
 const inputs={headroomPercent:0,budgets:{s:{watts:450,pf:.9,connector:''}}};
 const load=feedRack([device],inputs).loads[0];assert.equal(load.connector,'C13');assert.equal(load.minVoltage,100);assert.equal(load.maxVoltage,240);assert.equal(load.cordLimitAmps,undefined);assert.equal(load.psuAcCapacity,undefined);
 assert.equal(feedRack([device],{...inputs,budgets:{s:{...inputs.budgets.s,connector:'C19'}}}).loads[0].connector,'C19');
});
test('audit separates rack cable verification from per-device PSU documentation',()=>{
 const checks=powerSetupAudit([device],{headroomPercent:0,budgets:{s:{watts:450,pf:.9}}});
 assert.deepEqual(checks.filter(c=>c.blocking&&c.target==='power-equipment').map(c=>c.field),[]);assert.deepEqual(checks.filter(c=>!c.blocking&&c.scope!=='rack').map(c=>c.field),['psuAcCapacity']);assert.equal(checks.filter(c=>c.scope==='rack'&&!c.blocking).length,1);
 const missing=powerSetupAudit([{...device,rawData:{}}],{headroomPercent:0,budgets:{}});for(const field of ['watts','pf'])assert.ok(missing.some(c=>c.field===field&&c.blocking));
});
test('identical models with a saved cable limit and no cable limit share one installation reminder',()=>{
 const equipment=[{...device,id:'older',startRU:51},{...device,id:'newer',startRU:58}];
 const inputs={headroomPercent:0,budgets:{older:{watts:719,pf:.975,cordLimitAmps:12},newer:{watts:719,pf:.975}}};
 const before=structuredClone(inputs),checks=powerSetupAudit(equipment,inputs);
 assert.equal(checks.filter(c=>c.scope==='rack').length,1);
 assert.ok(checks.filter(c=>c.scope==='rack').every(c=>!c.blocking));
 assert.ok(!checks.some(c=>c.field==='cordLimitAmps'));
 assert.deepEqual(checks.filter(c=>c.deviceId==='older').map(c=>c.field),checks.filter(c=>c.deviceId==='newer').map(c=>c.field));
 assert.deepEqual(inputs,before);
 const loads=feedRack(equipment,inputs).loads;
 assert.equal(loads[0].cordLimitAmps,12);assert.equal(loads[1].cordLimitAmps,undefined);
});
test('numeric planning limits do not dismiss physical cable verification, and an empty rack has no cable reminder',()=>{
 const checks=powerSetupAudit([device],{headroomPercent:0,budgets:{s:{watts:450,pf:.9,cordLimitAmps:12}}});
 assert.equal(checks.filter(c=>c.scope==='rack'&&!c.blocking).length,1);
 assert.equal(powerSetupAudit([],{headroomPercent:0,budgets:{}}).filter(c=>c.scope==='rack').length,0);
});
