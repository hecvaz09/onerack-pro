import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import type {LibraryNetworkLink} from '../../lib/network-library-update.ts';

export type CatalogRecord={id:string;sku:string;vendor:string;model:string;heightRU:number;category:string;rawData:Record<string,unknown>};
let bundled:Promise<string>|undefined;
function bundle(){
 return bundled??=build({entryPoints:[resolve('app/equipment/actions.ts')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'catalog-action-adapters',setup(b){
  b.onResolve({filter:/^(next\/cache|@\/lib\/prisma)$/},args=>({path:args.path,namespace:'catalog-mock'}));
  b.onLoad({filter:/.*/,namespace:'catalog-mock'},args=>({contents:args.path==='next/cache'?'export const revalidatePath=__mocks.revalidatePath;':'export const prisma=__mocks.prisma;',loader:'js'}));
 }}]}).then(result=>result.outputFiles![0].text);
}
export async function catalogActionHarness(initial:CatalogRecord[],links:LibraryNetworkLink[]=[]){
 const records=new Map(initial.map(record=>[record.id,structuredClone(record)])),writes:CatalogRecord[]=[],paths:string[]=[],reads:string[]=[];
 let connectionReads=0;
 const tx={$queryRaw:async()=>[],catalogDevice:{
  findUnique:async({where}:{where:{id:string}})=>{reads.push(where.id);return structuredClone(records.get(where.id)||null);},
  create:async({data}:{data:Omit<CatalogRecord,'id'>})=>{const record=structuredClone({id:`duplicate-${writes.length+1}`,...data});records.set(record.id,record);writes.push(record);return record;},
  update:async({where,data}:{where:{id:string};data:Omit<CatalogRecord,'id'>})=>{const record=structuredClone({id:where.id,...data});records.set(record.id,record);writes.push(record);return record;},
 },connection:{findMany:async()=>{connectionReads++;return structuredClone(links);}}};
 const mocks={prisma:{$transaction:async(fn:(client:typeof tx)=>Promise<unknown>)=>fn(tx)},revalidatePath:(path:string)=>paths.push(path)};
 const loaded={exports:{}};
 new Function('module','exports','require','__mocks',await bundle())(loaded,loaded.exports,createRequire(import.meta.url),mocks);
 const actions=loaded.exports as typeof import('../../app/equipment/actions');
 return {actions,writes,reads,paths,records,connectionReads:()=>connectionReads,reload:(id:string)=>structuredClone(records.get(id)!)};
}
