import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {individualPowerFixture,individualEquipment} from './fixtures/individual-power';
import {b300PowerFixture,withCables} from './fixtures/b300-power';
import {actionHarness} from './helpers/action-harness';
import {simplePowerPlan,nextPowerQuestion} from '../lib/simple-power-plan';
import {balanceFeeds} from '../lib/feed-balance';
import {feedRack} from '../lib/feed-rack';
import {analyzeFeeds,type Supply} from '../lib/feed-power';
import {designPowerAnalysis} from '../lib/outlet-planning-checks';
import {powerSetupAudit} from '../lib/power-setup-audit';
import {psuConnectionStatuses} from '../lib/psu-connection-status';
import {powerOverview} from '../lib/power-overview';
import {PowerSiteNotice} from '../app/projects/[id]/racks/[rackId]/power-site-notice';
import {FeedElectricalSetup} from '../app/projects/[id]/racks/[rackId]/feed-electrical-setup';
import {RackStatusPane} from '../app/projects/[id]/racks/[rackId]/rack-status-pane';

function unconfirmedRack(){
 const f=individualPowerFixture(false);
 f.rack.devices=f.rack.devices.filter(d=>!d.id.startsWith('missing-'));
 for(const d of f.rack.devices.filter(d=>d.catalogDevice.category==='pdu'))(d.catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile.confirmed=false;
 return {...f,equipment:individualEquipment(f.rack).map(e=>({...e,name:`${e.name} · U${e.startRU}`}))};
}
test('unknown site power allows calculate, bulk save and reloaded green design indicators without confirming the site',async()=>{
 const f=unconfirmedRack(),before=structuredClone(f.rack.configuration),plan=simplePowerPlan(f.equipment,f.rack.configuration);
 assert.equal(plan.error,undefined);assert.equal(plan.remaining.length,2);assert.equal(plan.planning,true);
 assert.ok(balanceFeeds(f.equipment,f.inputs).error,'strict electrical verification still requires the site');
 assert.equal(nextPowerQuestion(f.equipment,f.inputs),null);
 assert.ok(powerSetupAudit(f.equipment,f.inputs).every(c=>!c.blocking));
 const h=await actionHarness({rack:f.rack});
 assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,false)).error);assert.equal(h.updates.length,0);
 assert.equal((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).ok,true);
 const saved=h.snapshot() as typeof f.rack,e=individualEquipment(saved),m=feedRack(e,f.inputs);
 assert.deepEqual(saved.configuration,before);assert.equal(h.rackUpdates.length,0);assert.ok(m.supplies.every(p=>p.confirmed===false));
 const statuses=Object.values(psuConnectionStatuses(e,saved.configuration).server);
 assert.ok(statuses.every(s=>s.state==='connected'&&s.verificationNotes?.some(n=>n.includes('confirm actual supply'))));
 const raw=analyzeFeeds(m.supplies,m.loads,m.cords,f.inputs.headroomPercent);
 assert.equal(raw.ready,false);assert.equal(designPowerAnalysis(raw).ready,true);
 assert.equal(simplePowerPlan(e,saved.configuration).remaining.length,0);assert.equal(powerOverview(e,f.inputs).next.target,'review');
 const html=renderToStaticMarkup(<RackStatusPane devices={[]} equipment={e} configuration={saved.configuration} heightRU={42} pockets={false} basePath="/synthetic" networkCables={0}>{null}</RackStatusPane>);
 assert.match(html,/Power design/);assert.match(html,/Plan checked/);assert.doesNotMatch(html,/Needs review|Incomplete|confirm actual supply/);
});
test('a missing confirmation flag is unknown and stays unknown during design evaluation',()=>{
 const f=unconfirmedRack();for(const d of f.rack.devices.filter(d=>d.catalogDevice.category==='pdu'))delete (d.catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile.confirmed;
 const before=structuredClone(f.equipment),plan=simplePowerPlan(f.equipment,f.rack.configuration);
 assert.equal(plan.error,undefined);assert.equal(plan.planning,true);assert.ok(balanceFeeds(f.equipment,f.inputs).error);assert.deepEqual(f.equipment,before);
});
test('design planning never bypasses missing specifications or known voltage, outlet, branch, phase and failover limits',async()=>{
 const changes:((f:ReturnType<typeof unconfirmedRack>,p:Supply)=>void)[]=[
  (_,p)=>{p.branches={};},(_,p)=>{p.voltage=0;},(_,p)=>{p.limitAmps=.1;},
  (_,p)=>{p.branches!.B1=.1;},(_,p)=>{p.outlets.forEach(o=>{o.limitAmps=.1;});},
  (_,p)=>{p.topology='three-phase-wye';p.outlets.forEach(o=>{delete o.phase;});},
  f=>{f.inputs.budgets.server.minVoltage=230;},f=>{f.inputs.budgets.server.watts=50000;},
  f=>{f.inputs.budgets.server.pf=0;},f=>{f.inputs.budgets.server.watts=0;},
 ];
 for(const change of changes){const f=unconfirmedRack();change(f,(f.rack.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile);const plan=simplePowerPlan(f.equipment,f.rack.configuration);assert.ok(plan.error,String(change));const h=await actionHarness({rack:f.rack});assert.ok((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).error);assert.equal(h.updates.length,0);}
});
test('B300 site uncertainty permits planning while incomplete chassis mapping stays amber',async()=>{
 const f=b300PowerFixture();f.supplies.forEach(p=>{p.confirmed=false;});const plan=simplePowerPlan(f.equipment,f.rack.configuration);
 assert.equal(plan.error,undefined);assert.equal(plan.assignments.length,12);
 const partial=psuConnectionStatuses(withCables(f.equipment,[plan.assignments[0]]),f.rack.configuration);
 assert.equal(partial.b300[1].state,'pending');assert.match(partial.b300[1].description,/complete the chassis input mapping/);
 const h=await actionHarness({rack:f.rack});assert.equal((await h.visual.saveVisualPowerPlan(f.rack.id,plan.revision,true)).ok,true);
 const complete=psuConnectionStatuses(withCables(f.equipment,plan.assignments),f.rack.configuration);
 assert.ok(Object.values(complete.b300).every(s=>s.state==='connected'));assert.ok(f.supplies.every(p=>p.confirmed===false));
});
test('site disclosure presents planned requirements without requiring confirmation or altering data',()=>{
 const f=unconfirmedRack(),supplies=feedRack(f.equipment,f.inputs).supplies,before=structuredClone(supplies);
 const html=renderToStaticMarkup(createElement(PowerSiteNotice,{supplies}));
 assert.match(html,/Site verification pending/);assert.match(html,/calculate and save connections/);assert.match(html,/208/);assert.match(html,/24/);assert.match(html,/upstream capacity/);assert.doesNotMatch(html,/<input|<button/);
 const setup=renderToStaticMarkup(createElement(FeedElectricalSetup,{supplies,initialSupplies:supplies,equipment:f.equipment,onChange:()=>{throw Error('Unexpected write');}}));
 assert.match(setup,/Design settings ready/);assert.match(setup,/Site verified:/);assert.doesNotMatch(setup,/type="checkbox"[^>]*checked/);assert.deepEqual(supplies,before);
 assert.equal(renderToStaticMarkup(createElement(PowerSiteNotice,{supplies:supplies.map(p=>({...p,confirmed:true}))})), '');
});
