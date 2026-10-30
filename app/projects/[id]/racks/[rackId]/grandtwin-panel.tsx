'use client';
import {useHardwareMaterials} from './hardware-materials';
 
import {HardwareLabel} from './hardware-label';
import type {NetworkPort} from '@/lib/network-ports';

export function GrandTwinPanel({face,ports,connected,psus=[],psuDescription,href,deviceId,onNode,disabled=false,rack=false}:{face:'front'|'rear';ports:NetworkPort[];connected:string[];psus?:number[];psuDescription?:(inlet:number)=>string;href?:string;deviceId:string;onNode?:(name:string)=>void;disabled?:boolean;rack?:boolean}){
 const materials=useHardwareMaterials(["#31494e"]);
 const positions=[{node:'D',x:0,y:32},{node:'B',x:380,y:32},{node:'C',x:0,y:87},{node:'A',x:380,y:87}];
 function socket(p:NetworkPort,x:number,y:number,w:number,h:number){
  const used=connected.includes(p.id);
  return <a data-connected={used} key={p.id} aria-label={`${p.name} · ${used?'Connected':'Available'}`} href={!disabled&&href?`${href}&fromDeviceId=${encodeURIComponent(deviceId)}&fromPort=${encodeURIComponent(p.id)}`:undefined} onPointerDown={e=>e.stopPropagation()}>
   <rect x={x} y={y} width={w} height={h} rx="1" fill={used?'var(--primary)':'#18262f'} stroke={used?'var(--primary)':'#b9c8cf'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
   {p.position==='mgmt'?<><path d={`M${x+3} ${y+3}h${w-6}v${h-7}h-4v3h-${w-14}v-3h-4Z`} fill={used?'#284138':'#080f15'} stroke="#9baeb9" strokeWidth=".6"/>{Array.from({length:8},(_,i)=><rect key={i} x={x+4+i*(w-8)/8} y={y+3} width="1" height="4" fill="#bdad7a"/>)}</>:<path d={`M${x+3} ${y+4}h${w-6}m-${w-6} 4h${w-6}`} stroke={used?'#101b22':'#b9c8cf'}/>}
   {p.aiom&&<HardwareLabel x={x+w/2} y={y+h-2} textAnchor="middle" fill={used?'#101b22':'#e3edf2'} fontSize="7">P{p.number}</HardwareLabel>}
  </a>;
 }
 const nodeZones=face==='rear'?positions.map(p=>({...p,x:p.x+198,y:p.y-1,w:174,h:53})):[{node:'B',x:22,y:30,w:375,h:53},{node:'D',x:402,y:30,w:375,h:53},{node:'A',x:22,y:84,w:375,h:56},{node:'C',x:402,y:84,w:375,h:56}];
 return <div className="grandtwin-panel"><svg viewBox={rack?'22 30 756 110':'0 0 800 160'} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`GrandTwin ${face} nodes and connections`}>{materials.defs}
 <image style={rack?{clipPath:'inset(18.75% 2.75% 12.5%)'}:undefined} href={`/equipment-artwork/smc-grandtwin-${face}.svg`} x="0" y="0" width="800" height="160" preserveAspectRatio="xMidYMid meet"/>
 {onNode&&nodeZones.map(({node,x,y,w,h})=><g key={node} className="grandtwin-node-hit" role="button" tabIndex={disabled?-1:0} aria-label={`Open Node ${node}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>!disabled&&onNode(`Node ${node}`)} onKeyDown={e=>{if(!disabled&&['Enter',' '].includes(e.key)){e.preventDefault();onNode(`Node ${node}`);}}}><rect x={x} y={y} width={w} height={h} fill="transparent" stroke="transparent" strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>)}
 {face==='rear'&&[2,1].map(n=><a className="face-connection-overlays psu-hit" href={rack?"#power-connection":undefined} data-psu-device={deviceId} data-psu-inlet={n} onPointerDown={e=>e.stopPropagation()} data-connected={psus.includes(n)} key={`psu${n}`} aria-label={psuDescription?.(n)||`PSU ${n} · ${psus.includes(n)?"Connected":"Not connected"}`}><title>{psuDescription?.(n)||`PSU ${n} · ${psus.includes(n)?"Connected":"Not connected"}`}</title><rect className="connection-socket" x={(n===2?33:413)-(rack?3:0)} y={rack?94:97} width={rack?27:21} height={rack?36:30} rx="2"/><circle className="connection-led" cx={n===2?50:430} cy="101" r="2"/></a>)}
 {face==='rear'&&positions.map(({node,x,y})=><g key={node}>
  {ports.filter(p=>p.node===node&&p.position==='mgmt').map(p=>socket(p,x+345,y+7,20,19))}
  {[2,1].map(slot=>{const configured=ports.filter(p=>p.node===node&&p.aiom===slot);const sy=y+(slot===2?2:27);return <g key={slot}>{configured.length>0&&<><rect x={x+203} y={sy} width="132" height="21" rx="1" fill={materials.fill("#31494e")} stroke="#8da8b5"/><HardwareLabel x={x+210} y={sy+14} fontSize="9" fill="#e7edf0">{node} · AIOM{slot}</HardwareLabel></>}{configured.map((p,i)=>socket(p,x+274+i*(64/Math.max(1,configured.length)),sy+2,Math.min(22,64/Math.max(1,configured.length)-8),17))}</g>;})}
 </g>)}
 </svg></div>;
}
