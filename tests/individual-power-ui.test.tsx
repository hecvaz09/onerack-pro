import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {individualPowerFixture,individualEquipment} from './fixtures/individual-power';
import {actionHarness} from './helpers/action-harness';

type Props={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):Props[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as Props;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as Props).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function find(n:unknown,check:(p:Props)=>boolean){const p=nodes(n).find(check);assert.ok(p);return p;}

test('actual controls save and reload the current outlet-plan status despite paused automatic balancing, then clear to off',async()=>{
 const result=await build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/visual-power-map.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'individual-workflow-adapters',setup(b){
  b.onResolve({filter:/^(react|next\/navigation|lucide-react|\.\/physical-rack-grid|\.\/visual-power-actions)$/},a=>({path:a.path,namespace:'ui'}));
  b.onLoad({filter:/.*/,namespace:'ui'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useEffect:()=>{},useMemo:f=>f(),useContext:()=>__m.settingsPending,useTransition:()=>[false,f=>__m.queue.push(f())]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:()=>{}});':a.path==='./physical-rack-grid'?'export const RackGrid=p=>__m.React.createElement("rack-grid",p);':a.path==='./visual-power-actions'?'export const connectVisualPower=(...args)=>__m.connect(...args);export const disconnectVisualPower=(...args)=>__m.clear(...args);export const saveVisualPowerPlan=()=>{throw Error("Unexpected bulk save")};':'export const ArrowRight="svg",Check="svg",ClipboardList="svg",PlugZap="svg",Trash2="svg",X="svg";'}));
 }}]});
 for(const unknownPdu of [true,false]){
 const f=individualPowerFixture(unknownPdu);
 f.inputs.budgets.server={watts:556,pf:.87,minVoltage:100,maxVoltage:240,estimateSource:'Reviewed planning estimate'};
 const h=await actionHarness({rack:f.rack}),slots:unknown[]=[],queue:Promise<unknown>[]=[],calls:unknown[][]=[];let cursor=0;
 const mocks={React,queue,settingsPending:false,
  connect:(...args:Parameters<typeof h.visual.connectVisualPower>)=>{calls.push(args);return h.visual.connectVisualPower(...args);},clear:h.visual.disconnectVisualPower,
  useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
 const loaded={exports:{}};new Function('module','exports','require','__m',result.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
 const api=loaded.exports as {VisualPowerMap:(p:unknown)=>unknown};
 let equipment=f.equipment,devices=f.rack.devices;
 const render=()=>{cursor=0;return api.VisualPowerMap({rackId:f.rack.id,configuration:f.rack.configuration,equipment,devices,heightRU:42,config:{profile:'apc-netshelter-42',pockets:false,pduA:true,pduB:true}});};
 const grid=(tree:unknown)=>find(tree,p=>typeof p.onPsu==='function');
 const state=(tree:unknown,inlet=1)=>(grid(tree).powerStatuses as Record<string,Record<number,{state:string}>>).server[inlet].state;
 const click=(tree:unknown,label:string)=>(find(tree,p=>typeof p.onClick==='function'&&text(p.children)===label).onClick as ()=>void)();
 let tree=render();(grid(tree).onPsu as (id:string,n:number)=>void)('server',1);tree=render();
 assert.ok(text(tree).includes('Select a free outlet'));
 (grid(tree).onOutlet as (id:string,o:unknown)=>void)('pdu-a',{n:1});tree=render();
 const controls=find(tree,p=>p['aria-label']==='Power connection controls');
 assert.ok(text(controls.children).includes('Save planning connection'));
 assert.ok(!text(controls.children).includes('electrical or configuration issues'));
 assert.equal(state(tree),'off');
 mocks.settingsPending=true;tree=render();assert.ok(text(find(tree,p=>p['aria-label']==='Power connection controls').children).includes('Review required settings'));
 mocks.settingsPending=false;tree=render();click(tree,'Save planning connection');click(tree,'Save planning connection');await Promise.all(queue);
 assert.equal(calls.length,1);assert.deepEqual(calls[0],[f.rack.id,'pdu-a',1,'server',1,true]);
 const expected=unknownPdu?'pending':'connected';
 tree=render();assert.equal(state(tree),expected);assert.equal(state(tree,2),'off');
 const after=h.snapshot() as typeof f.rack;devices=after.devices;equipment=individualEquipment(after);slots.length=0;tree=render();
 assert.equal(state(tree),expected);(grid(tree).onPsu as (id:string,n:number)=>void)('server',1);tree=render();
 assert.ok(text(tree).includes(unknownPdu?'Saved · planning checks pending':'Saved · outlet plan checked'));
 assert.ok(text(tree).includes('Planning assumptions and deferred checks'));
 assert.equal((find(tree,p=>p.className==='visual-power-map').style as Record<string,string>)['--power-feedback'],unknownPdu?'#f4ce73':'#5ee9b5','selected saved cord follows its own status despite global recommendation errors');
 click(tree,'Clear connection');tree=render();click(tree,'Yes, clear connection');await Promise.all(queue);
 tree=render();assert.equal(state(tree),'off');assert.equal(h.updates.length,2);
 }
});
