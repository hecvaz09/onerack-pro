import assert from 'node:assert/strict';
import {test} from 'node:test';
import {powerFeedProgress,applyPowerSave} from '../lib/power-feed-progress.ts';
import type {FeedEquipment} from '../lib/feed-rack.ts';
import type {Cord} from '../lib/feed-power.ts';

const cord=(pduId='test-pdu-a',outlet=1,deviceId='test-server-1',inlet=1):Cord=>({pduId,outlet,deviceId,inlet});
const config={feedPower:{headroomPercent:0,budgets:{}}};
function fixture(saved:Cord[]=[]):FeedEquipment[]{
 const pdu=(id:string,mounting:string):FeedEquipment=>({id,name:id,category:'pdu',mounting,rawData:{electricalProfile:{topology:'single-phase',voltage:230,limitAmps:16,branches:{one:16},outlets:[1,2].map(n=>({n,connectors:['C13'],branch:'one',phase:'L1',limitAmps:10}))}},details:{outlets:Object.fromEntries(saved.filter(c=>c.pduId===id).map(c=>[String(c.outlet),{deviceId:c.deviceId,inlet:c.inlet,notes:''}]))}});
 const server=(id:string):FeedEquipment=>({id,name:id,category:'chassis',rawData:{powerLoad:{cords:2,minimumCords:1,connector:'C13'}},details:{}});
 return [pdu('test-pdu-a','rear-right'),pdu('test-pdu-a2','rear-right-2'),pdu('test-pdu-b','rear-left'),server('test-server-1'),server('test-server-2')];
}
function side(equipment:FeedEquipment[],plan:Cord[],feed:'A'|'B'='A',configuration:unknown=config){return powerFeedProgress(equipment,configuration,plan).find(s=>s.feed===feed)!;}

test('exact saved mapping completes the same proposed mapping on both feeds',()=>{
 const plan=[cord(),cord('test-pdu-b',1,'test-server-1',2)],equipment=fixture(plan);
 for(const feed of ['A','B'] as const){const s=side(equipment,plan,feed);assert.equal(s.total,1);assert.equal(s.connected,1);assert.deepEqual(s.pending,[]);}
});
test('wrong outlet on the same PDU remains pending',()=>{
 const planned=cord(),s=side(fixture([cord('test-pdu-a',2)]),[planned]);assert.equal(s.connected,0);assert.deepEqual(s.pending,[planned]);
});
test('wrong PDU at the same outlet on the same feed remains pending',()=>{
 const s=side(fixture([cord('test-pdu-a2')]),[cord()]);assert.equal(s.connected,0);assert.equal(s.pending.length,1);
});
test('a saved cord on feed B never completes a proposed feed A endpoint',()=>{
 const s=side(fixture([cord('test-pdu-b')]),[cord()]);assert.equal(s.connected,0);assert.equal(s.pending.length,1);
});
test('wrong device or inlet never completes the proposal',()=>{
 for(const saved of [cord('test-pdu-a',1,'test-server-2'),cord('test-pdu-a',1,'test-server-1',2)]){const s=side(fixture([saved]),[cord()]);assert.equal(s.connected,0);assert.equal(s.pending.length,1);}
});
test('missing saved mapping remains pending and empty plans remain empty',()=>{
 const s=side(fixture(),[cord()]);assert.equal(s.total,1);assert.equal(s.connected,0);assert.equal(s.pending.length,1);
 assert.deepEqual(powerFeedProgress(fixture(),config,[]).map(x=>[x.total,x.connected,x.pending.length]),[[0,0,0],[0,0,0]]);
});
test('repeated exact proposals count as one physical mapping',()=>{
 const c=cord(),s=side(fixture([c]),[c,{...c}]);assert.equal(s.total,1);assert.equal(s.connected,1);assert.deepEqual(s.pending,[]);
 const p=side(fixture(),[c,{...c}]);assert.equal(p.total,1);assert.equal(p.pending.length,1);
});
test('conflicting proposals for the same PSU remain pending without overcount',()=>{
 const s=side(fixture([cord()]),[cord(),cord('test-pdu-a',2)]);assert.equal(s.total,2);assert.equal(s.connected,0);assert.equal(s.pending.length,2);
});
test('conflicting proposals for the same outlet remain pending',()=>{
 const s=side(fixture([cord()]),[cord(),cord('test-pdu-a',1,'test-server-2')]);assert.equal(s.total,2);assert.equal(s.connected,0);
});
test('conflicting saved destinations for one PSU cannot mark it complete',()=>{
 const s=side(fixture([cord(),cord('test-pdu-a2')]),[cord()]);assert.equal(s.connected,0);assert.equal(s.pending.length,1);
});
test('duplicate serialized aliases of an exact saved endpoint do not overcount',()=>{
 const equipment=fixture([cord()]);equipment[0].details={outlets:{'1':{deviceId:'test-server-1',inlet:1,notes:''},'01':{deviceId:'test-server-1',inlet:1,notes:''}}};
 const s=side(equipment,[cord()]);assert.equal(s.total,1);assert.equal(s.connected,1);
});
test('conflicting saved devices sharing a serialized outlet alias remain pending',()=>{
 const equipment=fixture();equipment[0].details={outlets:{'1':{deviceId:'test-server-1',inlet:1,notes:''},'01':{deviceId:'test-server-2',inlet:1,notes:''}}};
 assert.equal(side(equipment,[cord()]).connected,0);
});
test('a stale saved endpoint whose device was removed cannot complete a plan',()=>{
 const equipment=fixture([cord()]).filter(e=>e.id!=='test-server-1');const s=side(equipment,[cord()]);assert.equal(s.total,1);assert.equal(s.connected,0);assert.equal(s.pending.length,1);
});
test('a stale outlet removed from the supply map cannot count as complete',()=>{
 const invalid=cord('test-pdu-a',99),s=side(fixture([invalid]),[invalid]);assert.equal(s.connected,0);assert.equal(s.pending.length,1);
});
test('invalid or missing inlet identity remains pending',()=>{
 for(const inlet of [0,-1,1.5,3])assert.equal(side(fixture([cord('test-pdu-a',1,'test-server-1',inlet)]),[cord('test-pdu-a',1,'test-server-1',inlet)]).connected,0);
});
test('unmapped PDU/feed proposals do not produce connected counts',()=>{
 const result=powerFeedProgress(fixture(),config,[cord('removed-pdu')]);assert.equal(result.reduce((n,s)=>n+s.connected,0),0);assert.equal(result.reduce((n,s)=>n+s.total,0),0);
});
test('current configured feed identity is respected without inventing historical feed state',()=>{
 const c=cord(),configuration={feedPower:{headroomPercent:0,budgets:{},supplies:{'test-pdu-a':{feed:'B'}}}};
 assert.equal(side(fixture([c]),[c],'A',configuration).total,0);assert.equal(side(fixture([c]),[c],'B',configuration).connected,1);
});
test('independent saved endpoints preserve order and valid existing totals',()=>{
 const a=cord(),a2=cord('test-pdu-a',2,'test-server-2'),b=cord('test-pdu-b',1,'test-server-1',2),s=side(fixture([a,b]),[a,a2,b]);
 assert.equal(s.total,2);assert.equal(s.connected,1);assert.deepEqual(s.pending,[a2]);
});
test('failed saves preserve state and successful saves replace only the committed PDU',()=>{
 const equipment=fixture(),details={outlets:{'1':{deviceId:'test-server-1',inlet:1,notes:''}}};
 assert.equal(applyPowerSave(equipment,{error:'synthetic failure'}),equipment);
 const updated=applyPowerSave(equipment,{ok:true,pduId:'test-pdu-a',details});assert.equal(updated[0].details,details);assert.equal(updated[1],equipment[1]);assert.equal(equipment[0].details===details,false);
});
