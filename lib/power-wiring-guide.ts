import {balanceFeeds} from './feed-balance.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {readDetails} from './equipment-details.ts';
import {validateVisualPower,visualPowerBalance} from './visual-power.ts';
import type {Cord} from './feed-power.ts';

export function calculatedWiringPlan(equipment:FeedEquipment[],inputs:ReturnType<typeof readFeedInputs>){
 const fixed=equipment.map(e=>({...e,details:{...(e.details as object),outlets:Object.fromEntries(Object.entries(readDetails(e.details).outlets).map(([n,a])=>[n,{...a,locked:true}]))}}));
 return balanceFeeds(fixed,inputs,{planning:true});
}

// Use the existing full-rack allocator, fixing every saved cable in place.
// An alternative becomes a fixed constraint while the remaining rack is solved.
export function powerWiringGuide(equipment:FeedEquipment[],configuration:unknown,target?:{deviceId:string;inlet:number},alternative?:Cord){
 const inputs=readFeedInputs(configuration,equipment);
 const fixed=equipment.map(e=>({...e,details:{...(e.details as object),outlets:Object.fromEntries(Object.entries(readDetails(e.details).outlets).map(([n,a])=>[n,{...a,locked:true}]))}}));
 if(alternative){
  const error=validateVisualPower(equipment,configuration,alternative.pduId,alternative.outlet,alternative.deviceId,alternative.inlet);
  if(error)return {error,issues:[error],recommendation:undefined};
  const pdu=fixed.find(e=>e.id===alternative.pduId)!;
  pdu.details.outlets[alternative.outlet]={deviceId:alternative.deviceId,inlet:alternative.inlet,notes:'',locked:true};
 }
 const plan=balanceFeeds(fixed,inputs,{planning:true});
 if(plan.error)return {error:plan.error,inputChecksOnly:/^\d+ electrical or configuration issues/.test(plan.error),issues:visualPowerBalance(fixed,configuration).errors,recommendation:undefined};
 const saved=feedRack(equipment,inputs).cords;
 const remaining=plan.assignments.filter(c=>!saved.some(v=>v.deviceId===c.deviceId&&v.inlet===c.inlet));
 const cord=alternative||(target?plan.assignments.find(c=>c.deviceId===target.deviceId&&c.inlet===target.inlet):remaining[0]);
 if(!cord)return {issues:[],recommendation:undefined,assignments:plan.assignments,remaining,confirmed:saved.length,total:plan.assignments.length,pendingChecks:plan.pendingChecks};
 const model=feedRack(equipment,inputs),load=model.loads.find(d=>d.id===cord.deviceId)!,pdu=model.supplies.find(p=>p.id===cord.pduId)!;
 const contributions=plan.analysis.scenarios.map(s=>{
  const surviving=plan.assignments.filter(c=>c.deviceId===load.id&&model.supplies.find(p=>p.id===c.pduId)?.feed!==s.lost).length;
  return {lost:s.lost,watts:pdu.feed===s.lost?0:Number(load.watts)*(1+inputs.headroomPercent/100)/surviving,pduWatts:s.totals.find(t=>t.id===pdu.id)!.watts};
 });
 return {recommendation:cord,remaining,confirmed:saved.length,total:plan.assignments.length,provisional:plan.pendingChecks.length>0,pendingChecks:plan.pendingChecks,issues:[],contributions,feed:pdu.feed,assignments:plan.assignments,reason:plan.pendingChecks.length?'Recommended from saved consumption, phase balance, outlet and cord limits, and modeled feed-loss loads. PSU voltage/capacity documentation is pending; this is a planning recommendation.':inputs.cablePolicy==='low-ru-c13-switch-top'?'Uses the saved low-RU/C13 outlet rules and passes whole-rack capacity and both feed-loss checks.':'Chosen by the existing electrical allocator to distribute feed and phase load; the complete plan passes capacity and both feed-loss checks.'};
}
