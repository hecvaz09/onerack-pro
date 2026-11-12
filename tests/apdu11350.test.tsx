import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import record from '../data/catalog/apc-apdu11350me.json';
import {APDU11350_WHIP_DOWN,apdu11350Bank} from '../lib/apc-apdu11350';
import {feedRack} from '../lib/feed-rack';
import {outletVoltage,supplyCapacityVA,supplyDemand,supplyIssues} from '../lib/feed-power';
import {readOutlets} from '../lib/equipment-details';
import {readSystemSpecs} from '../lib/system-specs';
import {networkPorts} from '../lib/network-ports';
import {Apdu11350Panel} from '../app/projects/[id]/racks/[rackId]/apdu11350-panel';
import {RackGrid,type RackGridDevice} from '../app/projects/[id]/racks/[rackId]/physical-rack-grid';
import {RackOverview3D} from '../app/projects/[id]/racks/[rackId]/rack-overview-3d';
import {readRackConfig} from '../lib/rack-config';
import {addApdu11350,type LibraryAddPlan} from '../scripts/add-apdu11350me';

test('APDU11350: all 48 printed identities, banks and connectors agree across Library and rotated artwork',()=>{
 const outlets=readOutlets(record.rawData),electrical=record.rawData.electricalProfile;
 assert.equal(outlets.length,48);assert.equal(new Set(APDU11350_WHIP_DOWN.flat()).size,48);
 assert.deepEqual(APDU11350_WHIP_DOWN[0],[47,48,45,46]);assert.deepEqual(APDU11350_WHIP_DOWN[11],[3,4,1,2]);
 const banks=[[1,2,3,4,13,14,15,16],[5,6,7,8,17,18,19,20],[9,10,11,12,21,22,23,24],[25,26,27,28,37,38,39,40],[29,30,31,32,41,42,43,44],[33,34,35,36,45,46,47,48]];
 banks.forEach((numbers,i)=>{assert.deepEqual(outlets.filter(o=>o.cb===i+1).map(o=>o.n),numbers);numbers.forEach(n=>assert.equal(apdu11350Bank(n),i+1));});
 for(const o of outlets){const e=electrical.outlets.find(e=>e.n===o.n)!;assert.equal(e.branch,`B${o.cb}`);assert.equal(e.phase,`L${(o.cb!-1)%3+1}`);assert.equal(e.limitAmps,o.n%2?10:16);assert.deepEqual(e.connectors,o.type.split('/'));}
 assert.equal(readSystemSpecs(record.rawData).status,'verified');
 const ports=networkPorts(record.rawData);assert.equal(ports.length,1);assert.equal(ports[0].position,'mgmt');assert.equal(ports[0].reviewed,true);assert.deepEqual(ports[0].supportedSpeedsGbps,[.01,.1,1]);
});
test('APDU11350: inherits the US profile; site confirmation and installed overrides remain explicit',()=>{
 const e={id:'new-pdu',name:'APDU11350ME',category:'pdu',mounting:'rear-right',rawData:record.rawData,details:{}};
 const p=feedRack([e],{headroomPercent:0,budgets:{}}).supplies[0];
 assert.equal(p.voltage,415);assert.equal(p.limitAmps,24);assert.equal(p.confirmed,false);assert.equal(p.feed,'A');
 assert.deepEqual(supplyIssues(p),['confirm actual supply voltage, phase map and usable limits']);
 assert.ok(Math.abs(outletVoltage(p,p.outlets[0])-239.6)<.01);assert.ok(Math.abs(supplyCapacityVA(p)-17251.23)<.1);
 const confirmed=feedRack([e],{headroomPercent:0,budgets:{},supplies:{'new-pdu':{...p,confirmed:true,voltage:400,feed:'B'}}}).supplies[0];assert.equal(confirmed.voltage,400);assert.equal(confirmed.limitAmps,24);assert.deepEqual(supplyIssues(confirmed),[]);
 const balanced=supplyDemand(p,[1,5,9].map(n=>({outlet:p.outlets[n-1],watts:1000,pf:1})));assert.ok(balanced.spread<1e-10);
});
test('APDU11350: panel exposes 48 exact outlet targets and one LAN link, including saved highlights',()=>{
 const html=renderToStaticMarkup(createElement(Apdu11350Panel,{devices:[],deviceId:'pdu',networkHref:'/connections?mode=network',ports:networkPorts(record.rawData),outlets:readOutlets(record.rawData),assignments:{'48':{deviceId:'server',inlet:1,notes:''}}}));
 assert.equal((html.match(/data-power-outlet=/g)||[]).length,48);assert.equal((html.match(/<a /g)||[]).length,1);
 assert.ok(html.includes('data-power-outlet="48" data-breaker="6" data-phase="3" data-assigned="true"'));
 assert.ok(html.includes('Outlet 25 · C13/C15 · B4 · L1–N'));
});
test('APDU11350: both rack renderers select the new panel without a Raritan preset',()=>{
 const devices:RackGridDevice[]=[{id:'pdu',label:'APDU11350ME',startRU:1,mounting:'rear-right',details:{},catalogDevice:{...record,outlets:readOutlets(record.rawData)},networkPorts:networkPorts(record.rawData)}];
 const config=readRackConfig({profile:'apc-netshelter-42',pockets:false});
 for(const view of [createElement(RackGrid,{devices,heightRU:42,config,rear:true,disabled:true,onPsu(){},onOutlet(){}}),createElement(RackOverview3D,{devices,heightRU:42,config,onEdit(){}})]){
  const html=renderToStaticMarkup(view);assert.ok(html.includes('apdu11350-panel'));assert.equal((html.match(/data-power-outlet=/g)||[]).length,48);assert.ok(!html.includes('APC APDU10151ME outlets'));
 }
});
test('Library addition is insert-only, idempotent, rejects conflicts and protects installed hardware on rollback',async()=>{
 let rows:Record<string,unknown>[]=[],installed=false;const sql:string[]=[];
 const db={async query(query:string){sql.push(query);if(query.startsWith('SELECT id,sku'))return {rows};if(query.startsWith('SELECT id FROM'))return {rows:installed?[{id:'device'}]:[]};if(query.startsWith('INSERT')){rows=[record];return {rows:[],rowCount:1};}if(query.startsWith('DELETE')){rows=[];return {rows:[],rowCount:1};}return {rows:[]};}};
 const plan=await addApdu11350(db,'plan') as LibraryAddPlan;assert.equal(plan.changed,true);
 await addApdu11350(db,'apply',plan);await addApdu11350(db,'verify',plan);
 const again=await addApdu11350(db,'plan') as LibraryAddPlan;assert.equal(again.changed,false);await addApdu11350(db,'apply',again);assert.equal(sql.filter(s=>s.startsWith('INSERT')).length,1);
 installed=true;await assert.rejects(addApdu11350(db,'rollback',plan),/now installed/);assert.equal(rows.length,1);
 installed=false;await addApdu11350(db,'rollback',plan);assert.equal(rows.length,0);
 rows=[{...record,vendor:'Concurrent edit'}];await assert.rejects(addApdu11350(db,'plan'),/preserved without writes/);
 assert.ok(!sql.some(s=>/^(UPDATE|INSERT INTO "DeviceInstance")/.test(s)));
});
