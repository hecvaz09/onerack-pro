"use server";
import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/prisma';
import {catalogInputError,mergeSystemSpecs,type CatalogInput} from '@/lib/system-specs';
import {catalogRevision} from '@/lib/catalog-revision';
import {networkShape} from '@/lib/network-ports';
import {mappedNetworkChangeError} from '@/lib/network-library-update';
import {synchronizeLibraryArtwork} from '@/lib/library-reference-maintenance';
import {onboardingMetadata} from '@/lib/library-onboarding';
import {duplicateCatalogRaw,type CatalogCopySource} from '@/lib/catalog-duplicate';
import {catalogBaseSku} from '@/lib/catalog-identity';

export async function saveCatalogEquipment(id:string|null,revision:string,input:CatalogInput,copy?:CatalogCopySource):Promise<{ok:true;id:string}|{ok:false;error:string}>{
  const error=catalogInputError(input);if(error)return {ok:false,error};
  if(copy&&(id||typeof copy.id!=='string'||!copy.id.trim()||copy.id.length>200||typeof copy.revision!=='string'||!/^[a-f0-9]{64}$/.test(copy.revision)))return {ok:false,error:'Reload the source equipment before duplicating it.'};
  try{
    const result=await prisma.$transaction(async tx=>{
      const lockedId=id||copy?.id;
      if(lockedId)await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${lockedId}`}, 0))::text`;
      const previous=id?await tx.catalogDevice.findUnique({where:{id}}):null;
      const source=copy?await tx.catalogDevice.findUnique({where:{id:copy.id}}):null;
      if(copy&&!source)return {ok:false as const,error:'The source equipment no longer exists. Reload the Library before duplicating it.'};
      if(copy&&source&&catalogRevision(source)!==copy.revision)return {ok:false as const,error:'The source equipment was edited elsewhere. Reload it before duplicating the configuration.'};
      if(source&&(source.vendor.trim()!==input.vendor.trim()||source.model.trim()!==input.model.trim()||source.category!==input.category||source.heightRU!==input.heightRU))return {ok:false as const,error:'A duplicate retains its source hardware model and footprint. Keep those fields and change the configuration SKU or components; use Add equipment for a different hardware model.'};
      if(id&&!previous)return {ok:false as const,error:'Equipment no longer exists.'};
      if(previous&&catalogRevision(previous)!==revision)return {ok:false as const,error:'This equipment was edited elsewhere. Reload before saving to avoid overwriting those changes.'};
      if(previous&&catalogBaseSku('',previous.rawData)&&(previous.vendor.trim()!==input.vendor.trim()||previous.model.trim()!==input.model.trim()))return {ok:false as const,error:'This configuration inherits its source hardware model. Change the configuration SKU or components; use Add equipment for a different hardware model.'};
      if(previous&&(previous.heightRU!==input.heightRU||previous.category!==input.category))return {ok:false as const,error:'Existing placements must keep their footprint. Use Add equipment for a different rack height or equipment type.'};
      if(previous&&networkShape(previous.rawData)!==networkShape({systemSpecs:input.specs})){
        const mapped=await tx.connection.findMany({where:{OR:[{fromDevice:{catalogDeviceId:id!}},{toDevice:{catalogDeviceId:id!}}]},include:{fromDevice:{include:{catalogDevice:true}},toDevice:{include:{catalogDevice:true}}}});
        if(mapped.length){
          const connectionError=mappedNetworkChangeError(id!,previous.rawData,{systemSpecs:input.specs},mapped);
          if(connectionError)return {ok:false as const,error:connectionError};
        }
      }
      const raw=synchronizeLibraryArtwork(input.sku.trim(),mergeSystemSpecs(source?duplicateCatalogRaw(source):previous?.rawData,input.specs));
      const data={sku:input.sku.trim(),vendor:input.vendor.trim(),model:input.model.trim(),heightRU:input.heightRU,category:input.category,rawData:JSON.parse(JSON.stringify({...raw,libraryOnboarding:onboardingMetadata(input,raw)}))};
      const saved=previous?await tx.catalogDevice.update({where:{id:previous.id},data}):await tx.catalogDevice.create({data});
      return {ok:true as const,id:saved.id};
    },{isolationLevel:'Serializable'});
    if(result.ok){revalidatePath('/equipment');revalidatePath(`/equipment/${result.id}`);revalidatePath('/projects','layout');}
    return result;
  }catch(error){return {ok:false,error:error&&typeof error==='object'&&'code' in error&&error.code==='P2002'?'This SKU already exists. Choose a unique SKU for this configuration.':'Could not save equipment. Your entries are still here; try again.'};}
}
