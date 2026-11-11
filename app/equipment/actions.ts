"use server";
import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/prisma';
import {catalogInputError,mergeSystemSpecs,type CatalogInput} from '@/lib/system-specs';
import {catalogRevision} from '@/lib/catalog-revision';
import {networkShape} from '@/lib/network-ports';
import {isNetworkEnrichment,enrichmentConnectionError} from '@/lib/network-library-update';

export async function saveCatalogEquipment(id:string|null,revision:string,input:CatalogInput):Promise<{ok:true;id:string}|{ok:false;error:string}>{
  const error=catalogInputError(input);if(error)return {ok:false,error};
  try{
    const result=await prisma.$transaction(async tx=>{
      if(id)await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${id}`}, 0))::text`;
      const previous=id?await tx.catalogDevice.findUnique({where:{id}}):null;
      if(id&&!previous)return {ok:false as const,error:'Equipment no longer exists.'};
      if(previous&&catalogRevision(previous)!==revision)return {ok:false as const,error:'This equipment was edited elsewhere. Reload before saving to avoid overwriting those changes.'};
      if(previous&&(previous.heightRU!==input.heightRU||previous.category!==input.category))return {ok:false as const,error:'Duplicate this configuration to change its rack height or category. Existing placements must keep their footprint.'};
      if(previous&&networkShape(previous.rawData)!==networkShape({systemSpecs:input.specs})){
        const mapped=await tx.connection.findMany({where:{OR:[{fromDevice:{catalogDeviceId:id!}},{toDevice:{catalogDeviceId:id!}}]},include:{fromDevice:{include:{catalogDevice:true}},toDevice:{include:{catalogDevice:true}}}});
        if(mapped.length){
          if(!isNetworkEnrichment(previous.rawData,{systemSpecs:input.specs}))return {ok:false as const,error:'This configuration has mapped network cables. Existing port identities and known capabilities must be preserved. Duplicate the configuration to change them.'};
          const connectionError=enrichmentConnectionError(id!,{systemSpecs:input.specs},mapped);
          if(connectionError)return {ok:false as const,error:connectionError};
        }
      }
      const data={sku:input.sku.trim(),vendor:input.vendor.trim(),model:input.model.trim(),heightRU:input.heightRU,category:input.category,rawData:JSON.parse(JSON.stringify(mergeSystemSpecs(previous?.rawData,input.specs)))};
      const saved=previous?await tx.catalogDevice.update({where:{id:previous.id},data}):await tx.catalogDevice.create({data});
      return {ok:true as const,id:saved.id};
    },{isolationLevel:'Serializable'});
    if(result.ok){revalidatePath('/equipment');revalidatePath(`/equipment/${result.id}`);revalidatePath('/projects','layout');}
    return result;
  }catch(error){return {ok:false,error:error&&typeof error==='object'&&'code' in error&&error.code==='P2002'?'This SKU already exists. Choose a unique SKU for this configuration.':'Could not save equipment. Your entries are still here; try again.'};}
}
