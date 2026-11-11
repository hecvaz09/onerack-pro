import {isB300PowerDevice,B300_INPUT_IDENTITY} from './b300-power-inputs.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {readDetails} from './equipment-details.ts';
import {visualPowerBalance,connectionPowerChecks,validateVisualPower} from './visual-power.ts';
import {individualPowerChecks} from './individual-power-review.ts';

export type PsuStatus={state:'off'|'connected'|'pending'|'issue';description:string};
export type PsuStatuses=Record<string,Record<number,PsuStatus>>;
// Derived from committed assignments only. Recommendations never enter this calculation.
export function psuConnectionStatuses(equipment:FeedEquipment[],configuration:unknown):PsuStatuses {
 const model=feedRack(equipment,readFeedInputs(configuration,equipment));
 const review=visualPowerBalance(equipment,configuration);
 const individualChecks=individualPowerChecks(equipment,configuration);
 const result:PsuStatuses={};
 for(const load of model.loads){
  const device=equipment.find(e=>e.id===load.id)!;
  const inlets:Record<number,PsuStatus>={};result[load.id]=inlets;
  for(let inlet=1;inlet<=load.cords;inlet++){
   const cords=model.cords.filter(c=>c.deviceId===load.id&&c.inlet===inlet);
   if(!cords.length){inlets[inlet]={state:'off',description:'Not connected'};continue;}
   if(cords.length!==1){inlets[inlet]={state:'issue',description:'Conflicting saved assignments'};continue;}
   const cord=cords[0];
   if(isB300PowerDevice(device)&&cord.inputIdentity!==B300_INPUT_IDENTITY){inlets[inlet]={state:'pending',description:'Legacy assignment: exact AC input needs review'};continue;}
   const pdu=equipment.find(e=>e.id===cord.pduId)!;
   // Reuse endpoint validation with just this saved cord removed; retain every other cord.
   const details=readDetails(pdu.details);
   const outlets={...details.outlets};delete outlets[cord.outlet];
   const without=equipment.map(e=>e.id===pdu.id?{...e,details:{...details,outlets}}:e);
   const endpointError=validateVisualPower(without,configuration,cord.pduId,cord.outlet,load.id,inlet);
   if(endpointError){inlets[inlet]={state:'issue',description:endpointError};continue;}
   if(!isB300PowerDevice(device)){
    const checks=individualChecks(cord),draft=details.outlets[cord.outlet]?.notes.includes('Planning draft:');
    inlets[inlet]=checks.errors.length?{state:'issue',description:checks.errors.join(' ')}:checks.planning||draft?{state:'pending',description:checks.pendingChecks.join(' ')||'Saved planning connection: verification pending'}:{state:'connected',description:'Saved connection: applicable checks passed'};
    continue;
   }
   const checks=connectionPowerChecks(review,equipment,cord.pduId,load.id).filter(issue=>{
    const text=issue.replace(/^(Normal|Feed [AB] lost): /,'');
    return !text.startsWith(pdu.name+' P')||text.startsWith(pdu.name+' P'+cord.outlet+':');
   });
   const pending=(s:string)=>s.endsWith(': cable compatibility is pending; outlet-only planning.')||s.endsWith(': verify usable input cord current.')||s.endsWith(': verify the PSU voltage range.')||s.endsWith(': verify supported AC load per PSU and usable cord current.')||s.endsWith(': power estimate uses unverified efficiency, power factor and load assumptions.');
   const failures=checks.filter(s=>!pending(s));
   const draft=details.outlets[cord.outlet]?.notes.includes('Planning draft:');
   inlets[inlet]=failures.length?{state:'issue',description:failures.join(' ')}:checks.length||draft?{state:'pending',description:checks.join(' ')||'Saved planning connection: verification pending'}:{state:'connected',description:'Saved connection: applicable checks passed'};
  }
 }
 return result;
}
