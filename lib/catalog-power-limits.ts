import {readSystemSpecs} from './system-specs.ts';
// Only reviewed, unambiguous PSU fields supply missing model limits.
// DC output and AC input-current ratings are not usable cord/AC budgets.
export function catalogPowerLimits(raw:unknown){
 const specs=readSystemSpecs(raw);
 if(specs.status!=='verified')return {};
 const psus=specs.components.filter(c=>c.kind==='psu');
 if(!psus.length)return {};
 const ranges=psus.map(p=>p.attributes.inputVoltage?.trim().match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:V(?:AC)?|VAC)?$/i));
 const capacities=psus.map(p=>Number(p.attributes.acCapacityWatts));
 const connectors=psus.map(p=>p.attributes.inlet==='C14'?'C13':p.attributes.inlet==='C20'?'C19':undefined);
 const min=ranges.every(Boolean)?Math.max(...ranges.map(r=>Number(r![1]))):0;
 const max=ranges.every(Boolean)?Math.min(...ranges.map(r=>Number(r![2]))):0;
 return {...(min>0&&max>=min?{minVoltage:min,maxVoltage:max}:{}),...(capacities.every(n=>Number.isFinite(n)&&n>0)?{psuAcCapacity:Math.min(...capacities)}:{}),...(connectors.every(c=>c&&c===connectors[0])?{connector:connectors[0]}:{})};
}
