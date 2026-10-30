'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { rackMutation } from '@/lib/rack-mutation';
import { networkPorts } from '@/lib/network-ports';
import { planCablingPattern, patternState, type PatternOptions } from '@/lib/cabling-pattern';

export async function applyCablingPattern(rackId:string,options:PatternOptions,revision:string,reviewed:boolean):Promise<{ok:true;count:number}|{ok:false;error:string}>{
 if(!options||typeof options.sourceId!=='string'||!Array.isArray(options.targetIds)||options.targetIds.length>256||options.targetIds.some(id=>typeof id!=='string'||id.length>100)||typeof options.labelTemplate!=='string'||typeof revision!=='string'||typeof reviewed!=='boolean')return {ok:false,error:'Invalid pattern. Reload and try again.'};
 try{
  const result=await rackMutation(rackId,async tx=>{
   const rack=await tx.rack.findUnique({where:{id:rackId},select:{projectId:true}});if(!rack)return {error:'Rack not found.'};
   let installed=await tx.deviceInstance.findMany({where:{rackId},include:{catalogDevice:true}});
   for(const id of [...new Set(installed.map(d=>d.catalogDeviceId))].sort())await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${id}`}, 0))::text`;
   installed=await tx.deviceInstance.findMany({where:{rackId},include:{catalogDevice:true}});
   const devices=installed.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,startRU:d.startRU,category:d.catalogDevice.category,catalogId:d.catalogDeviceId,ports:networkPorts(d.catalogDevice.rawData)}));
   const cables=await tx.connection.findMany({where:{fromDevice:{rackId},OR:[{toDevice:{rackId}},{toDeviceId:null}],NOT:{cableType:'Power'}},select:{id:true,fromDeviceId:true,toDeviceId:true,fromPort:true,toPort:true,cableType:true,label:true,external:true,lengthValue:true,lengthUnit:true}});
   // Include null cable types, too: they still reserve endpoints.
   const unmapped=await tx.connection.findMany({where:{fromDevice:{rackId},OR:[{toDevice:{rackId}},{toDeviceId:null}],cableType:null},select:{id:true,fromDeviceId:true,toDeviceId:true,fromPort:true,toPort:true,cableType:true,label:true,external:true,lengthValue:true,lengthUnit:true}});
   cables.push(...unmapped);
   if(createHash('sha256').update(patternState(devices,cables)).digest('hex')!==revision)return {error:'The rack or its cabling changed. Reload and review a fresh preview before applying.'};
   const plan=planCablingPattern(devices,cables,options);
   if(plan.errors.length)return {error:plan.errors.join(' ')};
   if(plan.rows.some(r=>r.state==='conflict'))return {error:'Resolve the highlighted port conflicts before applying.'};
   if(plan.rows.some(r=>r.state==='add'&&r.warnings.length)&&!reviewed)return {error:'Review and acknowledge the compatibility warnings.'};
   const data=plan.rows.flatMap(r=>r.state==='add'&&r.data?[r.data]:[]);
   if(!data.length)return {error:'No new connections to add.'};
   await tx.connection.createMany({data});
   return {projectId:rack.projectId,count:data.length};
  });
  if('error' in result)return {ok:false,error:result.error!};
  const path=`/projects/${result.projectId}/racks/${rackId}`;revalidatePath(path);revalidatePath(path+'/connections');
  return {ok:true,count:result.count};
 }catch{return {ok:false,error:'Could not apply the cabling pattern. Nothing was saved; reload and try again.'};}
}
