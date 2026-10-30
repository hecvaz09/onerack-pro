import type {FeedInputs} from '../lib/feed-power';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {powerInputsRevision,matchesPowerInputsRevision} from '../lib/power-input-revision';
import {createPowerEditor,editPowerEditor,receivePowerSnapshot,capturePowerSave,finishPowerSave,powerEditorDirty,powerEditorMessage,samePowerValue} from '../lib/power-input-state';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64),d='d'.repeat(64);
const input=(watts=150)=>({headroomPercent:20,budgets:{device:{watts,pf:.95}}});
const rack=()=>({name:'Synthetic rack',heightRU:48,updatedAt:new Date('2026-10-28T00:00:00Z'),configuration:{feedPower:input()},devices:[{id:'device',catalogDeviceId:'model',startRU:1,mounting:'front',label:'Synthetic',details:{outlets:{}},catalogDevice:{id:'model',model:'Synthetic model',category:'chassis',rawData:{powerLoad:{cords:2}}}}]});
test('server revision is opaque, deterministic across JSONB/object/device ordering, and requires a real expected value',()=>{
 const value=rack(),version=powerInputsRevision('rack',value);assert.match(version,/^[a-f0-9]{64}$/);assert.equal(matchesPowerInputsRevision(version,'rack',value),true);for(const invalid of [undefined,null,'',{},'current',a.toUpperCase()])assert.equal(matchesPowerInputsRevision(invalid,'rack',value),false);
 const reordered={...value,configuration:{feedPower:{budgets:{device:{pf:.95,watts:150}},headroomPercent:20}}};assert.equal(powerInputsRevision('rack',reordered),version);const extra={...value.devices[0],id:'second'};assert.equal(powerInputsRevision('rack',{...value,devices:[extra,...value.devices]}),powerInputsRevision('rack',{...value,devices:[...value.devices,extra]}));
});
test('revision changes for saved inputs, moved/removed hardware, mapping, Library facts and rack timestamp',()=>{
 const value=rack(),version=powerInputsRevision('rack',value),versions=[{...value,configuration:{feedPower:input(175)}},{...value,devices:[]},{...value,devices:[{...value.devices[0],startRU:3}]},{...value,devices:[{...value.devices[0],details:{outlets:{'1':{deviceId:'device',inlet:1}}}}]},{...value,devices:[{...value.devices[0],catalogDevice:{...value.devices[0].catalogDevice,rawData:{powerLoad:{cords:4}}}}]},{...value,updatedAt:new Date('2026-10-28T00:00:01Z')}];for(const changed of versions)assert.notEqual(powerInputsRevision('rack',changed),version);assert.notEqual(powerInputsRevision('other-rack',value),version);
});
test('current clean client adopts a new server snapshot',()=>{
 const state=receivePowerSnapshot(createPowerEditor(input(),a),input(175),b);assert.equal(state.revision,b);assert.equal(state.draft.budgets.device.watts,175);assert.equal(powerEditorDirty(state),false);assert.equal(state.conflict,false);
});
test('dirty client keeps its exact draft and expected revision across a changed Next snapshot',()=>{
 const draft=editPowerEditor(createPowerEditor(input(),a),input(174));const next=receivePowerSnapshot(draft,input(200),b);assert.equal(next.draft,draft.draft);assert.equal(next.revision,a);assert.equal(next.saved.budgets.device.watts,150);assert.equal(next.conflict,true);assert.equal(next.status,'conflict');assert.match(next.message,/edits are kept/);assert.equal(capturePowerSave(next).revision,a);
});
test('conflict response keeps draft, baseline and version without auto-merge or retry',()=>{
 const state=editPowerEditor(createPowerEditor(input(),a),input(174)),request=capturePowerSave(state);const next=finishPowerSave(state,request,{error:'conflict',conflict:true});assert.equal(next.draft,state.draft);assert.equal(next.saved,state.saved);assert.equal(next.revision,a);assert.equal(next.conflict,true);assert.match(next.message,/Nothing was overwritten/);
});
test('successful save adopts returned normalized baseline and version for immediate repeated save',()=>{
 let state=editPowerEditor(createPowerEditor(input(),a),input(174));const request=capturePowerSave(state);state=finishPowerSave(state,request,{ok:true,saved:input(174),revision:b});assert.equal(powerEditorDirty(state),false);assert.equal(state.revision,b);assert.equal(state.status,'success');const second=capturePowerSave(editPowerEditor(state,input(180)));assert.equal(second.revision,b);assert.equal(second.inputs.budgets.device.watts,180);
});
test('edits made during save remain unsaved while committed snapshot becomes the baseline',()=>{
 const submitted=editPowerEditor(createPowerEditor(input(),a),input(174)),request=capturePowerSave(submitted),later=editPowerEditor(submitted,input(180));const saved=finishPowerSave(later,request,{ok:true,saved:input(174),revision:b});assert.equal(saved.draft.budgets.device.watts,180);assert.equal(saved.saved.budgets.device.watts,174);assert.equal(saved.revision,b);assert.equal(powerEditorDirty(saved),true);assert.match(saved.message,/later edits are still unsaved/);
});
test('matching Next refresh after local save does not erase edits typed after save',()=>{
 const submitted=editPowerEditor(createPowerEditor(input(),a),input(174));let state=finishPowerSave(submitted,capturePowerSave(submitted),{ok:true,saved:input(174),revision:b});state=editPowerEditor(state,input(180));const next=receivePowerSnapshot(state,input(174),b);assert.equal(next.draft.budgets.device.watts,180);assert.equal(next.conflict,false);assert.equal(next.seenRevision,b);
});
test('own refresh arriving before action response resolves without a false lasting conflict',()=>{
 const submitted=editPowerEditor(createPowerEditor(input(),a),input(174)),request=capturePowerSave(submitted);const early=receivePowerSnapshot(submitted,input(174),b);assert.equal(early.conflict,true);const done=finishPowerSave(early,request,{ok:true,saved:input(174),revision:b});assert.equal(done.conflict,false);assert.equal(powerEditorDirty(done),false);assert.equal(done.revision,b);
});
test('newer intervening server snapshot prevents a stale success message after own commit',()=>{
 const submitted=editPowerEditor(createPowerEditor(input(),a),input(174)),request=capturePowerSave(submitted);const observed=receivePowerSnapshot(submitted,input(250),c);const done=finishPowerSave(observed,request,{ok:true,saved:input(174),revision:b});assert.equal(done.revision,b);assert.equal(done.conflict,true);assert.equal(done.status,'conflict');assert.match(done.message,/rack changed again/);
});
test('out-of-order acknowledged Next snapshots cannot roll back a newer committed baseline',()=>{
 let state=editPowerEditor(createPowerEditor(input(),a),input(174));state=finishPowerSave(state,capturePowerSave(state),{ok:true,saved:input(174),revision:b});state=editPowerEditor(state,input(180));state=finishPowerSave(state,capturePowerSave(state),{ok:true,saved:input(180),revision:c});const older=receivePowerSnapshot(state,input(174),b);assert.equal(older.revision,c);assert.equal(older.draft.budgets.device.watts,180);assert.equal(older.conflict,false);const latest=receivePowerSnapshot(older,input(180),c);assert.equal(latest.revision,c);assert.equal(powerEditorDirty(latest),false);
});
test('refresh with removed device keeps its unsaved draft entry and blocks stale saving',()=>{
 const draft=editPowerEditor(createPowerEditor<FeedInputs>(input(),a),input(174));const next=receivePowerSnapshot(draft,{headroomPercent:20,budgets:{}},b);assert.equal(next.draft.budgets.device.watts,174);assert.equal(next.conflict,true);assert.equal(next.revision,a);
});
test('new edits clear previous success, while ordinary messages cannot hide an unresolved conflict',()=>{
 let state=editPowerEditor(createPowerEditor(input(),a),input(174));state=finishPowerSave(state,capturePowerSave(state),{ok:true,saved:input(174),revision:b});state=editPowerEditor(state,input(180));assert.equal(state.message,'');assert.equal(state.status,'idle');state=receivePowerSnapshot(state,input(250),c);assert.equal(powerEditorMessage(state,'Unsaved inputs').status,'conflict');assert.match(powerEditorMessage(state,'').message,/Nothing was overwritten/);
});
test('generic failed or unverifiable save keeps draft and cannot invent a successful baseline',()=>{
 const state=editPowerEditor(createPowerEditor(input(),a),input(174)),request=capturePowerSave(state);const failed=finishPowerSave(state,request,{error:'Could not confirm save'});assert.equal(failed.draft,state.draft);assert.equal(failed.revision,a);assert.equal(failed.status,'error');const invalid=finishPowerSave(state,request,{ok:true,saved:input(174),revision:'missing'});assert.equal(invalid.revision,a);assert.equal(invalid.status,'error');assert.match(invalid.message,/could not be confirmed/);
});
test('reordered JSONB and removed undefined source keys do not falsely mark saved inputs dirty',()=>{
 assert.equal(samePowerValue({watts:174,pf:.95,measurement:undefined},{pf:.95,watts:174}),true);assert.equal(samePowerValue({watts:174},{watts:175}),false);assert.equal(receivePowerSnapshot(createPowerEditor(input(),d),input(),d).revision,d);
});
