import test from 'node:test';
import assert from 'node:assert/strict';
import {psuConnectionStatuses} from '../lib/psu-connection-status.ts';
import {applyPowerSave} from '../lib/power-feed-progress.ts';
import {b300PowerFixture} from './fixtures/b300-power.ts';
import {B300_INPUT_IDENTITY} from '../lib/b300-power-inputs.ts';
const status=(f:ReturnType<typeof b300PowerFixture>)=>psuConnectionStatuses(f.equipment,{feedPower:f.inputs}).b300;
function saved(f:ReturnType<typeof b300PowerFixture>,inlet=12,extra={}){
 const pdu=f.equipment.find(e=>e.category==='pdu')!;
 const outlet=1;
 pdu.details={outlets:{[outlet]:{deviceId:'b300',inlet,inputIdentity:B300_INPUT_IDENTITY,notes:'',...extra}}};
 return pdu;
}
test('all twelve inputs start off; saved state is independent per input',()=>{
 const f=b300PowerFixture();assert.equal(Object.values(status(f)).filter(s=>s.state==='off').length,12);
 saved(f);assert.notEqual(status(f)[12].state,'off');assert.equal(status(f)[11].state,'off');
});
test('failed save leaves state unchanged and successful clear turns the input off',()=>{
 const f=b300PowerFixture(),pdu=saved(f);const before=status(f)[12];
 f.equipment=applyPowerSave(f.equipment,{error:'failed'});assert.deepEqual(status(f)[12],before);
 f.equipment=applyPowerSave(f.equipment,{ok:true,pduId:pdu.id,details:{outlets:{}}});assert.equal(status(f)[12].state,'off');
});
test('legacy B300 mapping requires review, never green',()=>{
 const f=b300PowerFixture();saved(f,12,{inputIdentity:undefined});assert.equal(status(f)[12].state,'pending');
});
test('duplicate input and invalid receptacle show issues',()=>{
 const f=b300PowerFixture(),pdu=saved(f);const other=f.equipment.find(e=>e.category==='pdu'&&e.id!==pdu.id)!;
 other.details=pdu.details;assert.equal(status(f)[12].state,'issue');
 other.details={};pdu.details={outlets:{999:{deviceId:'b300',inlet:12,inputIdentity:B300_INPUT_IDENTITY,notes:''}}};assert.equal(status(f)[12].state,'issue');
});
test('checked saved input is green, draft amber, and unrelated equipment checks do not change it',()=>{
 const f=b300PowerFixture(),pdu=f.equipment[0];
 const assignment={deviceId:'b300',inlet:12,inputIdentity:B300_INPUT_IDENTITY,notes:''};
 pdu.details={outlets:{1:assignment}};
 const state=()=>psuConnectionStatuses(f.equipment,{feedPower:f.inputs}).b300[12];
 assert.equal(state().state,'connected',state().description);
 assignment.notes='Planning draft: PSU electrical verification pending.';assert.equal(state().state,'pending');
 assignment.notes='';f.equipment.push({id:'unrelated',name:'Unrelated incomplete device',category:'chassis',rawData:{},details:{}});
 assert.equal(state().state,'connected',state().description);
});
