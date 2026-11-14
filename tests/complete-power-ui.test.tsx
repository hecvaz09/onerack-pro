import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {fourPsuPlanFixture} from './fixtures/four-psu-plan';
import {simplePowerPlan} from '../lib/simple-power-plan';
import {withCables} from './fixtures/b300-power';

type Props={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):Props[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as Props;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as Props).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function find(n:unknown,predicate:(p:Props)=>boolean){const p=nodes(n).find(predicate);assert.ok(p);return p;}
function click(n:unknown,label:string){(find(n,p=>typeof p.onClick==='function'&&text(p.children)===label).onClick as ()=>void)();}

async function harness(){
 const result=await build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/visual-power-map.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'complete-review-adapters',setup(b){
  b.onResolve({filter:/^(react|next\/navigation|lucide-react|\.\/physical-rack-grid|\.\/visual-power-actions)$/},a=>({path:a.path,namespace:'ui'}));
  b.onLoad({filter:/.*/,namespace:'ui'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useEffect:()=>{},useMemo:f=>f(),useContext:()=>__m.settingsPending,useTransition:()=>[false,f=>__m.queue.push(f())]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:()=>{}});':a.path==='./physical-rack-grid'?'export const RackGrid=p=>__m.React.createElement("rack-grid",p);':a.path==='./visual-power-actions'?'export const saveVisualPowerPlan=(...args)=>__m.save(...args);export const connectVisualPower=()=>{throw Error("Individual save must not be used for a reviewed layout")};export const disconnectVisualPower=connectVisualPower;':'export const ArrowRight="svg",Check="svg",ClipboardList="svg",PlugZap="svg",Trash2="svg",X="svg";'}));
 }}]});
 const f=fourPsuPlanFixture(),slots:unknown[]=[],queue:Promise<unknown>[]=[],calls:unknown[][]=[];let cursor=0,complete!:(value:unknown)=>void;
 const mocks={React,queue,settingsPending:false,save:(...args:unknown[])=>{calls.push(args);return new Promise(resolve=>{complete=resolve;});},useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
 const loaded={exports:{}};new Function('module','exports','require','__m',result.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
 const api=loaded.exports as {VisualPowerMap:(p:unknown)=>unknown};
 const render=()=>{cursor=0;return api.VisualPowerMap({rackId:f.rack.id,configuration:f.rack.configuration,equipment:f.equipment,devices:f.rack.devices,heightRU:42,config:{profile:'apc-netshelter-42',pockets:false,pduA:true,pduB:true}});};
 return {f,mocks,calls,queue,render,finish:(value:unknown)=>complete(value),grid:(tree:unknown)=>find(tree,p=>typeof p.onPsu==='function'),controls:(tree:unknown)=>find(tree,p=>p['aria-label']==='Power connection controls')};
}

test('Calculate then inspect PSU shows the full plan and saves only through the bulk action',async()=>{
 const h=await harness();let tree=h.render();click(tree,'Calculate connections');tree=h.render();
 (h.grid(tree).onPsu as (id:string,n:number)=>void)('server',1);tree=h.render();
 const controls=h.controls(tree);
 assert.match(text(controls.children),/Layout checked/);assert.match(text(controls.children),/4 PSU inputs · 2 on A \/ 2 on B/);
 assert.match(text(controls.children),/Save all 5 proposed connections together/);
 assert.match(text(tree),/5.04 A/);assert.match(text(tree),/10.09 A/);assert.doesNotMatch(text(tree),/20.17|PDU capacity exceeded|Cannot save this step/);
 assert.equal((h.grid(tree).powerStatuses as Record<string,Record<number,{state:string}>>).server[1].state,'off');
 click(controls.children,'Save planning layout');click(controls.children,'Save planning layout');assert.equal(h.calls.length,1);
 const plan=simplePowerPlan(h.f.equipment,h.f.rack.configuration);assert.deepEqual(h.calls[0],[h.f.rack.id,plan.revision,true]);
 const saved=withCables(h.f.equipment,plan.assignments);h.finish({ok:true,count:5,planning:true,updates:saved.filter(e=>e.category==='pdu').map(e=>({pduId:e.id,details:e.details}))});await Promise.all(h.queue);
 tree=h.render();assert.ok(Object.values((h.grid(tree).powerStatuses as Record<string,Record<number,{state:string}>>).server).every(s=>s.state==='connected'));
});
test('manual alternative keeps its single-input check and offers review of the complete layout',async()=>{
 const h=await harness(),plan=simplePowerPlan(h.f.equipment,h.f.rack.configuration),c=plan.remaining.find(c=>c.deviceId==='server'&&c.inlet===1)!;
 let tree=h.render();(h.grid(tree).onPsu as (id:string,n:number)=>void)('server',1);tree=h.render();
 (h.grid(tree).onOutlet as (id:string,o:unknown)=>void)(c.pduId,{n:24});tree=h.render();
 assert.match(text(h.controls(tree).children),/only 1 of 4 PSU inputs/);assert.doesNotMatch(text(h.controls(tree).children),/Save planning connection/);
 click(tree,'Review complete layout');tree=h.render();assert.match(text(h.controls(tree).children),/Layout checked/);assert.match(text(tree),/5.04 A/);assert.equal(h.calls.length,0);
 h.f.rack.configuration={...h.f.rack.configuration,feedPower:{...h.f.inputs,headroomPercent:5}};tree=h.render();
 assert.match(text(h.controls(tree).children),/rack changed/);assert.doesNotMatch(text(h.controls(tree).children),/Save planning/);assert.equal(h.calls.length,0);
 click(tree,'Recalculate layout');tree=h.render();assert.match(text(tree),/5 new connections proposed/);
});
test('Review next connection enters the full proposal without writing, and unsaved inputs still block saving',async()=>{
 const h=await harness();let tree=h.render();click(tree,'Review next connection');tree=h.render();
 assert.match(text(h.controls(tree).children),/Layout checked/);assert.match(text(tree),/5 new connections proposed/);assert.equal(h.calls.length,0);
 h.mocks.settingsPending=true;tree=h.render();assert.match(text(h.controls(tree).children),/Review required settings/);assert.doesNotMatch(text(h.controls(tree).children),/Save planning layout/);assert.equal(h.calls.length,0);
});
