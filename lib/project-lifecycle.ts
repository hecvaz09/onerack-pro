import type {Prisma} from '@/generated/prisma/client';
export const PROJECT_IN_TRASH='This project is in Trash. Restore it from Projects before making changes.';
export const activeProjectWhere={trashedAt:null} as const;
export const projectTrashDestination=(trash:boolean)=>trash?'/projects?notice=project-trashed':'/projects?notice=project-restored';
export function projectTrashInputError(id:unknown,name:unknown,trash:unknown){return typeof id!=='string'||!id.trim()||id.length>200||typeof name!=='string'||!name||name.length>5000||typeof trash!=='boolean'?'Invalid project selection.':null;}
// Project lifecycle takes an exclusive lock; normal rack work takes a shared
// project lock before its existing rack lock. Distinct racks can still edit concurrently.
export async function requireActiveProject(tx:Prisma.TransactionClient,projectId:string){
 if(typeof projectId!=='string'||!projectId.trim()||projectId.length>200)throw new Error('Project not found.');
 await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`project:${projectId}`},0))::text`;
 const project=await tx.project.findUnique({where:{id:projectId},select:{id:true,trashedAt:true}});
 if(!project)throw new Error('Project not found.');
 if(project.trashedAt)throw new Error(PROJECT_IN_TRASH);
 return project;
}
export async function requireActiveProjectForRack(tx:Prisma.TransactionClient,rackId:string){
 const rack=await tx.rack.findUnique({where:{id:rackId},select:{projectId:true}});
 if(!rack)throw new Error('Rack not found.');
 await requireActiveProject(tx,rack.projectId);
}
export async function setProjectTrash(tx:Prisma.TransactionClient,id:string,expectedName:string,trash:boolean){
 const error=projectTrashInputError(id,expectedName,trash);if(error)return {ok:false as const,error};
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`project:${id}`},0))::text`;
 const project=await tx.project.findUnique({where:{id},select:{id:true,name:true,trashedAt:true}});
 if(!project)return {ok:false as const,error:'Project no longer exists. Return to Projects.'};
 if(project.name!==expectedName)return {ok:false as const,error:'The project name changed. Refresh and confirm the current project.'};
 if(Boolean(project.trashedAt)!==trash)await tx.project.update({where:{id},data:{trashedAt:trash?new Date():null}});
 return {ok:true as const,destination:projectTrashDestination(trash)};
}
