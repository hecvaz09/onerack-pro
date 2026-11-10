import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {powerMapLine} from '../lib/power-map-view';
import {PX3_4068_ID,PX3_4068_OUTLETS} from '../lib/pdu-models';
import {apcOutletBreaker} from '../lib/apc-outlet-bank';
import {readOutlets} from '../lib/equipment-details';
import {readRackConfig} from '../lib/rack-config';
import type {FeedEquipment} from '../lib/feed-rack';
import type {FeedInputs} from '../lib/feed-power';
import {RackGrid,type RackGridDevice} from '../app/projects/[id]/racks/[rackId]/physical-rack-grid';
import {actionHarness} from './helpers/action-harness';

// Explicit synthetic supply values exercise topology-specific code. These are
// test fixtures, not manufacturer ratings or defaults for installed equipment.
function fixture(kind:'apc'|'raritan'){
 const inputs:FeedInputs={headroomPercent:0,budgets:{server:{watts:400,pf:1,connector:'C13',cords:2,minimumCords:1,minVoltage:100,maxVoltage:240,cordLimitAmps:8,psuAcCapacity:500}},supplies:{}};
 const equipment:FeedEquipment[]=(['A','B'] as const).map(feed=>{
  const id='test-'+kind+'-'+feed,apc=kind==='apc';
  const outlets=apc?Array.from({length:40},(_,i)=>({n:i+1,type:(i%2?'C13/C19':'C13'),cb:apcOutletBreaker(i+1)!,phase:'L1'})):PX3_4068_OUTLETS;
  const supply={feed,topology:apc?'single-phase' as const:'three-phase-wye' as const,voltage:apc?208:400,confirmed:true,limitAmps:20,branches:Object.fromEntries(Array.from({length:apc?2:15},(_,i)=>[String(i+1),10])),outlets:outlets.map(o=>({n:o.n,connectors:o.type.split('/'),branch:String(o.cb),phase:o.phase as 'L1'|'L2'|'L3',limitAmps:8}))};
  inputs.supplies![id]=supply;
  const sku=apc?'APDU10151ME':'PX3-4068YV-V2-K1';
  return {id,name:'Synthetic '+id+' · U1',sku,model:sku,startRU:1,mounting:feed==='A'?'rear-right':'rear-left',category:'pdu',rawData:{model:sku,pdu:{outlets},electricalProfile:supply},details:{feed,outlets:{},future:{keep:true}}};
 });
 equipment.push({id:'server',name:'Synthetic 1U · U20',model:'SYS-510P-WTR',sku:'SYS-510P-WTR',startRU:20,mounting:'front',category:'chassis',rawData:{},details:{}});
 const devices=equipment.map(e=>({id:e.id,label:e.name.replace(/ · U\d+$/,''),startRU:e.startRU!,mounting:e.mounting!,details:e.details,catalogDevice:{id:'catalog-'+e.id,vendor:'Synthetic',sku:e.sku,model:e.model!,category:e.category,heightRU:e.category==='pdu'?0:1,rawData:e.rawData,outlets:readOutlets(e.rawData),pduModel:kind==='raritan'&&e.category==='pdu'?PX3_4068_ID:undefined}}));
 const rack={id:'synthetic-'+kind,projectId:'synthetic-project',configuration:{feedPower:inputs},devices,updatedAt:new Date()};
 return {equipment,inputs,rack};
}

for(const kind of ['apc','raritan'] as const){
 test(`${kind}: shared Calculate/Save path saves both feeds with model-specific artwork at 200% zoom`,async()=>{
  const f=fixture(kind),plan=simplePowerPlan(f.equipment,f.rack.configuration);
  assert.equal(plan.error,undefined);assert.equal(plan.remaining.length,2);
  const h=await actionHarness({rack:f.rack});const result=await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.count,2);assert.equal(h.updates.length,2);
  const after=h.snapshot() as typeof f.rack;
  for(const d of after.devices.filter(d=>d.catalogDevice.category==='pdu'))assert.deepEqual((d.details as {future:unknown}).future,{keep:true});
  const html=renderToStaticMarkup(createElement(RackGrid,{devices:f.rack.devices as RackGridDevice[],heightRU:42,config:readRackConfig({profile:'apc-netshelter-42',pockets:false}),rear:true,zoom:200,disabled:true,onPsu(){},onOutlet(){}}));
  assert.ok(html.includes('zoom:2'));assert.equal((html.match(/data-power-outlet=/g)||[]).length,kind==='apc'?80:102);
  assert.ok(html.includes(kind==='apc'?'apc-pdu-panel':'pdu-model-layout'));
 });
}

test('APC missing branch verification is reported, not bypassed by the shared workflow',async()=>{
 const f=fixture('apc');for(const supply of Object.values(f.inputs.supplies!))supply.branches={};
 const plan=simplePowerPlan(f.equipment,f.rack.configuration);assert.ok(plan.error);
 const h=await actionHarness({rack:f.rack});assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).error);assert.equal(h.updates.length,0);
});

test('cord geometry stays attached to scaled rectangles after horizontal and vertical scroll',()=>{
 const line=powerMapLine({left:100,top:50,width:700,height:900},{left:120,top:110,width:40,height:60},{left:420,top:310,width:60,height:80},250,120,1800,3000);
 assert.deepEqual(line,{x1:290,y1:210,x2:600,y2:420,width:1800,height:3000});
});

test('plan revisions ignore object-field order and equipment list order, but detect real changes',()=>{
 const f=fixture('apc'),original=simplePowerPlan(f.equipment,f.rack.configuration);
 const reverse=(v:unknown):unknown=>Array.isArray(v)?v.map(reverse):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,item])=>[k,reverse(item)])):v;
 const reordered=f.equipment.slice().reverse().map(e=>reverse(e) as FeedEquipment);
 assert.equal(simplePowerPlan(reordered,reverse(f.rack.configuration)).revision,original.revision);
 f.inputs.budgets.server.watts=401;assert.notEqual(simplePowerPlan(f.equipment,f.rack.configuration).revision,original.revision);
});
