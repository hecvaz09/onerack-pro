import {isB300PowerDevice,B300_INPUT_IDENTITY} from './b300-power-inputs.ts';
import {detailsObject,readDetails} from './equipment-details.ts';
import type {FeedEquipment} from './feed-rack.ts';
import type {Cord} from './feed-power.ts';
import {individualPowerReview} from './individual-power-review.ts';
import {powerWiringGuide} from './power-wiring-guide.ts';
import {validateVisualPower,visualPowerBalance,canSaveVisualPowerDraft} from './visual-power.ts';

// Every individual connection entry point uses the saved rack under its mutation
// lock. Pending documentation can be acknowledged; a known endpoint/capacity
// failure cannot be converted into a planning connection.
export function reviewPowerConnection(equipment:FeedEquipment[],configuration:unknown,candidate:Cord,planning=false):{error?:string;planning:boolean}{
 const endpointError=validateVisualPower(equipment,configuration,candidate.pduId,candidate.outlet,candidate.deviceId,candidate.inlet);
 if(endpointError)return {error:endpointError,planning:false};
 if(!isB300PowerDevice(equipment.find(e=>e.id===candidate.deviceId))){
  const review=individualPowerReview(equipment,configuration,candidate);
  if(review.errors.length)return {error:review.errors.join(' '),planning:false};
  if(review.planning&&!planning)return {error:'Verification is pending. Review and save this as a planning connection.',planning:false};
  return {planning:review.planning};
 }
 // B300 capacity checks require the complete twelve-input proposal. Preserve
 // that existing model rather than judging one module input as a whole chassis.
 const review=visualPowerBalance(equipment,configuration,candidate);
 const guide=powerWiringGuide(equipment,configuration,{deviceId:candidate.deviceId,inlet:candidate.inlet},candidate);
 const pendingAllowed=planning&&!!guide.recommendation&&!!guide.provisional&&canSaveVisualPowerDraft(review);
 if(guide.provisional&&!planning)return {error:'This recommendation has pending PSU documentation. Confirm it as a planning connection.',planning:false};
 if(!pendingAllowed&&review.errors.length)return {error:review.errors.join(' '),planning:false};
 if(!pendingAllowed&&guide.error)return {error:guide.error,planning:false};
 return {planning:!!guide.provisional};
}

export function powerConnectionNotes(notes:string,planning:boolean){
 const pending='Planning draft: electrical verification pending.';
 const text=notes.trim();
 return planning&&!text.includes(pending)?[text,pending].filter(Boolean).join(' '):text;
}

// A whole-plan save may move automatic cords, but cannot replace a fixed binding
// or invent a physical endpoint. Check the final plan without applying the
// single-cord capacity check to temporarily incomplete multi-input equipment.
export function powerPlanEndpointError(equipment:FeedEquipment[],configuration:unknown,assignments:Cord[]):string|undefined{
 for(const pdu of equipment.filter(e=>e.category==='pdu'))for(const [outlet,saved] of Object.entries(readDetails(pdu.details).outlets)){
  if(saved.deviceId&&saved.locked!==false&&!assignments.some(c=>c.pduId===pdu.id&&c.outlet===Number(outlet)&&c.deviceId===saved.deviceId&&c.inlet===saved.inlet&&c.inputIdentity===saved.inputIdentity))
   return 'The proposal would change a fixed power connection. Clear that assignment before recalculating.';
 }
 const proposed=equipment.map(e=>({...e,details:{...detailsObject(e.details),outlets:{}}}));
 for(const cord of assignments){
  const error=validateVisualPower(proposed,configuration,cord.pduId,cord.outlet,cord.deviceId,cord.inlet);
  if(error)return error;
  if(isB300PowerDevice(equipment.find(e=>e.id===cord.deviceId))&&cord.inputIdentity!==B300_INPUT_IDENTITY)
   return 'The proposal must identify each physical B300 power input.';
  const pdu=proposed.find(e=>e.id===cord.pduId)!;
  pdu.details={...pdu.details,outlets:{...pdu.details.outlets,[cord.outlet]:{...cord,notes:''}}};
 }
}
