import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {outletVoltage,type Cord} from './feed-power.ts';
import {designPowerAnalysis} from './outlet-planning-checks.ts';
import type {simplePowerPlan} from './simple-power-plan.ts';

type Plan=ReturnType<typeof simplePowerPlan>;
export function isPlannedPowerConnection(plan:Plan,cord:Cord){
 return !plan.error&&plan.remaining.some(c=>c.deviceId===cord.deviceId&&c.inlet===cord.inlet&&c.pduId===cord.pduId&&c.outlet===cord.outlet&&c.inputIdentity===cord.inputIdentity);
}

// Present the existing allocator result, not another assignment or save path.
// Only an exact connection in the current reviewed plan gets this context.
export function powerPlanConnectionReview(equipment:FeedEquipment[],configuration:unknown,plan:Plan,revision:string|null,candidate?:Cord){
 if(!candidate||revision!==plan.revision||!isPlannedPowerConnection(plan,candidate)||!designPowerAnalysis(plan.analysis).ready)return undefined;
 const inputs=readFeedInputs(configuration,equipment),model=feedRack(equipment,inputs);
 const load=model.loads.find(l=>l.id===candidate.deviceId),pdu=model.supplies.find(p=>p.id===candidate.pduId),outlet=pdu?.outlets.find(o=>o.n===candidate.outlet);
 if(!load||!pdu||!outlet)return undefined;
 const cords=plan.assignments.filter(c=>c.deviceId===load.id);
 const feed=(c:Cord)=>model.supplies.find(p=>p.id===c.pduId)?.feed;
 return {newConnections:plan.remaining.length,inputs:cords.length,A:cords.filter(c=>feed(c)==='A').length,B:cords.filter(c=>feed(c)==='B').length,
  verificationNotes:plan.pendingChecks,
  scenarios:plan.analysis.scenarios.map(s=>{
   const online=pdu.feed!==s.lost,surviving=cords.filter(c=>feed(c)!==s.lost).length;
   const watts=online?Number(load.watts)*(1+inputs.headroomPercent/100)/surviving:0;
   return {lost:s.lost,online,watts,amps:watts/Number(load.pf)/outletVoltage(pdu,outlet)};
  })};
}
