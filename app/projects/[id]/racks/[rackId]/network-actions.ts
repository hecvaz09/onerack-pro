'use server';
import {validCableLength} from '@/lib/cable-length';
import {Prisma} from '@/generated/prisma/client';
import {readExternal,type ExternalEndpoint} from '@/lib/external-connections';
import {revalidatePath} from 'next/cache';
import {rackMutation} from '@/lib/rack-mutation';
import {networkPorts,portUsed,portCompatibility,NETWORK_CABLE_TYPES} from '@/lib/network-ports';

export type NetworkInput={fromDeviceId:string;toDeviceId:string;fromPort:string;toPort:string;cableType:string;label:string;reviewed:boolean;lengthValue?:number|null;lengthUnit?:string|null;external?:ExternalEndpoint|null};
export async function saveNetworkConnection(rackId:string,connectionId:string|null,input:NetworkInput):Promise<{ok:true;connectionId:string}|{ok:false;error:string}>{
  if(input&&!validCableLength(input.lengthValue,input.lengthUnit))return {ok:false,error:'Enter a positive cable length and choose feet or meters.'};
  if(!input||[input.fromDeviceId,input.toDeviceId,input.fromPort,input.toPort,input.cableType,input.label].some(v=>typeof v!=='string'||v.length>500)||typeof input.reviewed!=='boolean')return {ok:false,error:'Invalid cable details.'};
  const external=readExternal(input.external);
  if(input.external&&!external)return {ok:false,error:'Invalid external destination.'};
  if(external&&!input.label.trim())return {ok:false,error:'Enter the shipping cable label. Customer-site destination details can be left blank.'};
  if(external&&!input.reviewed)return {ok:false,error:'Acknowledge that the far-end specifications must be verified on site.'};
  if(!input.fromPort||(!external&&(!input.toPort||input.fromDeviceId===input.toDeviceId)))return {ok:false,error:'Choose two different devices and a port on each.'};
  if(!(NETWORK_CABLE_TYPES as readonly string[]).includes(input.cableType))return {ok:false,error:'Choose a supported cable type.'};
  let stage='opening rack transaction';
  try{
    const result=await rackMutation(rackId,async tx=>{
      stage='reading rack';
      const rack=await tx.rack.findUnique({where:{id:rackId},select:{projectId:true}});
      if(!rack)return {error:'Rack not found.'};
      stage='reading equipment';
      let devices=await tx.deviceInstance.findMany({where:{rackId,id:{in:external?[input.fromDeviceId]:[input.fromDeviceId,input.toDeviceId]}},include:{catalogDevice:true}});
      if(devices.length!==(external?1:2))return {error:'Choose installed equipment in this rack.'};
      // Serialize catalog changes with endpoint validation; lock order is deterministic.
      stage='locking equipment';
      for(const id of [...new Set(devices.map(d=>d.catalogDeviceId))].sort())await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${id}`}, 0))::text`;
      devices=await tx.deviceInstance.findMany({where:{rackId,id:{in:external?[input.fromDeviceId]:[input.fromDeviceId,input.toDeviceId]}},include:{catalogDevice:true}});
      stage='reading existing cables';
      const connections=await tx.connection.findMany({where:{fromDevice:{rackId},OR:[{toDevice:{rackId}},{toDeviceId:null}]}});
      const previous=connectionId?connections.find(c=>c.id===connectionId):undefined;
      if(connectionId&&!previous)return {error:'Cable no longer exists in this rack.'};
      if(previous?.cableType==='Power')return {error:'Manage power cords in Power layout.'};
      const from=networkPorts(devices.find(d=>d.id===input.fromDeviceId)?.catalogDevice.rawData).find(p=>p.id===input.fromPort);
      const to=networkPorts(devices.find(d=>d.id===input.toDeviceId)?.catalogDevice.rawData).find(p=>p.id===input.toPort);
      if(!from||(!external&&!to))return {error:'A selected port is missing. Update equipment specifications or reload.'};
      if(portUsed(connections,input.fromDeviceId,input.fromPort,connectionId??undefined)||(!external&&portUsed(connections,input.toDeviceId,input.toPort,connectionId??undefined)))return {error:'A selected port is already connected. Choose an available port.'};
      const check=portCompatibility(from,external?{...from,lane:undefined,parentId:undefined,protocol:'',connector:'',speedGbps:0,reviewed:false}:to!,input.cableType);
      if(check.error)return {error:check.error};
      if(check.warnings.length&&!input.reviewed)return {error:'Review the connection warnings and acknowledge them before saving.'};
      const data={lengthValue:input.lengthValue??null,lengthUnit:input.lengthUnit??null,fromDeviceId:input.fromDeviceId,toDeviceId:external?null:input.toDeviceId,external:external?{...external}:Prisma.DbNull,fromPort:input.fromPort,toPort:external?null:input.toPort,cableType:input.cableType,label:input.label.trim()||null};
      stage='writing cable';
      const saved=connectionId?await tx.connection.update({where:{id:connectionId},data}):await tx.connection.create({data});
      stage='saving history and committing';
      return {projectId:rack.projectId,connectionId:saved.id};
    });
    if('error' in result)return {ok:false,error:result.error!};
    stage='refreshing page';
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return {ok:true,connectionId:result.connectionId};
  }catch(error){
    const detail=error as {name?:string;code?:string;message?:string};
    const code=typeof detail?.code==='string'&&/^[A-Z0-9_]{2,30}$/.test(detail.code)?detail.code:'UNEXPECTED';
    const reference=crypto.randomUUID().slice(0,8);
    // Never print connection URLs, credentials, or the submitted cable payload.
    const message=String(detail?.message||'Unknown error').replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"']+/gi,'[redacted URL]').slice(-1800);
    console.error('[network-cable-save]',JSON.stringify({reference,stage,code,name:detail?.name,message}));
    return {ok:false,error:`Cable save failed during ${stage} (${code}; reference ${reference}). Your entries are preserved.`};
  }
}
