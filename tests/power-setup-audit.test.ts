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
test('audit exposes remaining cord requirement together, separating pending PSU documentation',()=>{
 const checks=powerSetupAudit([device],{headroomPercent:0,budgets:{s:{watts:450,pf:.9}}});
 assert.deepEqual(checks.filter(c=>c.blocking&&c.target==='power-equipment').map(c=>c.field),['cordLimitAmps']);assert.deepEqual(checks.filter(c=>!c.blocking).map(c=>c.field),['psuAcCapacity']);
 const missing=powerSetupAudit([{...device,rawData:{}}],{headroomPercent:0,budgets:{}});for(const field of ['watts','pf','connector','cordLimitAmps'])assert.ok(missing.some(c=>c.field===field&&c.blocking));
});
