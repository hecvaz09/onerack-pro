import {networkPorts,portCompatibility} from './network-ports.ts';
// Filling unknown capabilities must not renumber, remove or relocate endpoints,
// nor overwrite a capability already used to plan a saved connection.
export function isNetworkEnrichment(before:unknown,after:unknown){
 const old=networkPorts(before),next=networkPorts(after);
 if(old.length!==next.length)return false;
 return old.every(p=>{const n=next.find(v=>v.id===p.id);return !!n&&
  ['node','aiom','slot','endpoint','position','number','parentId','lane','parentEndpoint'].every(k=>p[k as keyof typeof p]===n[k as keyof typeof n])&&
  (!p.protocol||p.protocol==='Other'||p.protocol===n.protocol)&&(!p.connector||p.connector===n.connector||p.connector==='QSFP'&&n.connector==='QSFP28')&&(!p.speedGbps||p.speedGbps===n.speedGbps)&&(!p.supportedSpeedsGbps?.length||p.supportedSpeedsGbps.every(v=>n.supportedSpeedsGbps?.includes(v)));
 });
}
type Endpoint={catalogDeviceId:string;catalogDevice:{rawData:unknown}};
export type LibraryNetworkLink={fromDevice:Endpoint;toDevice:Endpoint|null;fromPort:string|null;toPort:string|null;cableType:string|null};
export function enrichmentConnectionError(catalogId:string,next:unknown,links:LibraryNetworkLink[]){
 for(const link of links){
  if(!link.toDevice||!link.fromPort||!link.toPort)continue;
  const find=(d:Endpoint,port:string,updated:boolean)=>networkPorts(updated&&d.catalogDeviceId===catalogId?next:d.catalogDevice.rawData).find(p=>p.id===port);
  const a=find(link.fromDevice,link.fromPort,true),b=find(link.toDevice,link.toPort,true);
  if(!a||!b)return 'A saved network endpoint would be removed.';
  const oldA=find(link.fromDevice,link.fromPort,false),oldB=find(link.toDevice,link.toPort,false);
  const error=portCompatibility(a,b,link.cableType||'').error;
  if(error&&(!oldA||!oldB||error!==portCompatibility(oldA,oldB,link.cableType||'').error))return `A saved network connection needs review: ${error}`;
 }
 return undefined;
}
