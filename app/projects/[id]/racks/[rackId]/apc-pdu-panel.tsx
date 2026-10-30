'use client';
import {apcOutletBreaker} from '@/lib/apc-outlet-bank';
import {outletDestination} from '@/lib/connection-highlights';
import type {RackGridDevice} from './physical-rack-grid';
import type {NetworkPort} from '@/lib/network-ports';
import type {Outlet,OutletAssignment} from '@/lib/equipment-details';
export function ApcPduPanel({devices,outlets,assignments,disabled,onOutlet,deviceId,networkHref,ports=[],connected=[]}:{devices:RackGridDevice[];deviceId:string;networkHref?:string;ports?:NetworkPort[];connected?:string[];outlets:Outlet[];assignments:Record<string,OutletAssignment>;disabled?:boolean;onOutlet?:(outlet:Outlet)=>void}){
 const groups=[0,1,2,3,4].map(g=>outlets.filter(o=>Math.floor((40-o.n)/8)===g).sort((a,b)=>Math.floor((40-a.n)/2)-Math.floor((40-b.n)/2)||(b.n%2)-(a.n%2)));
 function bank(g:number){return <div className="apc-socket-bank" key={g}>{groups[g].map(o=>{const used=!!assignments[o.n]?.deviceId;return <button key={o.n} type="button" data-power-pdu={deviceId} data-power-outlet={o.n} disabled={disabled} data-breaker={apcOutletBreaker(o.n)} data-assigned={used} data-combo={o.type.includes("C19")} aria-label={`Outlet ${o.n} · ${o.type} · B${apcOutletBreaker(o.n)} · ${outletDestination(assignments[o.n],devices)}`} title={`P${o.n} · ${o.type} · B${apcOutletBreaker(o.n)} · ${outletDestination(assignments[o.n],devices)}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>onOutlet?.(o)}><span className="apc-socket-number">{o.n}</span><svg viewBox="0 0 24 28" aria-hidden="true"><path d={o.type.includes("C19")?"M2 2H22V26H2Z":"M5 2H19L22 6V26H2V6Z"} fill="currentColor" stroke="#a9b5bd"/><path d="M12 7v5M7 16v5M17 16v5" stroke="#d8e1e6" strokeWidth="2.5"/></svg><i className="apc-status-dot"/></button>;})}</div>;}
 return <div className="apc-pdu-panel" role="group" aria-label="APC APDU10151ME outlets · whip down">
   <div className="apc-model-label">APC<small>APDU10151ME</small></div>
   <div className="apc-bank-stack">{[0,1,2].map(bank)}</div>
   <div className="apc-controller-face"><strong>APC</strong><div className="apc-display-face">Meter</div><div className="apc-controls"><i/><i/><i/></div>
    <div className="apc-usb-face" aria-hidden="true"><span/>USB</div>
    <div className="apc-management-ports">{ports.filter(p=>p.position==='mgmt').map(p=><a key={p.id} aria-disabled={disabled} tabIndex={disabled?-1:0} data-connected={connected.includes(p.id)} aria-label={`${p.name} · ${connected.includes(p.id)?'Connected':'Available'}`} href={!disabled&&networkHref?`${networkHref}&fromDeviceId=${encodeURIComponent(deviceId)}&fromPort=${encodeURIComponent(p.id)}`:undefined} onPointerDown={e=>e.stopPropagation()}><svg viewBox="0 0 28 26" aria-hidden="true"><rect x="1" y="1" width="26" height="24" rx="1" fill="#10211e" stroke="#a7bdb5"/><path d="M5 5H23V18H18V22H10V18H5Z" fill="#080e13" stroke="#71877f"/>{[7,9,11,13,15,17,19,21].map(x=><path key={x} d={`M${x} 5v4`} stroke="#bea665"/>)}<circle className="apc-network-led" cx="24" cy="3" r="2"/></svg><span>{p.name.replace('MGMT-','')}</span></a>)}</div>
    <small>208 V · 24 A</small></div>
   <div className="apc-bank-stack">{[3,4].map(bank)}</div>
   <div className="apc-breaker-bank" role="group" aria-label="Circuit breakers: B1 gray receptacles, B2 black receptacles; breaker state unverified">
    {[2,1].map(n=><svg key={n} viewBox="0 0 70 48" role="img" aria-label={`Breaker B${n}`}><rect x="1" y="1" width="68" height="46" rx="2" fill={n===1?'#a7afb4':'#202a31'} stroke="#65727b"/><circle cx="7" cy="7" r="2" fill="#152027"/><circle cx="63" cy="41" r="2" fill="#152027"/><rect x="12" y="7" width="23" height="34" rx="2" fill="#080e12" stroke="#64737d"/><path d="M16 15h15M16 33h15" stroke="#a4b0b8" strokeWidth="2"/><rect x="16" y="21" width="15" height="6" rx="1" fill="#4a5862"/><text x="50" y="30" textAnchor="middle" fontSize="16" fontWeight="700" fill={n===1?'#17222b':'#e1e7eb'}>B{n}</text></svg>)}
   </div>
   <div className="apc-breaker-key"><span>B1 · Gray</span><span>B2 · Black</span></div>
   <div className="apc-whip-end"><span/>WHIP ↓</div>
 </div>;
}
