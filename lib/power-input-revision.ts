import type {Prisma} from '@/generated/prisma/client';
import {createHash} from 'node:crypto';
import {canonicalPowerValue} from './power-input-state';
type RevisionDevice={id:string;catalogDeviceId?:string;startRU?:number;mounting?:string;label?:string|null;details?:unknown;catalogDevice?:{id?:string;sku?:string;vendor?:string;model?:string;heightRU?:number;category?:string|null;rawData?:unknown}};
export type PowerRevisionRack={name?:string;heightRU?:number;configuration:unknown;updatedAt?:Date|string;devices:RevisionDevice[]};
export function powerInputsRevision(rackId:string,rack:PowerRevisionRack){
 const snapshot={rackId,name:rack.name,heightRU:rack.heightRU,configuration:rack.configuration,updatedAt:rack.updatedAt instanceof Date?rack.updatedAt.toISOString():rack.updatedAt,devices:rack.devices.map(d=>({id:d.id,catalogDeviceId:d.catalogDeviceId,startRU:d.startRU,mounting:d.mounting,label:d.label,details:d.details,catalogDevice:d.catalogDevice&&{id:d.catalogDevice.id,sku:d.catalogDevice.sku,vendor:d.catalogDevice.vendor,model:d.catalogDevice.model,heightRU:d.catalogDevice.heightRU,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData}})).sort((a,b)=>a.id.localeCompare(b.id))};
 return createHash('sha256').update(canonicalPowerValue(snapshot)).digest('hex');
}
export function matchesPowerInputsRevision(expected:unknown,rackId:string,rack:PowerRevisionRack){return typeof expected==='string'&&/^[a-f0-9]{64}$/.test(expected)&&expected===powerInputsRevision(rackId,rack);}

// Caller already holds the rack lock. Use the Library's existing lock order so
// a model edit cannot race the inherited-PSU/profile comparison and input write.
export async function lockedPowerInputRack(tx:Prisma.TransactionClient,rackId:string){
 const first=await tx.rack.findUnique({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
 if(!first)return null;
 for(const id of [...new Set(first.devices.map(device=>device.catalogDeviceId))].sort())await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${id}`}, 0))::text`;
 return tx.rack.findUnique({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
}
