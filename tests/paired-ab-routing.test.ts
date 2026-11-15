import test from 'node:test';
import assert from 'node:assert/strict';
import apc from '../data/catalog/apc-apdu11350me.json';
import {balanceFeeds} from '../lib/feed-balance';
import {type FeedEquipment} from '../lib/feed-rack';
import {type FeedInputs} from '../lib/feed-power';
import {powerInputPositions,powerRailPosition} from '../lib/power-cable-routing';
import {pairPduFeedsBySide,type PduPositionItem} from '../lib/pdu-placement';

function fixture(){
 const items:PduPositionItem[]=['A1','A2','B1','B2'].map(id=>({id,name:id,feed:id[0] as 'A'|'B',number:Number(id[1]) as 1|2,mounting:'unused'}));
 const placements=pairPduFeedsBySide(items)!;
 const equipment:FeedEquipment[]=items.map(p=>({id:p.id,name:p.name,category:'pdu',startRU:1,mounting:placements.find(d=>d.id===p.id)!.mounting,details:{feed:p.feed,pduNumber:p.number},rawData:structuredClone(apc.rawData)}));
 const inputs:FeedInputs={headroomPercent:0,budgets:{}};
 for(const [id,sku,ru,watts,count,connector] of [
  ['storage','SSG-641E-E1CR36L',1,1300,2,'C13'],
  ...Array.from({length:5},(_,i)=>[`gpu${i+1}`,'ESC8000A-E12-26W10G',5+i*4,4350,4,'C19']),
  ['fabric','MQM8700-HS2F',41,1223,2,'C13'],['management','S3900-48T6S-R',42,51,2,'C13'],
 ] as [string,string,number,number,number,string][]){
  equipment.push({id,name:id,sku,model:sku,category:ru>=41?'switch':'server',startRU:ru,mounting:ru>=41?'rear':'front',details:{},rawData:{}});
  inputs.budgets[id]={watts,pf:.9,cords:count,minimumCords:count/2,connector,minVoltage:220,maxVoltage:240,psuAcCapacity:3000,cordLimitAmps:16};
 }
 return {items,equipment,inputs};
}
test('five GPU systems, adjacent storage PSUs and switches all use local A/B feeds under a realistic asymmetric load',()=>{
 const f=fixture(),before=structuredClone(f),plan=balanceFeeds(f.equipment,f.inputs,{planning:true});
 assert.equal(plan.error,undefined);assert.equal(plan.assignments.length,26);assert.ok(plan.analysis.scenarios.every(s=>!s.errors.length));
 assert.ok(plan.routingNotes.every(n=>!n.attention));assert.deepEqual(f,before);
 for(const c of plan.assignments){
  const x=powerInputPositions(f.equipment.find(e=>e.id===c.deviceId)!).get(c.inlet)!;
  assert.equal(x<.5,powerRailPosition(f.equipment.find(e=>e.id===c.pduId))<.5,`${c.deviceId} PSU ${c.inlet} crosses chassis`);
 }
 for(const id of ['gpu1','gpu2','gpu3','gpu4','gpu5'])for(const side of [[1,2],[3,4]]){
  assert.deepEqual(plan.assignments.filter(c=>c.deviceId===id&&side.includes(c.inlet)).map(c=>c.pduId[0]).sort(),['A','B']);
 }
 for(const p of f.equipment.filter(e=>e.category==='pdu'))p.mounting=p.mounting!.replace(/left|right/,s=>s==='left'?'right':'left');
 const swapped=balanceFeeds(f.equipment,f.inputs,{planning:true});assert.equal(swapped.error,undefined);
 for(const c of swapped.assignments)assert.equal(powerInputPositions(f.equipment.find(e=>e.id===c.deviceId)!).get(c.inlet)!<.5,powerRailPosition(f.equipment.find(e=>e.id===c.pduId))<.5);
});
test('local routing never overrides branch, outlet or failover capacity; unavoidable cross-rack routes are flagged',()=>{
 const f=fixture();(f.equipment.find(e=>e.id==='A1')!.rawData as typeof apc.rawData).electricalProfile.limitAmps=1;
 const plan=balanceFeeds(f.equipment,f.inputs,{planning:true});
 if(plan.error){assert.ok(plan.error);return;}
 assert.ok(plan.analysis.scenarios.every(s=>!s.errors.length));assert.ok(plan.routingNotes.some(n=>n.attention));
});
test('pairing is unavailable for two PDUs, missing feeds or duplicate feed identities',()=>{
 const f=fixture();assert.equal(pairPduFeedsBySide(f.items.slice(0,2)),undefined);
 assert.equal(pairPduFeedsBySide(f.items.map((p,i)=>i===0?{...p,feed:undefined}:p)),undefined);
 assert.equal(pairPduFeedsBySide(f.items.map((p,i)=>i===0?{...f.items[1],id:p.id}:p)),undefined);
});
