import {isB300PowerDevice} from './b300-power-inputs.ts';
import { PX3_4068_OUTLETS, PX3_4068_POWER, pduModelId } from "./pdu-models.ts";
import { acDemand } from "./power-demand.ts";
import { readDetails } from "./equipment-details.ts";

// Verified PDU profile with explicit 1+1 or equal-sharing 3+3 equipment groups.
export type PowerBudget = { watts:number; connector:"C13"|"C19"; passive:boolean; confirmed:boolean; source:string; pf?:number; cordAmps?:number; psusPerFeed?:1|2|3; psuAcCapacity?:number; testOnly?:boolean };
export type Px3Settings = { headroomPercent?:number; voltage:number; pf:number; inputLimit:number; reserveDedicated:boolean; supplyConfirmed:boolean; budgets:Record<string,PowerBudget> };
export type PowerEquipment = { sku?:string|null; id:string; name:string; model:string; mounting:string; category:string|null; rawData:unknown; details:unknown };
export type PowerAssignment = { pduId:string; outlet:number; deviceId:string; inlet:number; locked:boolean };
export type PowerIssue = { level:"incomplete"|"overload"|"warning"; message:string; code?:"missing-cables" };
export type PduTotals = { id:string; name:string; side:"A"|"B"; watts:number; kva:number; phases:number[]; breakers:number[]; outlets:{n:number;deviceId:string;inlet:number;watts:number;amps:number;locked:boolean}[]; spread:number };
export type PowerAnalysis = { issues:PowerIssue[]; pdus:PduTotals[]; ready:boolean; watts:number; settings:Px3Settings };
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function readPx3Settings(configuration:unknown):Px3Settings {
  const p=record(record(configuration).px3Power),budgets:Record<string,PowerBudget>={};
  for(const [id,raw] of Object.entries(record(p.budgets))){const b=record(raw);budgets[id]={watts:typeof b.watts==="number"?b.watts:0,connector:b.connector==="C19"?"C19":"C13",passive:b.passive===true,confirmed:b.confirmed===true,source:typeof b.source==="string"?b.source:"",...(b.psusPerFeed!==undefined?{psusPerFeed:Number(b.psusPerFeed) as 1|2|3}:{}),...(b.psuAcCapacity!==undefined?{psuAcCapacity:Number(b.psuAcCapacity)}:{}),...(b.testOnly!==undefined?{testOnly:b.testOnly===true}:{}),...(b.pf!==undefined?{pf:Number(b.pf)}:{}),...(b.cordAmps!==undefined?{cordAmps:Number(b.cordAmps)}:{})};}
  return {headroomPercent:typeof p.headroomPercent==="number"?p.headroomPercent:0,voltage:typeof p.voltage==="number"?p.voltage:400,pf:typeof p.pf==="number"?p.pf:0.975,inputLimit:typeof p.inputLimit==="number"?p.inputLimit:80,reserveDedicated:p.reserveDedicated!==false,supplyConfirmed:p.supplyConfirmed===true,budgets};
}
export function px3SettingsError(s:Px3Settings):string|null {
  if(!s||!Number.isFinite(s.voltage)||s.voltage<PX3_4068_POWER.minVoltage||s.voltage>PX3_4068_POWER.maxVoltage)return "This PDU profile requires 400–415 V three-phase Wye input.";
  if(!Number.isFinite(s.pf)||s.pf<0.1||s.pf>1)return "Power factor must be greater than or equal to 0.1 and at most 1.";
  if(!Number.isFinite(s.inputLimit)||s.inputLimit<=0||s.inputLimit>PX3_4068_POWER.inputAmps)return "Enter the smaller of the PDU and upstream usable continuous limits, up to 80 A per phase.";
  if(typeof s.reserveDedicated!=="boolean"||typeof s.supplyConfirmed!=="boolean"||!s.budgets||typeof s.budgets!=="object"||Array.isArray(s.budgets)||Object.keys(s.budgets).length>500)return "Invalid power settings.";
  if(s.headroomPercent!==undefined&&(!Number.isFinite(s.headroomPercent)||s.headroomPercent<0||s.headroomPercent>100))return "Additional headroom must be 0–100%.";
  for(const b of Object.values(s.budgets))if(!b||typeof b.passive!=="boolean"||typeof b.confirmed!=="boolean"||!Number.isFinite(b.watts)||b.watts<0||b.watts>100000||(!b.passive&&b.confirmed&&b.watts===0)||!["C13","C19"].includes(b.connector)||typeof b.source!=="string"||b.source.length>500||(b.pf!==undefined&&(!Number.isFinite(b.pf)||b.pf<0.1||b.pf>1))||(b.cordAmps!==undefined&&(!Number.isFinite(b.cordAmps)||b.cordAmps<=0||b.cordAmps>16)))return "Enter a positive AC watt budget (or passive status), connector, valid PF and cord limit. Notes are optional.";
  for(const b of Object.values(s.budgets)){
    if(b.psusPerFeed!==undefined&&b.psusPerFeed!==1&&b.psusPerFeed!==2&&b.psusPerFeed!==3)return "Choose a supported 1+1, 2+2 or 3+3 PSU group.";
    if(b.testOnly!==undefined&&typeof b.testOnly!=="boolean")return "Invalid test-profile flag.";
    if(b.psuAcCapacity!==undefined&&(!Number.isFinite(b.psuAcCapacity)||b.psuAcCapacity<=0||b.psuAcCapacity>100000))return "Enter a positive supported AC watt budget per PSU.";
    if(!b.passive&&b.confirmed&&(b.psusPerFeed??1)>1&&!b.psuAcCapacity)return "A multi-PSU feed group needs a supported AC watt budget per PSU.";
  }
  return null;
}
export function deviceDemand(b:PowerBudget,s:Px3Settings){return acDemand(b.passive?0:b.watts,b.pf??s.pf,s.voltage/Math.sqrt(3),s.headroomPercent??0);}
export function survivorCordDemand(b:PowerBudget,s:Px3Settings){const total=deviceDemand(b,s),n=b.psusPerFeed??1;return {watts:total.watts/n,va:total.va/n,amps:total.amps/n};}
export function sixPsuTestBudget():PowerBudget{return {watts:9000,connector:"C19",passive:false,confirmed:false,source:"SYNTHETIC TEST: 3+3 equal sharing; PSU1–3=A, PSU4–6=B; 3500 W supported AC budget per PSU. Not verified Supermicro specifications.",pf:0.975,cordAmps:16,psusPerFeed:3,psuAcCapacity:3500,testOnly:true};}
export function savedPowerAssignments(equipment:PowerEquipment[]):PowerAssignment[]{
  return equipment.filter(d=>d.category==="pdu").flatMap(p=>Object.entries(readDetails(p.details).outlets).filter(([,a])=>a.deviceId).map(([n,a])=>({pduId:p.id,outlet:Number(n),deviceId:a.deviceId,inlet:a.inlet??0,locked:a.locked!==false})));
}
export function analyzePx3(equipment:PowerEquipment[],settings:Px3Settings,assignments=savedPowerAssignments(equipment)):PowerAnalysis {
  const issues:PowerIssue[]=[],pdus:PduTotals[]=[];
  if(equipment.some(isB300PowerDevice))return {issues:[{level:'incomplete',message:'B300 dual-input cabling uses the shared power planner for physical input mapping and PDU capacity checks.'}],pdus,ready:false,watts:0,settings};
  const issue=(level:PowerIssue["level"],message:string,code?:PowerIssue["code"])=>issues.push({level,message,...(code?{code}:{})});
  const error=px3SettingsError(settings);
  if(error)return {issues:[{level:"incomplete",message:error}],pdus,ready:false,watts:0,settings};
  if(!settings.supplyConfirmed)issue("incomplete","Confirm independent A/B feeds, actual voltage, and upstream continuous current capacity.");
  const installed=equipment.filter(d=>d.category==="pdu").sort((a,b)=>(a.mounting==="rear-right"?0:1)-(b.mounting==="rear-right"?0:1)||a.id.localeCompare(b.id)), loads=equipment.filter(d=>d.category!=="pdu");
  if(installed.length!==2||installed.filter(d=>d.mounting==="rear-left").length!==1||installed.filter(d=>d.mounting==="rear-right").length!==1)issue("incomplete","Install one supported PDU on each rear rail: right A and left B.");
  for(const p of installed)if(!pduModelId(p.rawData))issue("incomplete",`${p.name}: this calculator only supports the verified PX3-4068YV-V2 profile.`);
  let watts=0;
  for(const d of loads){const b=settings.budgets[d.id];if(!b?.confirmed){issue("incomplete",`${d.name}: confirm its total AC budget, voltage/cord compatibility and full-load capability on either PSU group.`);continue;}if(!b.passive){watts+=deviceDemand(b,settings).watts;if(b.testOnly)issue("warning",`${d.name}: SYNTHETIC TEST assumptions; not a verified hardware plan.`);if(b.psuAcCapacity&&survivorCordDemand(b,settings).watts>b.psuAcCapacity+1e-9)issue("overload",`${d.name}: surviving PSU load exceeds its ${b.psuAcCapacity} W supported AC budget.`);}}
  const occupied=new Set<string>(),inlets=new Set<string>();
  for(const a of assignments){
    const key=`${a.pduId}:${a.outlet}`,inlet=`${a.deviceId}:${a.inlet}`;
    if(occupied.has(key))issue("incomplete",`Outlet ${a.outlet} has multiple assignments.`); occupied.add(key);
    if(!installed.some(p=>p.id===a.pduId)||!loads.some(d=>d.id===a.deviceId))issue("incomplete","A cable references equipment no longer installed in this rack.");
    const count=(settings.budgets[a.deviceId]?.psusPerFeed??1)*2;
    if(!Number.isInteger(a.inlet)||a.inlet<1||a.inlet>count)issue("incomplete",`Outlet ${a.outlet}: select PSU 1–${count}; legacy cables have no PSU identity.`);
    else if(inlets.has(inlet))issue("incomplete",`A device PSU is connected more than once (PSU ${a.inlet}).`);
    inlets.add(inlet);
  }
  for(const p of installed){
    const totals:PduTotals={id:p.id,name:p.name,side:p.mounting==="rear-left"?"B":"A",watts:0,kva:0,phases:[0,0,0],breakers:Array(15).fill(0),outlets:[],spread:0};
    for(const a of assignments.filter(a=>a.pduId===p.id)){
      const o=PX3_4068_OUTLETS.find(o=>o.n===a.outlet), d=loads.find(d=>d.id===a.deviceId), b=settings.budgets[a.deviceId];
      if(!o){issue("incomplete",`${p.name}: outlet ${a.outlet} does not exist.`);continue;}
      if(!d||!b?.confirmed)continue;
      if((b.psusPerFeed??1)>1){const n=b.psusPerFeed!;if((p.mounting==="rear-right"&&a.inlet>n)||(p.mounting==="rear-left"&&a.inlet<=n))issue("incomplete",`${d.name}: PSU ${a.inlet} is on the wrong feed for its configured group.`);}
      if(b.passive){issue("incomplete",`${d.name}: passive equipment has a power cable.`);continue;}
      if(b.connector!==o.type)issue("incomplete",`${p.name} outlet ${o.n}: ${o.type} does not match ${d.name}'s ${b.connector} cord.`);
      if(settings.reserveDedicated&&o.cb<=3)issue("overload",`${p.name} outlet ${o.n}: dedicated breaker reserved for facility use.`);
      // This is the survivor-PDU envelope, not a claim of equal normal sharing.
      const demand=survivorCordDemand(b,settings),amps=demand.amps;
      totals.watts+=demand.watts;totals.kva+=demand.va/1000;totals.phases[Number(o.phase.slice(1))-1]+=amps;totals.breakers[o.cb-1]+=amps;
      totals.outlets.push({...a,n:o.n,watts:demand.watts,amps});
      const limit=Math.min(PX3_4068_POWER.outletAmps[o.type],b.cordAmps??PX3_4068_POWER.outletAmps[o.type]);
      if(amps>limit+1e-9)issue("overload",`${p.name} outlet ${o.n}: ${amps.toFixed(2)} A exceeds ${limit} A.`);
    }
    totals.breakers.forEach((amps,i)=>{if(amps>PX3_4068_POWER.breakerAmps+1e-9)issue("overload",`${p.name} CB${i+1}: ${amps.toFixed(2)} A exceeds 20 A.`);});
    totals.phases.forEach((amps,i)=>{if(amps>settings.inputLimit+1e-9)issue("overload",`${p.name} L${i+1}: ${amps.toFixed(2)} A exceeds ${settings.inputLimit} A.`);});
    totals.spread=Math.max(...totals.phases)-Math.min(...totals.phases);
    if(totals.spread>3)issue("warning",`${p.name}: phase spread ${totals.spread.toFixed(2)} A exceeds the 3 A planning target.`);
    pdus.push(totals);
  }
  for(const d of loads){if(!settings.budgets[d.id]?.confirmed||settings.budgets[d.id].passive)continue;
    const cables=assignments.filter(a=>a.deviceId===d.id);
    const n=settings.budgets[d.id].psusPerFeed??1;
    if(cables.length!==n*2||pdus.some(p=>cables.filter(a=>a.pduId===p.id).length!==n))issue("incomplete",`${d.name}: connect ${n} PSU(s) to each feed (${n*2} total) for full-load failover.`,"missing-cables");
  }
  return {issues,pdus,ready:!issues.some(i=>i.level!=="warning"),watts,settings};
}

// Deterministic largest-load-first heuristic. Existing cables are retained as
// anchors by default. Candidates are checked against each survivor-PDU limit.
// Failure is explicit; this does not claim a globally optimal bin packing.
export function balancePx3(equipment:PowerEquipment[],settings:Px3Settings,existing=savedPowerAssignments(equipment)):{assignments:PowerAssignment[];analysis:PowerAnalysis;error?:string} {
  const assignments=existing.filter(a=>a.locked).map(a=>({...a}));
  const preflight=analyzePx3(equipment,settings,assignments);
  const fatal=preflight.issues.filter(i=>i.level!=="warning"&&i.code!=="missing-cables");
  if(fatal.length)return {assignments,analysis:preflight,error:fatal[0].message};
  const devices=equipment.filter(d=>d.category!=="pdu"&&!settings.budgets[d.id]?.passive).sort((a,b)=>survivorCordDemand(settings.budgets[b.id],settings).amps-survivorCordDemand(settings.budgets[a.id],settings).amps||a.id.localeCompare(b.id));
  for(const d of devices){
    const b=settings.budgets[d.id],used=new Set(assignments.filter(a=>a.deviceId===d.id).map(a=>a.inlet));
    for(const pdu of preflight.pdus){
      const n=b.psusPerFeed??1;
      const needed=n-assignments.filter(a=>a.pduId===pdu.id&&a.deviceId===d.id).length;
      for(let cord=0;cord<needed;cord++){
      const allowed=n===1?[1,2]:Array.from({length:n},(_,i)=>i+1+(pdu.side==="B"?n:0));
      const inlet=allowed.find(i=>!used.has(i));
      if(!inlet)return {assignments,analysis:preflight,error:`No unused PSU in the configured ${pdu.side} group for ${d.name}.`};
      let best:PowerAssignment|undefined,score=Infinity;
      for(const o of PX3_4068_OUTLETS){
        if(o.type!==b.connector||(settings.reserveDedicated&&o.cb<=3)||assignments.some(a=>a.pduId===pdu.id&&a.outlet===o.n))continue;
        const candidate={pduId:pdu.id,outlet:o.n,deviceId:d.id,inlet,locked:false};
        const trial=analyzePx3(equipment,settings,[...assignments,candidate]);
        if(trial.issues.some(i=>i.level==="overload"))continue;
        const totals=trial.pdus.find(p=>p.id===pdu.id)!;
        const value=Math.max(...totals.phases)*10000+totals.phases.reduce((n,v)=>n+v*v,0)*10+Math.max(...totals.breakers)*10+totals.breakers.reduce((n,v)=>n+v*v,0)+o.n/10000;
        if(value<score){score=value;best=candidate;}
      }
      if(!best)return {assignments,analysis:analyzePx3(equipment,settings,assignments),error:`No valid ${b.connector} outlet found for ${d.name} on ${pdu.side}. Review budgets, locked cables, or available capacity.`};
      assignments.push(best);used.add(inlet);
      }
    }
  }
  const analysis=analyzePx3(equipment,settings,assignments);
  return {assignments,analysis,...(!analysis.ready?{error:"The proposed cabling is incomplete or exceeds a limit."}:{})};
}

export function powerRevision(equipment:PowerEquipment[],settings:Px3Settings){
  // Stable serialized snapshot, compared on the server under the rack lock.
  function canonical(value:unknown):unknown {
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
    return value;
  }
  return JSON.stringify(canonical({settings,equipment:equipment.map(d=>({id:d.id,mounting:d.mounting,model:d.model,details:d.details})).sort((a,b)=>a.id.localeCompare(b.id))}));
}
