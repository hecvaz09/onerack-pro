'use server';
import {cookies,headers} from 'next/headers';
import {prisma} from '@/lib/prisma';
import {authEnabled,SESSION_COOKIE,validSession} from '@/lib/login-session';
import {explainRack,isAssistantTopic} from '@/lib/rack-assistant';
import {classifyRackQuestion} from '@/lib/rack-assistant-provider';

export async function askRackAssistant(projectId:string,rackId:string,request:{topic?:string;question?:string}):Promise<{text:string;checkedAt:string}|{error:string}>{
  if(authEnabled()){
    if(!validSession((await cookies()).get(SESSION_COOKIE)?.value))return {error:'Sign in again to review this rack.'};
  }else if(process.env.NODE_ENV==='production'||!['localhost:3001','127.0.0.1:3001'].includes((await headers()).get('host')||''))return {error:'Sign in is required for the rack assistant.'};
  if(typeof projectId!=='string'||typeof rackId!=='string'||projectId.length>200||rackId.length>200||!request||typeof request!=='object')return {error:'Choose a valid rack and topic.'};
  if(!isAssistantTopic(request.topic)&&(typeof request.question!=='string'||!request.question.trim()||request.question.length>2000))return {error:'Choose a topic or enter a question of up to 2,000 characters.'};
  try{
    // Current deployment has a shared authenticated workspace, not company isolation.
    const rack=await prisma.rack.findFirst({where:{id:rackId,projectId,trashedAt:null,project:{trashedAt:null}},include:{devices:{include:{catalogDevice:true},orderBy:{startRU:'asc'}}}});
    if(!rack)return {error:'This rack no longer exists in the selected project.'};
    const topic=isAssistantTopic(request.topic)?request.topic:await classifyRackQuestion(request.question!);
    // Re-read after the potentially slow provider call to avoid explaining stale wiring.
    const fresh=isAssistantTopic(request.topic)?rack:await prisma.rack.findFirst({where:{id:rackId,projectId,trashedAt:null,project:{trashedAt:null}},include:{devices:{include:{catalogDevice:true},orderBy:{startRU:'asc'}}}});
    if(!fresh)return {error:'This rack no longer exists.'};
    return {text:explainRack(topic,fresh.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details})),fresh.configuration),checkedAt:new Date().toISOString()};
  }catch(error){return {error:error instanceof Error&&/AI |allowance|topic|question/.test(error.message)?error.message:'Could not read the latest rack data. No changes were made.'};}
}
