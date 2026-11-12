'use client';
import {APDU11350_WHIP_DOWN,apdu11350Bank} from '@/lib/apc-apdu11350';
import {outletDestination} from '@/lib/connection-highlights';
import type {ComponentProps} from 'react';
import type {ApcPduPanel} from './apc-pdu-panel';

// A separate Gen 2 panel keeps the existing 40-outlet APC artwork unchanged.
export function Apdu11350Panel({devices,outlets,assignments,disabled,onOutlet,deviceId,networkHref,ports=[],connected=[]}:ComponentProps<typeof ApcPduPanel>){
 function group(index:number){return <div className="apc-socket-bank apdu11350-socket-group" key={index}>{APDU11350_WHIP_DOWN[index].map(n=>{
  const o=outlets.find(v=>v.n===n);if(!o)return null;
  const bank=apdu11350Bank(n)!,combo=n%2===0,used=!!assignments[n]?.deviceId;
  const label=`Outlet ${n} · ${o.type} · B${bank} · L${(bank-1)%3+1}–N · ${outletDestination(assignments[n],devices)}`;
  return <button type="button" key={n} disabled={disabled} data-power-pdu={deviceId} data-power-outlet={n} data-breaker={bank} data-phase={(bank-1)%3+1} data-assigned={used} data-combo={combo} aria-label={label} title={label} onPointerDown={e=>e.stopPropagation()} onClick={()=>onOutlet?.(o)}>
   <span className="apc-socket-number">{n}</span><svg viewBox="0 0 28 32" aria-hidden="true"><path d={combo?'M2 2H26V30H2Z':'M7 2H21L26 7V30H2V7Z'} fill="currentColor" stroke="#a9b5bd"/>{combo?<path d="M11 6h6v3h-2v8h-3V9h-1zM5 21h4v-4h3v10H5zM16 17h3v4h4v6h-7z" fill="#d8e1e6"/>:<path d="M14 7v7M7 20v6M21 20v6" stroke="#d8e1e6" strokeWidth="3"/>}</svg><i className="apc-status-dot"/>
  </button>;
 })}</div>;}
 return <div className="apc-pdu-panel apdu11350-panel" role="group" aria-label="APC APDU11350ME · 48 outlets · whip down">
  <div className="apc-model-label">APC<small>APDU11350ME</small></div>
  <div className="apc-bank-stack">{[0,1,2,3,4,5].map(group)}</div>
  <div className="apc-controller-face apdu11350-controller">

   <div className="apc-management-ports">{ports.filter(p=>p.position==='mgmt').map(p=><a key={p.id} aria-disabled={disabled} tabIndex={disabled?-1:0} data-connected={connected.includes(p.id)} aria-label={`${p.name} · Ethernet · ${connected.includes(p.id)?'Connected':'Available'}`} href={!disabled&&networkHref?`${networkHref}&fromDeviceId=${encodeURIComponent(deviceId)}&fromPort=${encodeURIComponent(p.id)}`:undefined} onPointerDown={e=>e.stopPropagation()}><svg viewBox="0 0 28 26" aria-hidden="true"><rect x="1" y="1" width="26" height="24" rx="1" fill="#10211e" stroke="#a7bdb5"/><path d="M5 5H23V18H18V22H10V18H5Z" fill="#080e13" stroke="#71877f"/>{[7,9,11,13,15,17,19,21].map(x=><path key={x} d={`M${x} 5v4`} stroke="#bea665"/>)}<circle className="apc-network-led" cx="24" cy="3" r="2"/></svg><span>LAN</span></a>)}</div>
   <div className="apdu11350-service-ports" aria-label="Two sensor ports and two PDU link ports; not Ethernet LAN ports">{['S1','L1','S2','L2'].map(name=><span key={name}><i/>{name}</span>)}</div>
   <div className="apc-usb-face"><span/>USB / console</div><div className="apc-controls"><i/><i/><i/></div><div className="apc-display-face">NMC3</div><strong>APC</strong><br/><small>415 V · 3φ · 24 A</small>
  </div>
  <div className="apc-bank-stack">{[6,7,8,9,10,11].map(group)}</div>
  <div className="apdu11350-breakers" role="group" aria-label="Six single-pole 20 A breakers; handle positions are illustrative">{[5,6,3,4,1,2].map(n=><div key={n} data-phase={(n-1)%3+1}><i/><span>B{n}<small>L{(n-1)%3+1}–N</small></span></div>)}</div>
  <div className="apc-whip-end"><span/>WHIP ↓</div>
 </div>;
}
