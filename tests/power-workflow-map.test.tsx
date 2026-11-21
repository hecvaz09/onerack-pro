import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {fourPsuPlanFixture} from './fixtures/four-psu-plan';
import {individualPowerFixture} from './fixtures/individual-power';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {savedRackPowerAssessment} from '../lib/rack-power-assessment';
import {withCables} from './fixtures/b300-power';

type Props={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):Props[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as Props;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as Props).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function find(n:unknown,predicate:(p:Props)=>boolean){const p=nodes(n).find(predicate);assert.ok(p);return p;}
function click(n:unknown,label:string){(find(n,p=>typeof p.onClick==='function'&&text(p.children)===label).onClick as ()=>void)();}

let bundle:Promise<string>|undefined;
async function harness(f=fourPsuPlanFixture()){
  bundle??=build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/visual-power-map.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'workflow-map-adapters',setup(b){
    b.onResolve({filter:/^(react|next\/navigation|lucide-react|\.\/physical-rack-grid|\.\/power-balance-sheet|\.\/visual-power-actions)$/},a=>({path:a.path,namespace:'ui'}));
    b.onLoad({filter:/.*/,namespace:'ui'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useEffect:()=>{},useMemo:f=>f(),useContext:()=>__m.settingsPending,useTransition:()=>[false,f=>__m.queue.push(f())]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:()=>{}});':a.path==='./physical-rack-grid'?'export const RackGrid="rack-grid";':a.path==='./power-balance-sheet'?'export const PowerBalanceSheet="balance-sheet";':a.path==='./visual-power-actions'?'export const saveVisualPowerPlan=(...args)=>__m.save(...args);export const connectVisualPower=(...args)=>__m.connect(...args);export const disconnectVisualPower=()=>{throw Error("Unexpected clear")};':'export const ArrowRight="svg",Check="svg",ClipboardList="svg",PlugZap="svg",Trash2="svg",X="svg";'}));
  }}]}).then(r=>r.outputFiles![0].text);
  const slots:unknown[]=[],queue:Promise<unknown>[]=[],calls:unknown[][]=[],individualCalls:unknown[][]=[];let cursor=0,complete!:(value:unknown)=>void;
  const mocks={React,queue,settingsPending:false,save:(...args:unknown[])=>{calls.push(args);return new Promise(resolve=>{complete=resolve;});},connect:async(...args:unknown[])=>{individualCalls.push(args);return {error:'Synthetic action response'};},useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
  const loaded={exports:{}};new Function('module','exports','require','__m',await bundle)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
  const api=loaded.exports as {VisualPowerMap:(props:unknown)=>unknown};
  const render=()=>{cursor=0;return api.VisualPowerMap({rackId:f.rack.id,configuration:f.rack.configuration,equipment:f.equipment,devices:f.rack.devices,heightRU:42,config:{profile:'apc-netshelter-42',pockets:false,pduA:true,pduB:true}});};
  return {f,mocks,render,calls,individualCalls,queue,finish:(value:unknown)=>complete(value),
    sheet:(tree:unknown)=>find(tree,p=>p.basis==='saved'||p.basis==='proposed'),
    save:(tree:unknown)=>find(tree,p=>p['data-power-save-layout']==='true'),
    grid:(tree:unknown)=>find(tree,p=>typeof p.onPsu==='function'),
  };
}

test('steps 2–4 have ordered anchors, one balance sheet and one full-layout Save action',async()=>{
  const h=await harness();let tree=h.render();
  const ids=nodes(tree).map(p=>p.id).filter(id=>['power-calculate','power-rack-review','power-save-connections'].includes(String(id)));
  assert.deepEqual(ids,['power-calculate','power-rack-review','power-save-connections']);
  assert.equal(nodes(tree).filter(p=>p.basis==='saved'||p.basis==='proposed').length,1);
  assert.equal(nodes(tree).filter(p=>p['data-power-save-layout']==='true').length,1);assert.equal(h.save(tree).disabled,true);
  assert.equal(h.sheet(tree).basis,'saved');assert.deepEqual(h.sheet(tree).analysis,savedRackPowerAssessment(h.f.equipment,h.f.rack.configuration).strict);
  const elements=nodes(tree);assert.ok(elements.indexOf(h.sheet(tree))<elements.indexOf(h.grid(tree)),'balance precedes the rack');
  click(tree,'Calculate connections');tree=h.render();
  assert.equal(h.sheet(tree).basis,'proposed');assert.equal(h.save(tree).disabled,false);assert.equal(h.calls.length,0);
  assert.deepEqual(h.sheet(tree).analysis,simplePowerPlan(h.f.equipment,h.f.rack.configuration).analysis);
  assert.match(text(tree),/Dashed outlines are proposed connections/);
  (h.grid(tree).onPsu as (id:string,inlet:number)=>void)('server',1);tree=h.render();
  const controls=find(tree,p=>p['aria-label']==='Power connection controls');
  assert.ok(nodes(controls.children).some(p=>p.href==='#power-save-connections'&&text(p.children)==='Review and save layout'));
  assert.equal(nodes(tree).filter(p=>typeof p.onClick==='function'&&/^(Save connections|Save planning layout)$/.test(text(p.children))).length,1);
});

test('unsaved settings and a changed rack show saved balance and block stale layout saves',async()=>{
  const h=await harness();let tree=h.render();click(tree,'Calculate connections');tree=h.render();
  (h.grid(tree).onPsu as (id:string,inlet:number)=>void)('server',1);tree=h.render();
  h.mocks.settingsPending=true;tree=h.render();
  assert.equal(h.sheet(tree).basis,'saved');assert.equal(h.save(tree).disabled,true);assert.match(text(tree),/Unsaved changes are excluded/);
  const controls=find(tree,p=>p['aria-label']==='Power connection controls');
  assert.match(text(controls.children),/Settings not saved/);assert.doesNotMatch(text(controls.children),/Layout checked|Complete layout/);
  (h.save(tree).onClick as ()=>void)();assert.equal(h.calls.length,0);
  const zoom=find(tree,p=>p['aria-label']==='Zoom rack in');assert.equal(zoom.disabled,false);
  h.mocks.settingsPending=false;
  h.f.rack.configuration={...h.f.rack.configuration,feedPower:{...h.f.inputs,headroomPercent:5}};tree=h.render();
  assert.equal(h.sheet(tree).basis,'saved');assert.equal(h.save(tree).disabled,true);assert.match(text(tree),/previous proposal is out of date/);
  assert.deepEqual(h.sheet(tree).analysis,savedRackPowerAssessment(h.f.equipment,h.f.rack.configuration).strict);
  (h.save(tree).onClick as ()=>void)();assert.equal(h.calls.length,0);
  click(tree,'Calculate connections');tree=h.render();assert.equal(h.sheet(tree).basis,'proposed');assert.equal(h.sheet(tree).headroomPercent,5);assert.equal(h.save(tree).disabled,false);
});

test('the sole full-layout action saves once and only then updates PSU lights and saved balance',async()=>{
  const h=await harness();let tree=h.render();click(tree,'Calculate connections');tree=h.render();
  const statuses=()=>h.grid(tree).powerStatuses as Record<string,Record<number,{state:string}>>;
  assert.equal(statuses().server[1].state,'off');
  const save=h.save(tree).onClick as ()=>void;save();save();assert.equal(h.calls.length,1);
  const plan=simplePowerPlan(h.f.equipment,h.f.rack.configuration);assert.deepEqual(h.calls[0],[h.f.rack.id,plan.revision,plan.planning]);
  const saved=withCables(h.f.equipment,plan.assignments);
  h.finish({ok:true,count:plan.remaining.length,planning:plan.planning,updates:saved.filter(e=>e.category==='pdu').map(e=>({pduId:e.id,details:e.details}))});await Promise.all(h.queue);
  tree=h.render();assert.equal(h.sheet(tree).basis,'saved');assert.equal(h.save(tree).disabled,true);
  assert.ok(Object.values(statuses().server).every(s=>s.state==='connected'));assert.match(text(tree),/Connections saved/);
  assert.deepEqual(h.sheet(tree).analysis,savedRackPowerAssessment(saved,h.f.rack.configuration).strict);
  assert.equal(h.individualCalls.length,0);
});

test('a failed calculation cannot display an unsaveable proposal as the current balance',async()=>{
  const h=await harness();h.f.inputs.budgets.server.watts=50000;
  let tree=h.render();click(tree,'Calculate connections');tree=h.render();
  assert.equal(h.sheet(tree).basis,'saved');assert.equal(h.save(tree).disabled,true);assert.match(text(tree),/settings need attention|Resolve the calculation checks/);
  (h.save(tree).onClick as ()=>void)();assert.equal(h.calls.length,0);
});

test('individual connection tools remain available when automatic layout planning is incomplete',async()=>{
  const f=individualPowerFixture(true);
  const h=await harness(f);let tree=h.render();
  (h.grid(tree).onPsu as (id:string,inlet:number)=>void)('server',1);tree=h.render();
  (h.grid(tree).onOutlet as (id:string,outlet:unknown)=>void)('pdu-a',{n:1});tree=h.render();
  assert.equal(h.save(tree).disabled,true);assert.equal(h.sheet(tree).basis,'saved');
  click(tree,'Save planning connection');await Promise.all(h.queue);
  assert.equal(h.individualCalls.length,1);assert.equal(h.calls.length,0);
});
