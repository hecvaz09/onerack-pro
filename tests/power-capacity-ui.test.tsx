import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {powerCapacityFixture} from './fixtures/power-capacity';
import {PowerCapacityReview} from '../app/projects/[id]/racks/[rackId]/power-capacity-review';
import type {PowerCapacityReview as Capacity} from '../lib/power-capacity-review';

type Props={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):Props[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as Props;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as Props).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function find(n:unknown,check:(p:Props)=>boolean){const p=nodes(n).find(check);assert.ok(p);return p;}

test('blocked connection opens capacity review instead of unrelated missing settings and never offers save',async()=>{
 const result=await build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/visual-power-map.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'capacity-ui-adapters',setup(b){
  b.onResolve({filter:/^(react|next\/navigation|lucide-react|\.\/physical-rack-grid|\.\/visual-power-actions)$/},a=>({path:a.path,namespace:'ui'}));
  b.onLoad({filter:/.*/,namespace:'ui'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useEffect:()=>{},useMemo:f=>f(),useContext:()=>__m.settingsPending,useTransition:()=>[false,()=>{throw Error("Unexpected mutation")} ]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:()=>{}});':a.path==='./physical-rack-grid'?'export const RackGrid=p=>__m.React.createElement("rack-grid",p);':a.path==='./visual-power-actions'?'export const connectVisualPower=()=>{throw Error("Unexpected save")};export const disconnectVisualPower=connectVisualPower;export const saveVisualPowerPlan=connectVisualPower;':'export const ArrowRight="svg",Check="svg",ClipboardList="svg",PlugZap="svg",Trash2="svg",X="svg";'}));
 }}]});
 const f=powerCapacityFixture(),slots:unknown[]=[];let cursor=0;
 const mocks={React,settingsPending:false,useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
 const loaded={exports:{}};new Function('module','exports','require','__m',result.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
 const api=loaded.exports as {VisualPowerMap:(p:unknown)=>unknown};
 const render=()=>{cursor=0;return api.VisualPowerMap({rackId:f.rack.id,configuration:f.rack.configuration,equipment:f.equipment,devices:f.rack.devices,heightRU:42,config:{profile:'apc-netshelter-42',pockets:false,pduA:true,pduB:true}});};
 let tree=render();(find(tree,p=>typeof p.onPsu==='function').onPsu as (id:string,n:number)=>void)('server-9',1);tree=render();
 (find(tree,p=>typeof p.onOutlet==='function').onOutlet as (id:string,o:unknown)=>void)('pdu-a',{n:9});tree=render();
 let controls=find(tree,p=>p['aria-label']==='Power connection controls');
 assert.match(text(controls.children),/Failover capacity exceeded/);assert.match(text(controls.children),/26.73 A/);
 assert.ok(!text(controls.children).includes('Review required settings'));assert.ok(!text(controls.children).includes('Save planning connection'));
 (find(tree,p=>text(p.children)==='Review failover capacity'&&typeof p.onClick==='function').onClick as ()=>void)();tree=render();
 const panel=find(tree,p=>!!p.review&&typeof p.onReviewDemand==='function');
 const html=renderToStaticMarkup(<PowerCapacityReview review={panel.review as Capacity} onReviewDemand={()=>{}} onClose={()=>{}}/>);
 assert.match(html,/14.85 A/);assert.match(html,/2.73 A over 24.00 A/);assert.match(html,/Before this connection: 23.76/);
 assert.match(html,/Another outlet on this same PDU will not reduce/);assert.match(html,/PF 0.9/);
 mocks.settingsPending=true;tree=render();controls=find(tree,p=>p['aria-label']==='Power connection controls');
 assert.match(text(controls.children),/Review required settings/,'unsaved inputs retain their existing save-first workflow');
});
