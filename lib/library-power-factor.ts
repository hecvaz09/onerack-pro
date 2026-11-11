import {psuTestReference} from './psu-test-reference.ts';
import {readSystemSpecs} from './system-specs.ts';
import type {FeedEquipment} from './feed-rack.ts';
import type {FeedInputs} from './feed-power.ts';

export function libraryPowerFactors(equipment:FeedEquipment[],inputs:FeedInputs){
 const budgets={...inputs.budgets},changes:{id:string;name:string;pf:number;source:string}[]=[];
 for(const device of equipment){
  const b=budgets[device.id];
  if(!b||!Number.isFinite(b.watts)||b.watts<=0||b.pf!==undefined&&b.pf!==0)continue;
  const report=psuTestReference(device.sku||device.model||'',device.rawData);
  const psus=readSystemSpecs(device.rawData).components.filter(c=>c.kind==='psu');
  if(!report||!psus.length||psus.some(p=>p.model.trim().toUpperCase()!==report.model))continue;
  const pf=Math.min(...report.points.map(p=>p.powerFactor));
  const source=`${report.model}, report ${report.reportId}: PF ${pf}, lowest reported test point across 10-100% PSU load at ${report.testVoltage} V / ${report.testFrequency} Hz. Planning assumption, not this server's measured PF or a guaranteed minimum outside the tested conditions. ${report.source}`;
  budgets[device.id]={...b,pf,pfEstimateSource:source};changes.push({id:device.id,name:device.name,pf,source});
 }
 return {inputs:changes.length?{...inputs,budgets}:inputs,changes};
}
