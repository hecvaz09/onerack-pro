import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

type Write={where:{id:string};data:Record<string,unknown>};
type Options={device?:unknown;pdus?:unknown[];rack?:unknown;failUpdate?:boolean};
const bundles=new Map<string,Promise<string>>();
async function bundle(file:string){
 let result=bundles.get(file);
 if(!result){result=build({entryPoints:[resolve(file)],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'isolated-action-adapters',setup(b){
  b.onResolve({filter:/^(next\/cache|@\/lib\/(rack-mutation|prisma|rack-history))$/},args=>({path:args.path,namespace:'action-mock'}));
  b.onLoad({filter:/.*/,namespace:'action-mock'},args=>({contents:args.path==='next/cache'?'export const revalidatePath=(path)=>__mocks.revalidatePath(path);':args.path==='@/lib/rack-mutation'?'export const rackMutation=(id,mutate)=>__mocks.rackMutation(id,mutate);':args.path==='@/lib/prisma'?'export const prisma=__mocks.prisma;':'export const replayRackChange=()=>{throw Error("Unexpected history replay in metadata test")};',loader:'js'}));
 }}]}).then(r=>r.outputFiles![0].text);bundles.set(file,result);}
 return result;
}
export async function actionHarness(options:Options={}){
 const updates:Write[]=[],rackUpdates:Write[]=[],deletions:string[]=[],paths:string[]=[],events:string[]=[];
 let currentRack=options.rack?structuredClone(options.rack) as Record<string,unknown>:null;
 const tx={$queryRaw:async()=>[],deviceInstance:{
  findFirst:async(input:{where:{id?:string}})=>{if(options.device)return options.device;const devices=(currentRack?.devices||[]) as {id:string}[];const d=devices.find(d=>d.id===input.where.id);return d?{...d,rack:currentRack}:null;},findMany:async()=>options.pdus??[],
  update:async(input:Write)=>{events.push('update:'+input.where.id);if(options.failUpdate)throw Error('Synthetic write failure');updates.push(structuredClone(input));if(currentRack&&Array.isArray(currentRack.devices))currentRack={...currentRack,devices:currentRack.devices.map((d:{id:string})=>d.id===input.where.id?{...d,...structuredClone(input.data)}:d)};return input;},
  delete:async(input:{where:{id:string}})=>{events.push('delete:'+input.where.id);deletions.push(input.where.id);return input;},
 },rack:{findUnique:async()=>currentRack,findUniqueOrThrow:async()=>{if(!currentRack)throw Error("Synthetic rack missing");return currentRack;},update:async(input:Write)=>{rackUpdates.push(structuredClone(input));currentRack={...currentRack,...structuredClone(input.data)};return currentRack;}}};
 const mocks={revalidatePath:(path:string)=>paths.push(path),rackMutation:async(id:string,mutate:(transaction:typeof tx)=>Promise<unknown>)=>{events.push('rackMutation:'+id);return mutate(tx);},prisma:{$transaction:()=>{throw Error('Unexpected direct database transaction');}}};
 const load=async(file:string)=>{const loadedModule={exports:{}};new Function('module','exports','require','__mocks',await bundle(file))(loadedModule,loadedModule.exports,createRequire(import.meta.url),mocks);return loadedModule.exports;};
 const actions=await load('app/projects/[id]/racks/[rackId]/actions.ts') as typeof import('../../app/projects/[id]/racks/[rackId]/actions.ts');
 const power=await load('app/projects/[id]/racks/[rackId]/power-actions.ts') as typeof import('../../app/projects/[id]/racks/[rackId]/power-actions.ts');
 const visual=await load('app/projects/[id]/racks/[rackId]/visual-power-actions.ts') as typeof import('../../app/projects/[id]/racks/[rackId]/visual-power-actions.ts');
 const feed=await load('app/projects/[id]/racks/[rackId]/feed-power-actions.ts') as typeof import('../../app/projects/[id]/racks/[rackId]/feed-power-actions.ts');
 return {actions,power,visual,feed,updates,rackUpdates,deletions,paths,events,snapshot:()=>structuredClone(currentRack)};
}
export function deepFreeze<T>(value:T):T{
 if(value&&typeof value==='object'){for(const item of Object.values(value))deepFreeze(item);Object.freeze(value);}
 return value;
}
