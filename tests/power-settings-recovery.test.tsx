import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {b300PowerFixture} from './fixtures/b300-power';
import {powerSettingsProblem} from '../lib/power-settings-problem';
import type {FeedInputs} from '../lib/feed-power';

type Props={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):Props[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as Props;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as Props).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function button(tree:unknown,label:string){const p=nodes(tree).find(p=>typeof p.onClick==='function'&&text(p.children)===label);assert.ok(p,label);return p.onClick as ()=>void;}

test('invalid PF identifies the exact equipment and never becomes a fabricated value',()=>{
 const f=b300PowerFixture();f.inputs.budgets.b300.pf=0;
 const issue=powerSettingsProblem(f.inputs,f.equipment);assert.equal(issue?.deviceId,'b300');assert.equal(issue?.field,'pf');assert.ok(issue?.message.includes('Synthetic B300'));assert.equal(f.inputs.budgets.b300.pf,0);
});

test('actual Save settings rejection opens/focuses PF, preserves edits, keeps the rack interactive, and permits corrected retry',async()=>{
 const result=await build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/feed-power-planner.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'settings-adapters',setup(b){
  b.onResolve({filter:/^(react|next\/navigation|\.\/(clear-layout-controls|power-overview|equipment-power-inputs|saved-power-review|draft-power-panel|feed-electrical-setup|feed-power-controls|feed-power-actions))$/},a=>({path:a.path,namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useTransition:()=>[false,f=>__m.queue.push(f())]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:__m.refresh});':a.path==='./feed-power-actions'?'export const saveFeedInputs=(...args)=>__m.save(...args);':'export const ClearLayoutControls="clear-tools",PowerOverview="overview",EquipmentPowerInputs="equipment-inputs",SavedPowerReview="review",DraftPowerPanel="draft",FeedElectricalSetup="feeds",FeedPowerControls="manual-tools";'}));
 }}]});
 const f=b300PowerFixture(),slots:unknown[]=[],queue:Promise<unknown>[]=[],calls:unknown[][]=[];let cursor=0,refreshes=0;
 const snapshots:{initial:FeedInputs;saveRevision:string}={initial:f.inputs,saveRevision:'a'.repeat(64)};
 let failNetwork=false;
 const mocks={React,queue,refresh:()=>{refreshes++;},save:async(...args:unknown[])=>{calls.push(args);if(failNetwork)throw Error('Synthetic network failure');return {ok:true,saved:args[1],revision:'b'.repeat(64)};},useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
 class Details {open=false;parentElement:Details|null=null;}
 const outer=new Details(),inner=new Details();inner.parentElement=outer;let focused=0;
 const field={parentElement:inner,scrollIntoView(){},focus(){focused++;}};
 const article={dataset:{equipmentPower:'b300'},querySelector:()=>field,parentElement:outer};
 const section={querySelectorAll:()=>[article],scrollIntoView(){},focus(){},parentElement:outer};
 const loaded={exports:{}};
 new Function('module','exports','require','__m','document','requestAnimationFrame','HTMLDetailsElement',result.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),mocks,{getElementById:()=>section},(fn:()=>void)=>fn(),Details);
 const api=loaded.exports as {FeedPowerPlanner:(p:unknown)=>unknown};
 const render=()=>{cursor=0;return api.FeedPowerPlanner({rackId:f.rack.id,equipment:f.equipment,...snapshots,children:React.createElement('rack-preview')});};
 const editor=(tree:unknown)=>nodes(tree).find(p=>typeof p.setInputs==='function')!;
 const edit=(tree:unknown,pf:number)=>{(editor(tree).setInputs as (fn:(v:FeedInputs)=>FeedInputs)=>void)(v=>({...v,budgets:{...v.budgets,b300:{...v.budgets.b300,watts:12345,pf}}}));};
 let tree=render();(nodes(tree).find(p=>p.id==='power-advanced')!.ref as {current:unknown}).current=outer;
 edit(tree,0);tree=render();assert.ok(text(tree).includes('enter a power factor above 0 and at most 1'));button(tree,'Complete required setting')();assert.equal(outer.open,true);assert.equal(calls.length,0);button(tree,'Save settings')();tree=render();
 assert.equal(calls.length,0);assert.equal(outer.open,true);assert.equal(inner.open,true);assert.equal(focused,2);
 assert.equal((editor(tree).inputs as FeedInputs).budgets.b300.pf,0);assert.equal((editor(tree).invalidField as {field:string}).field,'pf');
 assert.ok(!nodes(tree).some(p=>p.inert===true));assert.ok(text(tree).includes('enter a power factor above 0 and at most 1'));
 edit(tree,.98);tree=render();failNetwork=true;button(tree,'Save settings')();await Promise.all(queue);tree=render();assert.equal(calls.length,1);
 failNetwork=false;button(tree,'Save settings')();await Promise.all(queue);assert.equal(calls.length,2);assert.equal(refreshes,1);
 snapshots.initial=(calls[1][1] as FeedInputs);snapshots.saveRevision='b'.repeat(64);tree=render();tree=render();
 assert.equal(nodes(tree).find(p=>typeof p.value==='boolean')!.value,false);
 edit(tree,.5);tree=render();button(tree,'Discard unsaved changes')();tree=render();assert.equal((editor(tree).inputs as FeedInputs).budgets.b300.pf,.98);assert.equal(calls.length,2);
});
