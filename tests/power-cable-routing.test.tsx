import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {balanceFeeds} from '../lib/feed-balance';
import {analyzeFeeds,type Cord,type FeedInputs,type Supply} from '../lib/feed-power';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {routePowerAssignments,powerInputPositions,powerRailPosition} from '../lib/power-cable-routing';
import {catalogProfile} from '../lib/catalog-artwork';
import {catalogPowerInputs} from '../lib/power-input-geometry';
import {powerMapLine,powerMapRoute} from '../lib/power-map-view';
import {PowerAssignmentNotes} from '../app/projects/[id]/racks/[rackId]/power-assignment-notes';
import {FaceConnections} from '../app/projects/[id]/racks/[rackId]/face-connections';
import {b300PowerFixture,withCables} from './fixtures/b300-power';
import {fourPsuPlanFixture} from './fixtures/four-psu-plan';
import {individualEquipment} from './fixtures/individual-power';
import {actionHarness} from './helpers/action-harness';

function fixture(four=true,sku='ESC8000A-E12-26W10G',count=4){
 const supplies:Supply[]=(four?['A1','A2','B1','B2']:['A1','B1']).map(id=>({id,name:id,feed:id[0] as 'A'|'B',confirmed:true,topology:'single-phase',voltage:230,limitAmps:24,branches:{B1:16,B2:16},outlets:Array.from({length:16},(_,i)=>({n:i+1,connectors:['C19'],branch:i<8?'B1':'B2',phase:'L1',limitAmps:16}))}));
 const equipment:FeedEquipment[]=supplies.map(p=>({id:p.id,name:p.name,category:'pdu',startRU:1,mounting:`rear-${p.feed==='A'?'left':'right'}${p.id.endsWith('2')?'-2':''}`,details:{feed:p.feed},rawData:{electricalProfile:p}}));
 const inputs:FeedInputs={headroomPercent:0,budgets:{}};
 for(const [id,ru] of [['lower',1],['upper',10]] as const){equipment.push({id,name:id,sku,model:sku,category:'server',startRU:ru,mounting:'front',details:{},rawData:{}});inputs.budgets[id]={watts:600,pf:1,cords:count,minimumCords:Math.floor(count/2)||1,connector:'C19',minVoltage:100,maxVoltage:240,psuAcCapacity:2000,cordLimitAmps:16};}
 return {equipment,inputs,supplies,plan:()=>simplePowerPlan(equipment,{feedPower:inputs})};
}
function assertOrdered(e:FeedEquipment[],rows:Cord[]){
 for(const d of e.filter(d=>d.category!=='pdu')){
  const x=powerInputPositions(d),cords=rows.filter(c=>c.deviceId===d.id);
  for(const a of cords)for(const b of cords)assert.ok((x.get(a.inlet)!-x.get(b.inlet)!)*(powerRailPosition(e.find(p=>p.id===a.pduId))-powerRailPosition(e.find(p=>p.id===b.pduId)))>=-1e-9,`${d.id}: PSU ${a.inlet}/${b.inlet} routes cross`);
 }
}

for(const four of [false,true])test(`${four?4:2} PDUs: ASUS inputs follow physical sides, then follow a side swap`,()=>{
 const f=fixture(four),before=structuredClone(f.equipment);
 for(const swapped of [false,true]){
  const plan=f.plan();assert.equal(plan.error,undefined);assertOrdered(f.equipment,plan.assignments);
  for(const c of plan.assignments){const p=f.equipment.find(e=>e.id===c.pduId)!;assert.equal(p.mounting!.includes('left'),c.inlet<=2);assert.equal(p.id.startsWith('A'),swapped?c.inlet>2:c.inlet<=2);}
  assert.ok(plan.routingNotes.every(n=>!n.attention));assert.equal(plan.analysis.ready,true);
  for(const p of f.equipment.filter(e=>e.category==='pdu'))p.mounting=p.mounting!.replace(/left|right/,s=>s==='left'?'right':'left');
 }
 assert.deepEqual(f.equipment,before);
});

test('all 24 four-PDU positions retain feed identities, electrical checks and ordered PSU routes',()=>{
 const f=fixture(),positions=['rear-left-2','rear-left','rear-right','rear-right-2'];
 const permutations=(a:string[]):string[][]=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(t=>[v,...t])):[[]];
 for(const permutation of permutations(positions)){
  f.equipment.filter(d=>d.category==='pdu').forEach((d,i)=>{d.mounting=permutation[i];});
  const plan=f.plan();assert.equal(plan.error,undefined);assertOrdered(f.equipment,plan.assignments);
  for(const id of ['lower','upper'])for(const feed of ['A','B'])assert.equal(plan.assignments.filter(c=>c.deviceId===id&&c.pduId.startsWith(feed)).length,2);
  assert.equal(plan.analysis.ready,true);
 }
});

test('rack bottom-up outlet order is preserved independently on each PDU',()=>{
 const f=fixture(false);f.supplies.forEach(p=>p.outlets.forEach(o=>{o.branch='B1';}));const plan=f.plan();assert.equal(plan.error,undefined);
 for(const p of f.supplies){const lower=plan.assignments.filter(c=>c.deviceId==='lower'&&c.pduId===p.id).map(c=>c.outlet),upper=plan.assignments.filter(c=>c.deviceId==='upper'&&c.pduId===p.id).map(c=>c.outlet);assert.ok(Math.max(...lower)<Math.min(...upper));assert.equal(Math.min(...lower),1);}
});

test('input permutation preserves every electrical endpoint and normal/failure totals',()=>{
 const f=fixture(false),original:Cord[]=[1,2,3,4].map(inlet=>({deviceId:'lower',inlet,pduId:inlet%2?'A1':'B1',outlet:Math.ceil(inlet/2)}));
 const before=structuredClone(original),routed=routePowerAssignments(f.equipment,original,[]),model=feedRack(f.equipment,f.inputs);
 assertOrdered(f.equipment,routed.assignments);assert.deepEqual(original,before);
 assert.deepEqual(analyzeFeeds(model.supplies,model.loads,original).scenarios,analyzeFeeds(model.supplies,model.loads,routed.assignments).scenarios);
});

test('a crossed saved connection remains fixed and the routing constraint is explained',()=>{
 const f=fixture(false),saved:Cord={deviceId:'lower',inlet:1,pduId:'B1',outlet:1},e=withCables(f.equipment,[saved]),before=structuredClone(e),plan=simplePowerPlan(e,{feedPower:f.inputs});
 assert.equal(plan.error,undefined);assert.deepEqual(plan.assignments.find(c=>c.deviceId==='lower'&&c.inlet===1),saved);assert.deepEqual(e,before);
 assert.ok(plan.routingNotes.find(n=>n.deviceId==='lower')?.message.includes('fixed saved wiring'));
});

test('SMC PSU numbering is not assumed to run left to right',()=>{
 const f=fixture(false,'SYS-510P-WTR',2),plan=f.plan();assert.equal(plan.error,undefined);
 assert.equal(plan.assignments.find(c=>c.deviceId==='lower'&&c.inlet===2)!.pduId,'A1');
 assert.equal(plan.assignments.find(c=>c.deviceId==='lower'&&c.inlet===1)!.pduId,'B1');
 assert.ok(plan.routingNotes.every(n=>n.attention));
});

test('missing artwork, unknown PDU position and rotated pocket geometry do not invent a route',()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.equipment.find(e=>e.id==='lower')!.sku='unknown';},(f:ReturnType<typeof fixture>)=>{f.equipment[0].mounting='unknown';},(f:ReturnType<typeof fixture>)=>{const d=f.equipment.find(e=>e.id==='lower')!;d.category='switch';d.startRU=53;}]){
  const f=fixture();change(f);const plan=f.plan();assert.equal(plan.error,undefined);assert.match(plan.routingNotes.find(n=>n.deviceId==='lower')!.message,/not available/);
 }
});

test('capacity and failover cannot be bypassed to shorten a cable',()=>{
 const f=fixture(false);f.inputs.budgets.lower.watts=12000;
 const plan=f.plan();assert.ok(plan.error);assert.equal(plan.remaining.length,0);
});

test('a nearby PDU loses to capacity checks; the opposite-side routing exception is visible',()=>{
 const f=fixture();f.supplies[0].limitAmps=.1;f.equipment.find(e=>e.id==='A2')!.mounting='rear-right-2';
 const plan=f.plan();assert.equal(plan.error,undefined);assert.ok(plan.assignments.every(c=>c.pduId!=='A1'));assert.ok(plan.routingNotes.some(n=>n.attention));
 assert.deepEqual(simplePowerPlan([...f.equipment].reverse(),{feedPower:f.inputs}).assignments,plan.assignments);
});

test('three- and six-PSU devices retain calculated A/B counts while ordering physical routes',()=>{
 for(const [sku,count] of [['ESC8000A-E12-26W10G',3],['AS-8126GS-TNMR',6]] as const){
  const f=fixture(false,sku,count),plan=f.plan();assert.equal(plan.error,undefined);assertOrdered(f.equipment,plan.assignments);
  assert.equal(plan.assignments.length,count*2);assert.equal(plan.analysis.ready,true);
 }
});

test('twelve B300 inputs retain their identities and shared electrical assessment',()=>{
 const f=b300PowerFixture(),start=performance.now(),plan=balanceFeeds(f.equipment,f.inputs,{planning:true});assert.equal(plan.error,undefined);
 assert.equal(new Set(plan.assignments.map(c=>c.inlet)).size,12);assert.ok(plan.assignments.every(c=>c.inputIdentity==='b300-module-input-v1'));assertOrdered(f.equipment,plan.assignments);
 assert.ok(performance.now()-start<5000,'routing must not use factorial enumeration');
});

test('save and reload recompute the same routed proposal; saved positions invalidate an old preview',async()=>{
 const f=fourPsuPlanFixture();f.rack.devices.find(d=>d.id==='server')!.catalogDevice.sku='ESC8000A-E12-26W10G';
 f.rack.devices.filter(d=>d.catalogDevice.category==='pdu').forEach((d,i)=>{d.mounting=['rear-left','rear-left-2','rear-right','rear-right-2'][i];});
 const equipment=(rack:typeof f.rack)=>individualEquipment(rack).map(e=>({...e,name:`${e.name} · U${e.startRU}`}));
 const e=equipment(f.rack),plan=simplePowerPlan(e,f.rack.configuration);assert.equal(plan.error,undefined);
 const h=await actionHarness({rack:f.rack}),result=await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true);assert.equal(result.ok,true,JSON.stringify(result));
 const reload=simplePowerPlan(equipment(h.snapshot() as typeof f.rack),f.rack.configuration);assert.equal(reload.remaining.length,0);assert.deepEqual(reload.assignments,plan.assignments);
 f.rack.devices[0].mounting='rear-right';const drift=await actionHarness({rack:f.rack});assert.ok((await drift.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).error);assert.equal(drift.updates.length,0);
});

test('rear PSU hit targets share the same ASUS geometry used by the allocator',()=>{
 const p=catalogProfile('ESC8000A-E12-26W10G')!;assert.ok(p);const html=renderToStaticMarkup(<FaceConnections profile={p} face="rear" deviceId="server"/>);
 for(const {n,box} of catalogPowerInputs(p)){assert.match(html,new RegExp(`data-psu-inlet="${n}"`));assert.ok(html.includes(`x="${box.x-3}"`));}
 const f=fixture(),plan=f.plan(),notes=renderToStaticMarkup(<PowerAssignmentNotes equipment={f.equipment} deviations={plan.deviations} limitations={[]} routingNotes={plan.routingNotes}/>);
 assert.match(notes,/PSUs matched to PDU positions/);assert.match(notes,/Saved wiring stays fixed/);
});

test('highlight uses the chassis edge and side gutter, including zoom/pan coordinates',()=>{
 const line=powerMapLine({left:100,top:50,width:700,height:900},{left:120,top:110,width:40,height:60},{left:420,top:310,width:60,height:80},250,120,1800,3000);
 assert.equal(powerMapRoute(line,{left:350,top:350,width:800,height:90}),'M 290 210 H 320 V 445.4 H 600 V 420');
 assert.equal(powerMapRoute({...line,x1:1250},{left:350,top:350,width:800,height:90}),'M 1250 210 H 1200 V 445.4 H 600 V 420');
});
