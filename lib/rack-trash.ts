import type {Prisma} from '@/generated/prisma/client';
import {requireActiveProject} from '@/lib/project-lifecycle';
export const TRASHED_RACK_MESSAGE='This rack is in Trash. Restore it from the project before making changes.';
export const rackTrashDestination=(projectId:string,trash:boolean)=>`/projects/${encodeURIComponent(projectId)}?notice=${trash?'rack-trashed':'rack-restored'}`;
export function rackTrashInputError(projectId:unknown,rackId:unknown,name:unknown,heightRU:unknown,trash:unknown){return typeof projectId!=='string'||!projectId.trim()||projectId.length>200||typeof rackId!=='string'||!rackId.trim()||rackId.length>200||typeof name!=='string'||!name.trim()||name.length>5000||typeof heightRU!=='number'||!Number.isInteger(heightRU)||heightRU<1||typeof trash!=='boolean'?'Invalid rack selection.':null;}
// Called only after the same exclusive rack lock used by every rack write.
export async function requireActiveRack(tx:Prisma.TransactionClient,rackId:string){
 const rack=await tx.rack.findUnique({where:{id:rackId},select:{trashedAt:true}});
 if(!rack)throw new Error('Rack not found.');
 if(rack.trashedAt)throw new Error(TRASHED_RACK_MESSAGE);
}
export async function setRackTrash(tx:Prisma.TransactionClient,projectId:string,rackId:string,name:string,heightRU:number,trash:boolean){
 const error=rackTrashInputError(projectId,rackId,name,heightRU,trash);if(error)return {ok:false as const,error};
 // Preserve global lock order: shared project -> exclusive rack -> catalog.
 await requireActiveProject(tx,projectId);
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${rackId}, 0))::text`;
 const rack=await tx.rack.findUnique({where:{id:rackId},select:{id:true,projectId:true,name:true,heightRU:true,trashedAt:true}});
 if(!rack||rack.projectId!==projectId)return {ok:false as const,error:'Rack not found in this project.'};
 if(rack.name!==name||rack.heightRU!==heightRU)return {ok:false as const,error:'This rack changed. Refresh the project and confirm its current name and size.'};
 if(Boolean(rack.trashedAt)!==trash)await tx.rack.update({where:{id:rackId},data:{trashedAt:trash?new Date():null}});
 return {ok:true as const,destination:rackTrashDestination(projectId,trash)};
}
