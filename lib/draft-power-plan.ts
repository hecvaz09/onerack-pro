import type {FeedEquipment} from './feed-rack.ts';
import type {FeedInputs,Cord} from './feed-power.ts';
import {feedRevision} from './feed-balance.ts';
import {calculatedWiringPlan} from './power-wiring-guide.ts';
export type DraftPowerPlan={version:2;status:'draft';revision:string;assignments:Cord[];issues:string[]};
export function draftPowerPlan(equipment:FeedEquipment[],inputs:FeedInputs):{plan?:DraftPowerPlan;error?:string}{
 const result=calculatedWiringPlan(equipment,inputs);
 if(result.error)return {error:result.error};
 return {plan:{version:2,status:'draft',revision:feedRevision(equipment,inputs),assignments:result.assignments,issues:result.pendingChecks}};
}
export function readDraftPowerPlan(value:unknown):DraftPowerPlan|null{
 if(!value||typeof value!=='object')return null;
 const d=value as DraftPowerPlan;
 return d.version===2&&d.status==='draft'&&typeof d.revision==='string'&&Array.isArray(d.issues)&&d.issues.every(i=>typeof i==='string')&&Array.isArray(d.assignments)&&d.assignments.every(c=>c&&typeof c.pduId==='string'&&typeof c.deviceId==='string'&&Number.isInteger(c.outlet)&&Number.isInteger(c.inlet))?d:null;
}
