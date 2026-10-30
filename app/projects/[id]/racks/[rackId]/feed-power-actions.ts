'use server';
import {draftPowerPlan} from '@/lib/draft-power-plan';
import {balanceFeeds,feedRevision} from '@/lib/feed-balance';
import {readFeedInputs} from '@/lib/feed-rack';
import {readOutlets,readDetails} from '@/lib/equipment-details';
import {revalidatePath} from 'next/cache';
import {rackMutation} from '@/lib/rack-mutation';
import {feedInputsError,type FeedInputs} from '@/lib/feed-power';
import {matchesPowerInputsRevision,powerInputsRevision,lockedPowerInputRack} from '@/lib/power-input-revision';
import {POWER_INPUT_CONFLICT,type PowerSaveResult} from '@/lib/power-input-state';
export async function saveFeedInputs(rackId:string,inputs:FeedInputs,expectedRevision?:unknown):Promise<PowerSaveResult<FeedInputs>>{
  const error=feedInputsError(inputs);if(error)return {error};
  try{
    const result=await rackMutation(rackId,async tx=>{
      const rack=await lockedPowerInputRack(tx,rackId);
      if(!rack)return {error:'Rack not found.',conflict:false as const};
      if(!matchesPowerInputsRevision(expectedRevision,rackId,rack))return {error:POWER_INPUT_CONFLICT,conflict:true as const};
      const budgets=Object.fromEntries(Object.entries(inputs.budgets).filter(([id])=>rack.devices.some(d=>d.id===id)));
      const supplies=Object.fromEntries(Object.entries(inputs.supplies||{}).filter(([id])=>rack.devices.some(d=>d.id===id&&d.catalogDevice.category==='pdu')));
      for(const [id,p] of Object.entries(supplies)){
       const raw=rack.devices.find(d=>d.id===id)!.catalogDevice.rawData as Record<string,unknown>;
       const profile=raw?.electricalProfile as {outlets?:{n:number}[]}|undefined;
       const numbers=new Set([...readOutlets(raw).map(o=>o.n),...(profile?.outlets||[]).map(o=>o.n)]);
       if(p.outlets.some(o=>!numbers.has(o.n))||p.outlets.length!==numbers.size)throw Error('Outlet map must match the installed PDU.');
      }
      await tx.rack.update({where:{id:rackId},data:{configuration:JSON.parse(JSON.stringify({...rack.configuration as object,feedPower:{...inputs,budgets,...(inputs.supplies?{supplies}:{})}}))}});
      const savedRack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
      return {projectId:rack.projectId,revision:powerInputsRevision(rackId,savedRack),saved:readFeedInputs(savedRack.configuration)};
    });
    if('error' in result)return {error:result.error||'Could not save power inputs.',conflict:result.conflict};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true,revision:result.revision,saved:result.saved};
  }catch{return {error:'Could not save power inputs.'};}
}

export async function applyFeedBalance(rackId:string,revision:string){
 try{
  const result=await rackMutation(rackId,async tx=>{
   const rack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true},orderBy:{startRU:'asc'}}}});
   const equipment=rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
   const inputs=readFeedInputs(rack.configuration,equipment);
   if(feedRevision(equipment,inputs)!==revision)return {error:'Rack data changed. Reload and calculate a fresh proposal.'};
   const plan=balanceFeeds(equipment,inputs);
   if(plan.error||!plan.analysis.ready)return {error:plan.error||'Plan is not ready.'};
   for(const pdu of equipment.filter(d=>d.category==='pdu')){
    const details=readDetails(pdu.details);
    for(const [n,a] of Object.entries(details.outlets))if(a.locked===false)delete details.outlets[n];
    for(const c of plan.assignments.filter(c=>c.pduId===pdu.id))if(!details.outlets[c.outlet]?.deviceId)details.outlets[c.outlet]={deviceId:c.deviceId,inlet:c.inlet,notes:'',locked:false};
    await tx.deviceInstance.update({where:{id:pdu.id},data:{details:JSON.parse(JSON.stringify({...pdu.details as object,...details}))}});
   }
   return {projectId:rack.projectId};
  });
  if('error' in result)return result;
  revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true};
 }catch{return {error:'Could not apply the proposal. No partial changes were saved.'};}
}

export async function saveDraftPowerPlan(rackId:string,revision:string):Promise<{error?:string;ok?:boolean}>{
 try{
  const result=await rackMutation(rackId,async tx=>{
   const rack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true},orderBy:{startRU:'asc'}}}});
   const equipment=rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
   const inputs=readFeedInputs(rack.configuration,equipment);
   if(feedRevision(equipment,inputs)!==revision)return {error:'Rack data changed. Reload and generate a fresh draft.'};
   const result=draftPowerPlan(equipment,inputs);
   if(!result.plan)return {error:result.error||'Could not prepare draft.'};
   await tx.rack.update({where:{id:rackId},data:{configuration:JSON.parse(JSON.stringify({...rack.configuration as object,powerDraft:result.plan}))}});
   return {projectId:rack.projectId};
  });
  if('error' in result)return result;
  revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true};
 }catch{return {error:'Could not save the draft. Installed wiring was not changed.'};}
}
