import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement,isValidElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {powerOverview} from '../lib/power-overview';
import {PowerOverview} from '../app/projects/[id]/racks/[rackId]/power-overview';
import {overviewFixture} from './fixtures/power-overview';
function fixture(){const f=overviewFixture();f.equipment[2].startRU=3;return f;}
function connect(f:ReturnType<typeof fixture>,bothOnA=false){f.equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''},...(bothOnA?{'2':{deviceId:'qa-device',inlet:2,notes:''}}:{})}};if(!bothOnA)f.equipment[1].details={outlets:{'1':{deviceId:'qa-device',inlet:2,notes:''}}};}
const messages=(o:ReturnType<typeof powerOverview>)=>o.findings.map(g=>g.message).join(' ');
function render(f=fixture()){const html=renderToStaticMarkup(createElement(PowerOverview,{equipment:f.equipment,saved:f.saved,dirty:false}));return {html,text:html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')};}
test('fully unmapped equipment becomes one ID-based task, not repeated missing and survivor warnings',()=>{
 const f=fixture(),o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,1);assert.deepEqual(o.missingAssignments[0],{id:'qa-device',name:'Synthetic model',startRU:3,assigned:0,expected:2});assert.equal(o.backupFailures.length,0);assert.doesNotMatch(messages(o),/not all|surviving cords/);
 const {html,text}=render(f);assert.match(text,/1 device needs power assignments/);assert.match(text,/U3/);assert.equal((html.match(/data-assignment-device=/g)||[]).length,1);assert.match(text,/cannot yet be assessed for backup power/);
});
test('partial mappings retain modeled feed-loss warnings separately from the missing task',()=>{
 const f=fixture();f.equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''}}};const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments[0].assigned,1);assert.equal(o.backupFailures.length,1);assert.equal(o.backupFailures[0].feed,'A');assert.equal(o.priority?.target,'connections');assert.match(messages(o),/Feed A lost.*0 surviving cords/);assert.doesNotMatch(messages(o),/not all 2/);
});
test('complete A/B mappings have no missing task or survivor failure',()=>{
 const f=fixture();connect(f);const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,0);assert.equal(o.backupFailures.length,0);assert.doesNotMatch(render(f).text,/devices? needs? power assignments/);
});
test('complete mappings on one feed retain a visible backup-power action and detailed engine warning',()=>{
 const f=fixture();connect(f,true);const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,0);assert.equal(o.backupFailures.length,1);assert.equal(o.priority?.label,'Review backup-power connections');assert.match(messages(o),/Feed A lost.*0 surviving cords/);assert.match(render(f).text,/modeled feed-loss check/);
});
test('capacity failures remain visible and take priority over incomplete mapping presentation',()=>{
 const f=fixture();connect(f);f.saved.budgets['qa-device'].watts=50000;const o=powerOverview(f.equipment,f.saved);assert.equal(o.priority?.label,'Review power checks');assert.match(messages(o),/capacity exceeded|current exceeded|exceeds/);assert.match(render(f).text,/electrical or wiring conflicts/);
});
test('duplicate assignments cannot inflate task counts or hide conflicts',()=>{
 const f=fixture();f.equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''},'2':{deviceId:'qa-device',inlet:1,notes:''}}};const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,1);assert.equal(o.missingAssignments[0].assigned,1);assert.match(messages(o),/Duplicate outlet or PSU assignment/);assert.equal(o.priority?.label,'Review power checks');
});
test('invalid saved endpoints remain explicit errors alongside incomplete mappings',()=>{
 const f=fixture();f.equipment[0].details={outlets:{'999':{deviceId:'qa-device',inlet:1,notes:''}}};const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments[0].assigned,0);assert.match(messages(o),/invalid device, outlet or PSU/);
});
test('same model/name still counts unique IDs and never absorbs an ambiguous real feed-loss warning',()=>{
 const f=fixture();f.equipment.push({...f.equipment[2],id:'qa-device-2',startRU:5});f.saved.budgets['qa-device-2']={watts:100,pf:1};connect(f,true);const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,1);assert.equal(o.missingAssignments[0].id,'qa-device-2');assert.ok(o.backupFailures.some(v=>v.id==='qa-device'));assert.ok(o.backupFailures.every(v=>v.id!=='qa-device-2'));assert.match(messages(o),/Feed A lost.*0 surviving cords/);
});
test('affected equipment list uses unique IDs even for repeated input rows',()=>{
 const f=fixture();f.equipment.push({...f.equipment[2]});const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,1);assert.equal((render(f).html.match(/data-assignment-device=/g)||[]).length,1);
});
test('missing PSU documentation remains separate from the assignment task',()=>{
 const f=fixture();f.equipment[2].rawData={powerLoad:{cords:2,minimumCords:1,connector:'C13'}};const o=powerOverview(f.equipment,f.saved);assert.ok(o.documentation.length>0);assert.equal(o.missingAssignments.length,1);assert.match(render(f).text,/PSU documentation/);
});
test('connection-editor link executes real focus, disclosure and scroll navigation',()=>{
 const f=fixture();let handler:((event:{preventDefault:()=>void})=>void)|undefined;
 function visit(node:unknown):void{if(Array.isArray(node)){node.forEach(visit);return;}if(!isValidElement(node))return;const p=node.props as {href?:string;onClick?:typeof handler;children?:unknown};if(p.href==='#power-connections')handler=p.onClick;visit(p.children);}
 visit(PowerOverview({equipment:f.equipment,saved:f.saved,dirty:false}));assert.ok(handler);
 const beforeDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),beforeDetails=Object.getOwnPropertyDescriptor(globalThis,'HTMLDetailsElement');let prevented=0,focused=0,scrolled=0,requested='';class Details{open=false;parentElement=null;}const parent=new Details();const target={parentElement:parent,focus:()=>focused++,scrollIntoView:()=>scrolled++};
 try{Object.defineProperty(globalThis,'HTMLDetailsElement',{value:Details,configurable:true});Object.defineProperty(globalThis,'document',{value:{getElementById:(id:string)=>{requested=id;return target;}},configurable:true});handler({preventDefault:()=>prevented++});assert.equal(requested,'power-connections');assert.equal(parent.open,true);assert.equal(prevented,1);assert.equal(focused,1);assert.equal(scrolled,1);}finally{if(beforeDocument)Object.defineProperty(globalThis,'document',beforeDocument);else Reflect.deleteProperty(globalThis,'document');if(beforeDetails)Object.defineProperty(globalThis,'HTMLDetailsElement',beforeDetails);else Reflect.deleteProperty(globalThis,'HTMLDetailsElement');}
});

test('ambiguous identical names with no mappings stay incomplete, not a saved-layout failure',()=>{
 const f=fixture();f.equipment.push({...f.equipment[2],id:'qa-device-2',startRU:5});f.saved.budgets['qa-device-2']={watts:100,pf:1};const o=powerOverview(f.equipment,f.saved);assert.equal(o.missingAssignments.length,2);assert.equal(o.backupFailures.length,0);assert.equal(o.priority,undefined);assert.match(messages(o),/surviving cords/);
});
