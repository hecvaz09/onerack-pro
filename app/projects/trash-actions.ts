"use server";
import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/prisma';
import {authEnabled,authReady,validSession,SESSION_COOKIE} from '@/lib/login-session';
import {projectTrashInputError,setProjectTrash} from '@/lib/project-lifecycle';
export async function changeProjectTrash(projectId:string,expectedName:string,trash:boolean):Promise<{ok:true;destination:string}|{ok:false;error:string}>{
 const error=projectTrashInputError(projectId,expectedName,trash);if(error)return {ok:false,error};
 try{
  if(authEnabled()){
   if(!authReady()||!validSession((await cookies()).get(SESSION_COOKIE)?.value))return {ok:false,error:'Sign in again to manage project Trash.'};
  }else if(process.env.NODE_ENV==='production')return {ok:false,error:'Sign in is required to manage project Trash.'};
  // The current application is one shared authenticated workspace. This does
  // not introduce per-user ownership or permanently delete any related rows.
  const result=await prisma.$transaction(tx=>setProjectTrash(tx,projectId,expectedName,trash),{maxWait:10000,timeout:30000});
  if(result.ok){
   // The lifecycle change is already committed. A cache failure must not turn
   // it into a reported failed deletion; the client performs a full Projects navigation.
   try{revalidatePath('/projects');if(!trash)revalidatePath(`/projects/${projectId}`,'layout');}catch{/* Full navigation reloads uncached project queries. */}
  }
  return result;
 }catch{return {ok:false,error:'Could not confirm the Trash change. Project data is preserved. Open Projects to check its status before trying again.'};}
}
