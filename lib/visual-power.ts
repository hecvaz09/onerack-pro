import {B300_INPUT_IDENTITY} from './b300-power-inputs.ts';
import {analyzeFeeds,SITE_SUPPLY_CHECK,SINGLE_PSU_CHECK,type Cord} from './feed-power.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {readDetails,readOutlets} from './equipment-details.ts';
import {policyAllows} from './power-cable-policy.ts';

// Runs against fresh rack data inside the shared rack mutation lock.
export function validateVisualPower(equipment:FeedEquipment[],configuration:unknown,pduId:string,outlet:number,deviceId:string,inlet:number):string|undefined {
 const pdu=equipment.find(e=>e.id===pduId&&e.category==='pdu');
 const device=equipment.find(e=>e.id===deviceId&&e.category!=='pdu'&&e.category!=='accessory');
 if(!pdu||!device)return 'Choose a PDU and powered equipment in this rack.';
 const socket=readOutlets(pdu.rawData).find(o=>o.n===outlet);
 if(!socket)return 'This receptacle is not in the installed PDU.';
 const inputs=readFeedInputs(configuration,equipment),model=feedRack(equipment,inputs);
 const load=model.loads.find(d=>d.id===deviceId)!;
 if(!Number.isInteger(inlet)||inlet<1||inlet>load.cords)return 'This PSU is not in the equipment power configuration.';
 if(readDetails(pdu.details).outlets[outlet]?.deviceId)return 'This outlet is already connected. Clear its assignment before reconnecting.';
 if(model.cords.some(c=>c.deviceId===deviceId&&c.inlet===inlet))return 'This PSU already has a connection. Clear its assignment before reconnecting.';
 const configured=model.supplies.find(s=>s.id===pduId)?.outlets.find(o=>o.n===outlet);
 const connectors=configured?.connectors??socket.type.split(/[^A-Za-z0-9]+/).filter(Boolean);
 if(load.connector?!connectors.includes(load.connector):!connectors.some(c=>c==='C13'||c==='C19'))return 'The outlet and equipment cord connectors are incompatible.';
 if(configured?.reserved)return 'This outlet is reserved in the PDU power configuration.';
 if(!policyAllows(inputs.cablePolicy,device.category,{n:outlet,connectors}))return 'This outlet is excluded for this equipment by the saved cable assignment rules.';
}

export function visualPowerBalance(equipment:FeedEquipment[],configuration:unknown,candidate?:Cord) {
 const inputs=readFeedInputs(configuration,equipment),model=feedRack(equipment,inputs);
 const current=analyzeFeeds(model.supplies,model.loads,model.cords,inputs.headroomPercent);
 const endpointError=candidate?validateVisualPower(equipment,configuration,candidate.pduId,candidate.outlet,candidate.deviceId,candidate.inlet):undefined;
 const candidateLoad=model.loads.find(d=>d.id===candidate?.deviceId);
 const cords=candidate&&!endpointError?[...model.cords,{...candidate,...(candidateLoad?.assessment==='pdu-capacity'?{inputIdentity:B300_INPUT_IDENTITY}:{})}]:model.cords;
 const projected=analyzeFeeds(model.supplies,model.loads,cords,inputs.headroomPercent);
 const incomplete=new Set<string>();
 for(const load of model.loads){
  if(cords.filter(c=>c.deviceId===load.id).length<load.cords){
   incomplete.add(`${load.name}: not all ${load.cords} power cords are connected.`);
   for(const scenario of projected.scenarios){
    const count=cords.filter(c=>c.deviceId===load.id&&model.supplies.find(p=>p.id===c.pduId)?.feed!==scenario.lost).length;
    if(load.assessment!=='pdu-capacity'&&count<load.minimumCords)incomplete.add(`${load.name}: ${count} surviving cords; needs at least ${load.minimumCords}.`);
   }
  }
 }
 const errors=[...new Set([...(endpointError?[endpointError]:[]),...projected.issues.filter(i=>!incomplete.has(i)),...projected.scenarios.flatMap(s=>s.errors.filter(i=>!incomplete.has(i)).map(i=>`${s.lost?`Feed ${s.lost} lost`:'Normal'}: ${i}`))])];
 const cautions=[...incomplete];
 return {current,projected,supplies:model.supplies,errors,cautions,status:errors.length?'blocked' as const:cautions.length?'caution' as const:'approved' as const};
}

// Draft wiring may retain missing PSU metadata, but never suppress known failures.
export function canSaveVisualPowerDraft(review:ReturnType<typeof visualPowerBalance>){
 return review.errors.length>0&&review.errors.every(i=>
  i.endsWith(`: ${SITE_SUPPLY_CHECK}.`)||
  i.endsWith(`: ${SINGLE_PSU_CHECK}`)||
  i.endsWith(': cable compatibility is pending; outlet-only planning.')||
  i.endsWith(': verify usable input cord current.')||
  i.endsWith(': verify the PSU voltage range.')||
  i.endsWith(': verify supported AC load per PSU and usable cord current.')||
  i.endsWith(': power estimate uses unverified efficiency, power factor and load assumptions.'));
}

// Scope the saved-connection disclosure to its equipment and PDU, using current checks.
export function connectionPowerChecks(review:ReturnType<typeof visualPowerBalance>,equipment:FeedEquipment[],pduId:string,deviceId:string){
 const names=equipment.filter(e=>e.id===deviceId||e.id===pduId).map(e=>e.name);
 return [...new Set(review.errors.filter(issue=>{
  const text=issue.replace(/^(Normal|Feed [AB] lost): /,'');
  return names.some(name=>text.startsWith(name+':')||text.startsWith(name+' P'));
 }))];
}
