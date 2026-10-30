import {readFileSync} from 'node:fs';
import {ACCENTS} from '../app/theme';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement,isValidElement,type Dispatch,type SetStateAction} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EquipmentPowerInputs} from '../app/projects/[id]/racks/[rackId]/equipment-power-inputs';
import {PowerEstimatePicker} from '../app/projects/[id]/racks/[rackId]/power-estimate-picker';
import {EquipmentRecordSummary} from '../app/equipment/equipment-record-summary';
import {applyEquipmentDemand,matchingDemandDevices,equipmentDemandSource,type BulkApplyFeedback} from '../lib/equipment-power-editing';
import {feedRack,type FeedEquipment} from '../lib/feed-rack';
import {feedInputsError,type FeedInputs} from '../lib/feed-power';

type NodeProps={children?:unknown;[key:string]:unknown};
function nodes(node:unknown):NodeProps[]{
 if(Array.isArray(node))return node.flatMap(nodes);
 if(!isValidElement(node))return [];
 const p=node.props as NodeProps;return [p,...nodes(p.children)];
}
function find(node:unknown,predicate:(p:NodeProps)=>boolean){const p=nodes(node).find(predicate);assert.ok(p);return p;}
function call(p:NodeProps,name:string,event:unknown){assert.equal(typeof p[name],'function');(p[name] as (event:unknown)=>void)(event);}
function fixture(){
 const rawData={powerLoad:{cords:2,minimumCords:1,connector:'C13',psuAcCapacity:2000}};
 const equipment:FeedEquipment[]=['source','missing','manual','measured','different'].map((id,i)=>({id,name:'Same label · U'+(i+1),model:'Synthetic model',category:'chassis',startRU:i+1,rawData:id==='different'?{...rawData,powerLoad:{...rawData.powerLoad,cords:4}}:rawData,details:{}}));
 const initial:FeedInputs={headroomPercent:20,budgets:{source:{watts:600,pf:.95,measurement:{watts:600,source:'User-confirmed live measurement'}},manual:{watts:300,pf:.8,cords:4,connector:'C19'},measured:{watts:400,pf:.9,measurement:{watts:400,source:'Synthetic meter reading'}}}};
 let inputs=structuredClone(initial),message='';let feedback:BulkApplyFeedback|null=null;
 const setInputs:Dispatch<SetStateAction<FeedInputs>>=next=>{feedback=null;inputs=typeof next==='function'?next(inputs):next;};
 const render=()=>EquipmentPowerInputs({equipment,loads:feedRack(equipment,inputs).loads,inputs,initial,setInputs,setMessage:value=>{message=value;},bulkFeedback:feedback,setBulkFeedback:value=>{feedback=value;}});
 const article=(id:string)=>find(render(),p=>p['data-equipment-power']===id).children;
 const field=(id:string,name:string)=>find(article(id),p=>p['data-power-field']===name);
 const change=(id:string,name:string,value:string)=>call(field(id,name),'onChange',{target:{value}});
 const form=(id='source')=>find(article(id),p=>typeof p.onSubmit==='function');
 const submit=(ids:string[],id='source')=>{
  const details={open:true},state={resets:0,prevented:0};
  const checkboxes=ids.map(value=>({value,checked:true}));const element={querySelectorAll:(selector:string)=>selector.endsWith(':checked')?checkboxes.filter(input=>input.checked):checkboxes,reset:()=>state.resets++,closest:()=>details};
  call(form(id),'onSubmit',{preventDefault:()=>state.prevented++,currentTarget:element});return {details,state,checkboxes};
 };
 return {equipment,initial,render,article,field,change,form,submit,get inputs(){return inputs;},get message(){return message;},get feedback(){return feedback;}};
}
test('each installed ID has its own row and RU even when names are identical',()=>{
 const f=fixture(),html=renderToStaticMarkup(createElement(EquipmentPowerInputs,{equipment:f.equipment,loads:feedRack(f.equipment,f.inputs).loads,inputs:f.inputs,initial:f.initial,setInputs:()=>{},setMessage:()=>{}}));
 assert.equal((html.match(/data-equipment-power=/g)||[]).length,5);assert.match(html,/U1/);assert.match(html,/U2/);assert.match(html,/this installed device only/);assert.match(html,/Whole-system AC demand/);assert.doesNotMatch(html,/Live Verified Data|User-confirmed live measurement/);
});
test('editing one same-name device leaves every other budget and saved initial value unchanged',()=>{
 const f=fixture(),before=structuredClone(f.inputs);f.change('source','watts','650');assert.equal(f.inputs.budgets.source.watts,650);assert.equal(f.inputs.budgets.source.measurement,undefined);assert.deepEqual(f.inputs.budgets.manual,before.budgets.manual);assert.deepEqual(f.inputs.budgets.measured,before.budgets.measured);assert.equal(f.initial.budgets.source.watts,600);assert.equal(f.inputs.headroomPercent,20);
});
test('editing demand clears both estimate and measurement source; editing PF preserves a matching reading',()=>{
 const f=fixture();f.change('source','pf','.8');assert.equal(f.inputs.budgets.source.measurement?.watts,600);f.change('source','watts','700');assert.equal(f.inputs.budgets.source.measurement,undefined);assert.equal(f.inputs.budgets.source.estimateSource,undefined);assert.equal(equipmentDemandSource(f.inputs.budgets.source).label,'Manually entered');
 const estimate=find(f.article('source'),p=>typeof p.onApply==='function');(estimate.onApply as (v:object)=>void)({watts:800,pf:.9,estimateSource:'Synthetic estimate'});f.change('source','watts','750');assert.equal(f.inputs.budgets.source.estimateSource,undefined);
});
test('selecting recorded measurement affects only that device and stores an honest user source',()=>{
 const f=fixture();f.change('manual','source','measured');assert.deepEqual(f.inputs.budgets.manual.measurement,{watts:300,source:'User-recorded measurement'});assert.equal(f.inputs.budgets.source.measurement?.source,'User-confirmed live measurement');f.change('manual','source','entered');assert.equal(f.inputs.budgets.manual.measurement,undefined);
});
test('missing or invalid demand cannot be marked measured and remains explicit',()=>{
 const f=fixture();f.change('missing','source','measured');assert.equal(Object.hasOwn(f.inputs.budgets,'missing'),false);f.change('missing','watts','');assert.equal(f.inputs.budgets.missing.watts,0);f.change('missing','source','measured');assert.equal(f.inputs.budgets.missing.measurement,undefined);assert.equal(f.field('missing','watts').value,'');
 const html=renderToStaticMarkup(f.render());assert.match(html,/Blank or 0 W remains incomplete/);assert.match(html,/Power factor required/);assert.match(html,/Unsaved edits for this device/);assert.equal(feedInputsError({...f.inputs,budgets:{missing:{watts:0,pf:.95}}}),null);
});
test('per-device PF and PSU overrides do not change another device, cables or source',()=>{
 const f=fixture(),before=structuredClone(f.inputs);f.change('manual','pf','.85');f.change('manual','cords','6');assert.equal(f.inputs.budgets.manual.pf,.85);assert.equal(f.inputs.budgets.manual.cords,6);assert.deepEqual(f.inputs.budgets.measured,before.budgets.measured);assert.deepEqual(f.equipment[0].details,{});f.change('manual','cords','');assert.equal(f.inputs.budgets.manual.cords,undefined);
});
test('bulk choices exclude source and different Library configuration and protect existing values by default',()=>{
 const f=fixture();assert.deepEqual(matchingDemandDevices(f.equipment,f.equipment[0]).map(d=>d.id),['missing','manual','measured']);const targets=nodes(f.form().children).filter(p=>p.name==='target');assert.deepEqual(targets.map(p=>[p.value,p.defaultChecked]),[['missing',true],['manual',false],['measured',false]]);
});
test('actual bulk submit updates only selected IDs, preserves target limits and never copies measurement evidence',()=>{
 const f=fixture(),before=structuredClone(f.inputs),result=f.submit(['missing','manual','manual']);assert.equal(result.state.prevented,1);assert.equal(result.details.open,true);assert.equal(result.state.resets,0);assert.ok(result.checkboxes.every(input=>!input.checked));assert.equal(f.inputs.budgets.missing.watts,600);assert.equal(f.inputs.budgets.missing.pf,0);assert.equal(f.inputs.budgets.manual.watts,600);assert.equal(f.inputs.budgets.manual.pf,.8);assert.equal(f.inputs.budgets.manual.cords,4);assert.equal(f.inputs.budgets.manual.connector,'C19');assert.equal(f.inputs.budgets.manual.measurement,undefined);assert.match(f.inputs.budgets.manual.estimateSource||'',/Not a measurement of this device/);assert.deepEqual(f.inputs.budgets.measured,before.budgets.measured);assert.deepEqual(f.inputs.budgets.source,before.budgets.source);assert.equal(f.feedback?.changes.length,2);
});
test('explicitly selected measured destination becomes a planning estimate; unselected measurements stay intact',()=>{
 const f=fixture();f.submit(['measured']);assert.equal(f.inputs.budgets.measured.measurement,undefined);assert.equal(equipmentDemandSource(f.inputs.budgets.measured).label,'Planning estimate');assert.equal(f.inputs.budgets.source.measurement?.watts,600);
});
test('empty and stale/mismatched bulk selections fail closed with no mutation',()=>{
 const f=fixture(),before=structuredClone(f.inputs);f.submit([]);assert.match(f.feedback?.error||'',/Select at least one/);assert.deepEqual(f.inputs,before);f.submit(['different']);assert.match(f.feedback?.error||'',/no longer matches/);assert.deepEqual(f.inputs,before);f.submit(['unknown']);assert.deepEqual(f.inputs,before);
});
test('cancel closes and resets only the bulk form and makes no input changes',()=>{
 const f=fixture(),before=structuredClone(f.inputs);let resets=0;const details={open:true};const form={reset:()=>resets++,closest:()=>details};const button=find(f.form().children,p=>p['data-bulk-action']==='cancel');call(button,'onClick',{currentTarget:{form}});assert.equal(resets,1);assert.equal(details.open,false);assert.deepEqual(f.inputs,before);
});
test('reopening resets selection to current defaults and repeated submissions are idempotent',()=>{
 const f=fixture();f.submit(['missing']);const after=structuredClone(f.inputs);f.submit(['missing']);assert.deepEqual(f.inputs,after);const details=find(f.article('source'),p=>p['data-bulk-for']==='source');let resets=0;call(details,'onToggle',{currentTarget:{open:true,querySelector:()=>({reset:()=>resets++})}});assert.equal(resets,1);const target=find(f.form().children,p=>p.name==='target'&&p.value==='missing');assert.equal(target.defaultChecked,false);
});
test('invalid source cannot apply and helper never mutates original inputs',()=>{
 const f=fixture(),before=structuredClone(f.inputs);const result=applyEquipmentDemand(f.inputs,f.equipment,'source',['missing']);assert.notEqual(result.inputs,f.inputs);assert.deepEqual(f.inputs,before);assert.equal(applyEquipmentDemand(f.inputs,f.equipment,'missing',['source']).count,0);assert.equal(applyEquipmentDemand(f.inputs,f.equipment,'unknown',['source']).count,0);
});
test('using an estimate acts only on this device and preserves existing estimation payload',()=>{
 const f=fixture(),before=structuredClone(f.inputs);const picker=find(f.article('source'),p=>typeof p.onApply==='function');assert.equal(picker.count,1);(picker.onApply as (v:object)=>void)({watts:850,pf:.9,estimateSource:'Synthetic assumptions'});assert.deepEqual(f.inputs.budgets.source,{watts:850,pf:.9,measurement:undefined,estimateSource:'Synthetic assumptions'});assert.deepEqual(f.inputs.budgets.measured,before.budgets.measured);
});
test('Library reference maximum is explicitly not selected demand and measured copy has no telemetry claim',()=>{
 const html=renderToStaticMarkup(createElement(EquipmentRecordSummary,{model:'N9K-C92348GC-X',raw:{},powerInputContext:true}));assert.match(html,/Model maximum AC demand \(reference only\)/);assert.match(html,/not selected installation demand/);
 const measured=renderToStaticMarkup(createElement(EquipmentRecordSummary,{model:'Synthetic model',raw:{},installation:{watts:100,pf:1,measurement:{watts:100,source:'User-confirmed live measurement'}},powerInputContext:true}));assert.match(measured,/Selected installation demand/);assert.doesNotMatch(measured,/Live Verified Data|User-confirmed live measurement/);assert.match(measured,/not live monitoring/);
});
test('estimate picker explains Library inheritance and applies to one device without formula changes',()=>{
 const html=renderToStaticMarkup(createElement(PowerEstimatePicker,{model:'N9K-C92348GC-X',raw:{},requiredPsus:1,count:1,onApply:()=>{}}));assert.match(html,/current Library component specifications/);assert.match(html,/not a confirmed installed inventory/);assert.match(html,/for this device/);
});
test('save-navigation handler focuses and scrolls to existing save control without saving',()=>{
 const f=fixture(),link=find(f.render(),p=>p.href==='#power-save-inputs');const before=Object.getOwnPropertyDescriptor(globalThis,'document');let focused=0,scrolled=0,prevented=0,requested='';
 try{Object.defineProperty(globalThis,'document',{value:{getElementById:(id:string)=>{requested=id;return {focus:()=>focused++,scrollIntoView:()=>scrolled++};}},configurable:true});call(link,'onClick',{preventDefault:()=>prevented++});assert.equal(requested,'power-save-inputs');assert.equal(focused,1);assert.equal(scrolled,1);assert.equal(prevented,1);assert.deepEqual(f.inputs,f.initial);}finally{if(before)Object.defineProperty(globalThis,'document',before);else Reflect.deleteProperty(globalThis,'document');}
});
test('save navigation safely handles an absent target',()=>{
 const f=fixture(),link=find(f.render(),p=>p.href==='#power-save-inputs'),before=Object.getOwnPropertyDescriptor(globalThis,'document');try{Object.defineProperty(globalThis,'document',{value:{getElementById:()=>null},configurable:true});assert.doesNotThrow(()=>call(link,'onClick',{preventDefault:()=>{}}));}finally{if(before)Object.defineProperty(globalThis,'document',before);else Reflect.deleteProperty(globalThis,'document');}
});

test('large-rack selection controls are explicit and do not apply changes until submit',()=>{
 const f=fixture(),before=structuredClone(f.inputs),checkboxes=[{checked:true},{checked:false},{checked:false}];let resets=0;const form={querySelectorAll:()=>checkboxes,reset:()=>{resets++;checkboxes.forEach((c,i)=>{c.checked=i===0;});}};
 for(const [action,expected] of [['all',[true,true,true]],['clear',[false,false,false]],['missing',[true,false,false]]] as const){const button=find(f.form().children,p=>p['data-bulk-action']===action);call(button,'onClick',{currentTarget:{form}});assert.deepEqual(checkboxes.map(c=>c.checked),expected);assert.deepEqual(f.inputs,before);}
 assert.equal(resets,1);
});

test('175 W source updates a 150 W target and shows local named/RU feedback while staying open',()=>{
 const f=fixture();f.change('source','watts','175');f.change('manual','watts','150');const unselected=structuredClone(f.inputs.budgets.measured),result=f.submit(['manual']);
 assert.equal(f.inputs.budgets.manual.watts,175);assert.equal(result.details.open,true);assert.equal(result.checkboxes[0].checked,false);assert.deepEqual(f.inputs.budgets.measured,unselected);
 assert.deepEqual(f.feedback?.changes.map(c=>[c.id,c.before,c.after,c.kind]),[['manual',150,175,'demand']]);
 const html=renderToStaticMarkup(f.render());assert.match(html,/role="status"/);assert.match(html,/aria-live="polite"/);assert.match(html,/Demand updated in the unsaved draft/);assert.match(html,/U3/);assert.match(html,/150 W.*175 W/);assert.match(html,/Selection cleared after Apply/);assert.match(html,/Unsaved\. Review and save/);assert.equal(f.message,'');
});
test('150 W onto 150 W reports a source-only change rather than a wattage change',()=>{
 const f=fixture();f.change('source','watts','150');f.change('manual','watts','150');f.submit(['manual']);assert.equal(f.feedback?.changes[0].kind,'source');assert.equal(f.inputs.budgets.manual.watts,150);assert.equal(f.inputs.budgets.manual.measurement,undefined);
 const html=renderToStaticMarkup(f.render());assert.match(html,/Wattage unchanged; planning source updated/);assert.match(html,/Already 150 W; planning source updated/);assert.doesNotMatch(html,/Demand updated in the unsaved draft/);
});
test('reselecting the same target reports a genuine no-op and retains exact draft input reference',()=>{
 const f=fixture();f.submit(['manual']);const before=f.inputs;f.submit(['manual']);assert.equal(f.inputs,before);assert.equal(f.feedback?.changes[0].kind,'unchanged');const html=renderToStaticMarkup(f.render());assert.match(html,/No changes needed/);assert.match(html,/same planning source; unchanged/);assert.match(html,/Any earlier unsaved edits still need saving/);
});
test('Apply with no selection replaces old success with a local error and makes no changes',()=>{
 const f=fixture();f.submit(['manual']);const before=f.inputs;f.submit([]);assert.equal(f.inputs,before);assert.match(f.feedback?.error||'',/Select at least one/);const html=renderToStaticMarkup(f.render());assert.match(html,/role="alert"/);assert.doesNotMatch(html,/Demand updated in the unsaved draft/);
});
test('further edits on any device invalidate success and do not resurrect it when values are restored',()=>{
 const f=fixture();f.submit(['manual']);assert.ok(f.feedback);f.change('measured','pf','.85');assert.equal(f.feedback,null);f.change('measured','pf','.9');assert.equal(f.feedback,null);assert.doesNotMatch(renderToStaticMarkup(f.render()),/Selection cleared after Apply/);
});
test('cancel and reopen clear prior feedback without reverting applied draft values',()=>{
 const f=fixture();f.submit(['manual']);const before=structuredClone(f.inputs);let resets=0;const details={open:true};const form={reset:()=>resets++,closest:()=>details};const cancel=find(f.form().children,p=>p['data-bulk-action']==='cancel');call(cancel,'onClick',{currentTarget:{form}});assert.equal(f.feedback,null);assert.equal(details.open,false);assert.deepEqual(f.inputs,before);
 f.submit(['manual']);assert.ok(f.feedback);const disclosure=find(f.article('source'),p=>p['data-bulk-for']==='source');call(disclosure,'onToggle',{currentTarget:{open:true,querySelector:()=>({reset:()=>resets++})}});assert.equal(f.feedback,null);assert.deepEqual(f.inputs,before);assert.equal(resets,2);
});
test('checkbox and bulk selection controls clear success before a new selection is applied',()=>{
 const f=fixture();const checkboxes=[{checked:false}];const form={querySelectorAll:()=>checkboxes,reset:()=>{}};
 for(const action of ['all','missing','clear']){f.submit(['manual']);assert.ok(f.feedback);const button=find(f.form().children,p=>p['data-bulk-action']===action);call(button,'onClick',{currentTarget:{form}});assert.equal(f.feedback,null);}
 f.submit(['manual']);call(f.form(),'onChange',{});assert.equal(f.feedback,null);
});

test('Apply uses shared primary theme styles while retaining native submit/disabled behavior and secondary Cancel',()=>{
 const f=fixture(),apply=find(f.form().children,p=>p.type==='submit'),cancel=find(f.form().children,p=>p['data-bulk-action']==='cancel');assert.equal(apply.disabled,false);assert.equal(typeof f.form().onSubmit,'function');
 for(const token of ['bg-primary','text-primary-foreground','hover:bg-primary/80','focus-visible:ring-ring/50','disabled:opacity-50'])assert.ok(String(apply.className).includes(token));
 assert.doesNotMatch(String(apply.className),/#[a-f0-9]{3,8}\b/i);assert.doesNotMatch(String(cancel.className),/bg-primary/);f.change('source','watts','');assert.equal(find(f.form().children,p=>p.type==='submit').disabled,true);
});
test('every existing selectable accent supplies primary, foreground and focus tokens used by Apply',()=>{
 const css=readFileSync('app/globals.css','utf8');for(const accent of ACCENTS){const selector=`html[data-accent="${accent}"]`;const start=css.indexOf(selector);assert.ok(start>=0,accent);const block=css.slice(start,css.indexOf('}',start)+1);for(const token of ['--primary:','--primary-foreground:','--ring:'])assert.ok(block.includes(token),accent+' '+token);}
});
