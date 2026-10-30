"use server";
import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/prisma';
import {catalogInputError,mergeSystemSpecs,type CatalogInput} from '@/lib/system-specs';
import {catalogRevision} from '@/lib/catalog-revision';
import {networkShape} from '@/lib/network-ports';

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
        const mapped=await tx.connection.findFirst({where:{fromPort:{not:null},OR:[{fromDevice:{catalogDeviceId:id!}},{toDevice:{catalogDeviceId:id!}}]}});
        if(mapped)return {ok:false as const,error:'This configuration has mapped network cables. Remove those cables before changing port counts, protocol, speed or connectors, or duplicate the configuration.'};
      }
      const data={sku:input.sku.trim(),vendor:input.vendor.trim(),model:input.model.trim(),heightRU:input.heightRU,category:input.category,rawData:JSON.parse(JSON.stringify(mergeSystemSpecs(previous?.rawData,input.specs)))};
      const saved=previous?await tx.catalogDevice.update({where:{id:previous.id},data}):await tx.catalogDevice.create({data});
      return {ok:true as const,id:saved.id};
    });
    if(result.ok){revalidatePath('/equipment');revalidatePath(`/equipment/${result.id}`);revalidatePath('/projects','layout');}
    return result;
  }catch(error){return {ok:false,error:error&&typeof error==='object'&&'code' in error&&error.code==='P2002'?'This SKU already exists. Choose a unique SKU for this configuration.':'Could not save equipment. Your entries are still here; try again.'};}
}
