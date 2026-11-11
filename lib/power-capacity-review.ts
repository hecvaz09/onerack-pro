import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import type {Cord,Feed} from './feed-power.ts';
import {visualPowerBalance} from './visual-power.ts';

type Breach={lost:Feed|null;scope:'input'|'branch'|'neutral';label:string;amps:number;limit:number};
// Explain the existing calculator result by PDU identity. Never infer limits from
// outlet numbers or parse display-name-based error strings to calculate capacity.
export function powerCapacityReview(equipment:FeedEquipment[],configuration:unknown,candidate:Cord,review=visualPowerBalance(equipment,configuration,candidate)){
 const inputs=readFeedInputs(configuration,equipment),model=feedRack(equipment,inputs);
 const supply=review.supplies.find(p=>p.id===candidate.pduId);
 if(!supply)return undefined;
 const breaches:Breach[]=[];
 const scenarios=review.projected.scenarios.map(s=>{
  const total=s.totals.find(p=>p.id===supply.id)!;
  const before=review.current.scenarios.find(p=>p.lost===s.lost)!.totals.find(p=>p.id===supply.id)!;
  if(total.online&&Number.isFinite(total.limitAmps)&&total.limitAmps>0&&total.amps>total.limitAmps+1e-9)
   breaches.push({lost:s.lost,scope:'input',label:supply.topology&&supply.topology!=='single-phase'?'PDU input (highest line current)':'PDU input',amps:total.amps,limit:total.limitAmps});
  const branches=Object.entries(total.branches).map(([id,amps])=>({id,amps,limit:supply.branches?.[id]}));
  for(const b of branches)if(total.online&&b.limit&&b.limit>0&&b.amps>b.limit)
   breaches.push({lost:s.lost,scope:'branch',label:`Bank ${b.id}`,amps:b.amps,limit:b.limit});
  if(total.online&&supply.neutralLimitAmps&&total.neutralAmps>supply.neutralLimitAmps+1e-9)
   breaches.push({lost:s.lost,scope:'neutral',label:'Neutral',amps:total.neutralAmps,limit:supply.neutralLimitAmps});
  return {lost:s.lost,online:total.online,beforeAmps:before.amps,amps:total.amps,limit:total.limitAmps,watts:total.watts,phases:total.phases,branches};
 });
 if(!breaches.length)return undefined;
 // Normal overloads take precedence. One input breach represents both the
 // calculator's aggregate and phase-line messages without duplicating the warning.
 const primary=breaches.find(b=>b.lost===null)||breaches[0];
 const assignments=[...model.cords,candidate];
 const ids=new Set(assignments.filter(c=>c.pduId===supply.id).map(c=>c.deviceId));
 const devices=model.loads.filter(d=>ids.has(d.id)).map(d=>({id:d.id,name:d.name,watts:d.watts,pf:d.pf,estimateSource:d.estimateSource,pfEstimateSource:d.pfEstimateSource,measurement:d.measurement,partialChassis:d.assessment==='pdu-capacity'&&assignments.filter(c=>c.deviceId===d.id).length!==d.cords}));
 const context=primary.lost?`If Feed ${primary.lost} is lost`:'During normal operation';
 const message=`${context}, ${supply.name} / Feed ${supply.feed}: ${primary.label} reaches ${primary.amps.toFixed(2)} A against ${primary.limit.toFixed(2)} A usable (${(primary.amps-primary.limit).toFixed(2)} A over).`;
 return {supply:{id:supply.id,name:supply.name,feed:supply.feed,voltage:supply.voltage,topology:supply.topology},primary,breaches,scenarios,devices,headroomPercent:inputs.headroomPercent,message,
  title:primary.lost?'Failover capacity exceeded':'PDU capacity exceeded',
  action:primary.lost?'Review failover capacity':'Review PDU capacity'};
}
export type PowerCapacityReview=NonNullable<ReturnType<typeof powerCapacityReview>>;
