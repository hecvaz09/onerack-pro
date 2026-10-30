'use client';
import type {NetworkPort} from '@/lib/network-ports';
export function RaritanController({deviceId,href,ports=[],connected=[],disabled}:{deviceId?:string;href?:string;ports?:NetworkPort[];connected?:string[];disabled?:boolean}){
 return <div className="pdu-controller raritan-controller" aria-label="Raritan controller">
  <strong>Raritan</strong>
  <div className="raritan-service" aria-label="Sensor and console connectors"><span><b className="raritan-service-socket"/>SENSOR</span><span><b className="raritan-console"/>CONSOLE</span></div>
  <div className="raritan-usb" aria-label="USB A and USB B connectors"><span>▰ ▰</span><span>▣</span><small>USB</small></div>
  <div className="raritan-ethernet">{ports.filter(p=>p.position==='mgmt').map(p=><a key={p.id} data-connected={connected.includes(p.id)} aria-disabled={disabled} tabIndex={disabled?-1:0} aria-label={`ETH${p.number} · ${connected.includes(p.id)?'Connected':'Available'}`} href={!disabled&&href&&deviceId?`${href}&fromDeviceId=${encodeURIComponent(deviceId)}&fromPort=${encodeURIComponent(p.id)}`:undefined} onPointerDown={e=>e.stopPropagation()}><svg viewBox="0 0 28 26" aria-hidden="true"><rect x="1" y="1" width="26" height="24" rx="1" fill="#101b22" stroke="#a4b2bd"/><path d="M5 5H23V18H18V22H10V18H5Z" fill="#070d12" stroke="#738895"/>{[7,9,11,13,15,17,19,21].map(x=><path key={x} d={`M${x} 5v4`} stroke="#baa56f"/>)}<circle cx="24" cy="3" r="2" className="raritan-link-led"/></svg><span>ETH{p.number}</span></a>)}</div>
  <div className="raritan-screen" aria-label="Controller display"/>
  <div className="raritan-buttons" aria-hidden="true"><span>▲</span><span>●</span><span>▼</span><span>×</span></div>
 </div>;
}
