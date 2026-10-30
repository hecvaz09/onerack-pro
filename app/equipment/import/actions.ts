'use server';
import {createHash} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {parseTestBom} from '@/lib/bom-import';
import {revalidatePath} from 'next/cache';

export async function importTestBom(source:string):Promise<{ok:true;id:string;existing:boolean}|{ok:false;error:string}>{
  try{
    const {bom,racks}=parseTestBom(source);
    const digest=createHash('sha256').update(JSON.stringify(bom)).digest('hex').slice(0,24),id=`bom-test-${digest}`;
    const result=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))::text`;
      const existing=await tx.project.findUnique({where:{id}});if(existing)return {ok:true as const,id,existing:true};
      const catalogIds=new Map<string,string>();
      for(const [index,c] of bom.configurations.entries()){
        const catalogId=`${id}-config-${index}`;catalogIds.set(c.sku,catalogId);
        await tx.catalogDevice.create({data:{id:catalogId,sku:`TEST-${digest}-${index}`,vendor:c.vendor,model:`[TEST] ${c.model}`,heightRU:c.heightRU,category:c.category,
          rawData:JSON.parse(JSON.stringify({systemSpecs:c.specs,bomImport:{testOnly:true,sourceSku:c.sku},...(c.pduModel?{model:c.pduModel}:{})}))}});
      }
      const configs=new Map(bom.configurations.map(c=>[c.sku,c]));
      await tx.project.create({data:{id,name:`[TEST] ${bom.project}`,customer:bom.customer,notes:'Synthetic BOM import. Component specifications and demand budgets are test assumptions. No cables have been created.',
        racks:{create:racks.map((name,i)=>{
          const items=bom.placements.filter(p=>p.rack===name).map((p,j)=>({...p,id:`${id}-r${i}-d${j}`}));
          const budgets=Object.fromEntries(items.flatMap(p=>configs.get(p.sku)?.power?[[p.id,configs.get(p.sku)!.power]]:[]));
          return {name,heightRU:48,configuration:JSON.parse(JSON.stringify({profile:'rnr-60-pockets',pockets:true,pduA:true,pduB:true,bomTest:true,px3Power:{voltage:400,pf:.975,inputLimit:80,reserveDedicated:false,supplyConfirmed:false,budgets}})),
            devices:{create:items.map(p=>({id:p.id,label:p.label,startRU:p.startRU,mounting:p.mounting,catalogDeviceId:catalogIds.get(p.sku)!}))}};
        })}}});
      return {ok:true as const,id,existing:false};
    },{timeout:60000});
    revalidatePath('/projects');revalidatePath('/equipment');return result;
  }catch(e){return {ok:false,error:e instanceof Error&&!('code' in e)?e.message:'Import failed. No partial project was saved. Try again.'};}
}
