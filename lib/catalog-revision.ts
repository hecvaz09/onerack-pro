import {createHash} from 'node:crypto';
export function catalogRevision(device:{sku:string;vendor:string;model:string;heightRU:number;category:string|null;rawData:unknown}){
  return createHash('sha256').update(JSON.stringify([device.sku,device.vendor,device.model,device.heightRU,device.category,device.rawData])).digest('hex');
}
