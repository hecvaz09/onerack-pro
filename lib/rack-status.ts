import {isPocket} from './onerack-layout.ts';
export type StatusDevice={id:string;startRU:number;mounting:string;label:string|null;catalogDevice:{id?:string;model:string;heightRU:number;category:string|null;nodeNames?:string[]}};
export function rackSpaceStatus(height:number,pockets:boolean,devices:StatusDevice[]){
 const occupied=new Set<number>(),pocketPositions=new Set<number>();
 for(const d of devices){
  const target=isPocket(height,d.startRU,pockets)?pocketPositions:occupied;
  for(let n=d.startRU;n<d.startRU+d.catalogDevice.heightRU;n++)if(target===pocketPositions?n<=60:n>=1&&n<=height)target.add(n);
 }
 let longest=0,span=0;
 for(let n=1;n<=height;n++){span=occupied.has(n)?0:span+1;longest=Math.max(longest,span);}
 const groups=new Map<string,{name:string;count:number;positions:string[]}>();
 for(const d of devices){
  const key=d.catalogDevice.id||d.catalogDevice.model,g=groups.get(key)||{name:d.catalogDevice.model,count:0,positions:[]};
  g.count++;g.positions.push(d.catalogDevice.heightRU===0?d.mounting.replace('rear-','').replaceAll('-',' '):`${isPocket(height,d.startRU,pockets)?'Pocket ': 'U'}${d.startRU}${d.catalogDevice.heightRU>1?`–${d.startRU+d.catalogDevice.heightRU-1}`:''}`);groups.set(key,g);
 }
 return {used:occupied.size,free:height-occupied.size,longest,pockets:pocketPositions.size,groups:[...groups.values()],nodes:devices.reduce((n,d)=>n+(d.catalogDevice.nodeNames?.length||(['chassis','server'].includes(d.catalogDevice.category||'')?1:0)),0)};
}
