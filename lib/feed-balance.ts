import {isMeasuredPower} from './power-consumption.ts';
import {B300_INPUT_IDENTITY} from './b300-power-inputs.ts';
import {analyzeFeeds,outletVoltage,supplyDemand,siteVerificationIssues,singlePsuIssue,type Cord,type Supply,type Load} from './feed-power.ts';
import {feedRack,type FeedEquipment} from './feed-rack.ts';
import type {FeedInputs} from './feed-power.ts';
import {readDetails} from './equipment-details.ts';
import {policyAllows,equipmentRU} from './power-cable-policy.ts';

export function feedRevision(equipment:FeedEquipment[],inputs:FeedInputs){return JSON.stringify({equipment,inputs});}
type FeedCounts={A:number;B:number};
export type PowerAssignmentDecision=Cord&{feed:'A'|'B';reason:string;skippedOutlet?:number};
const compareScore=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>1e-9)return a[i]-b[i];return 0;};

// Rack order organizes work; the shared electrical model decides which outlets
// fit. Saved constraints are retained throughout. This remains a greedy planner.
export function balanceFeeds(equipment:FeedEquipment[],inputs:FeedInputs,options:{planning?:boolean}={}){
 const {supplies,loads,cords}=feedRack(equipment,inputs);
 const baseline=analyzeFeeds(supplies,loads,cords,inputs.headroomPercent);
 const devices=new Map(equipment.map(e=>[e.id,e])),loadById=new Map(loads.map(l=>[l.id,l])),supplyById=new Map(supplies.map(p=>[p.id,p]));
 const outlets=new Map(supplies.map(p=>[p.id,new Map(p.outlets.map(o=>[o.n,o]))]));
 const pending=new Set<string>();
 if(options.planning)for(const issue of siteVerificationIssues(supplies))pending.add(issue);
 if(options.planning)for(const load of loads){
  if(load.cords===1)pending.add(singlePsuIssue(load));
  if(!load.connector)pending.add(`${load.name}: cable compatibility is pending; outlet-only planning.`);
  if(load.assessment==='pdu-capacity'&&!load.cordLimitAmps)pending.add(`${load.name}: verify usable input cord current.`);
  if(load.pfEstimateSource||load.estimateSource&&!isMeasuredPower(load))pending.add(`${load.name}: power estimate uses unverified efficiency, power factor and load assumptions.`);
  if(!load.minVoltage||!load.maxVoltage)pending.add(`${load.name}: verify the PSU voltage range.`);
  if(load.assessment!=='pdu-capacity'&&(!load.psuAcCapacity||!load.cordLimitAmps))pending.add(`${load.name}: verify supported AC load per PSU and usable cord current.`);
 }
 const decisions:PowerAssignmentDecision[]=[];
 const fail=(error:string)=>({error,assignments:cords,analysis:baseline,pendingChecks:[...pending],decisions:[] as PowerAssignmentDecision[],deviations:[] as PowerAssignmentDecision[]});
 if(loads.some(l=>!Number.isInteger(l.cords)||l.cords<1||l.cords>(l.assessment==='pdu-capacity'?12:6)||!Number.isInteger(l.minimumCords)||l.minimumCords<1||l.minimumCords>l.cords))return fail('Enter a supported PSU arrangement with 1–6 cords and a valid minimum surviving PSU count.');
 const blocking=baseline.issues.filter(i=>!i.includes('power cords are connected.')&&!pending.has(i));
 if(blocking.length)return fail(`${blocking.length} electrical or configuration issues must be resolved before calculating cables. Review the missing-information list below.`);
 let assignments:Cord[]=cords.filter(c=>readDetails(devices.get(c.pduId)?.details).outlets[c.outlet]?.locked!==false);
 for(const c of assignments){
  const p=supplyById.get(c.pduId),o=p?.outlets.find(o=>o.n===c.outlet),e=devices.get(c.deviceId);
  if(o&&!policyAllows(inputs.cablePolicy,e?.category,o))return fail(`${e?.name}: fixed cable at ${p?.name} P${c.outlet} conflicts with the saved cable policy. Review or unlock it before recalculating.`);
 }
 const feedCounts=(load:Load,rows:Cord[])=>({A:rows.filter(c=>c.deviceId===load.id&&supplyById.get(c.pduId)?.feed==='A').length,B:rows.filter(c=>c.deviceId===load.id&&supplyById.get(c.pduId)?.feed==='B').length});
 function distributions(load:Load){
  const fixed=feedCounts(load,assignments),minimum=load.cords===1?0:load.assessment==='pdu-capacity'?Math.floor(load.cords/2):load.minimumCords;
  return Array.from({length:load.cords+1},(_,A)=>({A,B:load.cords-A})).filter(c=>c.A>=minimum&&c.B>=minimum&&c.A>=fixed.A&&c.B>=fixed.B).sort((a,b)=>Math.abs(a.A-a.B)-Math.abs(b.A-b.B)||b.A-a.A);
 }
 const targets=new Map<string,FeedCounts>();
 for(const load of loads){const target=distributions(load)[0];if(!target)return fail(`${load.name}: PSU arrangement or fixed cables cannot survive either feed loss.`);targets.set(load.id,target);}
 const supplyOrder=[...supplies].sort((a,b)=>a.feed.localeCompare(b.feed)||a.name.localeCompare(b.name,'en',{numeric:true})||a.id.localeCompare(b.id));
 const pduRank=new Map(supplyOrder.map((p,i)=>[p.id,i]));
 const orderedLoads=[...loads].sort((a,b)=>equipmentRU(devices.get(a.id)!)-equipmentRU(devices.get(b.id)!)||a.id.localeCompare(b.id));
 function endpointProblem(load:Load,p:Supply,o:Supply['outlets'][number]){
  if(o.reserved)return 'reserved outlet';
  if(!policyAllows(inputs.cablePolicy,devices.get(load.id)?.category,o))return 'excluded by the saved cable policy';
  if(load.connector?!o.connectors.includes(load.connector):!options.planning||!o.connectors.some(c=>c==='C13'||c==='C19'))return 'incompatible receptacle type';
  const voltage=outletVoltage(p,o);
  if(voltage<load.minVoltage!||voltage>load.maxVoltage!)return 'voltage outside the equipment input range';
 }
 // Project normal and both feed-loss cases with final per-feed cord counts,
 // including known fixed loads. Odd-PSU systems share demand within each feed.
 function projected(rows:Cord[],counts:Map<string,FeedCounts>){
  let peak=0,phaseSquares=0,branchSquares=0;
  for(const lost of [null,'A','B'] as const){
   const items=new Map<string,{outlet:Supply['outlets'][number];watts:number;pf:number}[]>();
   for(const c of rows){
    const p=supplyById.get(c.pduId)!,load=loadById.get(c.deviceId)!;
    if(p.feed===lost)continue;
    const denominator=lost?counts.get(load.id)![p.feed]:load.cords;
    if(!denominator)return {error:`${load.name}: no surviving input in this feed scenario.`,score:[]};
    const watts=Number(load.watts)*(1+inputs.headroomPercent/100)/denominator,o=outlets.get(p.id)!.get(c.outlet)!;
    const amps=watts/Number(load.pf)/outletVoltage(p,o);
    if(load.assessment!=='pdu-capacity'&&load.psuAcCapacity&&watts>load.psuAcCapacity)return {error:`${load.name}: surviving PSU AC capacity exceeded.`,score:[]};
    if(amps>Math.min(o.limitAmps!,load.cordLimitAmps??Infinity)+1e-9)return {error:`${p.name} P${o.n}: outlet or cord current exceeded.`,score:[]};
    const entries=items.get(p.id)||[];entries.push({outlet:o,watts,pf:Number(load.pf)});items.set(p.id,entries);
   }
   for(const p of supplies){
    const d=supplyDemand(p,items.get(p.id)||[]);
    if(d.amps>p.limitAmps+1e-9)return {error:`${p.name}: ${lost?`feed ${lost} loss`:'normal'} line capacity exceeded.`,score:[]};
    if(p.neutralLimitAmps&&d.neutralAmps>p.neutralLimitAmps+1e-9)return {error:`${p.name}: neutral current capacity exceeded.`,score:[]};
    for(const [b,a] of Object.entries(d.branches)){if(a>p.branches![b]+1e-9)return {error:`${p.name}: branch ${b} capacity exceeded.`,score:[]};branchSquares+=(a/p.branches![b])**2;}
    for(const a of d.phases){peak=Math.max(peak,a/p.limitAmps);phaseSquares+=(a/p.limitAmps)**2;}
   }
  }
  return {score:[peak,phaseSquares,branchSquares]};
 }
 for(const load of orderedLoads){
  if(assignments.filter(c=>c.deviceId===load.id).length===load.cords)continue;
  let best:{rows:Cord[];counts:FeedCounts;decisions:PowerAssignmentDecision[];score:number[]}|undefined,lastFailure='No compatible receptacle fits the planned limits.';
  for(const distribution of distributions(load)){
   const counts=new Map(targets);counts.set(load.id,distribution);
   const rows=[...assignments],trialDecisions:PowerAssignmentDecision[]=[];
   const used=new Set(rows.map(c=>`${c.pduId}:${c.outlet}`));let failed=false;
   for(let inlet=1;inlet<=load.cords;inlet++){
    if(rows.some(c=>c.deviceId===load.id&&c.inlet===inlet))continue;
    const assigned=feedCounts(load,rows),preferred=assigned.A<=assigned.B?'A':'B';
    const candidates=supplyOrder.filter(p=>assigned[p.feed]<distribution[p.feed]).flatMap(p=>{
     // Electrically identical free outlets have the same score. Evaluate only
     // the lowest number in each group, preserving the sequential tie-break.
     const groups=new Set<string>();
     return [...p.outlets].sort((a,b)=>a.n-b.n).flatMap(o=>{
     if(used.has(`${p.id}:${o.n}`)||endpointProblem(load,p,o))return [];
     const group=JSON.stringify([o.phase||'L1',o.branch,o.limitAmps]);
     if(groups.has(group))return [];groups.add(group);
     const cord:Cord={pduId:p.id,outlet:o.n,deviceId:load.id,inlet,...(load.assessment==='pdu-capacity'?{inputIdentity:B300_INPUT_IDENTITY}:{})};
     const check=projected([...rows,cord],counts);if(check.error){lastFailure=check.error;return [];}
     return [{p,o,cord,score:check.score}];
    });}).sort((a,b)=>compareScore(a.score,b.score)||(a.p.feed===preferred?0:1)-(b.p.feed===preferred?0:1)||a.o.n-b.o.n||pduRank.get(a.p.id)!-pduRank.get(b.p.id)!);
    const choice=candidates[0];if(!choice){failed=true;break;}
    const first=[...choice.p.outlets].sort((a,b)=>a.n-b.n).find(o=>!used.has(`${choice.p.id}:${o.n}`))!;
    let reason=`Feed ${choice.p.feed}; ${distribution.A} input${distribution.A===1?'':'s'} on A and ${distribution.B} on B. Normal and feed-loss capacity checked.`;
    if(load.cords===1)reason=`Best available calculated connection on feed ${choice.p.feed}. Independent A/B redundancy is unavailable through this PSU alone.`;
    if(first.n!==choice.o.n){
     const problem=endpointProblem(load,choice.p,first)||projected([...rows,{...choice.cord,outlet:first.n}],counts).error;
     reason=`P${first.n} skipped: ${problem||'another receptacle gives better PDU, phase or branch balance'}. P${choice.o.n} selected. ${reason}`;
    }
    trialDecisions.push({...choice.cord,feed:choice.p.feed,reason,...(first.n!==choice.o.n?{skippedOutlet:first.n}:{})});
    rows.push(choice.cord);used.add(`${choice.p.id}:${choice.o.n}`);
   }
   if(failed)continue;
   const check=projected(rows,counts);if(check.error){lastFailure=check.error;continue;}
   if(!best||compareScore(check.score,best.score)<0)best={rows,counts:distribution,decisions:trialDecisions,score:check.score};
  }
  if(!best)return fail(`${load.name}: no compatible outlet arrangement fits capacity and redundancy requirements. ${lastFailure} Review fixed cables or capacity.`);
  assignments=best.rows;targets.set(load.id,best.counts);decisions.push(...best.decisions);
 }
 const rank=new Map(orderedLoads.map((l,i)=>[l.id,i]));assignments.sort((a,b)=>rank.get(a.deviceId)!-rank.get(b.deviceId)!||a.inlet-b.inlet);
 const analysis=analyzeFeeds(supplies,loads,assignments,inputs.headroomPercent);
 const passes=analysis.issues.every(i=>pending.has(i))&&analysis.scenarios.every(s=>s.errors.length===0);
 return {assignments,analysis,pendingChecks:[...pending],decisions,deviations:decisions.filter(d=>d.skippedOutlet!==undefined),...(!passes?{error:'The proposed plan fails feed-loss checks. Review fixed cables and capacity; no changes can be saved.'}:{})};
}
