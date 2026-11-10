import {componentPowerEstimate} from './component-power-estimate.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import type {FeedInputs} from './feed-power.ts';
import {supplyIssues} from './feed-power.ts';
import {canonicalPowerValue} from './power-input-state.ts';
import {calculatedWiringPlan} from './power-wiring-guide.ts';

export function simplePowerPlan(equipment:FeedEquipment[],configuration:unknown){
 const inputs=readFeedInputs(configuration,equipment);
 const ordered=[...equipment].sort((a,b)=>a.id.localeCompare(b.id));
 const plan=calculatedWiringPlan(ordered,inputs);
 const saved=feedRack(ordered,inputs).cords;
 const remaining=plan.assignments.filter(c=>!saved.some(s=>s.deviceId===c.deviceId&&s.inlet===c.inlet&&s.pduId===c.pduId&&s.outlet===c.outlet));
 return {...plan,remaining,revision:canonicalPowerValue({equipment:ordered,inputs}),planning:plan.pendingChecks.length>0};
}

// Suggest only missing consumption. Never replace measurements, assign cord ratings,
// confirm supplies, or silently save a model-derived planning assumption.
export function missingPowerEstimates(equipment:FeedEquipment[],inputs:FeedInputs){
 const model=feedRack(equipment,inputs),budgets={...inputs.budgets};
 const changes:{id:string;name:string;watts:number}[]=[];
 for(const load of model.loads){
  if(Number.isFinite(load.watts)&&Number(load.watts)>0)continue;
  const device=equipment.find(d=>d.id===load.id)!;
  // B300's internal redundancy is deliberately outside this planner.
  const mode=load.assessment==='pdu-capacity'?'heavy':'nameplate';
  const estimate=componentPowerEstimate(device.rawData,load.minimumCords,mode,device.model||'');
  if(!estimate||load.assessment==='pdu-capacity'&&estimate.estimateSource.startsWith('PSU capacity estimate:'))continue;
  const previous=budgets[load.id];
  budgets[load.id]={...previous,watts:estimate.watts,pf:previous?.pf>0&&previous.pf<=1?previous.pf:estimate.pf,measurement:undefined,estimateSource:estimate.estimateSource.slice(0,1000)};
  changes.push({id:device.id,name:device.name,watts:estimate.watts});
 }
 return {inputs:changes.length?{...inputs,budgets}:inputs,changes};
}

export function nextPowerQuestion(equipment:FeedEquipment[],inputs:FeedInputs){
 const model=feedRack(equipment,inputs);
 const missing=model.loads.filter(l=>!(Number(l.watts)>0));
 if(!model.loads.length)return {target:'power-equipment',title:'Add equipment to this rack',message:'Install your equipment in the rack elevation to begin.'};
 if(missing.length)return {target:'power-equipment',title:'How much power will this rack use?',message:`${missing.length} system${missing.length===1?' needs':'s need'} a consumption value. Use available Library estimates, or enter a measurement.`};
 if(model.loads.some(l=>!(Number(l.pf)>0&&Number(l.pf)<=1)))return {target:'power-equipment',title:'Confirm the power factor',message:'A saved consumption value is missing its power factor. Review that equipment before calculating.'};
 if(!model.supplies.length||!model.supplies.some(p=>p.feed==='A')||!model.supplies.some(p=>p.feed==='B')||model.supplies.some(p=>supplyIssues(p).length))return {target:'power-feeds',title:'Confirm the rack’s power feeds',message:'Review the saved PDU feed assignments, supply voltage, and usable limits once for this rack.'};
 return null;
}
