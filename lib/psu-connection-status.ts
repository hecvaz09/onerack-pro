import {isB300PowerDevice,B300_INPUT_IDENTITY} from './b300-power-inputs.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {readDetails} from './equipment-details.ts';
import {validateVisualPower} from './visual-power.ts';
import {individualPowerChecks} from './individual-power-review.ts';
import {outletPlanningChecks} from './outlet-planning-checks.ts';

export type PsuStatus={state:'off'|'connected'|'pending'|'issue';description:string;verificationNotes?:string[]};
export type PsuStatuses=Record<string,Record<number,PsuStatus>>;
// Derived from committed assignments only. Recommendations never enter this calculation.
export function psuConnectionStatuses(equipment:FeedEquipment[],configuration:unknown):PsuStatuses {
 const model=feedRack(equipment,readFeedInputs(configuration,equipment));
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
   // Historical notes are not validation state. Re-evaluate every saved input
   // using current Library data, settings and shared PDU loading (including B300).
   const {errors,pendingChecks,verificationNotes}=outletPlanningChecks(individualChecks(cord));
   const status:PsuStatus=errors.length?{state:'issue',description:errors.join(' ')}:pendingChecks.length?{state:'pending',description:pendingChecks.join(' ')}:{state:'connected',description:'Saved outlet plan: PDU and outlet checks passed using entered demand. Equipment and cable verification is separate.'};
   inlets[inlet]={...status,...(verificationNotes.length?{verificationNotes}:{})};
  }
 }
 return result;
}
