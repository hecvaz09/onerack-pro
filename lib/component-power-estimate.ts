import {readSystemSpecs} from './system-specs.ts';
import {nameplateBudget} from './nameplate-budget.ts';
import {modelPowerReference} from './model-power-reference.ts';
export type PowerEstimateMode='heavy'|'typical'|'nameplate';
export type PowerEstimate={watts:number;lowWatts:number;pf:number;estimateSource:string;breakdown:string[];warnings:string[]};
// Manufacturer references are component ratings, not measured system consumption.
const ratings=[
 {kind:'cpu',match:/\bEPYC 9554\b/i,watts:360,url:'https://www.amd.com/en/products/processors/server/epyc/4th-generation-9004-and-8004-series/amd-epyc-9554.html'},
 {kind:'cpu',match:/\b6526Y\b/i,watts:195,url:'https://www.intel.com/content/www/us/en/products/sku/237560/intel-xeon-gold-6526y-processor-37-5m-cache-2-80-ghz/specifications.html'},
 {kind:'gpu',match:/\bRTX 6000 Ada\b/i,watts:300,url:'https://www.nvidia.com/en-us/products/workstations/rtx-6000/'},
];
export function componentPowerEstimate(raw:unknown,requiredPsus:number,mode:PowerEstimateMode='heavy',model=''):PowerEstimate|null{
 const efficiency=.9,pf=.9;
 const reference=modelPowerReference(model);
 const specs=readSystemSpecs(raw);
 // Explicit catalog PSU ratings take priority. Shared references fill missing ratings only.
 const referenceCapacity=()=>{
  const direct=nameplateBudget(raw,requiredPsus,efficiency,pf);
  if(direct)return direct;
  if(!reference?.psuWatts)return null;
  const existing=specs.components.filter(c=>c.kind==='psu');
  const components=existing.length?specs.components.map(c=>c.kind==='psu'?{...c,attributes:{...c.attributes,outputWatts:c.attributes.outputWatts||String(reference.psuWatts)}}:c):[...specs.components,{id:'model-psu-reference',kind:'psu' as const,manufacturer:'',model:reference.model,quantity:reference.psuCount,attributes:{outputWatts:String(reference.psuWatts)},notes:''}];
  const value=nameplateBudget({systemSpecs:{...specs,components}},requiredPsus,efficiency,pf);
  return value?{...value,estimateSource:value.estimateSource+` ${reference.model}: ${reference.psuWatts} W DC per PSU (${reference.model==='MQM8700-HS2F'?'user-supplied rating; exact PSU part unverified':'manufacturer PSU rating'}).`}:null;
 };
 if(mode==='nameplate'){
  const value=referenceCapacity();
  return value?{...value,lowWatts:value.watts,breakdown:[value.estimateSource],warnings:['Capacity envelope, not expected consumption. Redundancy count must be checked.']}:null;
 }
 const components=readSystemSpecs(raw).components;
 if(!components.some(c=>c.kind==='cpu')&&reference?.maximumAcWatts){
  const watts=reference.maximumAcWatts;
  return {watts,lowWatts:watts,pf,estimateSource:`Manufacturer maximum whole-device AC consumption: ${watts} W. ${reference.model}; ${reference.source}; ${reference.section}; reviewed ${reference.reviewedAt}. PF 0.90 assumed. No extra headroom.`,breakdown:[`Whole switch: ${watts} W total, not per PSU.`,reference.psuWatts?`Redundant PSU capacity: ${reference.psuCount} × ${reference.psuWatts} W; not added to consumption.`:'Multiple PSU options; installed PSU capacity is not inferred.'],warnings:['Manufacturer maximum, not a measured load or a typical-workload estimate. Power factor is assumed; verify before electrical approval.']};
 }
 if(!components.some(c=>c.kind==='cpu')){
  const value=referenceCapacity();
  return value?{...value,lowWatts:value.watts,breakdown:[value.estimateSource],warnings:['Automatic PSU-capacity fallback: actual switch consumption is unavailable. This is a capacity envelope, not a heavy/typical workload prediction. Confirm PSU rating, efficiency, power factor and surviving PSU count before electrical approval.']}:null;
 }
 let rated=0,allowance=0;const breakdown:string[]=[],warnings:string[]=[];
 for(const c of components){
  if(c.kind==='psu')continue;
  if(c.kind==='cpu'||c.kind==='gpu'){
   const entered=Number(c.attributes.tdpWatts),known=ratings.find(r=>r.kind===c.kind&&r.match.test(c.model));
   const watts=entered>0&&Number.isFinite(entered)?entered:known?.watts;
   if(!watts)return null; // Never invent a rating for an unknown processor or accelerator.
   rated+=watts*c.quantity;
   breakdown.push(`${c.quantity} × ${c.model}: ${watts} W each (${entered>0?'catalog rating':known!.url})`);
  }else{
   let watts=0;
   if(c.kind==='memory')watts=12;
   if(c.kind==='drive')watts=/HDD/i.test(c.attributes.type)?15:/NVMe/i.test(c.attributes.type)?25:8;
   if(c.kind==='network')watts=/MGMT|onboard/i.test(c.attributes.slot)?0:Number(c.attributes.speedGbps)>=100?35:15;
   if(c.kind==='other'){warnings.push(`Unmodeled item: ${c.model}. Check whether additional power is needed.`);continue;}
   allowance+=watts*c.quantity;
   if(watts)breakdown.push(`${c.quantity} × ${c.model}: ${watts} W each (planning allowance)`);
  }
 }
 const gpu=components.some(c=>c.kind==='gpu');
 const overhead=gpu?450:200;allowance+=overhead;
 breakdown.push(`Motherboard and fans: ${overhead} W total (chassis allowance; check multi-node systems).`);
 const factors=mode==='heavy'?[.85,1]:[.4,.7];
 const round=(n:number)=>Math.ceil(n/50)*50;
 const lowWatts=round((rated*factors[0]+allowance)/efficiency),watts=round((rated*factors[1]+allowance)/efficiency);
 warnings.push('Illustrative workload range, not a statistical confidence interval or guaranteed maximum. CPU TDP can differ from actual draw; startup and transient peaks are not modeled.');
 const capacity=nameplateBudget(raw,requiredPsus,efficiency,pf);
 if(capacity&&watts>capacity.watts)warnings.push('Estimate exceeds the selected redundant PSU capacity. Review the hardware and redundancy arrangement.');
 return {watts,lowWatts,pf,breakdown,warnings,estimateSource:`Component estimate v1 (${mode} workload): ${lowWatts}–${watts} W AC; upper end selected. CPU/GPU rating factor ${factors[0]}–${factors[1]}, other component allowances ${allowance} W, efficiency 90%, PF 0.90 assumed. Not measured; incomplete inventory, CPU boost and transients may change demand. Extra headroom is applied separately.`};
}
