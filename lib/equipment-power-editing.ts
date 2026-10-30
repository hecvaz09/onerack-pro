import type {FeedInputs} from './feed-power';
import type {FeedEquipment} from './feed-rack';
import {isMeasuredPower} from './power-consumption';

export type EquipmentBudget=FeedInputs['budgets'][string];
export type DemandChange={id:string;name:string;startRU?:number;before?:number;after:number;kind:'demand'|'source'|'unchanged'};
export type BulkApplyFeedback={sourceId:string;fingerprint:string;error?:string;changes:DemandChange[]};
export function hasEquipmentDemand(budget:EquipmentBudget|undefined){
  return !!budget&&Number.isFinite(budget.watts)&&budget.watts>0&&budget.watts<=1000000;
}
export function equipmentDemandSource(budget:EquipmentBudget|undefined){
  if(!hasEquipmentDemand(budget))return {label:'Not recorded',description:'No usable whole-system demand is selected.'};
  if(isMeasuredPower(budget!))return {label:'Recorded measurement',description:budget!.measurement!.source==='User-confirmed live measurement'
    ?'User-recorded reading (legacy source label). Not live monitoring or independently verified.'
    :`User-recorded reading: ${budget!.measurement!.source}. Not live monitoring or independently verified.`};
  if(budget!.estimateSource)return {label:'Planning estimate',description:budget!.estimateSource};
  return {label:'Manually entered',description:'Entered for this installed device. No measurement source is recorded.'};
}
export function matchingDemandDevices(equipment:FeedEquipment[],source:FeedEquipment){
  if(!source.model?.trim()||source.category==='pdu'||source.category==='accessory')return [];
  return equipment.filter(device=>device.id!==source.id&&device.model===source.model&&device.category===source.category&&JSON.stringify(device.rawData)===JSON.stringify(source.rawData));
}
export function applyEquipmentDemand(inputs:FeedInputs,equipment:FeedEquipment[],sourceId:string,selectedIds:string[]):{inputs:FeedInputs;count:number;changes:DemandChange[];error?:string}{
  const source=equipment.find(device=>device.id===sourceId),budget=inputs.budgets[sourceId];
  if(!source||!hasEquipmentDemand(budget))return {inputs,count:0,changes:[],error:'Enter a usable source demand before applying it.'};
  const ids=[...new Set(selectedIds)],eligible=new Set(matchingDemandDevices(equipment,source).map(device=>device.id));
  if(!ids.length)return {inputs,count:0,changes:[],error:'Select at least one installed device.'};
  if(ids.some(id=>!eligible.has(id)))return {inputs,count:0,changes:[],error:'The selection no longer matches this Library configuration. Review it again.'};
  const sourceName=(source.name||source.model||'another device').slice(0,200);
  const origin=equipmentDemandSource(budget).label.toLowerCase();
  const estimateSource=`Copied planning value: ${budget.watts} W from ${sourceName} (${origin}). Not a measurement of this device. Its power factor and PSU settings are unchanged.`;
  const budgets={...inputs.budgets},changes:DemandChange[]=[];
  for(const id of ids){
    const previous=budgets[id],next={...previous,pf:previous?.pf??0,watts:budget.watts,measurement:undefined,estimateSource},target=equipment.find(device=>device.id===id)!;
    const kind=previous?.watts!==next.watts?'demand':previous?.pf!==next.pf||previous?.measurement!==undefined||previous?.estimateSource!==next.estimateSource?'source':'unchanged';
    changes.push({id,name:target.name,startRU:target.startRU,before:hasEquipmentDemand(previous)?previous.watts:undefined,after:next.watts,kind});
    if(kind!=='unchanged')budgets[id]=next;
  }
  return {inputs:changes.every(change=>change.kind==='unchanged')?inputs:{...inputs,budgets},count:ids.length,changes};
}
