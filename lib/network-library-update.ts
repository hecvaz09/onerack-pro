import {networkPorts,portCompatibility,type NetworkPort} from './network-ports.ts';
function preservesPort(p:NetworkPort,n:NetworkPort|undefined){return !!n&&
 ['node','aiom','slot','endpoint','position','number','parentId','lane','parentEndpoint'].every(k=>p[k as keyof NetworkPort]===n[k as keyof NetworkPort])&&
 (!p.protocol||p.protocol==='Other'||p.protocol===n.protocol)&&(!p.connector||p.connector===n.connector||p.connector==='QSFP'&&n.connector==='QSFP28')&&(!p.speedGbps||p.speedGbps===n.speedGbps)&&(!p.supportedSpeedsGbps?.length||p.supportedSpeedsGbps.every(v=>n.supportedSpeedsGbps?.includes(v)));
}
// Filling unknown capabilities must not renumber, remove or relocate endpoints,
// nor overwrite a capability already used to plan a saved connection.
export function isNetworkEnrichment(before:unknown,after:unknown){
 const old=networkPorts(before),next=networkPorts(after);
 if(next.length<old.length||new Set(next.map(p=>p.id)).size!==next.length)return false;
 // A newly documented interface may be appended. Resizing an existing port
 // group/card population still changes its topology and requires a variant.
 const component=(id:string)=>JSON.parse(id)[0] as string;
 for(const id of new Set(old.map(p=>component(p.id))))if(old.filter(p=>component(p.id)===id).length!==next.filter(p=>component(p.id)===id).length)return false;
 return old.every(p=>preservesPort(p,next.find(v=>v.id===p.id)));
}
type Endpoint={catalogDeviceId:string;catalogDevice:{rawData:unknown}};
export type LibraryNetworkLink={fromDevice:Endpoint;toDevice:Endpoint|null;fromPort:string|null;toPort:string|null;cableType:string|null};
export function mappedNetworkChangeError(catalogId:string,before:unknown,after:unknown,links:LibraryNetworkLink[]){
 const old=networkPorts(before),next=networkPorts(after);
 const error='This configuration has mapped network cables. Existing port identities and known capabilities must be preserved. Duplicate the configuration to change them.';
 // A legacy connection without a selected port cannot be proven unaffected by
 // a topology edit. Retain the previous whole-configuration protection for it.
 const unspecified=links.some(link=>link.fromDevice.catalogDeviceId===catalogId&&!link.fromPort||link.toDevice?.catalogDeviceId===catalogId&&!link.toPort);
 if(unspecified&&!isNetworkEnrichment(before,after))return error;
 const used=new Set(links.flatMap(link=>[
  ...(link.fromDevice.catalogDeviceId===catalogId&&link.fromPort?[link.fromPort]:[]),
  ...(link.toDevice?.catalogDeviceId===catalogId&&link.toPort?[link.toPort]:[]),
 ]));
 const component=(port:NetworkPort)=>JSON.parse(port.id)[0] as string;
 for(const id of used){
  const p=old.find(port=>port.id===id);
  if(!p||!preservesPort(p,next.find(port=>port.id===id)))return error;
  // A connected card/group keeps its population, as in the original guard.
  if(old.filter(port=>component(port)===component(p)).length!==next.filter(port=>component(port)===component(p)).length)return error;
 }
 return enrichmentConnectionError(catalogId,after,links);
}
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
