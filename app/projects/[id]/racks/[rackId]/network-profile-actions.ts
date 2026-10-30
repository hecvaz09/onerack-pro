"use server";
import {revalidatePath} from 'next/cache';
import {rackMutation} from '@/lib/rack-mutation';
import {readNetworkProfiles,SMC_CX8_IB_PROFILE} from '@/lib/network-profiles';

export async function saveNetworkProfile(rackId:string,deviceId:string,enabled:boolean){
  if(typeof enabled!=='boolean')return {ok:false,error:'Invalid profile selection.'};
  try{
    const result=await rackMutation(rackId,async tx=>{
      const rack=await tx.rack.findUnique({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
      const device=rack?.devices.find(d=>d.id===deviceId);
      if(!rack||!device||device.catalogDevice.heightRU!==8||device.catalogDevice.category!=='chassis')return {error:'Choose an installed 8U chassis in this rack.'};
      const profiles=readNetworkProfiles(rack.configuration);
      if(enabled)profiles[deviceId]=SMC_CX8_IB_PROFILE.id;else delete profiles[deviceId];
      await tx.rack.update({where:{id:rackId},data:{configuration:JSON.parse(JSON.stringify({...rack.configuration as Record<string,unknown>,networkProfiles:profiles}))}});
      return {projectId:rack.projectId};
    });
    if('error' in result)return {ok:false,error:result.error};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    return {ok:true};
  }catch{return {ok:false,error:'Could not save the network profile. Try again.'};}
}
