'use server';
import {revalidatePath} from 'next/cache';
import {rackMutation} from '@/lib/rack-mutation';
export async function clearRackLayout(rackId:string,kind:'power'|'network'):Promise<{ok?:boolean;error?:string}>{
 if(typeof rackId!=='string'||!rackId||rackId.length>200||!['power','network'].includes(kind))return {error:'Choose a rack and layout.'};
 try{
  const projectId=await rackMutation(rackId,async tx=>{
   const rack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
   if(kind==='power'){
    for(const device of rack.devices.filter(d=>d.catalogDevice.category==='pdu')){
     const details=device.details&&typeof device.details==='object'&&!Array.isArray(device.details)?device.details:{};
     await tx.deviceInstance.update({where:{id:device.id},data:{details:{...details,outlets:{}}}});
    }
    const config=rack.configuration&&typeof rack.configuration==='object'&&!Array.isArray(rack.configuration)?{...rack.configuration}:{};
    delete config.powerDraft;
    await tx.rack.update({where:{id:rackId},data:{configuration:config}});
   }
   // Match the rack-history boundary so every cleared connection can be restored.
   await tx.connection.deleteMany({where:{fromDevice:{rackId},AND:[{OR:[{toDevice:{rackId}},{toDeviceId:null}]},kind==='power'?{cableType:'Power'}:{OR:[{cableType:{not:'Power'}},{cableType:null}]}]}});
   return rack.projectId;
  });
  revalidatePath(`/projects/${projectId}/racks/${rackId}`);
  revalidatePath(`/projects/${projectId}/racks/${rackId}/connections`);
  return {ok:true};
 }catch{return {error:'Could not clear the layout. No partial changes were saved.'};}
}
