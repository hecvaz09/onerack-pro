import {supportedNetworkSpeeds} from './network-speeds.ts';
import {externalName} from './external-connections.ts';
import {breakoutPortNumbers,BREAKOUT_CABLE} from './network-breakout.ts';
import { readSystemSpecs } from './system-specs.ts';
import {reviewedComponentField} from './component-review.ts';

export type NetworkPort = { id:string; name:string; protocol:string; connector:string; speedGbps:number|null; supportedSpeedsGbps?:number[]; reviewed:boolean; slot?:number; node?:string; aiom?:number; endpoint?:string; position?:'mgmt'|'lan'|'switch-data'; number?:number; parentId?:string; lane?:number; parentEndpoint?:string };
export function adapterSlots(value:string,quantity:number):number[]{
  const clean=value.trim().replace(/^PCIe\s*/i,'').replace(/^slots?\s*/i,'');
  const range=clean.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  const numbers=range?Array.from({length:Math.max(0,Math.min(64,Number(range[2])-Number(range[1])+1))},(_,i)=>Number(range[1])+i):clean.split(',').map(s=>Number(s.trim().replace(/^(?:PCIe\s*)?slot\s*/i,'')));
  return numbers.length===quantity&&new Set(numbers).size===quantity&&numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=64)?numbers:[];
}
export type PortConnection = { id:string; fromDeviceId:string; toDeviceId:string|null; external?:unknown; fromPort?:string|null; toPort?:string|null };
export const NETWORK_CABLE_TYPES = [BREAKOUT_CABLE,'DAC','Fiber','Fiber (SFP28/QSFP28)','Cat6/Cat6a','Other'] as const;

// IDs depend on the component identity and numbered instances, never its label or list order.
export function networkPorts(raw:unknown):NetworkPort[] {
  const specs=readSystemSpecs(raw), result:NetworkPort[]=[];
  for(const c of specs.components.filter(c=>c.kind==='network')){
    const count=Number(c.attributes.ports);
    if(!Number.isInteger(count)||count<1||count>512||count*c.quantity+result.length>4096)continue;
    const firstPort=Number(c.attributes.startPort)||1;
    const portBase=c.attributes.portNumberBase==='0'?0:1;
    const slots=adapterSlots(c.attributes.slot||'',c.quantity),mgmt=/^(BMC|MGMT|Management)$/i.test(c.attributes.slot||''),lan=/^onboard$/i.test(c.attributes.slot||''),front=/^front$/i.test(c.attributes.slot||'');
    for(let card=1;card<=c.quantity;card++)for(let port=1;port<=count;port++)result.push({
      id:JSON.stringify([c.id,card,port]),name:slots.length?`Slot${slots[card-1]} · P${port-1+portBase}`:mgmt?(count===1?'MGMT':`MGMT-P${port}`):lan?`LAN${(card-1)*count+port}`:`${c.model}${c.quantity>1?` #${card}`:''} · Port ${front?firstPort+port-1:port}`,
      slot:slots[card-1],number:front?firstPort+port-1:slots.length?port-1+portBase:port,...(mgmt?{position:'mgmt' as const}:lan?{position:'lan' as const}:front?{position:'switch-data' as const}:{}),
      endpoint:slots.length?`Slot${slots[card-1]}-P${port-1+portBase}`:mgmt?(count===1?'MGMT':`MGMT-P${port}`):lan?`LAN${(card-1)*count+port}`:undefined,
      protocol:c.attributes.protocol||'',connector:c.attributes.connector||'',speedGbps:Number(c.attributes.speedGbps)||null,...(c.attributes.supportedSpeedsGbps?{supportedSpeedsGbps:supportedNetworkSpeeds(c.attributes.supportedSpeedsGbps)||[]}:{}),reviewed:['ports','protocol','connector'].every(key=>!!reviewedComponentField(specs,c,key))&&!!(reviewedComponentField(specs,c,'speedGbps')||reviewedComponentField(specs,c,'supportedSpeedsGbps')),
    });
  }
  // Component IDs remain unchanged; node names qualify physical endpoints for tracing.
  for(const port of result){
    const component=specs.components.find(c=>c.id===JSON.parse(port.id)[0]);
    if(component?.id==='raritan-mgmt'&&port.position==='mgmt'){port.name=`ETH${port.number}`;port.endpoint=`ETH${port.number}`;}
    const node=(component?.attributes.node||'').trim().replace(/^Node\s*/i,'');
    const match=(component?.attributes.slot||'').match(/^AIOM\s*([12])$/i);
    if(match){port.aiom=Number(match[1]);port.name=`AIOM${port.aiom} · P${port.number}`;port.endpoint=`AIOM${port.aiom}-P${port.number}`;}
    if(node){port.node=node;port.name=`Node ${node} · ${port.name}`;if(port.endpoint)port.endpoint=`Node${node}-${port.endpoint}`;}
  }
  return result.flatMap<NetworkPort>(port=>{
    const component=specs.components.find(c=>c.id===JSON.parse(port.id)[0]);
    const selected=breakoutPortNumbers(component?.attributes.breakoutPorts||'')||[];
    if(port.position!=='switch-data'||!selected.includes(port.number||0))return [port];
    return [1,2,3,4].map(lane=>({...port,id:JSON.stringify([...JSON.parse(port.id),lane]),parentId:port.id,lane,parentEndpoint:`P${port.number}`,endpoint:`P${port.number}-${lane}`,name:`P${port.number}-${lane} · breakout leg ${lane}/4 · 25 Gb/s`,speedGbps:25,...(port.supportedSpeedsGbps?{supportedSpeedsGbps:[25]}:{}),connector:'SFP28'}));
  });
}
export function networkEndpoint(ru:number,category:string|null,port:NetworkPort){
  const suffix=port.endpoint||(category==='switch'&&port.position==='switch-data'&&port.number?`P${port.number}`:null);
  return suffix?`U${String(ru).padStart(2,'0')}-${suffix}`:null;
}
export function cableEndpointLabel(a:{startRU:number;category:string|null;port:NetworkPort},b:{startRU:number;category:string|null;port:NetworkPort}){
  const first=networkEndpoint(a.startRU,a.category,a.port),second=networkEndpoint(b.startRU,b.category,b.port);
  if(!first||!second)return '';
  return a.category!=='switch'&&b.category==='switch'?`${second} | ${first}`:`${first} | ${second}`;
}
export function portName(raw:unknown,id?:string|null){return id?networkPorts(raw).find(p=>p.id===id)?.name||'Port no longer in configuration':'Unmapped port';}
export function portUsed(connections:PortConnection[],deviceId:string,portId:string,excluding?:string){
  return connections.some(c=>c.id!==excluding&&((c.fromDeviceId===deviceId&&c.fromPort===portId)||(c.toDeviceId===deviceId&&c.toPort===portId)));
}
const normalized=(v:string)=>v.trim().toLowerCase().replace(/[\s-]/g,'');
export function portCompatibility(a:NetworkPort,b:NetworkPort,cableType:string):{error?:string;warnings:string[]} {
  const warnings:string[]=[];
  const known=(v:string)=>v&&v!=='Other';
  const legs=[a,b].filter(p=>p.lane);
  if(legs.length){
    if(cableType!==BREAKOUT_CABLE)return {error:'Choose the 100G to 4x25G breakout cable for this leg.',warnings};
    if(legs.length!==1)return {error:'Connect each breakout leg to a node port, not another breakout leg.',warnings};
    const peer=a.lane?b:a;
    if(peer.speedGbps&&peer.speedGbps!==25)return {error:'A 25G breakout leg requires a 25G node port. Configure the actual supported port speed first.',warnings};
    if(!peer.speedGbps&&peer.supportedSpeedsGbps?.length&&!peer.supportedSpeedsGbps.includes(25))return {error:'This adapter does not list 25G support for a breakout leg.',warnings};
    if(peer.protocol&&peer.protocol!=='Ethernet')return {error:'This breakout requires an Ethernet node port.',warnings};
  }else if(cableType===BREAKOUT_CABLE)return {error:'Select one configured breakout leg on the production switch.',warnings};
  if(known(a.protocol)&&known(b.protocol)&&a.protocol!==b.protocol)return {error:`${a.protocol} and ${b.protocol} cannot connect directly.`,warnings};
  if(!known(a.protocol)||!known(b.protocol))warnings.push('Protocol is unspecified.');
  if(a.speedGbps&&b.speedGbps&&a.speedGbps!==b.speedGbps)warnings.push('Port speeds differ; verify a supported common link speed.');
  if(!a.speedGbps||!b.speedGbps)warnings.push('Link speed is unspecified.');
  if(!a.connector||!b.connector)warnings.push('Connector details are missing.');
  else if(normalized(a.connector)!==normalized(b.connector))warnings.push('Connector types differ; verify the exact cable or transceiver combination.');
  if(!a.reviewed||!b.reviewed)warnings.push('Equipment specifications are draft.');
  if(cableType==='Cat6/Cat6a'&&[a,b].some(p=>(known(p.protocol)&&p.protocol!=='Ethernet')||(p.connector&&normalized(p.connector)!=='rj45')))return {error:'Cat6/Cat6a requires Ethernet RJ45 ports.',warnings};
  if(['DAC','Fiber','Fiber (SFP28/QSFP28)'].includes(cableType)&&[a,b].some(p=>normalized(p.connector)==='rj45'))return {error:'This cable type cannot connect directly to an RJ45 port.',warnings};
  if(!cableType||cableType==='Other')warnings.push('Cable type needs review.');
  return {warnings};
}
export function networkShape(raw:unknown){return JSON.stringify(networkPorts(raw).map(({id,protocol,connector,speedGbps,supportedSpeedsGbps,node,aiom})=>({id,protocol,connector,speedGbps,...(supportedSpeedsGbps?{supportedSpeedsGbps}:{}),...(node?{node}:{}),...(aiom?{aiom}:{})})).sort((a,b)=>a.id.localeCompare(b.id)));}


// Automatic labels are derived, so moving equipment cannot leave stale RU identifiers.
type CableDevice={startRU:number;catalogDevice:{category:string|null;rawData:unknown}};
export function resolvedCableLabel(c:{label:string|null;fromPort?:string|null;toPort?:string|null;fromDevice:CableDevice;toDevice:CableDevice|null;external?:unknown}){
  if(c.label)return c.label;
  if(!c.toDevice){const a=networkPorts(c.fromDevice.catalogDevice.rawData).find(p=>p.id===c.fromPort);return `${a?networkEndpoint(c.fromDevice.startRU,c.fromDevice.catalogDevice.category,a)||a.name:"Unmapped port"} | ${externalName(c.external)}`;}
  const a=networkPorts(c.fromDevice.catalogDevice.rawData).find(p=>p.id===c.fromPort),b=networkPorts(c.toDevice.catalogDevice.rawData).find(p=>p.id===c.toPort);
  return a&&b?cableEndpointLabel({startRU:c.fromDevice.startRU,category:c.fromDevice.catalogDevice.category,port:a},{startRU:c.toDevice.startRU,category:c.toDevice.catalogDevice.category,port:b}):'';
}
