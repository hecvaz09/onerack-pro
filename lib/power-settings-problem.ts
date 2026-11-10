import {feedInputsError,type FeedInputs} from './feed-power.ts';
import type {FeedEquipment} from './feed-rack.ts';

export type PowerSettingsProblem={message:string;target:'power-equipment'|'power-feeds';deviceId?:string;field?:'watts'|'pf'};
export function powerSettingsProblem(inputs:FeedInputs,equipment:FeedEquipment[]):PowerSettingsProblem|null{
 const error=feedInputsError(inputs);if(!error)return null;
 for(const [id,budget] of Object.entries(inputs.budgets||{})){
  const device=equipment.find(d=>d.id===id),name=device?.name||'Equipment';
  if(!budget||!Number.isFinite(budget.watts)||budget.watts<0||budget.watts>1000000)return {message:`${name}: enter AC watts from 0 to 1,000,000. Your edits have not been saved.`,target:'power-equipment',deviceId:id,field:'watts'};
  if(!Number.isFinite(budget.pf)||budget.pf<=0||budget.pf>1)return {message:`${name}: enter a power factor above 0 and at most 1. Watts alone do not supply this value. Your edits have not been saved.`,target:'power-equipment',deviceId:id,field:'pf'};
 }
 return {message:error,target:/PDU|branch|outlet|topology|phase/i.test(error)?'power-feeds':'power-equipment'};
}
