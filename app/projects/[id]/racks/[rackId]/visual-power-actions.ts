'use server';
import {isB300PowerDevice,B300_INPUT_IDENTITY} from '@/lib/b300-power-inputs';
import type {PowerSaveResult} from '@/lib/power-feed-progress';
import {revalidatePath} from 'next/cache';
import {rackMutation} from '@/lib/rack-mutation';
import {detailsObject,readDetails,withOutletAssignment} from '@/lib/equipment-details';
import {powerWiringGuide} from '@/lib/power-wiring-guide';
import {visualPowerBalance,canSaveVisualPowerDraft} from '@/lib/visual-power';
import {simplePowerPlan} from '@/lib/simple-power-plan';

export async function connectVisualPower(rackId:string,pduId:string,outlet:number,deviceId:string,inlet:number,draft=false):Promise<PowerSaveResult> {
 if(!rackId||!pduId||!deviceId||!Number.isInteger(outlet)||!Number.isInteger(inlet))return {error:'Invalid power endpoints.'};
 try {
  const result=await rackMutation(rackId,async tx=>{
   const rack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
   const equipment=rack.devices.map(d=>({id:d.id,name:d.label||d.catalogDevice.model,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
   const review=visualPowerBalance(equipment,rack.configuration,{pduId,outlet,deviceId,inlet});
   const guide=powerWiringGuide(equipment,rack.configuration,{deviceId,inlet},{pduId,outlet,deviceId,inlet});
   const draftAllowed=draft&&!!guide.recommendation&&!!guide.provisional&&canSaveVisualPowerDraft(review);
   if(guide.provisional&&!draft)return {error:'This recommendation has pending PSU documentation. Confirm it as a planning connection.'};
   if(!draftAllowed&&review.errors.length)return {error:review.errors.join(' ')};
   if(!draftAllowed&&guide.error)return {error:guide.error};
   const pdu=rack.devices.find(d=>d.id===pduId)!;
   const raw=detailsObject(pdu.details),outlets=detailsObject(raw.outlets),previous=readDetails(pdu.details).outlets[outlet];
   outlets[outlet]=withOutletAssignment(outlets[outlet],{deviceId,inlet,notes:[previous?.notes,draftAllowed?'Planning draft: PSU electrical verification pending.':''].filter(Boolean).join(' '),locked:true,...(isB300PowerDevice(equipment.find(e=>e.id===deviceId))?{inputIdentity:B300_INPUT_IDENTITY}:{})});
   const details=JSON.parse(JSON.stringify({...raw,outlets}));
   await tx.deviceInstance.update({where:{id:pduId},data:{details}});
   return {projectId:rack.projectId,pduId,details};
  });
  if('error' in result)return {error:result.error};
  revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
  return {ok:true,pduId:result.pduId,details:result.details};
 }catch{return {error:'Could not save this connection. Refresh and try again.'};}
}

export async function disconnectVisualPower(rackId:string,pduId:string,outlet:number,deviceId:string,inlet:number):Promise<PowerSaveResult>{
 try{
  const result=await rackMutation(rackId,async tx=>{
   const pdu=await tx.deviceInstance.findFirst({where:{id:pduId,rackId,catalogDevice:{category:'pdu'}},include:{rack:true}});
   if(!pdu)return {error:'PDU no longer exists in this rack.'};
   const a=readDetails(pdu.details).outlets[outlet];
   if(a?.deviceId!==deviceId||(a.inlet||0)!==inlet)return {error:'This connection changed. Refresh before clearing it.'};
   const raw=detailsObject(pdu.details),outlets=detailsObject(raw.outlets);
   delete outlets[outlet];
   const details=JSON.parse(JSON.stringify({...raw,outlets}));
   await tx.deviceInstance.update({where:{id:pduId},data:{details}});
   return {projectId:pdu.rack.projectId,pduId,details};
  });
  if('error' in result)return {error:result.error};
  revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true,pduId:result.pduId,details:result.details};
 }catch{return {error:'Could not clear this connection. Refresh and try again.'};}
}

export async function saveVisualPowerPlan(rackId:string,revision:string,planning:boolean){
 if(!rackId||typeof revision!=='string'||typeof planning!=='boolean')return {error:'Calculate and review the connections before saving.'};
 try{
  const result=await rackMutation(rackId,async tx=>{
   const rack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
   const equipment=rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
   const plan=simplePowerPlan(equipment,rack.configuration);
   if(plan.revision!==revision)return {error:'The rack changed. Calculate a fresh plan before saving.'};
   if(plan.error)return {error:plan.error};
   if(plan.planning&&!planning)return {error:'This plan has pending checks. Review it as a planning layout.'};
   const updates:{pduId:string;details:unknown}[]=[];
   for(const pdu of equipment.filter(e=>e.category==='pdu')){
    const added=plan.remaining.filter(c=>c.pduId===pdu.id);
    if(!added.length)continue;
    const raw=detailsObject(pdu.details),outlets=detailsObject(raw.outlets);
    for(const cord of added){
     const previous=readDetails(pdu.details).outlets[cord.outlet];
     if(previous?.deviceId)throw Error('Occupied outlet changed');
     outlets[cord.outlet]=withOutletAssignment(outlets[cord.outlet],{deviceId:cord.deviceId,inlet:cord.inlet,locked:true,notes:[previous?.notes,plan.planning?'Planning draft: electrical verification pending.':''].filter(Boolean).join(' '),...(cord.inputIdentity?{inputIdentity:cord.inputIdentity}:{})});
    }
    const details=JSON.parse(JSON.stringify({...raw,outlets}));
    await tx.deviceInstance.update({where:{id:pdu.id},data:{details}});updates.push({pduId:pdu.id,details});
   }
   return {projectId:rack.projectId,updates,count:plan.remaining.length,planning:plan.planning};
  });
  if('error' in result)return {error:result.error};
  revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
  return {ok:true as const,updates:result.updates,count:result.count,planning:result.planning};
 }catch{return {error:'Could not save the layout. No partial changes were saved.'};}
}
