'use client';
import type {PsuStatus} from '@/lib/psu-connection-status';
import {useHardwareMaterials} from './hardware-materials';
import {HardwareLabel} from './hardware-label';
import type {NetworkPort} from '@/lib/network-ports';
import {HardwareFan} from './hardware-fan';

// Relative geometry from Supermicro MNL-2832 rear-view figure; not a scale drawing.
export function ServerRearPanel({ports,connected,psus=[],psuStatus,psuDescription,href,deviceId}:{ports:NetworkPort[];connected:string[];psus?:number[];psuStatus?:(inlet:number)=>PsuStatus|undefined;psuDescription?:(inlet:number)=>string;href?:string;deviceId:string}){
 const materials=useHardwareMaterials(["#101820", "#111a21", "#19232b", "#202b33", "#29363f", "#35424b"]);
  function socket(p:NetworkPort,x:number,y:number,sideLabel=false){const used=connected.includes(p.id);return <a data-connected={used} key={p.id} href={href?`${href}&fromDeviceId=${encodeURIComponent(deviceId)}&fromPort=${encodeURIComponent(p.id)}`:undefined} aria-label={`${p.name} · ${used?'Connected':'Available'}`} onPointerDown={e=>e.stopPropagation()}><rect x={x} y={y} width="46" height="27" rx="3" fill={used?'var(--primary)':'#131c24'} stroke={used?'var(--primary)':'#b4bdc5'} strokeWidth="2"/><path d={`M${x+8} ${y+8}h30m-30 6h30`} stroke={used?'#142028':'#b4bdc5'} strokeWidth="2"/><HardwareLabel x={sideLabel?x+55:x+23} y={sideLabel?y+19:y+41} textAnchor={sideLabel?"start":"middle"} fill="currentColor" fontSize="18">{p.position==='mgmt'?'MGMT':p.position==='lan'?p.name:`P${p.number}`}</HardwareLabel></a>;}
  return <div className="server-rear-panel"><svg preserveAspectRatio="none" viewBox="0 0 800 440" role="group" aria-label="AS-8126GS-TNMR rear panel schematic">{materials.defs}
    <rect x="2" y="2" width="796" height="436" rx="6" fill={materials.fill("#202b33")} stroke="#93a0a9"/>
    {Array.from({length:5},(_,i)=><g key={i}><rect x={12+i*157} y="12" width="148" height="83" rx="4" fill={materials.fill("#111a21")} stroke="#77848d"/><HardwareFan x={86+i*157} y={53} r={32}/></g>)}
    {[{x:12,y:106},{x:208,y:106},{x:404,y:106},{x:600,y:106},{x:12,y:196},{x:600,y:196}].map((p,i)=><a key={i} href="#power-connection" data-psu-device={deviceId} data-psu-inlet={i+1} onPointerDown={e=>e.stopPropagation()} aria-label={psuDescription?.(i+1)||`PSU ${i+1} · ${psus.includes(i+1)?"Connected":"Not connected"}`} data-psu-state={psuStatus?.(i+1)?.state} data-connected={psus.includes(i+1)} className="rear-psu psu-hit"><title>{psuDescription?.(i+1)||`PSU ${i+1} · ${psus.includes(i+1)?"Connected":"Not connected"}`}</title><rect {...p} width="184" height="80" rx="4" fill={materials.fill("#35424b")} stroke="#87949b"/><rect x={p.x+9} y={p.y+19} width="30" height="40" className="psu-inlet" fill={materials.fill("#101820")}/><circle cx={p.x+115} cy={p.y+40} r="29" fill={materials.fill("#19232b")} stroke="#6d7c85"/><HardwareLabel x={p.x+115} y={p.y+45} textAnchor="middle" fontSize="18" fill="#bec8d0">PSU {i+1}</HardwareLabel></a>)}
    <rect x="12" y="294" width="155" height="134" fill={materials.fill("#29363f")} stroke="#87949b"/>
    {ports.filter(p=>p.position==='lan').slice(0,2).map((p,i)=>socket(p,22,300+i*43,true))}{ports.filter(p=>p.position==='mgmt').slice(0,1).map(p=>socket(p,22,386,true))}
    {[8,7,6,5,4,3,2,1].map((slot,i)=>{const installed=ports.filter(p=>p.slot===slot),x=178+i*76;return <g key={slot}><rect x={x} y="294" width="68" height="134" fill={installed.length?'#334b49':'#29363f'} stroke={installed.length?'var(--primary)':'#87949b'}/><HardwareLabel x={x+34} y="317" textAnchor="middle" fill="currentColor" fontSize="20">Slot{slot}</HardwareLabel>{installed.slice(0,2).map((p,j)=>socket(p,x+11,325+j*49))}</g>;})}
  </svg></div>;
}
