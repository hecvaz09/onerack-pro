import {catalogInputError,readSystemSpecs,systemSpecsError,type CatalogInput,type SystemSpecs} from './system-specs.ts';
import {catalogProfile,artworkUrl} from './catalog-artwork.ts';
import {libraryReadiness} from './library-readiness.ts';
import {feedRack} from './feed-rack.ts';
import {supplyDesignIssues} from './feed-power.ts';
import {manufacturerSpecifications} from './manufacturer-specifications.ts';
import {reviewedComponentField} from './component-review.ts';

export const LIBRARY_ONBOARDING_VERSION=1;
export type OnboardingCheck={id:string;label:string;ready:boolean;details:string[];target:string};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

// One reusable, derived checklist for every Library entry. Installation readings
// are deliberately absent: missing measured W/PF must never become fake defaults.
export function libraryOnboarding(input:CatalogInput,previousRaw?:unknown){
 const raw:Record<string,unknown>={...obj(previousRaw),systemSpecs:input.specs},specs=readSystemSpecs(raw);
 const profile=catalogProfile(input.sku,input.model),checks:OnboardingCheck[]=[];
 const add=(id:string,label:string,details:string[],target:string)=>checks.push({id,label,ready:details.length===0,details,target});
 const identity:string[]=[];
 const error=catalogInputError(input);if(error)identity.push(error);
 if(profile?.drawing.kind==='unknown'||obj(raw.catalogReference).basis==='model-pending'||/\b(?:TBD|DRAFT)\b/i.test(input.sku))identity.push('Confirm the exact model and build configuration.');
 add('identity','Identify the device',identity,'system-identity');
 add('sources','Document the source',specs.sourceUrl||input.category==='accessory'?[]:['Add the manufacturer datasheet or manual URL.'],'system-identity');
 const power:string[]=[],deferred:string[]=[];
 const model=feedRack([{id:'library',sku:input.sku,model:input.model,name:input.model,category:input.category,rawData:raw,details:{feed:'A'}}],{headroomPercent:0,budgets:{}});
 if(input.category==='pdu'){
  if(!model.supplies.length)power.push('Add the PDU electrical profile.');
  else power.push(...supplyDesignIssues(model.supplies[0]));
  if(power.length)power.push('For an existing PDU model, use Duplicate in the Library to retain its outlet, bank and phase profile.');
 }else if(input.category==='node')power.push('Identify the parent chassis that supplies this node; do not add independent PSUs to a shared-power node.');
 else if(input.category!=='accessory'){
  const load=model.loads[0],psus=specs.components.filter(c=>c.kind==='psu');
  if(!load?.cords)power.push('Record the PSU inventory and physical AC input count.');
  if(!load?.minVoltage||!load?.maxVoltage)power.push('Record a sourced input-voltage range or the applicable AC PSU option.');
  if(psus.length&&!psus.every(c=>c.attributes.redundancy))power.push('Record the supported redundancy arrangement.');
  if(!load?.connector)deferred.push('Confirm the equipment inlet and installed cable before installation.');
  if(!load?.psuAcCapacity)deferred.push('Per-PSU AC capacity is not established by its DC output rating.');
  if(psus.some(c=>/unconfirmed|pending|unspecified/i.test(c.model)))deferred.push('Confirm the installed PSU part number and its applicable ratings.');
 }
 add('power','Define power inputs',power,input.category==='pdu'?'additional-specifications':'component-psu');
 const network=libraryReadiness(input.sku,input.category,raw).issues.filter(i=>/confirm .*port count|confirm .*connector|confirm .*protocol|confirm .*speed capability/.test(i));
 if(input.category!=='accessory'&&!specs.components.some(c=>c.kind==='network'))network.push('Record onboard and installed network interfaces, or identify the intended configuration.');
 for(const c of specs.components.filter(c=>c.kind==='network'&&Number(c.attributes.ports)>0)){
  if(!['ports','protocol','connector'].every(f=>reviewedComponentField(specs,c,f))||!['speedGbps','supportedSpeedsGbps'].some(f=>reviewedComponentField(specs,c,f)))network.push(`${c.model}: review its port count, protocol, connector and speed capability against a source.`);
 }
 add('network','Define network ports',[...new Set(network)],'component-network');
 add('artwork','Provide front and rear references',!profile||profile.drawing.kind==='unknown'?['An exact-model front/rear reference is still needed.']:profile.heightRU!==input.heightRU?['The artwork and equipment rack height differ.']:[],'catalog-visuals');
 return {version:LIBRARY_ONBOARDING_VERSION,checks,ready:checks.every(c=>c.ready),completed:checks.filter(c=>c.ready).length,deferred:[...new Set(deferred)],measurementPolicy:'Record whole-device AC watts and power factor for the installed device when measured. Leave both blank until then.'};
}

// A reference template is always a draft. It does not assert that optional parts
// pictured in a chassis are installed, or that its site power has been verified.
export function libraryModelTemplate(input:CatalogInput):CatalogInput|null{
 const p=catalogProfile(input.sku,input.model);
 if(!p||p.drawing.kind==='unknown'||!p.components.length||input.specs.components.length||p.category!==input.category||p.heightRU!==input.heightRU||input.category==='pdu')return null;
 // PDU electrical profiles are part of the whole Library record. Use Duplicate
 // for a known PDU, rather than copying only its descriptive components.
 const specs=JSON.parse(JSON.stringify({...input.specs,status:'draft',sourceUrl:input.specs.sourceUrl||p.source,description:input.specs.description||p.label,components:p.components})) as SystemSpecs;
 for(const c of specs.components)if(c.kind==='network'&&c.attributes.speedGbps){
  c.attributes.supportedSpeedsGbps||=c.attributes.speedGbps;delete c.attributes.speedGbps;delete c.fieldReviews?.speedGbps;
 }
 if(systemSpecsError(specs))return null;
 return {...input,specs:manufacturerSpecifications(input.sku,specs).specs};
}

export function onboardingMetadata(input:CatalogInput,raw:unknown){
 const result=libraryOnboarding(input,raw),profile=catalogProfile(input.sku,input.model);
 return {version:result.version,modelReady:result.ready,pending:result.checks.filter(c=>!c.ready).map(c=>c.id),...(profile?{frontReference:artworkUrl(profile,'front',input.sku),rearReference:artworkUrl(profile,'rear',input.sku)}:{}),measurementPolicy:'measured-only'};
}
