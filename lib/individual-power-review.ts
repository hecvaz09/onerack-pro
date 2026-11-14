import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {SINGLE_PSU_CHECK,type Cord} from './feed-power.ts';
import {validateVisualPower,visualPowerBalance} from './visual-power.ts';

const pendingSuffixes=[
 `: ${SINGLE_PSU_CHECK}`,
 ': cable compatibility is pending; outlet-only planning.',
 ': verify usable input cord current.',
 ': verify the PSU voltage range.',
 ': verify supported AC load per PSU and usable cord current.',
 ': power estimate uses unverified efficiency, power factor and load assumptions.',
 ': enter total system AC watts.',
 ': power factor is missing or invalid.',
 ': branch mapping and outlet current ratings still need verification.',
 ': confirm actual supply voltage, phase map and usable limits.',
 ': feed A or B is not assigned.',
 ': each outlet needs a valid phase or line-pair assignment.',
];
const stripScenario=(s:string)=>s.replace(/^(Normal|Feed [AB] lost): /,'');

// Build once for a saved rack, then assess each PSU independently. Unique internal
// names prevent two installed devices with the same display label sharing errors.
// All loads remain in the model: shared PDU/branch/phase limits still apply.
export function individualPowerChecks(equipment:FeedEquipment[],configuration:unknown,candidate?:Cord){
 const named=equipment.map((e,i)=>({...e,name:`@equipment-${i}@`}));
 const inputs=readFeedInputs(configuration,named),model=feedRack(named,inputs);
 const review=visualPowerBalance(named,configuration,candidate);
 const cords=candidate?[...model.cords,candidate]:model.cords;
 const display=(s:string)=>named.reduce((text,e,i)=>text.split(e.name).join(equipment[i].name),s);
 return (cord:Cord)=>{
  const device=named.find(e=>e.id===cord.deviceId),pdu=named.find(e=>e.id===cord.pduId);
  const endpointError=candidate?validateVisualPower(equipment,configuration,cord.pduId,cord.outlet,cord.deviceId,cord.inlet):undefined;
  if(!device||!pdu||endpointError)return {errors:[endpointError||'Choose a PDU and powered equipment in this rack.'],pendingChecks:[],planning:false};
  const errors:string[]=[],pendingChecks:string[]=[];
  const supply=model.supplies.find(p=>p.id===pdu.id);
  for(const issue of review.errors){
   const text=stripScenario(issue);
   const relevant=text.startsWith(device.name+':')||text.startsWith(pdu.name+':')||text.startsWith(pdu.name+' P')||text.startsWith(pdu.name+' L');
   if(!relevant){
    if(text==='Invalid headroom.')errors.push(issue);
    // A connected load with unknown consumption makes this PDU's total partial.
    const affected=model.loads.find(l=>text.startsWith(l.name+':'));
    if(affected&&cords.some(c=>c.deviceId===affected.id&&c.pduId===cord.pduId)&&
       (text.endsWith(': enter total system AC watts.')||text.endsWith(': power factor is missing or invalid.')))pendingChecks.push(issue);
    if(text==='A saved cable has an invalid device, outlet or PSU number.'||text==='Duplicate outlet or PSU assignment.')pendingChecks.push('Saved rack assignments need review; complete capacity verification is pending.');
    continue;
   }
   const missingSupply=text===pdu.name+': supply limits are invalid.'&&supply&&
    (!supply.voltage||!supply.limitAmps)&&!(supply.voltage<0||supply.limitAmps<0);
   if(pendingSuffixes.some(s=>text.endsWith(s))||missingSupply)pendingChecks.push(issue);
   else errors.push(issue);
  }
  // The B300 model omits partial chassis mappings from demand totals. Do not
  // present another load on that PDU as fully checked while those watts are absent.
  for(const load of model.loads)if(load.assessment==='pdu-capacity'&&cords.some(c=>c.deviceId===load.id&&c.pduId===cord.pduId)&&cords.filter(c=>c.deviceId===load.id).length!==load.cords)
   pendingChecks.push(`${load.name}: complete the chassis input mapping to verify this PDU's total load.`);
  return {errors:[...new Set(errors.map(display))],pendingChecks:[...new Set(pendingChecks.map(display))],planning:pendingChecks.length>0};
 };
}

export function individualPowerReview(equipment:FeedEquipment[],configuration:unknown,cord:Cord){
 return individualPowerChecks(equipment,configuration,cord)(cord);
}
