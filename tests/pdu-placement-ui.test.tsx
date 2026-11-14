import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as React from 'react';
import {readRackConfig} from '../lib/rack-config';
import type {PduPositionItem} from '../lib/pdu-placement';
type Props={children?:unknown;[key:string]:unknown};
function nodes(n:unknown):Props[]{if(Array.isArray(n))return n.flatMap(nodes);if(!React.isValidElement(n))return [];const p=n.props as Props;return [p,...nodes(p.children)];}
function text(n:unknown):string{if(Array.isArray(n))return n.map(text).join('');if(React.isValidElement(n))return text((n.props as Props).children);return typeof n==='string'||typeof n==='number'?String(n):'';}
function find(n:unknown,predicate:(p:Props)=>boolean){const p=nodes(n).find(predicate);assert.ok(p);return p;}
function click(n:unknown,label:string){(find(n,p=>typeof p.onClick==='function'&&text(p.children)===label).onClick as ()=>void)();}
async function harness(pairs:1|2=2,count=pairs*2,outer=false){
 const result=await build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/pdu-placement-controls.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'pdu-position-adapters',setup(b){
 b.onResolve({filter:/^(react|next\/navigation|\.\/actions|\.\/pdu-placement.module.css)$/},a=>({path:a.path,namespace:'ui'}));
 b.onLoad({filter:/.*/,namespace:'ui'},a=>({loader:'js',contents:a.path==='react'?'module.exports={...__m.React,useState:__m.useState,useRef:__m.useRef,useTransition:()=>[false,f=>__m.queue.push(f())]};':a.path==='next/navigation'?'export const useRouter=()=>({refresh:()=>__m.refresh()});':a.path==='./actions'?'export const savePduPlacement=(...args)=>__m.save(...args);':'export default {};'}));
 }}]});
 const slots:unknown[]=[],queue:Promise<unknown>[]=[],calls:unknown[][]=[];let cursor=0,refreshes=0,finish!:(r:unknown)=>void;
 const mocks={React,queue,refresh:()=>refreshes++,save:(...args:unknown[])=>{calls.push(args);return new Promise(resolve=>{finish=resolve;});},useState:(initial:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [slots[i],(next:unknown)=>{slots[i]=typeof next==='function'?(next as (v:unknown)=>unknown)(slots[i]):next;}];},useRef:(initial:unknown)=>{const i=cursor++;return slots[i]??=({current:initial});}};
 const loaded={exports:{}};new Function('module','exports','require','__m',result.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
 const api=loaded.exports as {PduPlacementControls:(p:unknown)=>unknown};
 const items:PduPositionItem[]=([{id:'a1',feed:'A',number:1,name:'APC example',mounting:'rear-right'},{id:'b1',feed:'B',number:1,name:'Raritan example',mounting:'rear-left'},...(pairs===2?[{id:'a2',feed:'A',number:2,name:'APC example',mounting:'rear-right-2'},{id:'b2',feed:'B',number:2,name:'Raritan example',mounting:'rear-left-2'}]:[])] as PduPositionItem[]).slice(0,count).map(p=>({...p,mounting:p.mounting+(outer?'-2':'')}));
 const render=()=>{cursor=0;return api.PduPlacementControls({rackId:'rack',items,config:readRackConfig({pduPairs:pairs}),revision:'current-revision'});};
 return {render,calls,queue,finish:(v:unknown)=>finish(v),refreshes:()=>refreshes};
}
test('side swaps are previewed, reset without writes, and save exactly once with the reviewed revision',async()=>{
 const h=await harness();let tree=h.render();assert.equal(find(tree,p=>text(p.children)==='Save positions').disabled,true);
 click(tree,'Swap left/right');tree=h.render();assert.equal(h.calls.length,0);
 assert.equal(find(tree,p=>p['aria-label']==='Position for PDU-A1').value,'rear-left');
 assert.equal(find(tree,p=>p['aria-label']==='Position for PDU-B2').value,'rear-right-2');
 click(tree,'Reset');tree=h.render();assert.equal(find(tree,p=>p['aria-label']==='Position for PDU-A1').value,'rear-right');assert.equal(h.calls.length,0);
 click(tree,'Swap left/right');tree=h.render();click(tree,'Save positions');click(tree,'Save positions');assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'rack');assert.equal(h.calls[0][2],'current-revision');
 h.finish({ok:true});await Promise.all(h.queue);assert.equal(h.refreshes(),1);
});
test('individual destination swaps both occupied slots and a failed save preserves the draft for retry',async()=>{
 const h=await harness();let tree=h.render();
 (find(tree,p=>p['aria-label']==='Position for PDU-A1').onChange as (e:unknown)=>void)({target:{value:'rear-left-2'}});tree=h.render();
 assert.equal(find(tree,p=>p['aria-label']==='Position for PDU-A1').value,'rear-left-2');assert.equal(find(tree,p=>p['aria-label']==='Position for PDU-B2').value,'rear-right');
 click(tree,'Save positions');h.finish({ok:false,error:'PDU positions or feeds changed.'});await Promise.all(h.queue);tree=h.render();
 assert.match(text(find(tree,p=>p.role==='alert').children),/changed/);assert.equal(h.refreshes(),0);
 assert.equal(find(tree,p=>p['aria-label']==='Position for PDU-A1').value,'rear-left-2');
});
test('two installed PDUs get a simple swap even when the rack has four enabled rails',async()=>{
 for(const [pairs,outer] of [[1,false],[2,false],[2,true]] as const){
  const h=await harness(pairs,2,outer);let tree=h.render();click(tree,'Swap left/right');tree=h.render();
  assert.match(text(tree),/2 installed · Swap sides/);assert.equal(nodes(tree).filter(p=>typeof p.onChange==='function').length,0);
  assert.equal(find(tree,p=>p['data-feed']==='A')['data-position'],outer?'rear-left-2':'rear-left');
  assert.equal(nodes(tree).filter(p=>p['data-position']).length,2);
  assert.doesNotMatch(text(tree),/PDU-A1|PDU-A2|PDU-B1|PDU-B2|inner|outer|occupied position/);assert.equal(h.calls.length,0);
  click(tree,'Save positions');assert.deepEqual(h.calls[0][1],[{id:'a1',mounting:outer?'rear-left-2':'rear-left'},{id:'b1',mounting:outer?'rear-right-2':'rear-right'}]);
  h.finish({ok:true});await Promise.all(h.queue);assert.equal(h.refreshes(),1);
 }
});
test('four installed PDUs retain four position selectors; incomplete installations show no arrangement panel',async()=>{
 const four=await harness(2),tree=four.render();assert.match(text(tree),/4 installed · Individual positions/);
 assert.equal(nodes(tree).filter(p=>typeof p.onChange==='function').length,4);
 for(const count of [0,1,3]){const h=await harness(2,count);assert.equal(h.render(),null);assert.equal(h.calls.length,0);}
});
