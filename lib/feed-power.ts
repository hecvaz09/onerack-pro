import {B300_INPUT_IDENTITY,B300_POWER_SCOPE} from './b300-power-inputs.ts';
import {isMeasuredPower,type PowerMeasurement} from './power-consumption.ts';
// Electrical profiles are independent of rack position and manufacturer.
// Unknown branch/outlet limits must never produce an approved plan.
export type Feed = 'A'|'B';
export type Topology='single-phase'|'three-phase-wye'|'three-phase-delta';
export type Phase='L1'|'L2'|'L3'|'L1-L2'|'L2-L3'|'L3-L1';
export type Supply = {topology?:Topology;neutralLimitAmps?:number;confirmed?:boolean;id:string;name:string;feed:Feed;voltage:number;limitAmps:number;branches?:Record<string,number>;outlets:{n:number;connectors:string[];limitAmps?:number;branch?:string;phase?:Phase;reserved?:boolean}[]};
export type Load = {assessment?:"pdu-capacity";id:string;name:string;watts?:number;pf?:number;cords:number;minimumCords:number;connector:string;minVoltage?:number;maxVoltage?:number;cordLimitAmps?:number;psuAcCapacity?:number;pfEstimateSource?:string;estimateSource?:string;measurement?:PowerMeasurement};
export type Cord = {pduId:string;outlet:number;deviceId:string;inlet:number;inputIdentity?:"b300-module-input-v1"};
export type FeedInputs = {cablePolicy?:import('./power-cable-policy.ts').PowerCablePolicy;headroomPercent:number;supplies?:Record<string,Omit<Supply,'id'|'name'>>;budgets:Record<string,{watts:number;pf:number;pfEstimateSource?:string;estimateSource?:string;measurement?:PowerMeasurement;cords?:number;minimumCords?:number;connector?:string;minVoltage?:number;maxVoltage?:number;cordLimitAmps?:number;psuAcCapacity?:number}>};
export function feedInputsError(s:FeedInputs):string|null {
  if(s?.cablePolicy!==undefined&&!['balanced','low-ru-c13-switch-top'].includes(s.cablePolicy))return 'Choose a supported cable assignment policy.';
  if(!s||!Number.isFinite(s.headroomPercent)||s.headroomPercent<0||s.headroomPercent>100||!s.budgets||typeof s.budgets!=='object'||Array.isArray(s.budgets))return 'Check power inputs.';
  for(const b of Object.values(s.budgets))if(!b||(b.estimateSource!==undefined&&(typeof b.estimateSource!=='string'||b.estimateSource.length>1000))||!Number.isFinite(b.watts)||b.watts<0||b.watts>1000000||!Number.isFinite(b.pf)||b.pf<=0||b.pf>1)return 'Enter nonnegative AC watts and a power factor above 0 and at most 1.';
  for(const b of Object.values(s.budgets)){
    if(b.pfEstimateSource!==undefined&&(typeof b.pfEstimateSource!=='string'||!b.pfEstimateSource.trim()||b.pfEstimateSource.length>1000))return 'Check power factor source.';
    if(b.measurement!==undefined&&(!isMeasuredPower(b)||b.measurement.source.length>1000))return 'Measurement evidence must match the saved watts and include a source.';
    for(const k of ['cords','minimumCords','minVoltage','maxVoltage','cordLimitAmps','psuAcCapacity'] as const)if(b[k]!==undefined&&(!Number.isFinite(b[k])||b[k]!<=0||b[k]!>1000000))return 'Check PSU limits.';
    if(b.cords!==undefined&&(!Number.isInteger(b.cords)||b.cords>12))return 'Use 1-12 power inputs.';
    if(b.minimumCords!==undefined&&!Number.isInteger(b.minimumCords))return 'Minimum surviving PSU count must be a whole number.';
    if(b.connector!==undefined&&(typeof b.connector!=='string'||b.connector.length>40))return 'Check cord connector.';
  }
  if(s.supplies!==undefined){
   if(!s.supplies||typeof s.supplies!=='object'||Array.isArray(s.supplies)||Object.keys(s.supplies).length>8)return 'Check PDU setup.';
   for(const p of Object.values(s.supplies)){
    if(!p||!['single-phase','three-phase-wye','three-phase-delta'].includes(p.topology||'')||!['A','B'].includes(p.feed)||typeof p.confirmed!=='boolean'||!Number.isFinite(p.voltage)||p.voltage<=0||p.voltage>1000||!Number.isFinite(p.limitAmps)||p.limitAmps<=0||p.limitAmps>1000||!Array.isArray(p.outlets)||p.outlets.length>512||!p.branches||typeof p.branches!=='object'||Array.isArray(p.branches))return 'Choose the PDU topology, feed, voltage and usable current limits.';
    for(const value of Object.values(p.branches))if(!Number.isFinite(value)||value<0||value>1000)return 'Check branch current limits.';
    if(p.outlets.some(o=>!o||!Number.isInteger(o.n)||o.n<1||!Array.isArray(o.connectors)||o.connectors.some(c=>typeof c!=='string'||c.length>40)||typeof o.branch!=='string'||o.branch.length>40||(o.phase!==undefined&&!['L1','L2','L3','L1-L2','L2-L3','L3-L1'].includes(o.phase))||(o.limitAmps!==undefined&&(!Number.isFinite(o.limitAmps)||o.limitAmps<0||o.limitAmps>1000))))return 'Check outlet phase, connector and branch rows.';
    if(p.confirmed&&supplyIssues({...p,id:'setup',name:'PDU'}).length)return 'Complete the phase mapping and electrical limits before confirming the PDU.';
   }
  }
  return null;
}
export const phaseNames=['L1','L2','L3'] as const;
const phaseAngles=[0,-2*Math.PI/3,2*Math.PI/3];
export function outletVoltage(p:Supply,o:Supply['outlets'][number]){
 return p.topology==='three-phase-wye'&&!o.phase?.includes('-')?p.voltage/Math.sqrt(3):p.voltage;
}
export function supplyCapacityVA(p:Supply){return p.voltage*p.limitAmps*(p.topology&&p.topology!=='single-phase'?Math.sqrt(3):1);}
export function supplyIssues(p:Supply):string[]{
 const errors:string[]=[],three=p.topology&&p.topology!=='single-phase';
 if(p.topology&&!['single-phase','three-phase-wye','three-phase-delta'].includes(p.topology))errors.push('choose a supported supply topology');
 if(p.confirmed===false)errors.push('confirm actual supply voltage, phase map and usable limits');
 if(!['A','B'].includes(p.feed))errors.push('feed A or B is not assigned');
 if(!Number.isFinite(p.voltage)||p.voltage<=0||!Number.isFinite(p.limitAmps)||p.limitAmps<=0)errors.push('supply limits are invalid');
 if(!p.outlets.length||!p.branches||p.outlets.some(o=>!o.branch||!Number.isFinite(p.branches?.[o.branch])||Number(p.branches?.[o.branch])<=0||!Number.isFinite(o.limitAmps)||Number(o.limitAmps)<=0))errors.push('branch mapping and outlet current ratings still need verification');
 if(new Set(p.outlets.map(o=>o.n)).size!==p.outlets.length||p.outlets.some(o=>!Number.isInteger(o.n)||o.n<1||!Array.isArray(o.connectors)||!o.connectors.length))errors.push('outlet identities or connectors are invalid');
 const allowed=p.topology==='three-phase-delta'?['L1-L2','L2-L3','L3-L1']:['L1','L2','L3','L1-L2','L2-L3','L3-L1'];
 if(three&&p.outlets.some(o=>!o.phase||!allowed.includes(o.phase)))errors.push('each outlet needs a valid phase or line-pair assignment');
 if(three&&p.branches&&Object.keys(p.branches).some(b=>new Set(p.outlets.filter(o=>o.branch===b).map(o=>o.phase)).size>1))errors.push('a branch must map to one phase or line pair; split multi-pole branch groups into their protected circuits');
 if(p.neutralLimitAmps!==undefined&&(!Number.isFinite(p.neutralLimitAmps)||p.neutralLimitAmps<=0))errors.push('neutral current limit is invalid');
 return errors;
}
// Fundamental-frequency model: ABC sequence and lagging displacement PF.
// Line-pair currents are added as vectors, never as scalar sums on both lines.
export function supplyDemand(p:Supply,items:{outlet:Supply['outlets'][number];watts:number;pf:number}[]){
 const vectors=[[0,0],[0,0],[0,0]],branches:Record<string,number>={};let watts=0,va=0,singleAmps=0;
 for(const item of items){const o=item.outlet,v=outletVoltage(p,o);if(v<=0||item.pf<=0||item.pf>1)continue;
  const apparent=item.watts/item.pf,amps=apparent/v;watts+=item.watts;va+=apparent;singleAmps+=amps;
  if(o.branch)branches[o.branch]=(branches[o.branch]||0)+amps;
  const phase=o.phase||'L1',pair=phase.split('-'),a=phaseNames.indexOf(pair[0] as typeof phaseNames[number]),b=pair.length===2?phaseNames.indexOf(pair[1] as typeof phaseNames[number]):-1;
  if(a<0)continue;
  const angle=b<0?phaseAngles[a]:Math.atan2(Math.sin(phaseAngles[a])-Math.sin(phaseAngles[b]),Math.cos(phaseAngles[a])-Math.cos(phaseAngles[b]));
  const real=amps*Math.cos(angle-Math.acos(item.pf)),imag=amps*Math.sin(angle-Math.acos(item.pf));
  vectors[a][0]+=real;vectors[a][1]+=imag;if(b>=0){vectors[b][0]-=real;vectors[b][1]-=imag;}
 }
 const three=!!p.topology&&p.topology!=='single-phase',phases=three?vectors.map(v=>Math.hypot(...v)):[singleAmps];
 return {watts,va,branches,phases,amps:Math.max(...phases),neutralAmps:p.topology==='three-phase-wye'?Math.hypot(vectors.reduce((n,v)=>n+v[0],0),vectors.reduce((n,v)=>n+v[1],0)):0,spread:Math.max(...phases)-Math.min(...phases)};
}
export function analyzeFeeds(supplies:Supply[],loads:Load[],cords:Cord[],headroomPercent=0){
  const issues=new Set<string>();
  if(!supplies.length||!loads.length)issues.add("Install PDUs and powered equipment before evaluating a plan.");
  if(!supplies.some(p=>p.feed==='A')||!supplies.some(p=>p.feed==='B'))issues.add("Both independent feeds A and B are required.");
  if(!Number.isFinite(headroomPercent)||headroomPercent<0||headroomPercent>100){issues.add('Invalid headroom.');headroomPercent=0;}
  const seenOutlets=new Set<string>(),seenInlets=new Set<string>();
  const valid=cords.filter(c=>{
    const p=supplies.find(p=>p.id===c.pduId),d=loads.find(d=>d.id===c.deviceId),o=p?.outlets.find(o=>o.n===c.outlet);
    if(!p||!d||!o||!Number.isInteger(c.inlet)||c.inlet<1||c.inlet>d.cords){issues.add('A saved cable has an invalid device, outlet or PSU number.');return false;}
    if(d.assessment==='pdu-capacity'&&c.inputIdentity!==B300_INPUT_IDENTITY){issues.add(`${d.name}: saved input identity needs review; clear legacy PSU assignments and select the exact module input.`);return false;}
    if(d.assessment!=='pdu-capacity'&&c.inputIdentity===B300_INPUT_IDENTITY){issues.add(`${d.name}: saved input identity does not match the configured model.`);return false;}
    const outlet=`${p.id}:${c.outlet}`,inlet=`${d.id}:${c.inlet}`;
    if(seenOutlets.has(outlet)||seenInlets.has(inlet)){issues.add('Duplicate outlet or PSU assignment.');return false;}
    seenOutlets.add(outlet);seenInlets.add(inlet);
    if(o.reserved)issues.add(`${p.name} P${o.n}: outlet is reserved for facility use.`);
    if(d.connector?!o.connectors.includes(d.connector):!o.connectors.some(c=>c==='C13'||c==='C19'))issues.add(`${d.name}: incompatible connector at ${p.name} P${o.n}.`);
    const voltage=outletVoltage(p,o);
    if((d.minVoltage&&voltage<d.minVoltage)||(d.maxVoltage&&voltage>d.maxVoltage))issues.add(`${d.name}: ${voltage.toFixed(1)} V is outside its documented ${d.minVoltage}–${d.maxVoltage} V input range.`);
    return true;
  });
  for(const p of supplies)for(const error of supplyIssues(p))issues.add(`${p.name}: ${error}.`);
  for(const d of loads){
    if(!d.connector)issues.add(`${d.name}: cable compatibility is pending; outlet-only planning.`);
    if(d.pfEstimateSource||d.estimateSource&&!isMeasuredPower(d))issues.add(`${d.name}: power estimate uses unverified efficiency, power factor and load assumptions.`);
    if(!d.minVoltage||!d.maxVoltage)issues.add(`${d.name}: verify the PSU voltage range.`);
    if(!Number.isFinite(d.watts)||Number(d.watts)<=0)issues.add(`${d.name}: enter total system AC watts.`);
    if(!Number.isFinite(d.pf)||Number(d.pf)<=0||Number(d.pf)>1)issues.add(`${d.name}: power factor is missing or invalid.`);
    if(d.assessment==='pdu-capacity'){if(!d.cordLimitAmps)issues.add(`${d.name}: verify usable input cord current.`);}
    else if(!d.psuAcCapacity||!d.cordLimitAmps)issues.add(`${d.name}: verify supported AC load per PSU and usable cord current.`);
    if(valid.filter(c=>c.deviceId===d.id).length!==d.cords)issues.add(`${d.name}: not all ${d.cords} power cords are connected.`);
  }
  const scenarios=([null,'A','B'] as const).map(lost=>{
    const errors:string[]=[],active=valid.filter(c=>supplies.find(p=>p.id===c.pduId)?.feed!==lost);
    const items=new Map<string,{outlet:Supply['outlets'][number];watts:number;pf:number}[]>();
    const totals=supplies.map(p=>({id:p.id,name:p.name,feed:p.feed,online:p.feed!==lost,limitAmps:p.limitAmps,...supplyDemand(p,[])}));
    for(const d of loads){
      // An incomplete saved mapping cannot establish this chassis' PDU loading.
      // The allocator checks the completed proposal before any individual save.
      if(d.assessment==='pdu-capacity'&&valid.filter(c=>c.deviceId===d.id).length!==d.cords)continue;
      const connected=active.filter(c=>c.deviceId===d.id);
      if(d.assessment==='pdu-capacity'&&!connected.length)errors.push(`${d.name}: no assigned inputs remain for this PDU capacity scenario.`);
      if(d.assessment!=='pdu-capacity'&&connected.length<d.minimumCords)errors.push(`${d.name}: ${connected.length} surviving cords; needs at least ${d.minimumCords}.`);
      if(!connected.length||!Number.isFinite(d.watts)||Number(d.watts)<=0||!Number.isFinite(d.pf)||Number(d.pf)<=0||Number(d.pf)>1)continue;
      const watts=Number(d.watts)*(1+headroomPercent/100)/connected.length,va=watts/Number(d.pf);
      if(d.assessment!=='pdu-capacity'&&d.psuAcCapacity&&watts>d.psuAcCapacity)errors.push(`${d.name}: surviving PSU AC capacity exceeded.`);
      for(const c of connected){
        const p=supplies.find(p=>p.id===c.pduId)!,o=p.outlets.find(o=>o.n===c.outlet)!;
        if(p.voltage<=0)continue;
        const amps=va/outletVoltage(p,o);
        const rows=items.get(p.id)||[];rows.push({outlet:o,watts,pf:Number(d.pf)});items.set(p.id,rows);
        if((o.limitAmps&&amps>o.limitAmps)||(d.cordLimitAmps&&amps>d.cordLimitAmps))errors.push(`${p.name} P${o.n}: outlet or cord current exceeded.`);
      }
    }
    for(const t of totals){
      const supply=supplies.find(p=>p.id===t.id)!;Object.assign(t,supplyDemand(supply,items.get(t.id)||[]));
      t.phases.forEach((amps,i)=>{if(amps>t.limitAmps+1e-9)errors.push(`${t.name} L${i+1}: ${amps.toFixed(2)} A exceeds ${t.limitAmps} A.`);});
      if(supply.neutralLimitAmps&&t.neutralAmps>supply.neutralLimitAmps+1e-9)errors.push(`${t.name}: neutral current exceeds ${supply.neutralLimitAmps} A.`);
      if(t.amps>t.limitAmps+1e-9)errors.push(`${t.name}: ${t.amps.toFixed(2)} A exceeds ${t.limitAmps} A.`);
      const p=supplies.find(p=>p.id===t.id)!;
      for(const [b,a] of Object.entries(t.branches))if(p.branches?.[b]&&a>p.branches[b])errors.push(`${t.name}: branch ${b} overloaded.`);
    }
    return {lost,totals,errors};
  });
  return {ready:issues.size===0&&scenarios.every(s=>s.errors.length===0),issues:[...issues],scenarios,...(loads.some(d=>d.assessment==="pdu-capacity")?{scopeNotes:[B300_POWER_SCOPE]}:{})};
}
