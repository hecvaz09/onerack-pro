import {equipmentRecord} from '../lib/equipment-record';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {B300_INPUT_IDENTITY,b300PowerInputBoxes,powerInputLabel,powerAssignmentLabel} from '../lib/b300-power-inputs';
import {feedRack} from '../lib/feed-rack';
import {analyzeFeeds,feedInputsError} from '../lib/feed-power';
import {balanceFeeds} from '../lib/feed-balance';
import {visualPowerBalance,validateVisualPower} from '../lib/visual-power';
import {powerWiringGuide} from '../lib/power-wiring-guide';
import {powerOverview} from '../lib/power-overview';
import {connectedPsuInlets,outletDestination} from '../lib/connection-highlights';
import {catalogProfile} from '../lib/catalog-artwork';
import {FaceConnections} from '../app/projects/[id]/racks/[rackId]/face-connections';
import {rackPowerPlanner} from '../lib/rack-capabilities';
import {analyzePx3,readPx3Settings} from '../lib/px3-power';
import {b300PowerFixture,withCables} from './fixtures/b300-power';

test('B300 has 12 physical inputs independent of internal PSU minimum/capacity overrides; legacy models retain their count',()=>{
 const f=b300PowerFixture();f.inputs.budgets.b300={...f.inputs.budgets.b300,cords:6,minimumCords:6,psuAcCapacity:1};
 const load=feedRack(f.equipment,f.inputs).loads[0];assert.equal(load.cords,12);assert.equal(load.assessment,'pdu-capacity');
 const other=f.equipment.map(d=>d.id==='b300'?{...d,sku:'OTHER',model:'Other 6 PSU chassis'}:d);assert.equal(feedRack(other,f.inputs).loads[0].cords,6);assert.equal(feedRack(other,f.inputs).loads[0].assessment,undefined);
 assert.equal(powerInputLabel(f.equipment[2],12),'PSU 6 · Input 2');assert.equal(powerInputLabel(other[2],6),'PSU 6');
});
test('allocator assigns every B300 input once, preserves identifiers and balances six connections per feed',()=>{
 const f=b300PowerFixture(),p=balanceFeeds(f.equipment,f.inputs);assert.equal(p.error,undefined);assert.equal(p.analysis.ready,true);assert.equal(p.assignments.length,12);
 assert.deepEqual(p.assignments.map(c=>c.inlet).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
 assert.ok(p.assignments.every(c=>c.inputIdentity===B300_INPUT_IDENTITY));
 for(const id of ['pdu-a','pdu-b'])assert.equal(p.assignments.filter(c=>c.pduId===id).length,6);
 assert.equal(new Set(p.assignments.map(c=>c.pduId+':'+c.outlet)).size,12);
});
test('normal PDU totals include whole-system demand once and each feed-loss capacity scenario redistributes the entire demand',()=>{
 const f=b300PowerFixture();f.inputs.headroomPercent=20;const p=balanceFeeds(f.equipment,f.inputs);assert.equal(p.error,undefined);
 for(const s of p.analysis.scenarios){assert.ok(Math.abs(s.totals.reduce((n,p)=>n+p.watts,0)-14400)<1e-7);assert.equal(s.errors.length,0);}
 assert.ok(p.analysis.scopeNotes?.join(' ').includes('Server internal redundancy is not evaluated'));
});
test('incomplete saved mapping stays incomplete without inventing a full chassis draw on its first cord',()=>{
 const f=b300PowerFixture(),p=balanceFeeds(f.equipment,f.inputs),c=p.assignments.find(c=>c.inlet===12)!;
 const review=visualPowerBalance(f.equipment,{feedPower:f.inputs},c);assert.equal(review.status,'caution');assert.deepEqual(review.errors,[]);assert.equal(review.projected.ready,false);
 assert.ok(review.projected.issues.some(i=>i.includes('not all 12')));assert.ok(review.projected.scopeNotes?.join(' ').includes('excluded from capacity totals'));
 const guide=powerWiringGuide(f.equipment,{feedPower:f.inputs},{deviceId:'b300',inlet:12},c);assert.equal(guide.error,undefined);assert.equal(guide.recommendation?.inlet,12);
});
test('fixed input 12 is retained while the remaining rack is allocated, and source records are never mutated',()=>{
 const f=b300PowerFixture(),p=balanceFeeds(f.equipment,f.inputs),fixed=p.assignments.find(c=>c.inlet===12)!;
 const e=withCables(f.equipment,[fixed]),before=structuredClone(e),next=balanceFeeds(e,f.inputs);assert.equal(next.error,undefined);
 assert.deepEqual(next.assignments.find(c=>c.inlet===12),fixed);assert.deepEqual(e,before);
});
test('known outlet, branch and phase overloads cannot become an approved 12-input proposal',()=>{
 for(const kind of ['outlet','branch','phase'] as const){const f=b300PowerFixture();f.inputs.supplies=Object.fromEntries(f.supplies.map(p=>[p.id,{...p,...(kind==='phase'?{limitAmps:5}:kind==='branch'?{branches:Object.fromEntries(Object.keys(p.branches!).map(k=>[k,3]))}:{outlets:p.outlets.map(o=>({...o,limitAmps:3}))})}]));
 const p=balanceFeeds(f.equipment,f.inputs);assert.ok(p.error,kind);assert.equal(p.analysis.ready,false);}
});
test('missing watts, PF, cord current or voltage never yields an approved B300 plan',()=>{
 for(const field of ['watts','pf','cordLimitAmps','minVoltage'] as const){const f=b300PowerFixture();delete (f.inputs.budgets.b300 as Record<string,unknown>)[field];const p=balanceFeeds(f.equipment,f.inputs);assert.ok(p.error,field);assert.equal(p.analysis.ready,false);}
});
test('duplicate input and duplicate outlet assignments are rejected; out-of-range inputs are not physical endpoints',()=>{
 const f=b300PowerFixture(),model=feedRack(f.equipment,f.inputs),p=balanceFeeds(f.equipment,f.inputs);
 for(const extra of [{...p.assignments[0],outlet:12},{...p.assignments[1],pduId:p.assignments[0].pduId,outlet:p.assignments[0].outlet}]){
 const a=analyzeFeeds(model.supplies,model.loads,[...p.assignments,extra]);assert.equal(a.ready,false);assert.ok(a.issues.some(i=>i.includes('Duplicate')));}
 for(const n of [0,13,1.5])assert.ok(validateVisualPower(f.equipment,{feedPower:f.inputs},'pdu-a',1,'b300',n));
});
test('legacy unversioned B300 PSU assignments require review and are never silently reinterpreted',()=>{
 const f=b300PowerFixture(),p=balanceFeeds(f.equipment,f.inputs),old={...p.assignments[0],inputIdentity:undefined};const equipment=withCables(f.equipment,[old]);
 const next=balanceFeeds(equipment,f.inputs);assert.ok(next.error);assert.ok(next.analysis.issues.some(i=>i.includes('saved input identity needs review')));
 assert.equal(powerOverview(equipment,f.inputs).connected,0);assert.equal(powerAssignmentLabel(equipment[2],old),'Legacy PSU 1 - exact input needs review');
 const devices=equipment.map(e=>({id:e.id,label:e.name,startRU:e.startRU!,details:e.details,catalogDevice:{category:e.category,model:e.model!,sku:e.sku,heightRU:e.category==='pdu'?0:8}}));
 assert.deepEqual(connectedPsuInlets(devices,'b300'),[]);assert.ok(outletDestination({deviceId:'b300',inlet:1},devices).includes('exact input needs review'));
});
test('all twelve hit rectangles agree with the untouched SVG openings and labels identify module and input',()=>{
 const svg=readFileSync('public/equipment-artwork/smc-b3008u-rear.svg','utf8');
 for(const {n,box} of b300PowerInputBoxes){const key=`${Math.ceil(n/2)}-${(n-1)%2+1}`;const g=svg.split(`data-module-input="${key}"`)[1]?.split('</g>')[0];assert.ok(g);const rect=g.match(/<rect[^>]*>/)![0];
 for(const [prop,value] of Object.entries({x:box.x,y:box.y,width:box.w,height:box.h}))assert.ok(rect.includes(`${prop}="${value}"`),key+' '+prop);}
 const p=catalogProfile('AS-8126GS-NB3RT')!;const html=renderToStaticMarkup(createElement('svg',null,createElement(FaceConnections,{profile:p,face:'rear',deviceId:'b300',psus:[12]})));
 assert.equal((html.match(/class="psu-hit"/g)||[]).length,12);assert.equal((html.match(/data-connected="true"/g)||[]).length,1);assert.ok(html.includes('PSU 6 · Input 2'));assert.ok(html.includes('data-psu-inlet="12"'));
 const controls=FaceConnections({profile:p,face:'rear',deviceId:'b300'}).props.children[1];let stopped=false;controls[11].props.onPointerDown({stopPropagation(){stopped=true;}});assert.equal(stopped,true);
});
test('B300 racks use the existing shared planner even with a Raritan pair; old specialist cannot approve unsupported input identities',()=>{
 const f=b300PowerFixture();const devices=f.rack.devices;assert.equal(rackPowerPlanner(devices), 'feed');
 assert.equal(analyzePx3(f.equipment.map(e=>({...e,model:e.model!,mounting:e.mounting!})),readPx3Settings({})).ready,false);
});
test('12 input budgets validate structurally but larger/fractional input counts do not',()=>{
 const f=b300PowerFixture();f.inputs.budgets.b300.cords=12;assert.equal(feedInputsError(f.inputs),null);
 for(const n of [13,1.5]){f.inputs.budgets.b300.cords=n;assert.ok(feedInputsError(f.inputs));}
});

test('B300 Library reference separates six modules from twelve inputs and marks internal redundancy limits outside the PDU check',()=>{const f=b300PowerFixture(),device=f.equipment[2];const record=equipmentRecord(device.model!,device.rawData,{cords:6,minimumCords:3,psuAcCapacity:6600});assert.equal(record.facts.find(f=>f.key==='cords')?.value,'12');assert.equal(record.facts.find(f=>f.key==='cords')?.label,'Physical AC inputs');for(const key of ['minimumCords','psuAcCapacity']){assert.equal(record.facts.find(f=>f.key===key)?.origin,'unknown');assert.ok(record.facts.find(f=>f.key===key)?.label.includes('outside this check'));}assert.equal(record.facts.find(f=>f.key==='psuDcWatts')?.value,'6600 W');});
