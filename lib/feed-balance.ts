import {isMeasuredPower} from './power-consumption.ts';
import {B300_INPUT_IDENTITY,powerInputLabel} from './b300-power-inputs.ts';
import {analyzeFeeds,outletVoltage,supplyDemand,type Cord,type Supply,type Load} from './feed-power.ts';
import {feedRack,type FeedEquipment} from './feed-rack.ts';
import type {FeedInputs} from './feed-power.ts';
import {readDetails} from './equipment-details.ts';
import {policyAllows,equipmentRU} from './power-cable-policy.ts';
export function feedRevision(equipment:FeedEquipment[],inputs:FeedInputs){return JSON.stringify({equipment,inputs});}
// Conservative allocation: retain manual cords; distribute missing cords across
// independent feeds and check the entire proposal before permitting any write.
export function balanceFeeds(equipment:FeedEquipment[],inputs:FeedInputs,options:{planning?:boolean}={}){
 const {supplies,loads,cords}=feedRack(equipment,inputs);
 const baseline=analyzeFeeds(supplies,loads,cords,inputs.headroomPercent);
 // Planning can calculate distribution without undocumented PSU limits. All known
 // limits, wattage, PF, cord ampacity, outlet and supply data remain mandatory.
 const pending=new Set<string>();
 if(options.planning)for(const load of loads){
  if(!load.connector)pending.add(`${load.name}: cable compatibility is pending; outlet-only planning.`);
  if(load.assessment==='pdu-capacity'&&!load.cordLimitAmps)pending.add(`${load.name}: verify usable input cord current.`);
  if(load.pfEstimateSource||load.estimateSource&&!isMeasuredPower(load))pending.add(`${load.name}: power estimate uses unverified efficiency, power factor and load assumptions.`);
  if(!load.minVoltage||!load.maxVoltage)pending.add(`${load.name}: verify the PSU voltage range.`);
  if(load.assessment!=='pdu-capacity'&&(!load.psuAcCapacity||!load.cordLimitAmps))pending.add(`${load.name}: verify supported AC load per PSU and usable cord current.`);
 }
 const blocking=baseline.issues.filter(i=>!i.includes('power cords are connected.')&&!pending.has(i));
 const fail=(error:string)=>({error,assignments:cords,analysis:baseline,pendingChecks:[...pending]});
 if(loads.some(l=>!Number.isInteger(l.cords)||l.cords<2||l.cords>(l.assessment==='pdu-capacity'?12:6)||!Number.isInteger(l.minimumCords)||l.minimumCords<1))return fail('Enter a supported PSU arrangement with 2–6 cords and a confirmed minimum surviving PSU count.');
 if(blocking.length)return fail(`${blocking.length} electrical or configuration issues must be resolved before calculating cables. Review the missing-information list below.`);
 const assignments:Cord[]=cords.filter(c=>readDetails(equipment.find(e=>e.id===c.pduId)?.details).outlets[c.outlet]?.locked!==false);
 for(const c of assignments){
  const p=supplies.find(p=>p.id===c.pduId),o=p?.outlets.find(o=>o.n===c.outlet),e=equipment.find(e=>e.id===c.deviceId);
  if(o&&!policyAllows(inputs.cablePolicy,e?.category,o))return fail(`${e?.name}: fixed cable at ${p?.name} P${c.outlet} conflicts with the saved cable policy. Review or unlock it before recalculating.`);
 }
 const used=new Set(assignments.map(c=>`${c.pduId}:${c.outlet}`));
 function cordWatts(load:Load){return Number(load.watts)*(1+inputs.headroomPercent/100)/Math.floor(load.cords/2);}
 function demand(p:Supply,extra?:{outlet:Supply['outlets'][number];watts:number;pf:number}){
  const rows=assignments.filter(c=>c.pduId===p.id).map(c=>({outlet:p.outlets.find(o=>o.n===c.outlet)!,watts:cordWatts(loads.find(l=>l.id===c.deviceId)!),pf:Number(loads.find(l=>l.id===c.deviceId)!.pf)}));
  return supplyDemand(p,extra?[...rows,extra]:rows);
 }
 for(const load of [...loads].sort((a,b)=>inputs.cablePolicy==='low-ru-c13-switch-top'?equipmentRU(equipment.find(e=>e.id===a.id)!)-equipmentRU(equipment.find(e=>e.id===b.id)!):Number(b.watts)-Number(a.watts))){
  if(load.assessment!=='pdu-capacity'&&Math.floor(load.cords/2)<load.minimumCords)return fail(`${load.name}: PSU count cannot survive either feed loss.`);
  for(let inlet=1;inlet<=load.cords;inlet++){
   if(assignments.some(c=>c.deviceId===load.id&&c.inlet===inlet))continue;
   const count=(feed:string)=>assignments.filter(c=>c.deviceId===load.id&&supplies.find(p=>p.id===c.pduId)?.feed===feed).length;
   const preferred=count('A')<=count('B')?'A':'B';
   const candidates=supplies.filter(p=>p.feed===preferred).flatMap(p=>p.outlets.flatMap(o=>{
    const voltage=outletVoltage(p,o),amps=cordWatts(load)/Number(load.pf)/voltage;
    if(!policyAllows(inputs.cablePolicy,equipment.find(e=>e.id===load.id)?.category,o)||o.reserved||used.has(`${p.id}:${o.n}`)||(load.connector?!o.connectors.includes(load.connector):!options.planning||!o.connectors.some(c=>c==='C13'||c==='C19'))||voltage<load.minVoltage!||voltage>load.maxVoltage!||amps>Math.min(o.limitAmps!,load.cordLimitAmps??Infinity))return [];
    const projected=demand(p,{outlet:o,watts:cordWatts(load),pf:Number(load.pf)});
    if(projected.amps>p.limitAmps||(p.neutralLimitAmps&&projected.neutralAmps>p.neutralLimitAmps)||Object.entries(projected.branches).some(([b,a])=>a>p.branches![b]))return [];
    return [{p,o,score:projected.amps/p.limitAmps+projected.spread/p.limitAmps*.01}];
   })).sort((a,b)=>inputs.cablePolicy==='low-ru-c13-switch-top'?a.o.n-b.o.n||a.p.id.localeCompare(b.p.id):a.score-b.score||a.o.n-b.o.n);
   const choice=candidates[0];
   if(!choice)return fail(`${load.name} ${powerInputLabel(equipment.find(e=>e.id===load.id),inlet)}: no compatible outlet fits the verified limits on feed ${preferred}. Review fixed cables or capacity.`);
   assignments.push({pduId:choice.p.id,outlet:choice.o.n,deviceId:load.id,inlet,...(load.assessment==='pdu-capacity'?{inputIdentity:B300_INPUT_IDENTITY}:{})});used.add(`${choice.p.id}:${choice.o.n}`);
  }
 }
 const analysis=analyzeFeeds(supplies,loads,assignments,inputs.headroomPercent);
 const passes=analysis.issues.every(i=>pending.has(i))&&analysis.scenarios.every(s=>s.errors.length===0);
 return {assignments,analysis,pendingChecks:[...pending],...(!passes?{error:'The proposed plan fails feed-loss checks. Review fixed cables and capacity; no changes can be saved.'}:{})};
}
