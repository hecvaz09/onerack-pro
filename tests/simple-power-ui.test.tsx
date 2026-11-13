import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {b300PowerFixture,withCables} from './fixtures/b300-power';
import {simplePowerPlan} from '../lib/simple-power-plan';

type NodeProps={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):NodeProps[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as NodeProps;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as NodeProps).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function button(tree:unknown,label:string){const p=nodes(tree).find(p=>typeof p.onClick==='function'&&text(p.children)===label);assert.ok(p,'Missing button: '+label);return p.onClick as ()=>void;}

for(const siteUnknown of [false,true])test(`actual Calculate/Save controls preview, save once and light committed inputs (site unknown: ${siteUnknown})`,async()=>{
 const result=await build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/visual-power-map.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'workflow-adapters',setup(b){
  b.onResolve({filter:/^(react|next\/navigation|lucide-react|\.\/physical-rack-grid|\.\/visual-power-actions)$/},a=>({path:a.path,namespace:'ui'}));
  b.onLoad({filter:/.*/,namespace:'ui'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useEffect:()=>{},useMemo:f=>f(),useContext:()=>__m.settingsPending,useTransition:()=>[false,f=>__m.queue.push(f())]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:__m.refresh});':a.path==='./physical-rack-grid'?'export const RackGrid=p=>__m.React.createElement("rack-grid",p);':a.path==='./visual-power-actions'?'export const saveVisualPowerPlan=(...args)=>__m.save(...args);export const connectVisualPower=()=>{throw Error("Unexpected individual save")};export const disconnectVisualPower=()=>{throw Error("Unexpected clear")};':'export const ArrowRight="svg",Check="svg",ClipboardList="svg",PlugZap="svg",Trash2="svg",X="svg";'}));
 }}]});
 const f=b300PowerFixture(),slots:unknown[]=[],queue:Promise<unknown>[]=[],calls:unknown[][]=[];let cursor=0,refreshes=0,complete!:(value:unknown)=>void;
 if(siteUnknown)f.supplies.forEach(p=>{p.confirmed=false;});
 const mocks={React,queue,settingsPending:false,refresh:()=>{refreshes++;},save:(...args:unknown[])=>{calls.push(args);return new Promise(resolve=>{complete=resolve;});},useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
 const loaded={exports:{}};new Function('module','exports','require','__m',result.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
 const api=loaded.exports as {VisualPowerMap:(p:unknown)=>unknown};
 const render=()=>{cursor=0;return api.VisualPowerMap({rackId:f.rack.id,configuration:f.rack.configuration,equipment:f.equipment,devices:f.rack.devices,heightRU:42,config:{profile:'apc-netshelter-42',pockets:false,pduA:true,pduB:true}});};
 const states=(tree:unknown)=>(nodes(tree).find(p=>typeof p.onPsu==='function')!.powerStatuses as Record<string,Record<number,{state:string}>>).b300;
 let tree=render();assert.equal(states(tree)[12].state,'off');
 const control=(label:string)=>nodes(tree).find(p=>p['aria-label']===label)!;
 assert.equal(nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom,100);
 (control('Zoom rack in').onClick as ()=>void)();tree=render();assert.equal(nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom,125);assert.equal(calls.length,0);
 for(let i=0;i<12;i++){(control('Zoom rack in').onClick as ()=>void)();tree=render();}assert.equal(nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom,300);assert.equal(control('Zoom rack in').disabled,true);
 for(let i=0;i<12;i++){(control('Zoom rack out').onClick as ()=>void)();tree=render();}assert.equal(nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom,50);assert.equal(control('Zoom rack out').disabled,true);
 button(tree,'Reset')();tree=render();assert.equal(nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom,100);
 button(tree,'Calculate connections')();tree=render();assert.equal(states(tree)[12].state,'off');assert.ok(text(tree).includes('12 new connections proposed'));
 const save=button(tree,siteUnknown?'Save planning layout':'Save connections');save();save();assert.equal(calls.length,1);
 const plan=simplePowerPlan(f.equipment,f.rack.configuration);assert.deepEqual(calls[0],[f.rack.id,plan.revision,siteUnknown]);
 const saved=withCables(f.equipment,plan.assignments);complete({ok:true,count:12,planning:siteUnknown,updates:saved.filter(e=>e.category==='pdu').map(e=>({pduId:e.id,details:e.details}))});await Promise.all(queue);
 tree=render();assert.equal(refreshes,1);assert.ok(Object.values(states(tree)).every(s=>s.state==='connected'));assert.ok(text(tree).includes('Connections saved.'));const meters=nodes(tree).filter(p=>p.role==='progressbar');assert.equal(meters.length,2);for(const meter of meters){assert.equal(meter['aria-valuenow'],6);assert.equal(meter['aria-valuemax'],6);assert.equal(meter.className,'power-feed-progress');}
 assert.ok(text(tree).includes('12/12 connections planned'));if(siteUnknown){assert.ok(text(tree).includes('site verification pending'));assert.ok(f.supplies.every(p=>p.confirmed===false));}
 mocks.settingsPending=true;tree=render();assert.equal(nodes(tree).find(p=>typeof p.onClick==='function'&&text(p.children)==='Calculate connections')!.disabled,true);assert.equal(control('Zoom rack in').disabled,false);const beforeZoom=nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom;(control('Zoom rack in').onClick as ()=>void)();tree=render();assert.notEqual(nodes(tree).find(p=>typeof p.onPsu==='function')!.zoom,beforeZoom);assert.equal(calls.length,1);
});
