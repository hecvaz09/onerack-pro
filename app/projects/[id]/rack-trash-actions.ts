"use server";
import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/prisma';
import {authEnabled,authReady,validSession,SESSION_COOKIE} from '@/lib/login-session';
import {rackTrashInputError,setRackTrash} from '@/lib/rack-trash';
export async function changeRackTrash(projectId:string,rackId:string,name:string,heightRU:number,trash:boolean):Promise<{ok:true;destination:string}|{ok:false;error:string}>{
 const error=rackTrashInputError(projectId,rackId,name,heightRU,trash);if(error)return {ok:false,error};
 try{
  if(authEnabled()){
   if(!authReady()||!validSession((await cookies()).get(SESSION_COOKIE)?.value))return {ok:false,error:'Sign in again to manage rack Trash.'};
  }else if(process.env.NODE_ENV==='production')return {ok:false,error:'Sign in is required to manage rack Trash.'};
  const result=await prisma.$transaction(tx=>setRackTrash(tx,projectId,rackId,name,heightRU,trash),{maxWait:10000,timeout:30000});
  if(result.ok){try{revalidatePath(`/projects/${projectId}`);if(!trash)revalidatePath(`/projects/${projectId}/racks/${rackId}`,'layout');}catch{/* The committed operation is followed by full navigation to the uncached rack list. */}}
  return result;
 }catch{return {ok:false,error:'Could not confirm the rack Trash change. Its data is preserved. Refresh the project to check its status before trying again.'};}
}
