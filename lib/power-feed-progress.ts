import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import type {Cord} from './feed-power.ts';
export type PowerSaveResult={ok?:boolean;error?:string;pduId?:string;details?:unknown};
// Called only with the committed server response; failures leave all state intact.
export function applyPowerSave(equipment:FeedEquipment[],result:PowerSaveResult){
 if(!result.ok||!result.pduId||result.details===undefined)return equipment;
 return equipment.map(e=>e.id===result.pduId?{...e,details:result.details}:e);
}
const cordKey=(c:Cord)=>JSON.stringify([c.deviceId,c.inlet,c.pduId,c.outlet]);
const inletKey=(c:Cord)=>JSON.stringify([c.deviceId,c.inlet]);
const outletKey=(c:Cord)=>JSON.stringify([c.pduId,c.outlet]);
function distinctCords(cords:Cord[]){
 return [...new Map(cords.map(c=>[cordKey(c),c])).values()];
}
function counts(cords:Cord[],key:(c:Cord)=>string){
 const result=new Map<string,number>();
 for(const c of cords)result.set(key(c),(result.get(key(c))||0)+1);
 return result;
}
export function powerFeedProgress(equipment:FeedEquipment[],configuration:unknown,assignments:Cord[]){
 const model=feedRack(equipment,readFeedInputs(configuration,equipment));
 const planned=distinctCords(assignments),saved=distinctCords(model.cords);
 const savedKeys=new Set(saved.map(cordKey));
 const plannedInlets=counts(planned,inletKey),plannedOutlets=counts(planned,outletKey);
 const savedInlets=counts(saved,inletKey),savedOutlets=counts(saved,outletKey);
 const matched=new Set(planned.filter(c=>{
  const supply=model.supplies.find(p=>p.id===c.pduId),load=model.loads.find(d=>d.id===c.deviceId);
  // Stale/out-of-range endpoints and conflicting assignments cannot complete a cord.
  if(!supply||!load||!Number.isSafeInteger(c.inlet)||c.inlet<1||c.inlet>load.cords||
     !Number.isSafeInteger(c.outlet)||!supply.outlets.some(o=>o.n===c.outlet))return false;
  return savedKeys.has(cordKey(c))&&plannedInlets.get(inletKey(c))===1&&
   plannedOutlets.get(outletKey(c))===1&&savedInlets.get(inletKey(c))===1&&savedOutlets.get(outletKey(c))===1;
 }).map(cordKey));
 // Feed comes from the current PDU configuration; Cord has no historical feed field.
 // "Connected" means an exact saved mapping, not physical installation or a passed test.
 return (['A','B'] as const).map(feed=>{
  const rows=planned.filter(c=>model.supplies.find(p=>p.id===c.pduId)?.feed===feed);
  const pending=rows.filter(c=>!matched.has(cordKey(c)));
  return {feed,total:rows.length,connected:rows.length-pending.length,pending};
 });
}
