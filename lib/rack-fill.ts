import {mountingError} from './rack-mounting.ts';
import type {OccupiedDevice} from './rack-validation.ts';
export function planRackFill(rackHeight:number,heightRU:number,category:string|null,mounting:string,devices:(OccupiedDevice & {mounting:string})[],options:{pockets:boolean}) {
 if(!Number.isSafeInteger(heightRU)||heightRU<1)return [];
 const occupied=[...devices];
 const positions:number[]=[];
 for(let ru=1;ru+heightRU-1<=rackHeight;ru++){
  if(!mountingError(rackHeight,ru,heightRU,category,mounting,occupied,undefined,options)){
   positions.push(ru);occupied.push({id:`fill:${ru}`,startRU:ru,heightRU,mounting,name:'New equipment'});
  }
 }
 return positions;
}
