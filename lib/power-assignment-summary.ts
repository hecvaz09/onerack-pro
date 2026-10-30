import type {analyzeFeeds,Cord,Load,Supply} from './feed-power.ts';
import type {FeedEquipment} from './feed-rack.ts';

// Presentation only. Match existing engine diagnostics; never change its verdict.
export function powerAssignmentSummary(equipment:FeedEquipment[],supplies:Supply[],loads:Load[],cords:Cord[],analysis:ReturnType<typeof analyzeFeeds>){
 const byId=new Map(loads.map(d=>[d.id,d])),seenOutlets=new Set<string>(),seenInlets=new Set<string>();
 const valid:Cord[]=[];
 for(const cord of cords){
  const load=byId.get(cord.deviceId),pdu=supplies.find(p=>p.id===cord.pduId);
  if(!load||!pdu?.outlets.some(o=>o.n===cord.outlet)||!Number.isInteger(cord.inlet)||cord.inlet<1||cord.inlet>load.cords)continue;
  const outlet=`${cord.pduId}:${cord.outlet}`,inlet=`${cord.deviceId}:${cord.inlet}`;
  if(seenOutlets.has(outlet)||seenInlets.has(inlet))continue;
  seenOutlets.add(outlet);seenInlets.add(inlet);valid.push(cord);
 }
 const nameUses=new Map<string,number>();for(const load of byId.values())nameUses.set(load.name,(nameUses.get(load.name)||0)+1);
 const missing:{id:string;name:string;startRU?:number;assigned:number;expected:number}[]=[],incompleteIssues=new Set<string>(),incompleteScenarios=new Set<string>();
 const backupFailures:{id:string;feed:'A'|'B';message:string}[]=[];
 for(const load of byId.values()){
  const assigned=valid.filter(c=>c.deviceId===load.id);
  const incomplete=Number.isInteger(load.cords)&&load.cords>0&&assigned.length<load.cords;
  if(incomplete){
   const device=equipment.find(e=>e.id===load.id);
   missing.push({id:load.id,name:device?.model||device?.name||load.name,startRU:device?.startRU,assigned:assigned.length,expected:load.cords});
   incompleteIssues.add(`${load.name}: not all ${load.cords} power cords are connected.`);
  }
  for(const scenario of analysis.scenarios){
   const surviving=assigned.filter(c=>supplies.find(p=>p.id===c.pduId)?.feed!==scenario.lost).length;
   const message=`${load.name}: ${surviving} surviving cords; needs at least ${load.minimumCords}.`;
   if(!scenario.errors.includes(message))continue;
   // No saved mapping cannot establish feed-loss behavior. A partial/complete saved
   // layout with a modeled feed-loss failure must remain a separate visible warning.
   if(incomplete&&nameUses.get(load.name)===1&&(!scenario.lost||assigned.length===0))incompleteScenarios.add(`${scenario.lost||'normal'}\n${message}`);
   else if(scenario.lost&&assigned.length>0)backupFailures.push({id:load.id,feed:scenario.lost,message});
  }
 }
 return {missing,incompleteIssues,incompleteScenarios,backupFailures};
}
export function scenarioDiagnostic(issue:string,lost:'A'|'B'|null,equipment:FeedEquipment[]){
 const context=lost?`Feed ${lost} lost`:'Normal operation';
 const device=[...equipment].sort((a,b)=>b.name.length-a.name.length).find(e=>issue.startsWith(e.name+':'));
 return device?`${device.name}: ${context} · ${issue.slice(device.name.length+1).trim()}`:`${context}: ${issue}`;
}
