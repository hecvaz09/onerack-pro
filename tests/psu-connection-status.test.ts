import test from 'node:test';
import assert from 'node:assert/strict';
import {psuConnectionStatuses} from '../lib/psu-connection-status.ts';
import {applyPowerSave} from '../lib/power-feed-progress.ts';
import {b300PowerFixture,withCables} from './fixtures/b300-power.ts';
import {individualPowerFixture} from './fixtures/individual-power.ts';
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
test('partial B300 inputs remain amber until the complete chassis load can be checked',()=>{
 const f=b300PowerFixture();saved(f);
 assert.equal(status(f)[12].state,'pending');
 assert.match(status(f)[12].description,/complete the chassis input mapping/);
});

test('fully mapped B300 inputs recheck current data regardless of historical draft notes',()=>{
 const f=b300PowerFixture();
 f.equipment=withCables(f.equipment,Array.from({length:12},(_,i)=>({deviceId:'b300',inlet:i+1,pduId:i%2?'pdu-b':'pdu-a',outlet:Math.floor(i/2)+1,inputIdentity:B300_INPUT_IDENTITY})));
 const state=()=>psuConnectionStatuses(f.equipment,{feedPower:f.inputs}).b300[12];
 assert.equal(state().state,'connected',state().description);
 const pdu=f.equipment.find(e=>e.id==='pdu-b')!;
 (pdu.details as {outlets:Record<number,{notes:string}>}).outlets[6].notes='Planning draft: PSU electrical verification pending.';
 assert.equal(state().state,'connected');
 f.equipment.push({id:'unrelated',name:'Unrelated incomplete device',category:'chassis',rawData:{},details:{}});
 assert.equal(state().state,'connected',state().description);
});

test('saved outlet plans turn green when Library ratings arrive while estimates and deferred checks remain visible',()=>{
 const f=individualPowerFixture();
 f.inputs.budgets.server={watts:556,pf:.87,minVoltage:100,maxVoltage:240,estimateSource:'Reviewed planning estimate'};
 f.equipment[0].details={outlets:{1:{deviceId:'server',inlet:1,notes:'Planning draft: electrical verification pending. Keep user note.'}}};
 const state=()=>psuConnectionStatuses(f.equipment,{feedPower:f.inputs}).server;
 assert.equal(state()[1].state,'pending');assert.equal(state()[2].state,'off');
 const profile=(f.equipment[0].rawData as {electricalProfile:{branches:Record<string,number>;outlets:{branch:string;limitAmps:number}[]}}).electricalProfile;
 profile.branches={B1:16};profile.outlets.forEach(o=>{o.branch='B1';o.limitAmps=10;});
 const before=structuredClone(f);
 assert.equal(state()[1].state,'connected',state()[1].description);
 assert.equal(state()[1].verificationNotes?.length,3);
 assert.ok(state()[1].verificationNotes?.some(s=>s.includes('power estimate')));
 assert.match(state()[1].description,/outlet plan/);assert.deepEqual(f,before,'status evaluation must not change saved notes or data');
 const reloaded=structuredClone(f);assert.equal(psuConnectionStatuses(reloaded.equipment,{feedPower:reloaded.inputs}).server[1].state,'connected');
 f.equipment[0].details={outlets:{}};assert.equal(state()[1].state,'off');
});

test('current missing planning inputs stay amber and known failures turn previously green plans red',()=>{
 const f=individualPowerFixture(false);
 f.equipment[0].details={outlets:{1:{deviceId:'server',inlet:1,notes:'Planning draft:'}}};
 const state=()=>psuConnectionStatuses(f.equipment,{feedPower:f.inputs}).server[1];
 assert.equal(state().state,'connected');
 f.inputs.budgets.server.watts=0;assert.equal(state().state,'pending');
 f.inputs.budgets.server.watts=556;f.inputs.budgets.server.pf=0;assert.equal(state().state,'pending');
 f.inputs.budgets.server.pf=.87;delete f.inputs.budgets.server.minVoltage;assert.equal(state().state,'pending');
 f.inputs.budgets.server.minVoltage=100;f.inputs.budgets.server.cordLimitAmps=.1;assert.equal(state().state,'issue');
 f.inputs.budgets.server.cordLimitAmps=10;f.inputs.budgets.server.psuAcCapacity=100;assert.equal(state().state,'issue');
 f.inputs.budgets.server.psuAcCapacity=1000;f.inputs.budgets.server.connector='C19';assert.equal(state().state,'issue');
 f.inputs.budgets.server.connector='C13';assert.equal(state().state,'connected');
 f.equipment[0].details={outlets:{1:{deviceId:'server',inlet:1,notes:''},2:{deviceId:'missing-0',inlet:1,notes:''}}};
 assert.equal(state().state,'pending','unknown connected demand must prevent a complete PDU capacity claim');
});
