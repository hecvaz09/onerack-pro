import {readSystemSpecs} from './system-specs.ts';
import {reviewedComponentField} from './component-review.ts';
// Only reviewed, unambiguous PSU fields supply missing model limits.
// DC output and AC input-current ratings are not usable cord/AC budgets.
export function catalogPowerLimits(raw:unknown){
 const specs=readSystemSpecs(raw);
 const psus=specs.components.filter(c=>c.kind==='psu');
 if(!psus.length)return {};
 // A sourced, exact PSU reference can establish a field independently of the
 // rest of a draft system. Never promote unrelated fields or other PSU models.
 const field=(p:typeof psus[number],key:string)=>{
  const reviewed=reviewedComponentField(specs,p,key);
  if(reviewed!==undefined)return reviewed;
  if(key==='inputVoltage'&&p.manufacturer.trim().toLowerCase()==='supermicro'&&p.model.trim().toUpperCase()==='PWS-504P-1R'){
   const value=p.attributes[key]?.trim();
   // Do not override a conflicting catalog value; it needs review.
   // https://www.supermicro.com/en/products/system/WIO/1U/SYS-510P-WTR
   if(!value||/^100\s*[-–]\s*240\s*VAC$/i.test(value))return '100-240 VAC';
  }
  return undefined;
 };
 const ranges=psus.map(p=>field(p,'inputVoltage')?.trim().match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:V(?:AC)?|VAC)?$/i));
 const capacities=psus.map(p=>Number(field(p,'acCapacityWatts')));
 const connectors=psus.map(p=>field(p,'inlet')==='C14'?'C13':field(p,'inlet')==='C20'?'C19':undefined);
 const min=ranges.every(Boolean)?Math.max(...ranges.map(r=>Number(r![1]))):0;
 const max=ranges.every(Boolean)?Math.min(...ranges.map(r=>Number(r![2]))):0;
 return {...(min>0&&max>=min?{minVoltage:min,maxVoltage:max}:{}),...(capacities.every(n=>Number.isFinite(n)&&n>0)?{psuAcCapacity:Math.min(...capacities)}:{}),...(connectors.every(c=>c&&c===connectors[0])?{connector:connectors[0]}:{})};
}
