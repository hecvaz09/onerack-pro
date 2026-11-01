import {isB300PowerDevice} from './b300-power-inputs.ts';
import {consumptionLabel,isMeasuredPower} from './power-consumption.ts';
import {readSystemSpecs} from './system-specs.ts';
import {modelPowerReference} from './model-power-reference.ts';
export type EquipmentFact={key:string;label:string;value:string;origin:'model'|'installation'|'unknown';basis:string;source?:string};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const positive=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:undefined;};
// Read-only consolidation. Existing IDs, wiring, budgets and raw records remain untouched.
export function equipmentRecord(model:string,raw:unknown,installation?:unknown){
 const specs=readSystemSpecs(raw),reference=modelPowerReference(model),power=object(object(raw).powerLoad),saved=object(installation);
 const b300=isB300PowerDevice({model});
 const facts:EquipmentFact[]=[];
 const add=(key:string,label:string,base:unknown,unit:string,basis:string,source?:string)=>{
  const override=b300&&['cords','minimumCords','psuAcCapacity'].includes(key)?undefined:positive(saved[key]),value=override??positive(base);
  facts.push({key,label,value:value===undefined?'Not recorded':`${value}${unit}`,origin:override!==undefined?'installation':value!==undefined?'model':'unknown',basis:override!==undefined?(key==='watts'&&isMeasuredPower(saved)?'User-confirmed live measurement; PSU compatibility is checked separately.':key==='watts'&&typeof saved.estimateSource==='string'?saved.estimateSource:'Saved for this installation; not automatically verified.'):value!==undefined?basis:'No usable value recorded.',...(source&&override===undefined?{source}:{})});
 };
 const psus=specs.components.filter(c=>c.kind==='psu');
 add('watts',saved.watts?consumptionLabel(saved):'Whole-device AC power',reference?.maximumAcWatts,' W','Manufacturer maximum consumption; not measured.',reference?.source);
 add('pf','Power factor',undefined,'','');
 add('cords',b300?'Physical AC inputs':'PSU cords',b300?12:power.cords??(psus.length?psus.reduce((n,c)=>n+c.quantity,0):undefined),'','Library configuration.',specs.sourceUrl||undefined);
 add('minimumCords',b300?'Internal PSU minimum (outside this check)':'Required surviving PSUs',b300?undefined:power.minimumCords,'','Library configuration.',specs.sourceUrl||undefined);
 const psuRatings=psus.map(c=>positive(c.attributes.outputWatts));
 const uniform=psuRatings.length&&psuRatings.every(w=>w!==undefined&&w===psuRatings[0])?psuRatings[0]:undefined;
 add('psuDcWatts','DC output per PSU',uniform??(!psus.length||psuRatings.every(w=>w===undefined)?reference?.psuWatts:undefined),' W',uniform?'Catalog PSU rating; review hardware.':reference?.model==='MQM8700-HS2F'?'User-supplied rating; exact PSU part unverified.':'Manufacturer PSU capacity.',uniform?specs.sourceUrl||undefined:reference?.model==='MQM8700-HS2F'?undefined:reference?.source);
 add('psuAcCapacity',b300?'Per-PSU AC capacity (outside this check)':'Supported AC budget per PSU',b300?undefined:power.psuAcCapacity,' W','Library AC capacity; distinct from DC output.',specs.sourceUrl||undefined);
 add('minVoltage','Minimum input voltage',power.minVoltage,' V','Library voltage range.',specs.sourceUrl||undefined);
 add('maxVoltage','Maximum input voltage',power.maxVoltage,' V','Library voltage range.',specs.sourceUrl||undefined);
 add('cordLimitAmps','Usable cord current',power.cordLimitAmps,' A','Library cord limit.',specs.sourceUrl||undefined);
 return {model,specs,facts,sourceUrls:[...new Set([specs.sourceUrl,reference?.source].filter((s):s is string=>!!s))]};
}
