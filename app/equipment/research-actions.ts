"use server";
import {headers} from 'next/headers';
import {runCatalogResearch} from '@/lib/catalog-research-provider';
import type {ResearchIdentity,ResearchReport} from '@/lib/catalog-research';
export async function researchEquipment(identity:ResearchIdentity):Promise<{ok:true;report:ResearchReport;cached:boolean}|{ok:false;error:string}>{
  const host=(await headers()).get('host')||'';
  if(process.env.NODE_ENV==='production'||!/^localhost:3001$|^127\.0\.0\.1:3001$/.test(host))return {ok:false,error:'AI research is available only in this local development app.'};
  try{return {ok:true,...await runCatalogResearch(identity)};}catch(error){return {ok:false,error:error instanceof Error?error.message:'Research could not complete. No catalog data changed.'};}
}
