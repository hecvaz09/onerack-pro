import { cableEndpointLabel, networkEndpoint, portCompatibility, portUsed, NETWORK_CABLE_TYPES, type NetworkPort, type PortConnection } from './network-ports.ts';

export type PatternDevice = {id:string;name:string;startRU:number;category:string|null;catalogId:string;ports:NetworkPort[]};
export type PatternConnection = PortConnection & {lengthValue?:number|null;lengthUnit?:string|null;cableType:string|null;label:string|null};
export type PatternOptions = {sourceId:string;targetIds:string[];order:'descending'|'ascending';direction:-1|1;labelTemplate:string};
export type PatternRow = {targetId:string;targetName:string;sourcePort:string;switchName:string;switchPort:string;label:string;state:'add'|'keep'|'conflict';message:string;warnings:string[];data?:{fromDeviceId:string;fromPort:string;toDeviceId:string;toPort:string;cableType:string;label:string|null}};
function family(port:NetworkPort) {
  try { const id=JSON.parse(port.parentId||port.id); return JSON.stringify(id.slice(0,2)); } catch { return port.position||''; }
}
export function patternState(devices:PatternDevice[],connections:PatternConnection[]) {
  function canonical(value:unknown):unknown {
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
    return value;
  }
  return JSON.stringify(canonical({devices:[...devices].sort((a,b)=>a.id.localeCompare(b.id)),connections:[...connections].sort((a,b)=>a.id.localeCompare(b.id))}));
}
export function planCablingPattern(devices:PatternDevice[],connections:PatternConnection[],options:PatternOptions):{rows:PatternRow[];errors:string[];notes:string[]} {
  const rows:PatternRow[]=[],errors:string[]=[],notes:string[]=[];
  const source=devices.find(d=>d.id===options.sourceId);
  if(!source||source.category!=='chassis')return {rows,errors:['Choose an installed chassis as the template.'],notes};
  if(![1,-1].includes(options.direction)||!['descending','ascending'].includes(options.order))return {rows,errors:['Choose valid chassis and switch-port directions.'],notes};
  if(options.labelTemplate.length>400||/\{(?!switch\}|device\}|n\})[^}]*\}/.test(options.labelTemplate))return {rows,errors:['Labels support {switch}, {device}, and {n}; use no more than 400 characters.'],notes};
  const targetIds=new Set(options.targetIds);
  const targets=devices.filter(d=>targetIds.has(d.id)).sort((a,b)=>(options.order==='descending'?-1:1)*(a.startRU-b.startRU)||a.id.localeCompare(b.id));
  if(!targets.length||targets.length!==targetIds.size||targets.some(d=>d.id===source.id||d.catalogId!==source.catalogId))return {rows,errors:['Select other chassis with the same equipment model.'],notes};
  const cables=connections.filter(c=>c.cableType!=='Power'&&(c.fromDeviceId===source.id||c.toDeviceId===source.id));
  const template=cables.flatMap(c=>{
    const forward=c.fromDeviceId===source.id;
    const sw=devices.find(d=>d.id===(forward?c.toDeviceId:c.fromDeviceId));
    const chassisPort=source.ports.find(p=>p.id===(forward?c.fromPort:c.toPort));
    const switchPort=sw?.ports.find(p=>p.id===(forward?c.toPort:c.fromPort));
    if(!sw||sw.category!=='switch'||!chassisPort||!switchPort||switchPort.position!=='switch-data'||!switchPort.number){notes.push('A template connection is not a mapped switch data port and will not be repeated.');return [];}
    return [{c,sw,chassisPort,switchPort,key:sw.id+'|'+family(switchPort)}];
  }).sort((a,b)=>a.key.localeCompare(b.key)||a.chassisPort.id.localeCompare(b.chassisPort.id));
  if(!template.length)return {rows,errors:['Connect this chassis to its switches first, then use it as the template.'],notes};
  if(new Set(template.map(t=>t.chassisPort.id)).size!==template.length)return {rows,errors:['The template has duplicate connections on a chassis port. Correct these before repeating it.'],notes};
  if(template.some(t=>t.c.label))notes.push('New labels are generated from endpoints or your label formula; custom template labels are not copied verbatim.');
  const occupied:PortConnection[]=[...connections];
  targets.forEach((target,index)=>{
    for(const entry of template){
      const {sw,chassisPort,switchPort,c,key}=entry;
      const numbers=template.filter(t=>t.key===key).map(t=>t.switchPort.number!);
      const step=Math.max(...numbers)-Math.min(...numbers)+1;
      const number=switchPort.number!+options.direction*step*(index+1);
      const next=sw.ports.find(p=>family(p)===family(switchPort)&&p.number===number&&p.lane===switchPort.lane&&p.position==='switch-data');
      const peer=target.ports.find(p=>p.id===chassisPort.id);
      const row:PatternRow={targetId:target.id,targetName:target.name,sourcePort:chassisPort.name,switchName:sw.name,switchPort:next?.endpoint||`P${number}${switchPort.lane?'-'+switchPort.lane:''}`,label:'',state:'add',message:'',warnings:[]};
      rows.push(row);
      const existing=connections.find(link=>(link.fromDeviceId===target.id&&link.fromPort===chassisPort.id)||(link.toDeviceId===target.id&&link.toPort===chassisPort.id));
      if(existing){
        const forward=existing.fromDeviceId===target.id;
        const other=devices.find(d=>d.id===(forward?existing.toDeviceId:existing.fromDeviceId));
        const otherPort=other?.ports.find(p=>p.id===(forward?existing.toPort:existing.fromPort));
        row.switchName=other?.name||'Existing endpoint';row.switchPort=otherPort?.endpoint||otherPort?.name||'Unmapped';
        row.state='keep';row.message='Existing connection kept; no changes.';continue;
      }
      if(!peer||!next){row.state='conflict';row.message=!peer?'Chassis port is missing.':'No matching switch port at this position. Change the direction or template.';continue;}
      if(portUsed(occupied,sw.id,next.id)){row.state='conflict';row.message='Switch port is already occupied. No cables will be overwritten.';continue;}
      if(!(NETWORK_CABLE_TYPES as readonly string[]).includes(c.cableType||'')){row.state='conflict';row.message='Choose a supported cable type on the template connection.';continue;}
      const check=portCompatibility(next,peer,c.cableType!);row.warnings=check.warnings;
      if(check.error){row.state='conflict';row.message=check.error;continue;}
      const from={startRU:sw.startRU,category:sw.category,port:next},to={startRU:target.startRU,category:target.category,port:peer};
      const switchLabel=networkEndpoint(sw.startRU,sw.category,next)||`${sw.name} / ${next.name}`,deviceLabel=networkEndpoint(target.startRU,target.category,peer)||`${target.name} / ${peer.name}`;
      row.label=options.labelTemplate.trim()?options.labelTemplate.replace(/\{(switch|device|n)\}/g,(_,token)=>token==='switch'?switchLabel:token==='device'?deviceLabel:String(index+2)):cableEndpointLabel(from,to);
      if(row.label.length>500){row.state='conflict';row.message='Generated label is longer than 500 characters.';continue;}
      row.data={fromDeviceId:sw.id,fromPort:next.id,toDeviceId:target.id,toPort:peer.id,cableType:c.cableType!,label:options.labelTemplate.trim()?row.label:null};
      occupied.push({id:`planned-${rows.length}`,...row.data});
    }
  });
  if(rows.length>4096)errors.push('Select fewer chassis; a batch supports up to 4,096 connections.');
  return {rows,errors,notes:[...new Set(notes)]};
}
