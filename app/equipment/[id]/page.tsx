import {connection} from 'next/server';
import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {readSystemSpecs,emptySystemSpecs} from '@/lib/system-specs';
import {catalogRevision} from '@/lib/catalog-revision';
import {EquipmentEditor} from '../equipment-editor';
export default async function EquipmentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{copy?:string}>}){
  await connection();const {id}=await params,{copy}=await searchParams;const isNew=id==='new';
  const device=(!isNew||copy)?await prisma.catalogDevice.findUnique({where:{id:isNew?copy!:id},include:{_count:{select:{instances:true}}}}):null;
  if((!isNew||copy)&&!device)notFound();
  return <EquipmentEditor modelRaw={device?.rawData} key={`${id}:${device?catalogRevision(device):''}`} id={isNew?null:id} revision={device&&!isNew?catalogRevision(device):''} installed={!isNew?device?._count.instances??0:0} initial={device?{sku:isNew?`${device.sku}-COPY`:device.sku,vendor:device.vendor,model:device.model,heightRU:device.heightRU,category:device.category||'chassis',specs:{...readSystemSpecs(device.rawData),...(isNew?{status:'draft' as const}:{})}}:{sku:'',vendor:'',model:'',heightRU:1,category:'chassis',specs:emptySystemSpecs()}}/>;
}
