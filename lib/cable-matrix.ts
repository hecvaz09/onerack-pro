import {cableLength,type CableLength} from './cable-length.ts';
import {externalName,externalStatus} from './external-connections.ts';
import {networkEndpoint,type NetworkPort,type PortConnection} from './network-ports.ts';
export type MatrixDevice={id:string;name:string;startRU:number;category:string|null;ports:NetworkPort[]};
export type MatrixCable=PortConnection&CableLength&{cableType:string|null;label:string|null};
export type MatrixRow={id:string;length?:string;port:string;number:number;equipment:string;endpoint:string;label:string;type:string;connected:boolean;href:string;parentPort:string;headLabel:string;status?:string};
export function buildCableMatrix<T extends MatrixCable>(devices:MatrixDevice[],connections:T[],basePath:string){
 const covered=new Set<string>();
 const byId=new Map(devices.map(d=>[d.id,d]));
 const sections=devices.filter(d=>d.category==='switch').sort((a,b)=>a.startRU-b.startRU).map(device=>{
  const rows:MatrixRow[]=device.ports.flatMap<MatrixRow>(port=>{
   const matches=connections.filter(c=>(c.fromDeviceId===device.id&&c.fromPort===port.id)||(c.toDeviceId===device.id&&c.toPort===port.id));
   const source=networkEndpoint(device.startRU,device.category,port)||`U${device.startRU} / ${port.name}`;
   const parentPort=port.lane?`U${String(device.startRU).padStart(2,'0')}-${port.parentEndpoint}`:'';
   const head={parentPort,headLabel:parentPort};
   const href=`${basePath}?tab=network&fromDeviceId=${encodeURIComponent(device.id)}&fromPort=${encodeURIComponent(port.id)}`;
   if(!matches.length)return [{...head,id:port.id,port:source,number:port.position==='mgmt'?-1:(port.number||0)*10+(port.lane||0),equipment:'',endpoint:'',label:'',type:port.connector,connected:false,href}];
   return matches.map(c=>{covered.add(c.id);const from=c.fromDeviceId===device.id&&c.fromPort===port.id;const peer=byId.get((from?c.toDeviceId:c.fromDeviceId)||'');const peerPort=peer?.ports.find(p=>p.id===(from?c.toPort:c.fromPort));const endpoint=c.external?externalName(c.external):peer&&peerPort?networkEndpoint(peer.startRU,peer.category,peerPort)||peerPort.name:'Port not mapped';
    return {...head,id:`${port.id}:${c.id}`,port:source,number:port.position==='mgmt'?-1:(port.number||0)*10+(port.lane||0),length:cableLength(c),status:externalStatus(c.external),equipment:c.external?externalName(c.external):peer?.name||'Unknown equipment',endpoint,label:c.label||`${source} | ${endpoint}`,type:c.cableType||'Unspecified',connected:true,href};});
  });
  for(const row of rows){
   if(row.parentPort){
    const endpoints=[...new Set(rows.filter(r=>r.parentPort===row.parentPort&&r.connected).sort((a,b)=>a.number-b.number).map(r=>r.endpoint))];
    row.headLabel=[row.parentPort,...endpoints].join('\n');
   }else row.headLabel=row.label||row.port;
  }
  return {id:device.id,name:device.name,ru:device.startRU,breakoutHeads:new Set(device.ports.filter(p=>p.lane).map(p=>p.parentId)).size,breakoutLegs:device.ports.filter(p=>p.lane).length,rows};
 });
 const other=connections.filter(c=>!covered.has(c.id));
 const additional=other.map(c=>{
  const local=byId.get(c.fromDeviceId),peer=byId.get(c.toDeviceId||'');
  const localPort=local?.ports.find(p=>p.id===c.fromPort),peerPort=peer?.ports.find(p=>p.id===c.toPort);
  const source=local&&localPort?networkEndpoint(local.startRU,local.category,localPort)||localPort.name:`${local?.name||'Unknown equipment'} / Port not mapped`;
  const endpoint=c.external?externalName(c.external):peer&&peerPort?networkEndpoint(peer.startRU,peer.category,peerPort)||peerPort.name:`${peer?.name||'Unknown equipment'} / Port not mapped`;
  return {id:c.id,port:source,number:local?.startRU||0,equipment:c.external?externalName(c.external):peer?.name||'Unknown equipment',endpoint,label:c.label||`${source} | ${endpoint}`,type:c.cableType||'Unspecified',length:cableLength(c),connected:true,parentPort:'',headLabel:'',status:externalStatus(c.external),
   href:`${basePath}?tab=network&fromDeviceId=${encodeURIComponent(c.fromDeviceId)}&fromPort=${encodeURIComponent(c.fromPort||'')}`} satisfies MatrixRow;
 });
 const allSections=[...sections,...(additional.length?[{id:'external-other',name:'External / other network cables',ru:0,breakoutHeads:0,breakoutLegs:0,rows:additional}]:[])];
 return {sections,other,allSections};
}
